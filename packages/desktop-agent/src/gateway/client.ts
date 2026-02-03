/**
 * GoodTeams Desktop Agent - Gateway WebSocket Client
 *
 * Connects to the tenant gateway as a "node" (like mobile nodes in OpenClaw).
 * Handles:
 * - WebSocket connection management
 * - Authentication
 * - Reconnection with exponential backoff
 * - Message routing
 */

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import {
  type NodeProtocol,
  PROTOCOL_VERSION,
  type RequestFrame,
  type ResponseFrame,
  type EventFrame,
  type NodeInvokeRequest,
} from "./node-protocol.js";

export interface GatewayClientOptions {
  /** Gateway WebSocket URL (ws:// or wss://) */
  url: string;
  /** Node ID for this agent */
  nodeId?: string;
  /** Authentication token */
  token?: string;
  /** Platform identifier */
  platform?: string;
  /** Agent version */
  version?: string;
  /** Capabilities this agent supports */
  capabilities?: string[];
  /** Commands this agent can handle */
  commands?: string[];
  /** Called when connected */
  onConnect?: () => void;
  /** Called when disconnected */
  onDisconnect?: (code: number, reason: string) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called when a command is invoked */
  onInvoke?: (request: NodeInvokeRequest) => Promise<unknown>;
  /** Reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export class GatewayClient extends EventEmitter implements NodeProtocol {
  private ws: WebSocket | null = null;
  private options: GatewayClientOptions;
  private nodeId: string;
  private connected = false;
  private connecting = false;
  private intentionalClose = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private currentReconnectDelay: number;
  private pendingRequests = new Map<string, PendingRequest>();
  private lastSeq = 0;

  constructor(options: GatewayClientOptions) {
    super();
    this.options = {
      autoReconnect: true,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      heartbeatInterval: 30000,
      platform: process.platform,
      version: "0.1.0",
      capabilities: [],
      commands: [],
      ...options,
    };
    this.nodeId = options.nodeId ?? `desktop-${randomUUID().slice(0, 8)}`;
    this.currentReconnectDelay = this.options.reconnectDelay!;
  }

  /**
   * Connect to the gateway
   */
  async connect(): Promise<void> {
    if (this.connected || this.connecting) {
      return;
    }

    this.connecting = true;
    this.intentionalClose = false;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.url);

        this.ws.onopen = () => {
          this.onOpen();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.onMessage(event.data);
        };

        this.ws.onclose = (event) => {
          this.onClose(event.code, event.reason);
        };

        this.ws.onerror = (event) => {
          const error = new Error(`WebSocket error: ${event.type}`);
          this.onError(error);
          if (this.connecting) {
            reject(error);
          }
        };
      } catch (error) {
        this.connecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the gateway
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.connected = false;
    this.connecting = false;

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Client disconnected"));
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Send a request and wait for response
   */
  async request<T = unknown>(
    method: string,
    params?: unknown,
    timeoutMs = 30000
  ): Promise<T> {
    if (!this.connected || !this.ws) {
      throw new Error("Not connected to gateway");
    }

    const id = randomUUID();
    const frame: RequestFrame = {
      type: "req",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.send(frame);
    });
  }

  /**
   * Send an event to the gateway
   */
  sendEvent(event: string, payload?: unknown): void {
    const frame: EventFrame = {
      type: "event",
      event,
      payload,
      seq: ++this.lastSeq,
    };
    this.send(frame);
  }

  /**
   * Send a response to a node invoke request
   */
  sendInvokeResult(
    requestId: string,
    ok: boolean,
    payload?: unknown,
    error?: { code?: string; message?: string }
  ): void {
    this.request("node.invoke.result", {
      id: requestId,
      nodeId: this.nodeId,
      ok,
      payload,
      error,
    }).catch((err) => {
      console.error("Failed to send invoke result:", err);
    });
  }

  /**
   * Get the node ID
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Handle WebSocket open
   */
  private onOpen(): void {
    this.connected = true;
    this.connecting = false;
    this.currentReconnectDelay = this.options.reconnectDelay!;

    // Send connect message
    this.sendConnect();

    // Start heartbeat
    this.startHeartbeat();

    this.options.onConnect?.();
    this.emit("connect");
  }

  /**
   * Send the initial connect message
   */
  private async sendConnect(): Promise<void> {
    try {
      await this.request("connect", {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: "goodteams-desktop-agent",
          displayName: "GoodTeams Desktop Agent",
          version: this.options.version,
          platform: this.options.platform,
          mode: "node",
        },
        caps: this.options.capabilities,
        commands: this.options.commands,
        auth: this.options.token
          ? { token: this.options.token }
          : undefined,
      });
    } catch (error) {
      console.error("Connect handshake failed:", error);
      this.disconnect();
    }
  }

  /**
   * Handle incoming message
   */
  private onMessage(data: string | ArrayBuffer | Blob): void {
    try {
      const text =
        typeof data === "string"
          ? data
          : data instanceof ArrayBuffer
            ? new TextDecoder().decode(data)
            : "";

      if (!text) return;

      const frame = JSON.parse(text);

      if (frame.type === "res") {
        this.handleResponse(frame as ResponseFrame);
      } else if (frame.type === "event") {
        this.handleEvent(frame as EventFrame);
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  }

  /**
   * Handle response frame
   */
  private handleResponse(frame: ResponseFrame): void {
    const pending = this.pendingRequests.get(frame.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(frame.id);

    if (frame.ok) {
      pending.resolve(frame.payload);
    } else {
      pending.reject(new Error(frame.error?.message ?? "Unknown error"));
    }
  }

  /**
   * Handle event frame
   */
  private handleEvent(frame: EventFrame): void {
    switch (frame.event) {
      case "tick":
        // Heartbeat from server
        break;

      case "node.invoke":
        // Command invocation from server
        this.handleInvoke(frame.payload as NodeInvokeRequest);
        break;

      case "shutdown":
        // Server is shutting down
        this.emit("shutdown", frame.payload);
        break;

      default:
        this.emit("event", frame);
    }
  }

  /**
   * Handle invoke request from server
   */
  private async handleInvoke(request: NodeInvokeRequest): Promise<void> {
    try {
      if (this.options.onInvoke) {
        const result = await this.options.onInvoke(request);
        this.sendInvokeResult(request.id, true, result);
      } else {
        this.sendInvokeResult(request.id, false, undefined, {
          code: "NOT_IMPLEMENTED",
          message: `Command not implemented: ${request.command}`,
        });
      }
    } catch (error) {
      this.sendInvokeResult(request.id, false, undefined, {
        code: "INVOKE_ERROR",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle WebSocket close
   */
  private onClose(code: number, reason: string): void {
    this.connected = false;
    this.connecting = false;
    this.clearTimers();

    this.options.onDisconnect?.(code, reason);
    this.emit("disconnect", code, reason);

    // Reconnect if not intentional
    if (!this.intentionalClose && this.options.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error
   */
  private onError(error: Error): void {
    this.options.onError?.(error);
    this.emit("error", error);
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => {
        console.error("Reconnect failed:", error);
        // Increase delay for next attempt
        this.currentReconnectDelay = Math.min(
          this.currentReconnectDelay * 2,
          this.options.maxReconnectDelay!
        );
        this.scheduleReconnect();
      });
    }, this.currentReconnectDelay);
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        this.sendEvent("heartbeat");
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send a frame over the WebSocket
   */
  private send(frame: RequestFrame | ResponseFrame | EventFrame): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }
}
