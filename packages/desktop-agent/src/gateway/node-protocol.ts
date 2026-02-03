/**
 * GoodTeams Desktop Agent - Node Protocol Implementation
 *
 * Defines the protocol for communicating with the GoodTeams gateway as a "node".
 * Based on OpenClaw's gateway protocol.
 */

/** Current protocol version */
export const PROTOCOL_VERSION = 1;

/**
 * Request frame sent to gateway
 */
export interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

/**
 * Response frame received from gateway
 */
export interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };
}

/**
 * Event frame (sent or received)
 */
export interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: StateVersion;
}

/**
 * State version for optimistic concurrency
 */
export interface StateVersion {
  version: number;
  timestamp: number;
}

/**
 * Node invoke request from gateway
 */
export interface NodeInvokeRequest {
  id: string;
  nodeId: string;
  command: string;
  params?: unknown;
  paramsJSON?: string;
  timeoutMs?: number;
  idempotencyKey?: string;
}

/**
 * Node invoke result sent back to gateway
 */
export interface NodeInvokeResult {
  id: string;
  nodeId: string;
  ok: boolean;
  payload?: unknown;
  payloadJSON?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

/**
 * Connect parameters sent to gateway
 */
export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    displayName?: string;
    version: string;
    platform: string;
    deviceFamily?: string;
    modelIdentifier?: string;
    mode: string;
    instanceId?: string;
  };
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  role?: string;
  scopes?: string[];
  auth?: {
    token?: string;
    password?: string;
  };
}

/**
 * Hello response from gateway after successful connect
 */
export interface HelloOk {
  type: "hello-ok";
  protocol: number;
  server: {
    version: string;
    commit?: string;
    host?: string;
    connId: string;
  };
  features: {
    methods: string[];
    events: string[];
  };
  policy: {
    maxPayload: number;
    maxBufferedBytes: number;
    tickIntervalMs: number;
  };
  auth?: {
    deviceToken: string;
    role: string;
    scopes: string[];
    issuedAtMs?: number;
  };
}

/**
 * Tick event from gateway (heartbeat)
 */
export interface TickEvent {
  ts: number;
}

/**
 * Shutdown event from gateway
 */
export interface ShutdownEvent {
  reason: string;
  restartExpectedMs?: number;
}

/**
 * Node protocol interface
 */
export interface NodeProtocol {
  /** Connect to gateway */
  connect(): Promise<void>;

  /** Disconnect from gateway */
  disconnect(): void;

  /** Send a request and wait for response */
  request<T = unknown>(
    method: string,
    params?: unknown,
    timeoutMs?: number
  ): Promise<T>;

  /** Send an event */
  sendEvent(event: string, payload?: unknown): void;

  /** Send invoke result */
  sendInvokeResult(
    requestId: string,
    ok: boolean,
    payload?: unknown,
    error?: { code?: string; message?: string }
  ): void;

  /** Check if connected */
  isConnected(): boolean;

  /** Get node ID */
  getNodeId(): string;
}

/**
 * Node capabilities that can be advertised
 */
export const NODE_CAPABILITIES = {
  /** Can capture screen */
  SCREEN_CAPTURE: "screen.capture",
  /** Can stream screen */
  SCREEN_STREAM: "screen.stream",
  /** Can automate UI */
  UI_AUTOMATION: "ui.automation",
  /** Can automate Office apps */
  OFFICE_AUTOMATION: "office.automation",
  /** Can execute commands */
  COMMAND_EXEC: "command.exec",
  /** Can access filesystem */
  FILESYSTEM: "filesystem",
} as const;

/**
 * Built-in commands that nodes can handle
 */
export const NODE_COMMANDS = {
  // Screen commands
  SCREEN_CAPTURE: "screen.capture",
  SCREEN_STREAM_START: "screen.stream.start",
  SCREEN_STREAM_STOP: "screen.stream.stop",
  SCREEN_GET_SOURCES: "screen.get_sources",

  // UI Automation commands
  UI_CLICK: "ui.click",
  UI_TYPE: "ui.type",
  UI_SCROLL: "ui.scroll",
  UI_GET_WINDOWS: "ui.get_windows",
  UI_GET_ELEMENTS: "ui.get_elements",
  UI_WAIT_FOR: "ui.wait_for",

  // Office commands
  EXCEL_OPEN: "excel.open",
  EXCEL_READ: "excel.read",
  EXCEL_WRITE: "excel.write",
  WORD_OPEN: "word.open",
  WORD_READ: "word.read",
  WORD_WRITE: "word.write",
  OUTLOOK_LIST_MAIL: "outlook.list_mail",
  OUTLOOK_SEND_MAIL: "outlook.send_mail",

  // System commands
  PING: "ping",
  GET_INFO: "get_info",
} as const;

/**
 * Error codes for node responses
 */
export const NODE_ERROR_CODES = {
  /** Command not implemented */
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  /** Invalid parameters */
  INVALID_PARAMS: "INVALID_PARAMS",
  /** Command execution failed */
  EXEC_ERROR: "EXEC_ERROR",
  /** Command timed out */
  TIMEOUT: "TIMEOUT",
  /** Permission denied */
  PERMISSION_DENIED: "PERMISSION_DENIED",
  /** Resource not found */
  NOT_FOUND: "NOT_FOUND",
} as const;

/**
 * Helper to create a success result
 */
export function successResult(payload?: unknown): {
  ok: true;
  payload?: unknown;
} {
  return { ok: true, payload };
}

/**
 * Helper to create an error result
 */
export function errorResult(
  code: string,
  message: string
): { ok: false; error: { code: string; message: string } } {
  return { ok: false, error: { code, message } };
}
