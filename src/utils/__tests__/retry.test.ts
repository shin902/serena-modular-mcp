import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolInfo } from "../../types.js";
import { listToolsWithRetry } from "../retry.js";

describe("listToolsWithRetry", () => {
  let mockClient: Client;

  beforeEach(() => {
    mockClient = {
      listTools: vi.fn(),
    } as unknown as Client;
    vi.clearAllMocks();
  });

  it("should return tools on first successful attempt", async () => {
    const mockTools: ToolInfo[] = [
      {
        name: "test-tool",
        description: "A test tool",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];

    vi.mocked(mockClient.listTools).mockResolvedValue({ tools: mockTools });

    const result = await listToolsWithRetry(mockClient, "test-group");

    expect(result).toEqual(mockTools);
    expect(mockClient.listTools).toHaveBeenCalledTimes(1);
  });

  it("should retry when tools list is empty", async () => {
    const mockTools: ToolInfo[] = [
      {
        name: "test-tool",
        description: "A test tool",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];

    // First two calls return empty array, third call returns tools
    vi.mocked(mockClient.listTools)
      .mockResolvedValueOnce({ tools: [] })
      .mockResolvedValueOnce({ tools: [] })
      .mockResolvedValueOnce({ tools: mockTools });

    const result = await listToolsWithRetry(mockClient, "test-group");

    expect(result).toEqual(mockTools);
    expect(mockClient.listTools).toHaveBeenCalledTimes(3);
  });

  it("should retry when listTools throws error", async () => {
    const mockTools: ToolInfo[] = [
      {
        name: "test-tool",
        description: "A test tool",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];

    // First two calls throw error, third call succeeds
    vi.mocked(mockClient.listTools)
      .mockRejectedValueOnce(new Error("Connection failed"))
      .mockRejectedValueOnce(new Error("Connection failed"))
      .mockResolvedValueOnce({ tools: mockTools });

    const result = await listToolsWithRetry(mockClient, "test-group");

    expect(result).toEqual(mockTools);
    expect(mockClient.listTools).toHaveBeenCalledTimes(3);
  });

  it("should throw error after max retries with errors", async () => {
    vi.useFakeTimers();

    // All attempts throw error
    vi.mocked(mockClient.listTools).mockRejectedValue(
      new Error("Connection failed"),
    );

    const promise = listToolsWithRetry(mockClient, "test-group");

    // Fast-forward through all retry delays
    // Delays: 500ms, 1000ms, 2000ms, 4000ms
    const advancePromise = (async () => {
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
    })();

    await expect(Promise.all([promise, advancePromise])).rejects.toThrow(
      'Failed to retrieve tools from "test-group" after 5 attempts',
    );

    expect(mockClient.listTools).toHaveBeenCalledTimes(5);
    vi.useRealTimers();
  });

  it("should return empty array if no errors but all attempts return empty", async () => {
    vi.useFakeTimers();

    // All attempts return empty array
    vi.mocked(mockClient.listTools).mockResolvedValue({ tools: [] });

    const promise = listToolsWithRetry(mockClient, "test-group");

    // Fast-forward through all retry delays
    // Delays: 500ms, 1000ms, 2000ms, 4000ms
    const advancePromise = (async () => {
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
    })();

    const [result] = await Promise.all([promise, advancePromise]);

    expect(result).toEqual([]);
    expect(mockClient.listTools).toHaveBeenCalledTimes(5);
    vi.useRealTimers();
  });

  it("should handle non-Error thrown values", async () => {
    const mockTools: ToolInfo[] = [
      {
        name: "test-tool",
        description: "A test tool",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];

    // First call throws string, second call succeeds
    vi.mocked(mockClient.listTools)
      .mockRejectedValueOnce("String error")
      .mockResolvedValueOnce({ tools: mockTools });

    const result = await listToolsWithRetry(mockClient, "test-group");

    expect(result).toEqual(mockTools);
    expect(mockClient.listTools).toHaveBeenCalledTimes(2);
  });

  it("should implement exponential backoff delays", async () => {
    vi.useFakeTimers();

    const mockTools: ToolInfo[] = [
      {
        name: "test-tool",
        description: "A test tool",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];

    // First three calls return empty, fourth succeeds
    vi.mocked(mockClient.listTools)
      .mockResolvedValueOnce({ tools: [] })
      .mockResolvedValueOnce({ tools: [] })
      .mockResolvedValueOnce({ tools: [] })
      .mockResolvedValueOnce({ tools: mockTools });

    const promise = listToolsWithRetry(mockClient, "test-group");

    // Fast-forward through delays
    // Delays should be: 500ms, 1000ms, 2000ms
    await vi.advanceTimersByTimeAsync(500); // After first retry
    await vi.advanceTimersByTimeAsync(1000); // After second retry
    await vi.advanceTimersByTimeAsync(2000); // After third retry

    const result = await promise;

    expect(result).toEqual(mockTools);
    vi.useRealTimers();
  });

  it("should return tools with multiple items", async () => {
    const mockTools: ToolInfo[] = [
      {
        name: "tool1",
        description: "Tool 1",
        inputSchema: {
          type: "object",
          properties: { param1: { type: "string" } },
          required: ["param1"],
        },
      },
      {
        name: "tool2",
        description: "Tool 2",
        inputSchema: {
          type: "object",
          properties: { param2: { type: "number" } },
        },
      },
    ];

    vi.mocked(mockClient.listTools).mockResolvedValue({ tools: mockTools });

    const result = await listToolsWithRetry(mockClient, "test-group");

    expect(result).toEqual(mockTools);
    expect(result).toHaveLength(2);
  });
});
