import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { virtualTools } from "../../../src/commands/tool/virtual-tools.js";
import { SiteService } from "../../../src/lib/services/site/SiteService.js";

describe("Virtual Tools", () => {
  let mockClient: any;
  let mockCallTool: any;

  beforeEach(() => {
    mockCallTool = mock();
    mockClient = {
      callTool: mockCallTool,
    };

    // Reset global fetch mock
    global.fetch = mock(() => Promise.resolve(new Response(""))) as any;
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

  describe("build_site", () => {
    const tool = virtualTools.find(t => t.name === "build_site")!;

    const mockRemoteScreens = {
      screens: [
        {
          name: "screen-1",
          title: "Home Screen",
          htmlCode: { downloadUrl: "http://example.com/screen1.html" },
        },
        {
          name: "screen-2",
          title: "About Screen",
          htmlCode: { downloadUrl: "http://example.com/screen2.html" },
        },
      ],
    };

    let generateSiteSpy: any;

    beforeEach(() => {
      generateSiteSpy = spyOn(SiteService, "generateSite").mockResolvedValue(undefined);
      generateSiteSpy.mockClear();
      generateSiteSpy.mockResolvedValue(undefined);
    });

    afterEach(() => {
      generateSiteSpy.mockRestore();
    });

    it("should be registered with correct schema", () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe("build_site");
      expect(tool.inputSchema!.required).toContain("projectId");
      expect(tool.inputSchema!.required).toContain("routes");
      expect(tool.inputSchema!.properties!.outputDir).toBeDefined();
    });

    it("should generate a site successfully", async () => {
      mockCallTool.mockResolvedValue(mockRemoteScreens);
      const fetchMock = mock(async (url: any) => {
        if (url === "http://example.com/screen1.html") {
          return new Response("<html>Home</html>", { status: 200 });
        }
        if (url === "http://example.com/screen2.html") {
          return new Response("<html>About</html>", { status: 200 });
        }
        return new Response("", { status: 404 });
      });
      global.fetch = fetchMock as any;

      const result = await tool.execute(mockClient, {
        projectId: "123",
        routes: [
          { screenId: "screen-1", route: "/" },
          { screenId: "screen-2", route: "/about" },
        ],
        outputDir: "/tmp/test-site",
      });

      expect(result.success).toBe(true);
      expect(result.outputDir).toBe("/tmp/test-site");
      expect(result.pages).toHaveLength(2);
      expect(result.pages[0]).toEqual({ screenId: "screen-1", route: "/", title: "Home Screen" });
      expect(result.pages[1]).toEqual({ screenId: "screen-2", route: "/about", title: "About Screen" });
      expect(generateSiteSpy).toHaveBeenCalledTimes(1);
    });

    it("should throw when screen ID is not found", async () => {
      mockCallTool.mockResolvedValue(mockRemoteScreens);

      await expect(
        tool.execute(mockClient, {
          projectId: "123",
          routes: [{ screenId: "nonexistent", route: "/" }],
        })
      ).rejects.toThrow("Screen IDs not found in project: nonexistent");
    });

    it("should throw for empty routes array", async () => {
      await expect(
        tool.execute(mockClient, {
          projectId: "123",
          routes: [],
        })
      ).rejects.toThrow("non-empty array");
    });

    it("should throw when routes is not an array", async () => {
      await expect(
        tool.execute(mockClient, {
          projectId: "123",
          routes: "not-an-array",
        })
      ).rejects.toThrow("routes must be an array");
    });

    it("should throw on HTML fetch failure", async () => {
      mockCallTool.mockResolvedValue(mockRemoteScreens);
      // Mock setTimeout to avoid waiting for retry backoff
      const origSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = ((fn: Function) => { fn(); return 0; }) as any;

      const fetchMock = mock(async () => {
        return new Response("Too Many Requests", { status: 429, statusText: "Too Many Requests" });
      });
      global.fetch = fetchMock as any;

      await expect(
        tool.execute(mockClient, {
          projectId: "123",
          routes: [{ screenId: "screen-1", route: "/" }],
        })
      ).rejects.toThrow("Failed to fetch HTML for screens");

      globalThis.setTimeout = origSetTimeout;
    });

    it("should throw on duplicate routes", async () => {
      await expect(
        tool.execute(mockClient, {
          projectId: "123",
          routes: [
            { screenId: "screen-1", route: "/" },
            { screenId: "screen-2", route: "/" },
          ],
        })
      ).rejects.toThrow("Duplicate route paths found: /");
    });

    it("should construct all routes as 'included'", async () => {
      mockCallTool.mockResolvedValue(mockRemoteScreens);
      const fetchMock = mock(async () => new Response("<html></html>", { status: 200 }));
      global.fetch = fetchMock as any;

      await tool.execute(mockClient, {
        projectId: "123",
        routes: [
          { screenId: "screen-1", route: "/" },
          { screenId: "screen-2", route: "/about" },
        ],
      });

      const config = generateSiteSpy.mock.calls[0][0];
      expect(config.routes.every((r: any) => r.status === "included")).toBe(true);
    });

    it("should default outputDir to '.'", async () => {
      mockCallTool.mockResolvedValue(mockRemoteScreens);
      const fetchMock = mock(async () => new Response("<html></html>", { status: 200 }));
      global.fetch = fetchMock as any;

      await tool.execute(mockClient, {
        projectId: "123",
        routes: [{ screenId: "screen-1", route: "/" }],
      });

      const outputDir = generateSiteSpy.mock.calls[0][3];
      expect(outputDir).toBe(".");
    });

    it("should pass HTML content map correctly", async () => {
      mockCallTool.mockResolvedValue(mockRemoteScreens);
      const fetchMock = mock(async (url: any) => {
        if (url === "http://example.com/screen1.html") {
          return new Response("<html>Home</html>", { status: 200 });
        }
        return new Response("<html>About</html>", { status: 200 });
      });
      global.fetch = fetchMock as any;

      await tool.execute(mockClient, {
        projectId: "123",
        routes: [
          { screenId: "screen-1", route: "/" },
          { screenId: "screen-2", route: "/about" },
        ],
      });

      const htmlMap = generateSiteSpy.mock.calls[0][1] as Map<string, string>;
      expect(htmlMap.get("screen-1")).toBe("<html>Home</html>");
      expect(htmlMap.get("screen-2")).toBe("<html>About</html>");
    });

    it("should throw for entries missing route string", async () => {
      await expect(
        tool.execute(mockClient, {
          projectId: "123",
          routes: [{ screenId: "screen-1" }],
        })
      ).rejects.toThrow('Each route entry must have a "route" string');
    });
  });
});
