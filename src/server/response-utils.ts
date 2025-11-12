import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as v from "valibot";
import type { ToolInfo } from "../types.js";

/**
 * Create a standardized error response
 * @param error - The error to convert to a response
 * @returns Formatted error response compatible with CallToolResult
 */
export function createErrorResponse(error: unknown): CallToolResult {
  const errorDetails = error instanceof v.ValiError ? error.issues : error;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: false,
          error: errorDetails,
        }),
      },
    ],
    isError: true,
  };
}

/**
 * Sanitized tool schema (without $schema property)
 */
export interface SanitizedToolSchema {
  name: string;
  description?: string;
  inputSchema: Omit<ToolInfo["inputSchema"], "$schema">;
}

/**
 * Remove $schema property from tool input schemas
 * @param tool - The tool to sanitize
 * @returns Tool with sanitized input schema
 */
export function sanitizeToolSchema(tool: ToolInfo): SanitizedToolSchema {
  const { $schema: _schemaUrl, ...inputSchema } = tool.inputSchema;
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: inputSchema,
  };
}
