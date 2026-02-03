/**
 * Iterator Node Executor
 *
 * Loops over collections and processes each item.
 * Sets the current item as a context variable for child nodes.
 */

import type {
  IteratorNodeConfig,
  IteratorNodeOutput,
  ExecutionContext,
  NodeExecutor,
} from "./types.js";
import { NodeExecutionError } from "./types.js";

/** Variable injection pattern */
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

/** Default maximum concurrency for parallel iteration */
const DEFAULT_MAX_CONCURRENCY = 5;

/**
 * Callback for processing each item in the iteration
 */
export type IteratorCallback = (
  item: unknown,
  index: number,
  context: ExecutionContext,
) => Promise<unknown>;

/**
 * Execute an iterator node
 *
 * The iterator node loops over a collection and optionally processes each item.
 * It returns iteration metadata that can be used by the workflow engine
 * to execute child nodes for each item.
 *
 * @param config - Iterator node configuration
 * @param context - Current execution context
 * @param callback - Optional callback to process each item
 * @returns Iterator output with iteration count and results
 */
export async function executeIteratorNode(
  config: IteratorNodeConfig,
  context: ExecutionContext,
  callback?: IteratorCallback,
): Promise<IteratorNodeOutput> {
  if (!config.collection) {
    throw new NodeExecutionError("iterator", "Missing 'collection' in configuration");
  }

  if (!config.itemVariable) {
    throw new NodeExecutionError("iterator", "Missing 'itemVariable' in configuration");
  }

  // Resolve the collection from context
  const collection = resolveCollection(config.collection, context);

  if (!Array.isArray(collection)) {
    throw new NodeExecutionError(
      "iterator",
      `Collection '${config.collection}' is not an array. Got: ${typeof collection}`,
    );
  }

  const maxConcurrency = config.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
  const results: unknown[] = [];
  const errors: Array<{ index: number; item: unknown; error: string }> = [];

  // If no callback is provided, just return iteration metadata
  // The workflow engine will use this to queue child nodes
  if (!callback) {
    return {
      iterations: collection.length,
      results: collection.map((item, index) => ({
        index,
        item,
        [config.itemVariable]: item,
      })),
      errors: [],
    };
  }

  // Process items with concurrency control
  if (maxConcurrency === 1) {
    // Sequential processing
    for (let i = 0; i < collection.length; i++) {
      const item = collection[i];
      const itemContext = createItemContext(context, config.itemVariable, item, i);

      try {
        const result = await callback(item, i, itemContext);
        results[i] = result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ index: i, item, error: message });
      }
    }
  } else {
    // Parallel processing with concurrency limit
    const chunks = chunkArray(
      collection.map((item, index) => ({ item, index })),
      maxConcurrency,
    );

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(async ({ item, index }) => {
          const itemContext = createItemContext(context, config.itemVariable, item, index);
          return { index, result: await callback(item, index, itemContext) };
        }),
      );

      for (const settled of chunkResults) {
        if (settled.status === "fulfilled") {
          results[settled.value.index] = settled.value.result;
        } else {
          const originalIndex = chunk.find((_, i) => chunkResults[i] === settled)?.index ?? -1;
          const originalItem = collection[originalIndex];
          errors.push({
            index: originalIndex,
            item: originalItem,
            error:
              settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
          });
        }
      }
    }
  }

  return {
    iterations: collection.length,
    results,
    errors,
  };
}

/**
 * Resolve collection from context using variable path
 */
function resolveCollection(collectionPath: string, context: ExecutionContext): unknown {
  // Check if it's a variable reference
  const match = collectionPath.match(/^\{\{([^}]+)\}\}$/);
  if (match) {
    return resolvePath(match[1].trim(), context);
  }

  // Otherwise treat as a direct path
  return resolvePath(collectionPath, context);
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

  // Unprefixed paths: check inputs first, then nodeOutputs, then globals
  const inputValue = getNestedValue(context.inputs, parts);
  if (inputValue !== undefined) {
    return inputValue;
  }

  const nodeValue = getNestedValue(context.nodeOutputs, parts);
  if (nodeValue !== undefined) {
    return nodeValue;
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
 * Create a new context with the current item set as a variable
 */
function createItemContext(
  baseContext: ExecutionContext,
  itemVariable: string,
  item: unknown,
  index: number,
): ExecutionContext {
  return {
    ...baseContext,
    inputs: {
      ...baseContext.inputs,
      [itemVariable]: item,
      [`${itemVariable}Index`]: index,
    },
    globalVariables: {
      ...baseContext.globalVariables,
      _currentItem: item,
      _currentIndex: index,
    },
  };
}

/**
 * Split an array into chunks of a given size
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Validate iterator node configuration
 */
export function validateIteratorConfig(config: IteratorNodeConfig): string[] {
  const errors: string[] = [];

  if (!config.collection) {
    errors.push("collection is required");
  }

  if (!config.itemVariable) {
    errors.push("itemVariable is required");
  } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(config.itemVariable)) {
    errors.push("itemVariable must be a valid identifier (letters, numbers, underscore)");
  }

  if (config.maxConcurrency !== undefined) {
    if (config.maxConcurrency < 1) {
      errors.push("maxConcurrency must be at least 1");
    }
    if (config.maxConcurrency > 100) {
      errors.push("maxConcurrency cannot exceed 100");
    }
  }

  return errors;
}

/**
 * Get iteration items from iterator output
 * Helper function for use by workflow engine
 */
export function getIterationItems(
  output: IteratorNodeOutput,
  itemVariable: string,
): Array<{ item: unknown; index: number; contextVars: Record<string, unknown> }> {
  return output.results.map((result, index) => {
    const item =
      typeof result === "object" && result !== null
        ? ((result as Record<string, unknown>).item ?? result)
        : result;

    return {
      item,
      index,
      contextVars: {
        [itemVariable]: item,
        [`${itemVariable}Index`]: index,
      },
    };
  });
}

/**
 * Node executor function that matches the standard signature
 */
export const executeIteratorNodeExecutor: NodeExecutor<IteratorNodeConfig, IteratorNodeOutput> = (
  config,
  context,
) => executeIteratorNode(config, context);
