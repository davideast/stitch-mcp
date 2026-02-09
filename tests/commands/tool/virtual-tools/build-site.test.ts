import { describe, it, expect, mock, beforeEach } from "bun:test";
import { buildSiteTool } from "../../../../src/commands/tool/virtual-tools/build-site.js";

describe("build_site virtual tool", () => {
  let mockClient: any;
  let mockCallTool: any;

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

  beforeEach(() => {
    mockCallTool = mock();
    mockClient = { callTool: mockCallTool };

    global.fetch = mock(() => Promise.resolve(new Response(""))) as any;
  });

  it("should be registered with correct schema", () => {
    expect(buildSiteTool.name).toBe("build_site");
    expect(buildSiteTool.inputSchema!.required).toContain("projectId");
    expect(buildSiteTool.inputSchema!.required).toContain("routes");
    expect(buildSiteTool.inputSchema!.properties!.outputDir).toBeUndefined();
  });

  it("should return pages with raw HTML", async () => {
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

    const result = await buildSiteTool.execute(mockClient, {
      projectId: "123",
      routes: [
        { screenId: "screen-1", route: "/" },
        { screenId: "screen-2", route: "/about" },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toEqual({
      screenId: "screen-1",
      route: "/",
      title: "Home Screen",
      html: "<html>Home</html>",
    });
    expect(result.pages[1]).toEqual({
      screenId: "screen-2",
      route: "/about",
      title: "About Screen",
      html: "<html>About</html>",
    });
  });

  it("should throw when screen ID is not found", async () => {
    mockCallTool.mockResolvedValue(mockRemoteScreens);

    await expect(
      buildSiteTool.execute(mockClient, {
        projectId: "123",
        routes: [{ screenId: "nonexistent", route: "/" }],
      })
    ).rejects.toThrow("Screen IDs not found in project: nonexistent");
  });

  it("should throw for empty routes array", async () => {
    await expect(
      buildSiteTool.execute(mockClient, {
        projectId: "123",
        routes: [],
      })
    ).rejects.toThrow("non-empty array");
  });

  it("should throw when routes is not an array", async () => {
    await expect(
      buildSiteTool.execute(mockClient, {
        projectId: "123",
        routes: "not-an-array",
      })
    ).rejects.toThrow("routes must be an array");
  });

  it("should throw on HTML fetch failure", async () => {
    mockCallTool.mockResolvedValue(mockRemoteScreens);
    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: Function) => { fn(); return 0; }) as any;

    const fetchMock = mock(async () => {
      return new Response("Too Many Requests", { status: 429, statusText: "Too Many Requests" });
    });
    global.fetch = fetchMock as any;

    await expect(
      buildSiteTool.execute(mockClient, {
        projectId: "123",
        routes: [{ screenId: "screen-1", route: "/" }],
      })
    ).rejects.toThrow("Failed to fetch HTML for screens");

    globalThis.setTimeout = origSetTimeout;
  });

  it("should throw on duplicate routes", async () => {
    await expect(
      buildSiteTool.execute(mockClient, {
        projectId: "123",
        routes: [
          { screenId: "screen-1", route: "/" },
          { screenId: "screen-2", route: "/" },
        ],
      })
    ).rejects.toThrow("Duplicate route paths found: /");
  });

  it("should return correct HTML for each screen", async () => {
    mockCallTool.mockResolvedValue(mockRemoteScreens);
    const fetchMock = mock(async (url: any) => {
      if (url === "http://example.com/screen1.html") {
        return new Response("<html>Home</html>", { status: 200 });
      }
      return new Response("<html>About</html>", { status: 200 });
    });
    global.fetch = fetchMock as any;

    const result = await buildSiteTool.execute(mockClient, {
      projectId: "123",
      routes: [
        { screenId: "screen-1", route: "/" },
        { screenId: "screen-2", route: "/about" },
      ],
    });

    expect(result.pages[0].html).toBe("<html>Home</html>");
    expect(result.pages[1].html).toBe("<html>About</html>");
  });

  it("should throw for entries missing route string", async () => {
    await expect(
      buildSiteTool.execute(mockClient, {
        projectId: "123",
        routes: [{ screenId: "screen-1" }],
      })
    ).rejects.toThrow('Each route entry must have a "route" string');
  });
});
