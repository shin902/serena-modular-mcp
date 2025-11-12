import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { RETRY_CONFIG } from "../constants.js";
import { logger } from "../logger.js";
import type { ToolInfo } from "../types.js";

/**
 * List tools with retry logic to wait for upstream server to be ready
 * Uses exponential backoff with inter-attempt delays: 500ms, 1s, 2s, 4s (maximum 5 retries)
 * Total maximum wait time: ~7.5 seconds
 *
 * @param client - The MCP client
 * @param groupName - The group name for logging
 * @returns The list of tools from the upstream server
 * @throws Error if all retry attempts are exhausted
 */
export async function listToolsWithRetry(
  client: Client,
  groupName: string,
): Promise<ToolInfo[]> {
  const { MAX_RETRIES, BASE_DELAY_MS } = RETRY_CONFIG;
  let lastError: Error | null = null;
  let lastTools: ToolInfo[] = [];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { tools } = await client.listTools();
      lastTools = tools;
      if (tools.length > 0) {
        logger.info(
          `Successfully retrieved ${tools.length} tools from "${groupName}" on attempt ${attempt}`,
        );
        return tools;
      }
      // Tools list is empty, server might still be initializing
      logger.warn(
        `No tools available from "${groupName}" on attempt ${attempt}, retrying...`,
      );
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(`Failed to list tools: ${String(error)}`);
      logger.warn(
        `Attempt ${attempt}/${MAX_RETRIES} to list tools from "${groupName}" failed: ${lastError.message}`,
      );
    }

    if (attempt < MAX_RETRIES) {
      // Exponential backoff inter-attempt delays: 500ms, 1s, 2s, 4s
      const waitMs = BASE_DELAY_MS * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  // If all retries are exhausted but the last attempt returned an empty array without error
  if (lastError === null && lastTools.length === 0) {
    logger.warn(
      `Server "${groupName}" returned 0 tools after ${MAX_RETRIES} attempts, but no errors occurred`,
    );
    return lastTools;
  }

  throw new Error(
    `Failed to retrieve tools from "${groupName}" after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || "Unknown error"}`,
  );
}
