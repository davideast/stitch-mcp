import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test";
import { ToolCommandHandler } from "../../../src/commands/tool/handler.js";
import { createMockStitch, createMockProject, createMockScreen } from '../../../src/services/stitch-sdk/MockStitchSDK.js';
import * as stitchSdk from '@google/stitch-sdk';

mock.module('@google/stitch-sdk', () => ({
  stitch: createMockStitch(createMockProject('123', [
      createMockScreen({ screenId: 'abc', projectId: '123' }),
  ]))
}));

describe("ToolCommandHandler (integration)", () => {
  let mockClient: any;
  let mockListTools: any;
  let mockCallTool: any;

  beforeEach(() => {
    mockListTools = mock();
    mockCallTool = mock();
    mockClient = {
      listTools: mockListTools,
      callTool: mockCallTool,
      close: mock(),
    };
  });

  it("should return tool list when no toolName is provided", async () => {
    const serverTools = [{ name: "server_tool", description: "desc" }];
    mockListTools.mockResolvedValue({ tools: serverTools });

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({ showSchema: false, output: "pretty" });

    expect(result.success).toBe(true);
    expect(result.data).toContainEqual(expect.objectContaining({ name: "server_tool" }));
    expect(result.data).toContainEqual(expect.objectContaining({ name: "get_screen_code" }));
  });

  it("should return formatted schema with --schema flag", async () => {
    const tool = {
      name: "create_project",
      description: "Creates a project",
      inputSchema: {
        type: "object",
        properties: { title: { type: "string", description: "Project title" } },
        required: ["title"],
      },
    };
    mockListTools.mockResolvedValue({ tools: [tool] });

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({
      toolName: "create_project",
      showSchema: true,
      output: "pretty",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: "create_project",
      description: "Creates a project",
      virtual: false,
      arguments: { title: "string (required) - Project title" },
      example: `stitch-mcp tool create_project -d '{"title":"<title>"}'`,
    });
  });

  it("should execute server tool with -d data", async () => {
    const mockResult = { id: "123", title: "My Project" };
    mockCallTool.mockResolvedValue(mockResult);
    mockListTools.mockResolvedValue({ tools: [{ name: "create_project" }] });

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({
      toolName: "create_project",
      data: '{"title": "My Project"}',
      showSchema: false,
      output: "pretty",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResult);
    expect(mockCallTool).toHaveBeenCalledWith("create_project", { title: "My Project" });
  });

  it("should route to virtual tool when name matches", async () => {
    mockListTools.mockResolvedValue({ tools: [] });
    global.fetch = mock(() => Promise.resolve(new Response("<html>hello</html>"))) as any;

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({
      toolName: "get_screen_code",
      data: '{"projectId": "123", "screenId": "abc"}',
      showSchema: false,
      output: "pretty",
    });

    expect(result.success).toBe(true);
    expect(result.data.screenId).toBe("abc");
  });
});
