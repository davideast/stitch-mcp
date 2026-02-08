import { describe, it, expect, mock, beforeEach } from "bun:test";
import { getScreenCodeTool } from "../../../../src/commands/tool/virtual-tools/get-screen-code.js";

describe("get_screen_code virtual tool", () => {
  let mockClient: any;
  let mockCallTool: any;

  beforeEach(() => {
    mockCallTool = mock();
    mockClient = { callTool: mockCallTool };
    global.fetch = mock(() => Promise.resolve(new Response(""))) as any;
  });

  it("should fetch screen and download HTML code", async () => {
    const mockScreen = {
      name: "projects/123/screens/abc",
      title: "Test Screen",
      htmlCode: { downloadUrl: "http://example.com/code.html" },
    };
    mockCallTool.mockResolvedValue(mockScreen);

    const fetchMock = mock(async (url: any) => {
      if (url === "http://example.com/code.html") {
        return new Response("<html></html>", { status: 200 });
      }
      return new Response("", { status: 404 });
    });
    global.fetch = fetchMock as any;

    const result = await getScreenCodeTool.execute(mockClient, { projectId: "123", screenId: "abc" });

    expect(mockCallTool).toHaveBeenCalledWith("get_screen", { projectId: "123", screenId: "abc" });
    expect(result.htmlContent).toBe("<html></html>");
    expect(result.name).toBe(mockScreen.name);
  });

  it("should handle missing download URL gracefully", async () => {
    const mockScreen = { name: "projects/123/screens/abc", title: "Test Screen" };
    mockCallTool.mockResolvedValue(mockScreen);

    const result = await getScreenCodeTool.execute(mockClient, { projectId: "123", screenId: "abc" });

    expect(result.htmlContent).toBeNull();
  });

  it("should strip extra arguments before calling get_screen", async () => {
    const mockScreen = { name: "projects/123/screens/abc" };
    mockCallTool.mockResolvedValue(mockScreen);

    await getScreenCodeTool.execute(mockClient, { projectId: "123", screenId: "abc", extraArg: "ignored" });

    expect(mockCallTool).toHaveBeenCalledWith("get_screen", { projectId: "123", screenId: "abc" });
  });
});
