import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ScreensHandler } from "../../../src/commands/screens/handler.js";

describe("ScreensHandler", () => {
  let mockClient: any;
  let mockCallTool: any;

  beforeEach(() => {
    mockCallTool = mock();
    mockClient = {
      callTool: mockCallTool,
    };
  });

  it("should return all screens sorted by code availability then title", async () => {
    const projectId = "123";
    const projectTitle = "My Project";

    mockCallTool.mockImplementation((toolName: string, args: any) => {
      if (toolName === "get_project") {
        return Promise.resolve({ title: projectTitle });
      }
      if (toolName === "list_screens") {
        return Promise.resolve({
          screens: [
            {
              name: "projects/123/screens/s1",
              title: "Zebra", // No code, starts with Z
              htmlCode: {}
            },
            {
              name: "projects/123/screens/s2",
              title: "Beta", // Has code, starts with B
              htmlCode: { downloadUrl: "http://code" }
            },
            {
              name: "projects/123/screens/s3",
              title: "Alpha", // Has code, starts with A
              htmlCode: { downloadUrl: "http://code" }
            },
            {
              name: "projects/123/screens/s4",
              title: "Apple", // No code, starts with A
              htmlCode: {}
            }
          ]
        });
      }
      return Promise.reject("Unknown tool");
    });

    const handler = new ScreensHandler(mockClient);
    const result = await handler.execute(projectId);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.screens).toHaveLength(4);

    // Expected order:
    // 1. Alpha (Has Code) - top because has code + alphabetical
    // 2. Beta (Has Code) - second because has code + alphabetical
    // 3. Apple (No Code) - third because no code + alphabetical
    // 4. Zebra (No Code) - fourth because no code + alphabetical

    expect(result.screens![0]!.title).toBe("Alpha");
    expect(result.screens![0]!.hasCode).toBe(true);

    expect(result.screens![1]!.title).toBe("Beta");
    expect(result.screens![1]!.hasCode).toBe(true);

    expect(result.screens![2]!.title).toBe("Apple");
    expect(result.screens![2]!.hasCode).toBe(false);

    expect(result.screens![3]!.title).toBe("Zebra");
    expect(result.screens![3]!.hasCode).toBe(false);
  });

  it("should map screen fields correctly", async () => {
    mockCallTool.mockImplementation((toolName: string) => {
      if (toolName === "get_project") return Promise.resolve({ title: "P" });
      if (toolName === "list_screens") {
        return Promise.resolve({
          screens: [
            {
              name: "projects/123/screens/my-screen-id",
              title: "My Screen",
              htmlCode: { downloadUrl: "http://code" },
              screenshot: { downloadUrl: "http://image" }
            }
          ]
        });
      }
      return Promise.resolve();
    });

    const handler = new ScreensHandler(mockClient);
    const result = await handler.execute("123");

    expect(result.success).toBe(true);
    if (!result.success) return;

    const screen = result.screens![0]!;
    expect(screen.screenId).toBe("my-screen-id");
    expect(screen.title).toBe("My Screen");
    expect(screen.hasCode).toBe(true);
    expect(screen.codeUrl).toBe("http://code");
    expect(screen.hasImage).toBe(true);
  });
});
