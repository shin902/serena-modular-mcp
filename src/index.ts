#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config-loader.js";
import { logger } from "./logger.js";
import { createServer } from "./server.js";

async function main() {
  const configPath = process.argv[2];

  if (!configPath) {
    logger.error("Usage: modular-mcp <config-path>");
    process.exit(1);
  }

  try {
    const config = await loadConfig(configPath);
    const { server } = await createServer(config);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("MCP server started successfully");
  } catch (error) {
    logger.error(error instanceof Error ? error : String(error));
    process.exit(1);
  }
}

await main();
