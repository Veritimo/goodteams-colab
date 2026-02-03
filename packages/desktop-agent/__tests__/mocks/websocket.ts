/**
 * Mock WebSocket for testing
 */

import { vi } from "vitest";
import { EventEmitter } from "node:events";

export class MockWebSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
  }

  send = vi.fn();
  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    const event = { code: code ?? 1000, reason: reason ?? "" };
    this.onclose?.(event as CloseEvent);
    this.emit("close", event);
  });

  // Simulate connection open
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
    this.emit("open");
  }

  // Simulate message received
  simulateMessage(data: unknown): void {
    const messageData = typeof data === "string" ? data : JSON.stringify(data);
    this.onmessage?.({ data: messageData } as MessageEvent);
    this.emit("message", { data: messageData });
  }

  // Simulate close
  simulateClose(code = 1000, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason } as CloseEvent);
    this.emit("close", { code, reason });
  }

  // Simulate error
  simulateError(error?: Error): void {
    this.onerror?.({ type: "error", error } as unknown as Event);
    this.emit("error", error ?? new Error("WebSocket error"));
  }

  // Event handlers (to be set by the client)
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
}

// Factory to create mock WebSocket instances
export function createMockWebSocket(): {
  MockWebSocket: typeof MockWebSocket;
  instances: MockWebSocket[];
  getLastInstance: () => MockWebSocket | undefined;
} {
  const instances: MockWebSocket[] = [];

  class TrackedMockWebSocket extends MockWebSocket {
    constructor(url: string) {
      super(url);
      instances.push(this);
    }
  }

  return {
    MockWebSocket: TrackedMockWebSocket,
    instances,
    getLastInstance: () => instances[instances.length - 1],
  };
}
