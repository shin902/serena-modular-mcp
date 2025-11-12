import type {
  CallToolRequest,
  CallToolResult,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import * as v from "valibot";
import type { ClientManager } from "../client-manager.js";
import { createErrorResponse, sanitizeToolSchema } from "./response-utils.js";
import {
  callCategoryToolSchema,
  callToolSchema,
  getCategoryToolsSchema,
  getToolsSchema,
} from "./schemas.js";

/**
 * Handle ListTools request
 * @param manager - Client manager instance
 * @returns List of available tools
 */
export async function handleListTools(
  manager: ClientManager,
): Promise<ListToolsResult> {
  const categories = manager.listCategories();
  const hasCategories = categories.length > 0;

  if (hasCategories) {
    // Category mode: Use new category-based tools
    return buildCategoryModeResponse(categories);
  }

  // Legacy group mode: Use original group-based tools
  return buildGroupModeResponse(manager);
}

/**
 * Build response for category mode
 */
function buildCategoryModeResponse(
  categories: Array<{ name: string; description: string }>,
): ListToolsResult {
  const categoryNames = categories.map((c) => c.name);
  const categoriesDescription = categories
    .map((c) => `- ${c.name}: ${c.description}`)
    .join("\n");

  return {
    tools: [
      {
        name: "get-category-tools",
        description: `Retrieve available tools for a specific category. This MCP server organizes tools by category, allowing you to load only the tool schemas you need.\n\nAvailable categories:\n${categoriesDescription}\n\nWorkflow:\n1. Call this tool with a category name to get available tool schemas\n2. Use call-category-tool to execute the tools`,
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "The name of the category to get tools from",
              enum: categoryNames,
            },
          },
          required: ["category"],
        },
      },
      {
        name: "call-category-tool",
        description:
          "Execute a tool from a specific category. Proxies the call to the appropriate upstream MCP server.\n\nWorkflow:\n1. First call get-category-tools to discover available tools and their schemas\n2. Then use this tool to execute them with the appropriate arguments",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "The name of the category containing the tool",
              enum: categoryNames,
            },
            name: {
              type: "string",
              description: "The name of the tool to execute",
            },
            args: {
              type: "object",
              description: "Arguments to pass to the tool",
              additionalProperties: true,
            },
          },
          required: ["category", "name", "args"],
        },
      },
    ],
  };
}

/**
 * Build response for group mode (legacy)
 */
function buildGroupModeResponse(manager: ClientManager): ListToolsResult {
  const groups = manager.listGroups();
  const groupNames = groups.map((g) => g.name);
  const groupsDescription = groups
    .map((g) => `- ${g.name}: ${g.description}`)
    .join("\n");

  const failedGroups = manager.listFailedGroups();
  const unavailableGroupsDescription =
    failedGroups.length > 0
      ? `\n\nUnavailable groups (connection failed):\n${failedGroups
          .map((g) => `- ${g.name}: ${g.description} (Error: ${g.error})`)
          .join("\n")}`
      : "";

  return {
    tools: [
      {
        name: "get-modular-tools",
        description: `modular-mcp manages multiple MCP servers as organized groups, providing only the necessary group's tool descriptions to the LLM on demand instead of overwhelming it with all tool descriptions at once.\n\nUse this tool to retrieve available tools in a specific group, then use call-modular-tool to execute them.\n\nAvailable groups:\n${groupsDescription}${unavailableGroupsDescription}`,
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "The name of the MCP group to get tools from",
              enum: groupNames,
            },
          },
          required: ["group"],
        },
      },
      {
        name: "call-modular-tool",
        description:
          "Execute a tool from a specific MCP group. Proxies the call to the appropriate upstream MCP server. Use get-modular-tools first to discover available tools and their input schemas in the specified group, then use this tool to execute them. This maintains a clean separation between discovery (context-efficient) and execution phases, enabling effective management of large tool collections across multiple MCP servers.",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "The name of the MCP group containing the tool",
              enum: groupNames,
            },
            name: {
              type: "string",
              description: "The name of the tool to execute",
            },
            args: {
              type: "object",
              description: "Arguments to pass to the tool",
              additionalProperties: true,
            },
          },
          required: ["group", "name"],
        },
      },
    ],
  };
}

/**
 * Handle CallTool request
 * @param manager - Client manager instance
 * @param request - The tool call request
 * @returns Tool execution result
 */
export async function handleCallTool(
  manager: ClientManager,
  request: CallToolRequest,
): Promise<CallToolResult> {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "get-category-tools":
      return handleGetCategoryTools(manager, args);
    case "call-category-tool":
      return handleCallCategoryTool(manager, args);
    case "get-modular-tools":
      return handleGetModularTools(manager, args);
    case "call-modular-tool":
      return handleCallModularTool(manager, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Handle get-category-tools request
 */
async function handleGetCategoryTools(
  manager: ClientManager,
  args: unknown,
): Promise<CallToolResult> {
  const parsedArgs = v.safeParse(getCategoryToolsSchema, args);
  if (!parsedArgs.success) {
    return createErrorResponse(parsedArgs.issues);
  }

  try {
    const result = await manager.getCategoryTools(parsedArgs.output.category);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
        },
      ],
    };
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * Handle call-category-tool request
 */
async function handleCallCategoryTool(
  manager: ClientManager,
  args: unknown,
): Promise<CallToolResult> {
  const parsedArgs = v.safeParse(callCategoryToolSchema, args);
  if (!parsedArgs.success) {
    return createErrorResponse(parsedArgs.issues);
  }

  try {
    const result = await manager.callCategoryTool(
      parsedArgs.output.category,
      parsedArgs.output.name,
      parsedArgs.output.args,
    );

    // Type assertion: upstream MCP server response is compatible with CallToolResult
    return result as CallToolResult;
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * Handle get-modular-tools request
 */
async function handleGetModularTools(
  manager: ClientManager,
  args: unknown,
): Promise<CallToolResult> {
  const parsedArgs = v.safeParse(getToolsSchema, args);
  if (!parsedArgs.success) {
    return createErrorResponse(parsedArgs.issues);
  }

  const tools = await manager.listTools(parsedArgs.output.group);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(tools.map(sanitizeToolSchema)),
      },
    ],
  };
}

/**
 * Handle call-modular-tool request
 */
async function handleCallModularTool(
  manager: ClientManager,
  args: unknown,
): Promise<CallToolResult> {
  const parsedArgs = v.safeParse(callToolSchema, args);
  if (!parsedArgs.success) {
    return createErrorResponse(parsedArgs.issues);
  }

  try {
    const result = await manager.callTool(
      parsedArgs.output.group,
      parsedArgs.output.name,
      parsedArgs.output.args,
    );

    // Type assertion: upstream MCP server response is compatible with CallToolResult
    return result as CallToolResult;
  } catch (error) {
    return createErrorResponse(error);
  }
}
