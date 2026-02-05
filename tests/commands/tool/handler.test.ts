import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { ToolCommandHandler } from "../../../src/commands/tool/handler.js";

describe("ToolCommandHandler", () => {
  let mockClient: any;
  let mockGetCapabilities: any;
  let mockCallTool: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockGetCapabilities = mock();
    mockCallTool = mock();

    // Create a mock client that matches the interface expected by ToolCommandHandler
    mockClient = {
      getCapabilities: mockGetCapabilities,
      callTool: mockCallTool,
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
    // Should now contain both server tools and virtual tools
    expect(result.data).toContainEqual(expect.objectContaining({ name: "tool1" }));
    expect(result.data).toContainEqual(expect.objectContaining({ name: "tool2" }));
    expect(result.data).toContainEqual(expect.objectContaining({ name: "get_screen_code" }));
    expect(mockGetCapabilities).toHaveBeenCalled();
  });

  it("should list tools when tool name is 'list'", async () => {
    const tools = [
      { name: "tool1", description: "desc1" },
      { name: "tool2", description: "desc2" }
    ];
    mockGetCapabilities.mockResolvedValue({ tools });

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({
      toolName: "list",
      showSchema: false,
      output: "pretty"
    });

    expect(result.success).toBe(true);
    // Should now contain both server tools and virtual tools
    expect(result.data).toContainEqual(expect.objectContaining({ name: "tool1" }));
    expect(result.data).toContainEqual(expect.objectContaining({ name: "tool2" }));
    expect(result.data).toContainEqual(expect.objectContaining({ name: "get_screen_code" }));
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

  it("should execute get_project tool correctly", async () => {
    const mockResult = {
      name: "projects/123",
      title: "My Project",
      thumbnailScreenshot: { downloadUrl: "http://example.com/img.png" }
    };
    mockCallTool.mockResolvedValue(mockResult);

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({
      toolName: "get_project",
      data: '{"name": "projects/123"}',
      showSchema: false,
      output: "pretty"
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResult);
    expect(mockCallTool).toHaveBeenCalledWith("get_project", { name: "projects/123" });
  });

  it("should execute get_screen tool correctly", async () => {
    const mockResult = {
      name: "projects/123/screens/abc",
      title: "Login Screen",
      deviceType: "MOBILE"
    };
    mockCallTool.mockResolvedValue(mockResult);

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({
      toolName: "get_screen",
      data: '{"projectId": "123", "screenId": "abc"}',
      showSchema: false,
      output: "pretty"
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResult);
    expect(mockCallTool).toHaveBeenCalledWith("get_screen", { projectId: "123", screenId: "abc" });
    expect(mockCallTool).toHaveBeenCalledWith("get_screen", { projectId: "123", screenId: "abc" });
  });

  it("should list virtual tools alongside server tools", async () => {
    const serverTools = [{ name: "server_tool", description: "desc" }];
    mockGetCapabilities.mockResolvedValue({ tools: serverTools });

    const handler = new ToolCommandHandler(mockClient);
    const tools = await handler.listTools();

    expect(tools).toContainEqual(expect.objectContaining({ name: "get_screen_code" }));
    expect(tools).toContainEqual(expect.objectContaining({ name: "server_tool" }));
  });

  it("should execute virtual tool when name matches", async () => {
    // Mock get_screen for the virtual tool to use
    const mockScreen = {
      name: "projects/123/screens/abc",
      title: "Test Screen"
    };
    mockCallTool.mockResolvedValue(mockScreen);

    // Also, we need to mock fetch to avoid network errors
    global.fetch = mock(() => Promise.resolve(new Response(""))) as any;

    const handler = new ToolCommandHandler(mockClient);
    const result = await handler.execute({
      toolName: "get_screen_code",
      data: '{"projectId": "123", "screenId": "abc"}',
      showSchema: false,
      output: "pretty"
    });

    expect(result.success).toBe(true);
    expect(mockCallTool).toHaveBeenCalledWith("get_screen", { projectId: "123", screenId: "abc" });
    // result.data should be the composite object
    expect(result.data.name).toBe(mockScreen.name);
  });
});

