/**
 * Condition Node Executor
 *
 * Evaluates expressions for conditional branching.
 * Uses safe expression evaluation (no eval) with a simple parser.
 */

import type {
  ConditionNodeConfig,
  ConditionNodeOutput,
  ExecutionContext,
  NodeExecutor,
} from "./types.js";
import { NodeExecutionError } from "./types.js";

/** Variable injection pattern */
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * Execute a condition node
 *
 * @param config - Condition node configuration with expression
 * @param context - Current execution context
 * @returns Condition output with result and next handle
 */
export const executeConditionNode: NodeExecutor<ConditionNodeConfig, ConditionNodeOutput> = async (
  config,
  context,
) => {
  if (!config.expression) {
    throw new NodeExecutionError("condition", "Missing 'expression' in configuration");
  }

  // First resolve variables in the expression
  const resolvedExpression = resolveVariables(config.expression, context);

  try {
    const result = evaluateExpression(resolvedExpression);

    return {
      result: Boolean(result),
      nextHandle: result ? "true" : "false",
      evaluatedExpression: resolvedExpression,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new NodeExecutionError(
      "condition",
      `Failed to evaluate expression '${config.expression}': ${message}`,
      error as Error,
    );
  }
};

/**
 * Resolve variables in expression string
 */
function resolveVariables(expression: string, context: ExecutionContext): string {
  return expression.replace(VARIABLE_PATTERN, (match, path) => {
    const value = resolvePath(path.trim(), context);
    if (value === undefined) {
      return "undefined";
    }
    // Return appropriate JS literal representation
    if (value === null) return "null";
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "boolean") return value.toString();
    if (typeof value === "number") return value.toString();
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Resolve a dot-notation path to a value
 */
function resolvePath(path: string, context: ExecutionContext): unknown {
  const parts = path.split(".");

  // Handle prefixed paths
  if (parts[0] === "inputs") {
    return getNestedValue(context.inputs, parts.slice(1));
  }
  if (parts[0] === "nodes") {
    return getNestedValue(context.nodeOutputs, parts.slice(1));
  }
  if (parts[0] === "globals") {
    return getNestedValue(context.globalVariables, parts.slice(1));
  }

  // Unprefixed paths: check inputs first, then globals
  const inputValue = getNestedValue(context.inputs, parts);
  if (inputValue !== undefined) {
    return inputValue;
  }

  return getNestedValue(context.globalVariables, parts);
}

/**
 * Get a nested value from an object using a path array
 */
function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  if (path.length === 0) return obj;

  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Token types for expression parsing
 */
type TokenType =
  | "NUMBER"
  | "STRING"
  | "BOOLEAN"
  | "NULL"
  | "UNDEFINED"
  | "IDENTIFIER"
  | "OPERATOR"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "DOT"
  | "COMMA"
  | "EOF";

interface Token {
  type: TokenType;
  value: string | number | boolean | null;
  raw: string;
}

/**
 * Tokenize an expression string
 */
function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const char = expression[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Numbers
    if (/\d/.test(char) || (char === "-" && /\d/.test(expression[i + 1]))) {
      let numStr = "";
      if (char === "-") {
        numStr += char;
        i++;
      }
      while (i < expression.length && /[\d.]/.test(expression[i])) {
        numStr += expression[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value: parseFloat(numStr), raw: numStr });
      continue;
    }

    // Strings (single or double quoted)
    if (char === '"' || char === "'") {
      const quote = char;
      let str = "";
      i++; // Skip opening quote
      while (i < expression.length && expression[i] !== quote) {
        if (expression[i] === "\\") {
          i++;
          if (i < expression.length) {
            str += expression[i];
            i++;
          }
        } else {
          str += expression[i];
          i++;
        }
      }
      i++; // Skip closing quote
      tokens.push({ type: "STRING", value: str, raw: `${quote}${str}${quote}` });
      continue;
    }

    // Operators (multi-char first)
    const twoChar = expression.slice(i, i + 2);
    const threeChar = expression.slice(i, i + 3);

    if (threeChar === "===" || threeChar === "!==") {
      tokens.push({ type: "OPERATOR", value: threeChar, raw: threeChar });
      i += 3;
      continue;
    }

    if (
      twoChar === "==" ||
      twoChar === "!=" ||
      twoChar === ">=" ||
      twoChar === "<=" ||
      twoChar === "&&" ||
      twoChar === "||"
    ) {
      tokens.push({ type: "OPERATOR", value: twoChar, raw: twoChar });
      i += 2;
      continue;
    }

    if (char === ">" || char === "<" || char === "!" || char === "+" || char === "-") {
      tokens.push({ type: "OPERATOR", value: char, raw: char });
      i++;
      continue;
    }

    // Parentheses and brackets
    if (char === "(") {
      tokens.push({ type: "LPAREN", value: "(", raw: "(" });
      i++;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "RPAREN", value: ")", raw: ")" });
      i++;
      continue;
    }
    if (char === "[") {
      tokens.push({ type: "LBRACKET", value: "[", raw: "[" });
      i++;
      continue;
    }
    if (char === "]") {
      tokens.push({ type: "RBRACKET", value: "]", raw: "]" });
      i++;
      continue;
    }
    if (char === ".") {
      tokens.push({ type: "DOT", value: ".", raw: "." });
      i++;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "COMMA", value: ",", raw: "," });
      i++;
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(char)) {
      let ident = "";
      while (i < expression.length && /[a-zA-Z_0-9]/.test(expression[i])) {
        ident += expression[i];
        i++;
      }

      // Check for keywords
      if (ident === "true") {
        tokens.push({ type: "BOOLEAN", value: true, raw: ident });
      } else if (ident === "false") {
        tokens.push({ type: "BOOLEAN", value: false, raw: ident });
      } else if (ident === "null") {
        tokens.push({ type: "NULL", value: null, raw: ident });
      } else if (ident === "undefined") {
        tokens.push({ type: "UNDEFINED", value: null, raw: ident });
      } else {
        tokens.push({ type: "IDENTIFIER", value: ident, raw: ident });
      }
      continue;
    }

    throw new Error(`Unexpected character: ${char}`);
  }

  tokens.push({ type: "EOF", value: null, raw: "" });
  return tokens;
}

/**
 * Simple recursive descent parser for safe expression evaluation
 */
class ExpressionParser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(expression: string) {
    this.tokens = tokenize(expression);
  }

  parse(): unknown {
    const result = this.parseOr();
    if (this.current().type !== "EOF") {
      throw new Error(`Unexpected token: ${this.current().raw}`);
    }
    return result;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  private parseOr(): unknown {
    let left = this.parseAnd();

    while (this.current().value === "||") {
      this.advance();
      const right = this.parseAnd();
      left = left || right;
    }

    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseComparison();

    while (this.current().value === "&&") {
      this.advance();
      const right = this.parseComparison();
      left = left && right;
    }

    return left;
  }

  private parseComparison(): unknown {
    let left = this.parseAdditive();

    const compOps = ["===", "!==", "==", "!=", ">=", "<=", ">", "<"];
    while (compOps.includes(this.current().value as string)) {
      const op = this.advance().value as string;
      const right = this.parseAdditive();

      switch (op) {
        case "===":
          left = left === right;
          break;
        case "!==":
          left = left !== right;
          break;
        case "==":
          left = left == right;
          break;
        case "!=":
          left = left != right;
          break;
        case ">=":
          left = (left as number) >= (right as number);
          break;
        case "<=":
          left = (left as number) <= (right as number);
          break;
        case ">":
          left = (left as number) > (right as number);
          break;
        case "<":
          left = (left as number) < (right as number);
          break;
      }
    }

    return left;
  }

  private parseAdditive(): unknown {
    let left = this.parseUnary();

    while (this.current().value === "+" || this.current().value === "-") {
      const op = this.advance().value as string;
      const right = this.parseUnary();

      if (op === "+") {
        left = (left as number) + (right as number);
      } else {
        left = (left as number) - (right as number);
      }
    }

    return left;
  }

  private parseUnary(): unknown {
    if (this.current().value === "!") {
      this.advance();
      return !this.parseUnary();
    }

    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    const token = this.current();

    switch (token.type) {
      case "NUMBER":
        this.advance();
        return token.value;

      case "STRING":
        this.advance();
        return token.value;

      case "BOOLEAN":
        this.advance();
        return token.value;

      case "NULL":
        this.advance();
        return null;

      case "UNDEFINED":
        this.advance();
        return undefined;

      case "LPAREN": {
        this.advance(); // consume (
        const result = this.parseOr();
        if (this.current().type !== "RPAREN") {
          throw new Error("Expected closing parenthesis");
        }
        this.advance(); // consume )
        return result;
      }

      case "LBRACKET": {
        // Array literal
        this.advance(); // consume [
        const elements: unknown[] = [];
        while (this.current().type !== "RBRACKET") {
          elements.push(this.parseOr());
          if (this.current().type === "COMMA") {
            this.advance();
          }
        }
        this.advance(); // consume ]
        return elements;
      }

      case "IDENTIFIER": {
        // Handle identifiers with property access
        let value: unknown = this.parseIdentifierOrCall();
        return value;
      }

      default:
        throw new Error(`Unexpected token: ${token.raw}`);
    }
  }

  private parseIdentifierOrCall(): unknown {
    const token = this.advance();
    let value: unknown = token.value;

    // Handle property access and array indexing
    while (
      this.current().type === "DOT" ||
      this.current().type === "LBRACKET" ||
      this.current().type === "LPAREN"
    ) {
      if (this.current().type === "DOT") {
        this.advance(); // consume .
        if (this.current().type !== "IDENTIFIER") {
          throw new Error("Expected identifier after dot");
        }
        const prop = this.advance().value as string;

        // Handle some common methods
        if (this.current().type === "LPAREN") {
          this.advance(); // consume (
          const args: unknown[] = [];
          while (this.current().type !== "RPAREN") {
            args.push(this.parseOr());
            if (this.current().type === "COMMA") {
              this.advance();
            }
          }
          this.advance(); // consume )

          // Safe method execution
          value = this.executeMethod(value, prop, args);
        } else if (value !== null && value !== undefined && typeof value === "object") {
          value = (value as Record<string, unknown>)[prop];
        } else {
          value = undefined;
        }
      } else if (this.current().type === "LBRACKET") {
        this.advance(); // consume [
        const index = this.parseOr();
        if (this.current().type !== "RBRACKET") {
          throw new Error("Expected closing bracket");
        }
        this.advance(); // consume ]

        if (value !== null && value !== undefined) {
          value = (value as Record<string | number, unknown>)[index as string | number];
        } else {
          value = undefined;
        }
      }
    }

    return value;
  }

  private executeMethod(obj: unknown, method: string, args: unknown[]): unknown {
    // Whitelist of safe methods
    const safeMethods: Record<string, (obj: unknown, args: unknown[]) => unknown> = {
      length: (o) => {
        if (Array.isArray(o) || typeof o === "string") return o.length;
        return undefined;
      },
      includes: (o, a) => {
        if (Array.isArray(o)) return o.includes(a[0]);
        if (typeof o === "string") return o.includes(String(a[0]));
        return false;
      },
      startsWith: (o, a) => {
        if (typeof o === "string") return o.startsWith(String(a[0]));
        return false;
      },
      endsWith: (o, a) => {
        if (typeof o === "string") return o.endsWith(String(a[0]));
        return false;
      },
      toLowerCase: (o) => {
        if (typeof o === "string") return o.toLowerCase();
        return o;
      },
      toUpperCase: (o: unknown) => {
        if (typeof o === "string") return o.toUpperCase();
        return o;
      },
      trim: (o: unknown) => {
        if (typeof o === "string") return o.trim();
        return o;
      },
      toString: (o: unknown) => String(o),
    };

    const methodFn = safeMethods[method];
    if (methodFn) {
      return methodFn(obj, args);
    }

    throw new Error(`Method '${method}' is not allowed in expressions`);
  }
}

/**
 * Safely evaluate an expression string
 */
export function evaluateExpression(expression: string): unknown {
  const parser = new ExpressionParser(expression);
  return parser.parse();
}

/**
 * Validate condition node configuration
 */
export function validateConditionConfig(config: ConditionNodeConfig): string[] {
  const errors: string[] = [];

  if (!config.expression) {
    errors.push("Expression is required");
  } else {
    // Try to tokenize to catch syntax errors early
    try {
      tokenize(config.expression.replace(VARIABLE_PATTERN, "true"));
    } catch (error) {
      errors.push(`Invalid expression syntax: ${(error as Error).message}`);
    }
  }

  return errors;
}
