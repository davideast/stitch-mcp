import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test";
import { ToolCommandHandler } from "../../../src/commands/tool/handler.js";
import type { StitchMCPClient } from "../../../src/services/mcp-client/client.js";

describe("ToolCommandHandler", () => {
  let mockClient: any;
  let mockGetCapabilities: any;
  let mockCallTool: any;

  beforeEach(() => {
    mockGetCapabilities = mock();
    mockCallTool = mock();

    // Create a mock client that matches the interface expected by ToolCommandHandler
    mockClient = {
      getCapabilities: mockGetCapabilities,
      callTool: mockCallTool,
    };
  });

  it("should list tools when no tool name is provided", async () => {
    const tools = [
      { name: "tool1", description: "desc1" },
      { name: "tool2", description: "desc2" }
    ];
    mockGetCapabilities.mockResolvedValue({ tools });

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({
      showSchema: false,
      output: "pretty"
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(tools);
    expect(mockGetCapabilities).toHaveBeenCalled();
  });

  it("should show schema when --schema is used", async () => {
    const tool = {
      name: "create_project",
      description: "Creates a project",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Project title" }
        },
        required: ["title"]
      }
    };
    mockGetCapabilities.mockResolvedValue({ tools: [tool] });

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({
      toolName: "create_project",
      showSchema: true,
      output: "pretty"
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: "create_project",
      description: "Creates a project",
      arguments: {
        title: "string (required) - Project title"
      },
      example: `stitch-mcp tool create_project -d '{"title":"<title>"}'`
    });
  });

  it("should return error if tool not found when showing schema", async () => {
    mockGetCapabilities.mockResolvedValue({ tools: [] });

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({
      toolName: "unknown_tool",
      showSchema: true,
      output: "pretty"
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Tool not found");
  });

  it("should execute tool with data", async () => {
    const mockResult = { id: "123", title: "My Project" };
    mockCallTool.mockResolvedValue(mockResult);

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({
      toolName: "create_project",
      data: '{"title": "My Project"}',
      showSchema: false,
      output: "pretty"
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResult);
    expect(mockCallTool).toHaveBeenCalledWith("create_project", { title: "My Project" });
  });

  it("should execute tool with data file", async () => {
    const mockResult = { id: "123", title: "My Project" };
    mockCallTool.mockResolvedValue(mockResult);

    // Mock Bun.file
    const mockFileText = mock(() => Promise.resolve('{"title": "My Project"}'));
    spyOn(Bun, "file").mockReturnValue({ text: mockFileText } as any);

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({
      toolName: "create_project",
      dataFile: "@data.json",
      showSchema: false,
      output: "pretty"
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResult);
    expect(mockCallTool).toHaveBeenCalledWith("create_project", { title: "My Project" });
    expect(Bun.file).toHaveBeenCalledWith("data.json");
  });
});
