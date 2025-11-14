import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config-loader.js";

describe("loadConfig", () => {
  const testDir = join(process.cwd(), "test-fixtures");
  const configPath = join(testDir, "test-config.json");

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("should load and validate a valid configuration", async () => {
    const validConfig = {
      mcpServers: {
        testServer: {
          type: "stdio",
          description: "Test server",
          command: "node",
          args: ["server.js"],
        },
      },
    };

    await writeFile(configPath, JSON.stringify(validConfig));
    const config = await loadConfig(configPath);

    expect(config).toEqual(validConfig);
    expect(config.mcpServers.testServer.type).toBe("stdio");
  });

  it("should load configuration with categories", async () => {
    const configWithCategories = {
      mcpServers: {
        testServer: {
          type: "stdio",
          description: "Test server",
          command: "node",
          args: ["server.js"],
        },
      },
      categories: {
        testCategory: {
          description: "Test category",
          server: "testServer",
          tools: {
            includeNames: ["tool1", "tool2"],
          },
        },
      },
    };

    await writeFile(configPath, JSON.stringify(configWithCategories));
    const config = await loadConfig(configPath);

    expect(config.categories).toBeDefined();
    expect(config.categories?.testCategory.server).toBe("testServer");
    expect(config.categories?.testCategory.tools.includeNames).toEqual([
      "tool1",
      "tool2",
    ]);
  });

  it("should load HTTP server configuration", async () => {
    const httpConfig = {
      mcpServers: {
        httpServer: {
          type: "http",
          description: "HTTP server",
          url: "http://localhost:3000",
          headers: {
            Authorization: "Bearer token",
          },
        },
      },
    };

    await writeFile(configPath, JSON.stringify(httpConfig));
    const config = await loadConfig(configPath);

    expect(config.mcpServers.httpServer.type).toBe("http");
    expect(config.mcpServers.httpServer.url).toBe("http://localhost:3000");
  });

  it("should load SSE server configuration", async () => {
    const sseConfig = {
      mcpServers: {
        sseServer: {
          type: "sse",
          description: "SSE server",
          url: "http://localhost:3000/sse",
        },
      },
    };

    await writeFile(configPath, JSON.stringify(sseConfig));
    const config = await loadConfig(configPath);

    expect(config.mcpServers.sseServer.type).toBe("sse");
    expect(config.mcpServers.sseServer.url).toBe("http://localhost:3000/sse");
  });

  it("should throw error for invalid JSON", async () => {
    await writeFile(configPath, "{ invalid json }");

    await expect(loadConfig(configPath)).rejects.toThrow(
      "Specified configuration file is not a valid json",
    );
  });

  it("should throw error for missing required fields", async () => {
    const invalidConfig = {
      mcpServers: {
        testServer: {
          type: "stdio",
          // missing required fields: description, command
        },
      },
    };

    await writeFile(configPath, JSON.stringify(invalidConfig));

    await expect(loadConfig(configPath)).rejects.toThrow(
      "Specified configuration file is not satisfies the schema",
    );
  });

  it("should throw error when category references unknown server", async () => {
    const invalidCategoryConfig = {
      mcpServers: {
        testServer: {
          type: "stdio",
          description: "Test server",
          command: "node",
          args: ["server.js"],
        },
      },
      categories: {
        testCategory: {
          description: "Test category",
          server: "unknownServer", // This server doesn't exist
          tools: {
            includeNames: ["tool1"],
          },
        },
      },
    };

    await writeFile(configPath, JSON.stringify(invalidCategoryConfig));

    await expect(loadConfig(configPath)).rejects.toThrow(
      'Category "testCategory" references unknown server "unknownServer"',
    );
  });

  it("should handle configuration with tool overrides", async () => {
    const configWithOverrides = {
      mcpServers: {
        testServer: {
          type: "stdio",
          description: "Test server",
          command: "node",
          args: ["server.js"],
        },
      },
      categories: {
        testCategory: {
          description: "Test category",
          server: "testServer",
          tools: {
            includeNames: ["tool1", "tool2"],
            overrides: {
              tool1: {
                enabled: false,
                description: "Custom description",
              },
            },
          },
        },
      },
    };

    await writeFile(configPath, JSON.stringify(configWithOverrides));
    const config = await loadConfig(configPath);

    expect(config.categories?.testCategory.tools.overrides).toBeDefined();
    expect(config.categories?.testCategory.tools.overrides?.tool1.enabled).toBe(
      false,
    );
  });

  it("should resolve relative paths to absolute", async () => {
    const validConfig = {
      mcpServers: {
        testServer: {
          type: "stdio",
          description: "Test server",
          command: "node",
        },
      },
    };

    await writeFile(configPath, JSON.stringify(validConfig));
    const relativePath = "test-fixtures/test-config.json";
    const config = await loadConfig(relativePath);

    expect(config).toBeDefined();
  });

  it("should handle environment variables in config", async () => {
    const configWithEnv = {
      mcpServers: {
        testServer: {
          type: "stdio",
          description: "Test server",
          command: "node",
          env: {
            NODE_ENV: "test",
            API_KEY: "secret",
          },
        },
      },
    };

    await writeFile(configPath, JSON.stringify(configWithEnv));
    const config = await loadConfig(configPath);

    expect(config.mcpServers.testServer.env).toEqual({
      NODE_ENV: "test",
      API_KEY: "secret",
    });
  });
});
