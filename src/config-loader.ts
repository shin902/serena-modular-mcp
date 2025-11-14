import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as v from "valibot";
import { logger } from "./logger.js";
import { type ServerConfig, serverConfigSchema } from "./types.js";

/**
 * Load and validate proxy configuration from a JSON file
 * @param configPath Path to configuration file (relative or absolute)
 * @returns Parsed and validated configuration
 */
export const loadConfig = async (configPath: string): Promise<ServerConfig> => {
  const absolutePath = resolve(configPath);
  const fileContent = await readFile(absolutePath, "utf-8");

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(
      `Specified configuration file is not a valid json: ${absolutePath}`,
      {
        cause: error,
      },
    );
  }

  // Validate schema
  const config = v.safeParse(serverConfigSchema, parsed);

  if (!config.success) {
    throw new Error(
      `Specified configuration file does not satisfy the schema: ${absolutePath}`,
      {
        cause: v.flatten(config.issues).nested,
      },
    );
  }

  logger.info(`MCP server config loaded successfully.`);

  // Validate categories if present
  if (config.output.categories) {
    validateCategories(config.output);
  }

  return config.output;
};

/**
 * Validate category configuration
 * - Check that category.server references exist in mcpServers
 * - Warn about duplicate tool names across categories
 */
function validateCategories(config: ServerConfig): void {
  const categories = config.categories;
  if (!categories) {
    return;
  }

  const serverNames = Object.keys(config.mcpServers);
  const allToolNames = new Set<string>();

  for (const [categoryName, categoryConfig] of Object.entries(categories)) {
    // Validate server reference
    if (!serverNames.includes(categoryConfig.server)) {
      throw new Error(
        `Category "${categoryName}" references unknown server "${categoryConfig.server}". Available servers: [${serverNames.join(", ")}]`,
      );
    }

    // Check for duplicate tool names
    for (const toolName of categoryConfig.tools.includeNames) {
      if (allToolNames.has(toolName)) {
        logger.warn(
          `Tool "${toolName}" in category "${categoryName}" is already included in another category`,
        );
      }
      allToolNames.add(toolName);
    }

    // Warn about unknown tools in overrides (can only warn, not error, since we don't know upstream tools yet)
    if (categoryConfig.tools.overrides) {
      for (const toolName of Object.keys(categoryConfig.tools.overrides)) {
        if (!categoryConfig.tools.includeNames.includes(toolName)) {
          logger.warn(
            `Category "${categoryName}" has override for tool "${toolName}" which is not in includeNames`,
          );
        }
      }
    }
  }

  logger.info(
    `Category validation complete. ${Object.keys(categories).length} categories configured.`,
  );
}
