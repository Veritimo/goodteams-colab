#!/usr/bin/env npx tsx
/**
 * Standalone Platform API Server
 * 
 * Runs just the platform API for testing/development.
 * Usage: npx tsx scripts/platform-server.ts
 */

import { createServer } from "node:http";
import { createPlatformApiHandler } from "../src/platform/api/index.js";

const PORT = parseInt(process.env.PLATFORM_PORT || "19100", 10);
const HOST = process.env.PLATFORM_HOST || "127.0.0.1";

async function main() {
  console.log("[platform] Starting platform API server...");
  
  const handlePlatformRequest = createPlatformApiHandler();

  const server = createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    // Log request
    console.log(`[platform] ${req.method} ${req.url}`);

    // Try platform API handler
    const handled = await handlePlatformRequest(req, res);
    if (handled) return;

    // 404 for unhandled routes
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Not Found", path: req.url }));
  });

  server.listen(PORT, HOST, () => {
    console.log(`[platform] ✅ Platform API running at http://${HOST}:${PORT}`);
    console.log(`[platform] Health: http://${HOST}:${PORT}/api/platform/health`);
    console.log(`[platform] Auth: http://${HOST}:${PORT}/api/platform/auth/entra/login`);
    console.log("");
    console.log("[platform] Press Ctrl+C to stop");
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[platform] Shutting down...");
    server.close(() => {
      console.log("[platform] Goodbye!");
      process.exit(0);
    });
  });
}

main().catch((err) => {
  console.error("[platform] Fatal error:", err);
  process.exit(1);
});
