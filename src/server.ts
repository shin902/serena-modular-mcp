import { Server } from "@modelcontextprotocol/sdk/server";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import packageJson from "../package.json" with { type: "json" };
import { ClientManager } from "./client-manager.js";
import { logger } from "./logger.js";
import { handleCallTool, handleListTools } from "./server/handlers.js";
import type { ServerConfig } from "./types.js";

export const createServer = async (config: ServerConfig) => {
  const manager = new ClientManager();
  const mcpGroups = Object.entries(config.mcpServers);

  // Initialize categories if present
  if (config.categories) {
    manager.initCategories(config.categories);
  }

  const cleanup = async () => {
    await manager.disconnectAll();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  await Promise.allSettled(
    mcpGroups.map(async ([name, config]) => {
      try {
        await manager.connect(name, config);
      } catch (error) {
        manager.recordFailedConnection(name, config, error);
      }
    }),
  );

  if (manager.listFailedGroups().length === 0) {
    logger.info(
      `Successfully connected ${manager.listGroups().length} MCP groups. All groups are valid.`,
    );
  } else {
    logger.warn(
      `Some MCP groups failed to connect. success_groups=[${manager
        .listGroups()
        .map((g) => g.name)
        .join(", ")}], failed_groups=[${manager
        .listFailedGroups()
        .map((g) => g.name)
        .join(", ")}]`,
    );
  }

  const server = new Server(
    {
      name: packageJson.name,
      version: packageJson.version,
    },
    {
      capabilities: { tools: {} },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return handleListTools(manager);
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleCallTool(manager, request);
  });

  return {
    server,
  };
};
