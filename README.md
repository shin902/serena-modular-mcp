# Modular MCP

A Model Context Protocol (MCP) proxy server that enables efficient management of large tool collections across multiple MCP servers by grouping them and loading tool schemas on-demand.

## Concept

Traditional MCP setups can overwhelm LLM context when dealing with numerous tools from multiple servers. Modular MCP solves this by:

- **Context Efficiency**: Group information is embedded in tool descriptions, so LLMs can discover available groups without making any tool calls
- **On-Demand Loading**: Retrieves detailed tool schemas only when needed for specific groups
- **Separation of Concerns**: Maintains clear phases between tool discovery and execution
- **Proxy Architecture**: Acts as a single MCP endpoint that manages multiple upstream MCP servers

## How it works?

### 1. Configuration

Create a configuration file (e.g., `modular-mcp.json`) for the upstream MCP servers you want to manage. This uses the standard MCP server configuration format, with one addition: a `description` field for each server.

Here's an example using Context7 and Playwright MCP servers:

```diff
{
+ "$schema": "https://raw.githubusercontent.com/d-kimuson/modular-mcp/refs/heads/main/config-schema.json",
  "mcpServers": {
    "context7": {
+     "description": "Use when you need to search library documentation.",
-     "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "env": {}
    },
    "playwright": {
+     "description": "Use when you need to control or automate web browsers.",
-     "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": {}
    }
  }
}
```

The `description` field is the only extension to the standard MCP configuration. It helps the LLM understand each tool group's purpose without loading detailed tool schemas.

**Note**: The `type` field defaults to `"stdio"` if not specified. For `stdio` type servers, you can omit the `type` field for cleaner configuration.

### 2. Register Modular MCP

Register Modular MCP in your MCP client configuration (e.g., `.mcp.json` for Claude Code):

```json
{
  "mcpServers": {
    "modular-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@kimuson/modular-mcp", "modular-mcp.json"],
      "env": {}
    }
  }
}
```

### 3. Two Tools Registration

When Modular MCP starts, it registers only two tools to the LLM:

- `get-modular-tools`: Retrieves tool name and schemas for a specific group
- `call-modular-tool`: Executes a tool from a specific group

The `get-modular-tools` tool description includes information about available groups, like this:

```
modular-mcp manages multiple MCP servers as organized groups, providing only the necessary group's tool descriptions to the LLM on demand instead of overwhelming it with all tool descriptions at once.

Use this tool to retrieve available tools in a specific group, then use call-modular-tool to execute them.

Available groups:
- context7: Use when you need to search library documentation.
- playwright: Use when you need to control or automate web browsers.
```

This description is passed to the LLM as part of the system prompt, allowing it to discover available groups without making any tool calls.

### 4. On-Demand Tool Loading

The LLM can now load and use tools on a per-group basis:

1. **Discovery**: The LLM sees available groups in the tool description (no tool calls needed)
2. **Exploration**: When the LLM needs playwright tools, it calls `get-modular-tools` with `group="playwright"`
3. **Execution**: The LLM uses `call-modular-tool` to execute specific tools like `browser_navigate`

For example, to automate a web browser:
```
get-modular-tools(group="playwright")
→ Returns all playwright tool schemas

call-modular-tool(group="playwright", name="browser_navigate", args={"url": "https://example.com"})
→ Executes the navigation through the playwright MCP server
```

This workflow keeps context usage minimal while providing access to all tools when needed.

## Advanced: Categories for Fine-Grained Tool Organization

In addition to organizing entire MCP servers as groups, Modular MCP supports **categories** - a way to subdivide tools within a single MCP server into logical groupings. This is particularly useful for large MCP servers like Serena that provide dozens of tools across different domains.

### When to Use Categories

- **Large MCP servers**: When a single server provides many tools (e.g., 20+ tools)
- **Logical separation**: When tools naturally group by functionality (file operations, code editing, memory management, etc.)
- **Selective exposure**: When you want to enable/disable specific tools or customize their descriptions
- **Context optimization**: When you want even finer-grained control over what tools are loaded

### Configuration Example

Here's how to configure categories using Serena MCP as an example:

```json
{
  "$schema": "https://raw.githubusercontent.com/shin902/serena-modular-mcp/refs/heads/main/config-schema.json",
  "mcpServers": {
    "serena": {
      "description": "社内コードベース操作に最適化された MCP。",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@org/serena-mcp@latest"],
      "env": {}
    }
  },
  "categories": {
    "fs": {
      "description": "ファイル/ディレクトリの読み書きと検索。",
      "server": "serena",
      "tools": {
        "includeNames": [
          "mcp__serena__read_file",
          "mcp__serena__create_text_file",
          "mcp__serena__list_dir",
          "mcp__serena__find_file"
        ],
        "overrides": {
          "mcp__serena__read_file": {
            "enabled": true,
            "description": "大きなファイルは範囲指定を推奨（O(n) 回避）。"
          }
        }
      }
    },
    "code": {
      "description": "シンボル探索とコード編集。",
      "server": "serena",
      "tools": {
        "includeNames": [
          "mcp__serena__get_symbols_overview",
          "mcp__serena__find_symbol",
          "mcp__serena__replace_symbol_body"
        ],
        "overrides": {
          "mcp__serena__replace_symbol_body": {
            "enabled": false
          }
        }
      }
    }
  }
}
```

### Category Configuration Structure

Each category has:

- **`description`**: What this category of tools provides
- **`server`**: Which MCP server (from `mcpServers`) these tools come from
- **`tools.includeNames`**: Array of tool names to include in this category
- **`tools.overrides`** (optional): Per-tool customization
  - **`enabled`**: Whether to expose this tool (default: true)
  - **`description`**: Custom description to override the original

### How Categories Work

When categories are configured:

1. **Registration**: Modular MCP exposes categories instead of server groups
2. **Discovery**: The LLM sees available categories in the tool description
3. **Loading**: Use `get-modular-tools` with `group="category-name"` to load tools for that category
4. **Execution**: Use `call-modular-tool` with the category name and tool name

Example workflow:
```
get-modular-tools(group="fs")
→ Returns file system tools from Serena

call-modular-tool(group="fs", name="mcp__serena__read_file", args={"path": "src/index.ts"})
→ Executes the file read through Serena MCP server
```

### Categories vs Groups

| Feature | Groups (MCP Servers) | Categories (Tool Subdivisions) |
|---------|---------------------|-------------------------------|
| **Scope** | Entire MCP server | Subset of tools from one server |
| **Use case** | Organize different MCP servers | Subdivide a large MCP server |
| **Configuration** | `mcpServers` section | `categories` section |
| **Tool selection** | All tools from server | Specific tools via `includeNames` |
| **Customization** | Server-level description | Per-tool overrides |

**Note**: You can use both approaches simultaneously - organize multiple servers as groups, and subdivide large servers using categories.

## Benefits

- **Reduced Context Usage**: Only loads tool information when actually needed
- **Scalable**: Can manage dozens of MCP servers without overwhelming context
- **Flexible**: Easy to add/remove tool groups without affecting others
- **Transparent**: Tools execute exactly as if called directly on upstream servers
- **Fine-Grained Control**: Categories allow precise tool selection and customization within large servers
