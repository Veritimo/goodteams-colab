/**
 * Execution Context Manager
 *
 * Manages workflow execution state across async job processing.
 * Tracks inputs, node outputs, and global variables.
 */

import type { ExecutionContext, NodeId } from "../types.js";

/**
 * Serialized context format for database storage
 */
export interface SerializedContext {
  inputs: Record<string, unknown>;
  nodeOutputs: Record<NodeId, unknown>;
  globalVariables: Record<string, unknown>;
}

/**
 * Manages execution context for a workflow run.
 * Provides methods to store/retrieve node outputs and serialize for persistence.
 */
export class ExecutionContextManager {
  private inputs: Record<string, unknown>;
  private nodeOutputs: Record<NodeId, unknown>;
  private globalVariables: Record<string, unknown>;

  constructor(initialContext?: Partial<ExecutionContext>) {
    this.inputs = initialContext?.inputs ?? {};
    this.nodeOutputs = initialContext?.nodeOutputs ?? {};
    this.globalVariables = initialContext?.globalVariables ?? {};
  }

  /**
   * Set an input variable
   */
  setInput(key: string, value: unknown): void {
    this.inputs[key] = value;
  }

  /**
   * Get an input variable
   */
  getInput(key: string): unknown {
    return this.inputs[key];
  }

  /**
   * Get all inputs
   */
  getInputs(): Record<string, unknown> {
    return { ...this.inputs };
  }

  /**
   * Set bulk inputs
   */
  setInputs(inputs: Record<string, unknown>): void {
    this.inputs = { ...this.inputs, ...inputs };
  }

  /**
   * Store the output of a node execution
   */
  setNodeOutput(nodeId: NodeId, output: unknown): void {
    this.nodeOutputs[nodeId] = output;
  }

  /**
   * Retrieve the output of a previously executed node
   */
  getNodeOutput(nodeId: NodeId): unknown {
    return this.nodeOutputs[nodeId];
  }

  /**
   * Check if a node has output
   */
  hasNodeOutput(nodeId: NodeId): boolean {
    return nodeId in this.nodeOutputs;
  }

  /**
   * Get all node outputs
   */
  getNodeOutputs(): Record<NodeId, unknown> {
    return { ...this.nodeOutputs };
  }

  /**
   * Set a global variable
   */
  setGlobalVariable(key: string, value: unknown): void {
    this.globalVariables[key] = value;
  }

  /**
   * Get a global variable
   */
  getGlobalVariable(key: string): unknown {
    return this.globalVariables[key];
  }

  /**
   * Get all global variables
   */
  getGlobalVariables(): Record<string, unknown> {
    return { ...this.globalVariables };
  }

  /**
   * Get the full execution context
   */
  getContext(): ExecutionContext {
    return {
      inputs: this.inputs,
      nodeOutputs: this.nodeOutputs,
      globalVariables: this.globalVariables,
    };
  }

  /**
   * Serialize context for database storage
   */
  toJSON(): SerializedContext {
    return {
      inputs: this.inputs,
      nodeOutputs: this.nodeOutputs,
      globalVariables: this.globalVariables,
    };
  }

  /**
   * Create a context manager from serialized JSON
   */
  static fromJSON(json: SerializedContext): ExecutionContextManager {
    // Deep copy the objects to ensure independence
    return new ExecutionContextManager({
      inputs: JSON.parse(JSON.stringify(json.inputs ?? {})),
      nodeOutputs: JSON.parse(JSON.stringify(json.nodeOutputs ?? {})),
      globalVariables: JSON.parse(JSON.stringify(json.globalVariables ?? {})),
    });
  }

  /**
   * Clone the context manager
   */
  clone(): ExecutionContextManager {
    return ExecutionContextManager.fromJSON(this.toJSON());
  }

  /**
   * Clear all node outputs (for re-execution)
   */
  clearNodeOutputs(): void {
    this.nodeOutputs = {};
  }

  /**
   * Reset the entire context
   */
  reset(): void {
    this.inputs = {};
    this.nodeOutputs = {};
    this.globalVariables = {};
  }
}
