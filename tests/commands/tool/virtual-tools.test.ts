import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { virtualTools } from "../../../src/commands/tool/virtual-tools.js";

describe("Virtual Tools", () => {
  let mockClient: any;
  let mockCallTool: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockCallTool = mock();
    mockClient = {
      callTool: mockCallTool,
    };

    // Reset global fetch mock
    global.fetch = mock(() => Promise.resolve(new Response(""))) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("get_screen_code", () => {
    it("should fetch screen and download HTML code", async () => {
      const tool = virtualTools.find(t => t.name === "get_screen_code");
      expect(tool).toBeDefined();

      const mockScreen = {
        name: "projects/123/screens/abc",
        title: "Test Screen",
        htmlCode: { downloadUrl: "http://example.com/code.html" }
      };
      mockCallTool.mockResolvedValue(mockScreen);

      const fetchMock = mock(async (url: any) => {
        if (url === "http://example.com/code.html") {
          return new Response("<html></html>", { status: 200 });
        }
        return new Response("", { status: 404 });
      });
      global.fetch = fetchMock as any;

      const result = await tool!.execute(mockClient, { projectId: "123", screenId: "abc" });

      expect(mockCallTool).toHaveBeenCalledWith("get_screen", { projectId: "123", screenId: "abc" });
      expect(result.htmlContent).toBe("<html></html>");
      expect(result.name).toBe(mockScreen.name);
    });

    it("should handle missing download URL gracefully", async () => {
      const tool = virtualTools.find(t => t.name === "get_screen_code");
      const mockScreen = { name: "projects/123/screens/abc", title: "Test Screen" };
      mockCallTool.mockResolvedValue(mockScreen);

      const result = await tool!.execute(mockClient, { projectId: "123", screenId: "abc" });

      expect(result.htmlContent).toBeNull();
    });

    it("should strip extra arguments before calling get_screen", async () => {
      const tool = virtualTools.find(t => t.name === "get_screen_code");
      const mockScreen = { name: "projects/123/screens/abc" };
      mockCallTool.mockResolvedValue(mockScreen);

      await tool!.execute(mockClient, { projectId: "123", screenId: "abc", extraArg: "ignored" });

      expect(mockCallTool).toHaveBeenCalledWith("get_screen", { projectId: "123", screenId: "abc" });
    });
  });

  describe("get_screen_image", () => {
    it("should fetch screen and download screenshot", async () => {
      const tool = virtualTools.find(t => t.name === "get_screen_image");
      expect(tool).toBeDefined();

      const mockScreen = {
        name: "projects/123/screens/abc",
        title: "Test Screen",
        screenshot: { downloadUrl: "http://example.com/image.png" }
      };
      mockCallTool.mockResolvedValue(mockScreen);

      const fetchMock = mock(async (url: any) => {
        if (url === "http://example.com/image.png") {
          return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        }
        return new Response("", { status: 404 });
      });
      global.fetch = fetchMock as any;

      const result = await tool!.execute(mockClient, { projectId: "123", screenId: "abc" });

      expect(mockCallTool).toHaveBeenCalledWith("get_screen", { projectId: "123", screenId: "abc" });
      expect(result.screenshotBase64).toBe(Buffer.from([1, 2, 3]).toString('base64'));
      expect(result.name).toBe(mockScreen.name);
    });

    it("should handle missing download URL gracefully", async () => {
      const tool = virtualTools.find(t => t.name === "get_screen_image");
      const mockScreen = { name: "projects/123/screens/abc", title: "Test Screen" };
      mockCallTool.mockResolvedValue(mockScreen);

      const result = await tool!.execute(mockClient, { projectId: "123", screenId: "abc" });

      expect(result.screenshotBase64).toBeNull();
    });

    it("should strip extra arguments before calling get_screen", async () => {
      const tool = virtualTools.find(t => t.name === "get_screen_image");
      const mockScreen = { name: "projects/123/screens/abc" };
      mockCallTool.mockResolvedValue(mockScreen);

      await tool!.execute(mockClient, { projectId: "123", screenId: "abc", extraArg: "ignored" });

      expect(mockCallTool).toHaveBeenCalledWith("get_screen", { projectId: "123", screenId: "abc" });
    });
  });
});
