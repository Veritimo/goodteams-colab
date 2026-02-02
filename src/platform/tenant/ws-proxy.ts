/**
 * WebSocket Proxy for Tenant Gateways
 *
 * Handles WebSocket upgrade requests and proxies them to the correct tenant gateway.
 * Supports authentication via:
 * - Query parameter: ?token=xxx
 * - X-Tenant-ID header
 * - Subdomain extraction
 */

import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { prisma } from "../db/client.js";
import { extractSubdomain, getOrganizationBySlug, TENANT_ID_HEADER } from "./router.js";

/**
 * Configuration for WebSocket proxy
 */
export interface WebSocketProxyConfig {
  /** Path prefix for WebSocket connections (default: /ws) */
  pathPrefix?: string;
  /** Ping interval in ms to keep connections alive (default: 30000) */
  pingInterval?: number;
  /** Connection timeout in ms (default: 10000) */
  connectionTimeout?: number;
}

/**
 * Active proxy connection tracking
 */
interface ProxyConnection {
  clientWs: WebSocket;
  tenantWs: WebSocket;
  organizationId: string;
  connectedAt: Date;
}

/**
 * WebSocket proxy instance
 */
export class TenantWebSocketProxy {
  private wss: WebSocketServer;
  private connections: Map<string, ProxyConnection> = new Map();
  private pingIntervalId?: ReturnType<typeof setInterval>;
  private config: Required<WebSocketProxyConfig>;

  constructor(config: WebSocketProxyConfig = {}) {
    this.config = {
      pathPrefix: config.pathPrefix ?? "/ws",
      pingInterval: config.pingInterval ?? 30000,
      connectionTimeout: config.connectionTimeout ?? 10000,
    };

    this.wss = new WebSocketServer({ noServer: true });
  }

  /**
   * Set up WebSocket proxy on HTTP server
   *
   * Listens for 'upgrade' events and handles WebSocket connections.
   *
   * @param server - HTTP server instance
   */
  setup(server: Server): void {
    server.on("upgrade", this.handleUpgrade.bind(this));

    // Start ping interval to keep connections alive
    this.pingIntervalId = setInterval(() => {
      this.pingConnections();
    }, this.config.pingInterval);
  }

  /**
   * Handle WebSocket upgrade request
   */
  private async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    // Only handle paths starting with our prefix
    if (!url.pathname.startsWith(this.config.pathPrefix)) {
      return;
    }

    try {
      // Resolve tenant from request
      const organizationId = await this.resolveTenantFromRequest(request, url);

      if (!organizationId) {
        this.rejectConnection(socket, 404, "Tenant not found");
        return;
      }

      // Get gateway for tenant
      const gateway = await this.getGatewayForTenant(organizationId);

      if (!gateway) {
        this.rejectConnection(socket, 503, "Gateway unavailable");
        return;
      }

      // Accept the WebSocket connection
      this.wss.handleUpgrade(request, socket, head, (clientWs) => {
        this.proxyConnection(clientWs, gateway.port, organizationId, url.pathname);
      });
    } catch (error) {
      console.error("[ws-proxy] Error handling upgrade:", error);
      this.rejectConnection(socket, 500, "Internal server error");
    }
  }

  /**
   * Resolve tenant from WebSocket request
   */
  private async resolveTenantFromRequest(
    request: IncomingMessage,
    url: URL,
  ): Promise<string | null> {
    // 1. Try X-Tenant-ID header
    const headerValue = request.headers[TENANT_ID_HEADER.toLowerCase()];
    if (headerValue && typeof headerValue === "string") {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(headerValue)) {
        return headerValue;
      }
    }

    // 2. Try tenant query parameter
    const tenantParam = url.searchParams.get("tenant");
    if (tenantParam) {
      // Could be org ID or slug
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantParam)) {
        return tenantParam;
      }
      // Try as slug
      return getOrganizationBySlug(tenantParam);
    }

    // 3. Try subdomain
    const host = request.headers.host;
    if (host) {
      const subdomain = extractSubdomain(host);
      if (subdomain) {
        return getOrganizationBySlug(subdomain);
      }
    }

    return null;
  }

  /**
   * Get gateway for tenant
   */
  private async getGatewayForTenant(organizationId: string): Promise<{ port: number } | null> {
    const gateway = await prisma.tenantGateway.findUnique({
      where: { organizationId },
      select: { port: true, status: true },
    });

    if (!gateway || !["HEALTHY", "STARTING"].includes(gateway.status)) {
      return null;
    }

    return { port: gateway.port };
  }

  /**
   * Create proxy connection to tenant gateway
   */
  private proxyConnection(
    clientWs: WebSocket,
    gatewayPort: number,
    organizationId: string,
    path: string,
  ): void {
    const connectionId = `${organizationId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Connect to tenant gateway WebSocket
    const tenantWsUrl = `ws://127.0.0.1:${gatewayPort}${path}`;
    const tenantWs = new WebSocket(tenantWsUrl, {
      handshakeTimeout: this.config.connectionTimeout,
    });

    // Store connection
    const connection: ProxyConnection = {
      clientWs,
      tenantWs,
      organizationId,
      connectedAt: new Date(),
    };
    this.connections.set(connectionId, connection);

    // Handle tenant gateway connection open
    tenantWs.on("open", () => {
      console.log(`[ws-proxy] Connected to tenant gateway: ${organizationId}`);
    });

    // Pipe client messages to tenant gateway
    clientWs.on("message", (data, isBinary) => {
      if (tenantWs.readyState === WebSocket.OPEN) {
        tenantWs.send(data, { binary: isBinary });
      }
    });

    // Pipe tenant gateway messages to client
    tenantWs.on("message", (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    // Handle errors
    clientWs.on("error", (error) => {
      console.error(`[ws-proxy] Client error (${connectionId}):`, error);
      this.closeConnection(connectionId);
    });

    tenantWs.on("error", (error) => {
      console.error(`[ws-proxy] Tenant gateway error (${connectionId}):`, error);
      this.closeConnection(connectionId);
    });

    // Handle close from either side
    clientWs.on("close", (code, reason) => {
      console.log(`[ws-proxy] Client closed (${connectionId}): ${code}`);
      this.closeConnection(connectionId);
    });

    tenantWs.on("close", (code, reason) => {
      console.log(`[ws-proxy] Tenant gateway closed (${connectionId}): ${code}`);
      this.closeConnection(connectionId);
    });
  }

  /**
   * Close a proxy connection
   */
  private closeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.connections.delete(connectionId);

    // Close both WebSockets
    if (connection.clientWs.readyState !== WebSocket.CLOSED) {
      connection.clientWs.close(1000, "Connection closed");
    }
    if (connection.tenantWs.readyState !== WebSocket.CLOSED) {
      connection.tenantWs.close(1000, "Connection closed");
    }
  }

  /**
   * Reject WebSocket connection with HTTP error
   */
  private rejectConnection(socket: Duplex, code: number, message: string): void {
    const response = [
      `HTTP/1.1 ${code} ${message}`,
      "Content-Type: text/plain",
      "Connection: close",
      "",
      message,
    ].join("\r\n");

    socket.write(response);
    socket.destroy();
  }

  /**
   * Ping all connections to keep them alive
   */
  private pingConnections(): void {
    const entries = Array.from(this.connections.entries());
    for (const [connectionId, connection] of entries) {
      try {
        if (connection.clientWs.readyState === WebSocket.OPEN) {
          connection.clientWs.ping();
        }
        if (connection.tenantWs.readyState === WebSocket.OPEN) {
          connection.tenantWs.ping();
        }
      } catch (error) {
        console.error(`[ws-proxy] Ping error (${connectionId}):`, error);
        this.closeConnection(connectionId);
      }
    }
  }

  /**
   * Get active connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connections for a specific tenant
   */
  getConnectionsForTenant(organizationId: string): number {
    let count = 0;
    const connections = Array.from(this.connections.values());
    for (const connection of connections) {
      if (connection.organizationId === organizationId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Shutdown the proxy
   */
  shutdown(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
    }

    // Close all connections
    const connectionIds = Array.from(this.connections.keys());
    for (const connectionId of connectionIds) {
      this.closeConnection(connectionId);
    }

    this.wss.close();
  }
}

/**
 * Create and setup WebSocket proxy on server
 *
 * Convenience function that creates a TenantWebSocketProxy and sets it up.
 *
 * @param server - HTTP server instance
 * @param config - Optional configuration
 * @returns TenantWebSocketProxy instance
 */
export function setupWebSocketProxy(
  server: Server,
  config?: WebSocketProxyConfig,
): TenantWebSocketProxy {
  const proxy = new TenantWebSocketProxy(config);
  proxy.setup(server);
  return proxy;
}
