import { describe, it, expect, mock, beforeEach } from "bun:test";
import { getScreenImageTool } from "../../../../src/commands/tool/virtual-tools/get-screen-image.js";

describe("get_screen_image virtual tool", () => {
  let mockClient: any;
  let mockCallTool: any;

  beforeEach(() => {
    mockCallTool = mock();
    mockClient = { callTool: mockCallTool };
    global.fetch = mock(() => Promise.resolve(new Response(""))) as any;
  });

  it("should fetch screen and download screenshot", async () => {
    const mockScreen = {
      name: "projects/123/screens/abc",
      title: "Test Screen",
      screenshot: { downloadUrl: "http://example.com/image.png" },
    };
    mockCallTool.mockResolvedValue(mockScreen);

    const fetchMock = mock(async (url: any) => {
      if (url === "http://example.com/image.png") {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }
      return new Response("", { status: 404 });
    });
    global.fetch = fetchMock as any;

    const result = await getScreenImageTool.execute(mockClient, { projectId: "123", screenId: "abc" });

    expect(mockCallTool).toHaveBeenCalledWith("get_screen", { projectId: "123", screenId: "abc" });
    expect(result.screenshotBase64).toBe(Buffer.from([1, 2, 3]).toString("base64"));
    expect(result.name).toBe(mockScreen.name);
  });

  it("should handle missing download URL gracefully", async () => {
    const mockScreen = { name: "projects/123/screens/abc", title: "Test Screen" };
    mockCallTool.mockResolvedValue(mockScreen);

    const result = await getScreenImageTool.execute(mockClient, { projectId: "123", screenId: "abc" });

    expect(result.screenshotBase64).toBeNull();
  });

  it("should strip extra arguments before calling get_screen", async () => {
    const mockScreen = { name: "projects/123/screens/abc" };
    mockCallTool.mockResolvedValue(mockScreen);

    await getScreenImageTool.execute(mockClient, { projectId: "123", screenId: "abc", extraArg: "ignored" });

    expect(mockCallTool).toHaveBeenCalledWith("get_screen", { projectId: "123", screenId: "abc" });
  });
});
