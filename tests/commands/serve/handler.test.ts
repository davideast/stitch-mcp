import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ServeHandler } from "../../../src/commands/serve/handler.js";

describe("ServeHandler", () => {
  let mockClient: any;
  let mockCallTool: any;

  beforeEach(() => {
    mockCallTool = mock();
    mockClient = {
      callTool: mockCallTool,
    };
  });

  it("should return screens with code sorted alphabetically", async () => {
    const projectId = "123";
    const projectTitle = "My Project";

    // Mock get_project response
    mockCallTool.mockImplementation((toolName: string, args: any) => {
      if (toolName === "get_project") {
        return Promise.resolve({ title: projectTitle });
      }
      if (toolName === "list_screens") {
        return Promise.resolve({
          screens: [
            {
              name: "projects/123/screens/s1",
              title: "Zap Screen", // S comes after A, expect this second
              htmlCode: { downloadUrl: "http://code1" }
            },
            {
              name: "projects/123/screens/s2",
              title: "App Screen", // A, expect this first
              htmlCode: { downloadUrl: "http://code2" }
            },
            {
              name: "projects/123/screens/s3",
              title: "No Code Screen",
              htmlCode: {} // No downloadUrl
            }
          ]
        });
      }
      return Promise.reject("Unknown tool");
    });

    const handler = new ServeHandler(mockClient);
    const result = await handler.execute(projectId);

    expect(result.success).toBe(true);
    if (!result.success) return; // Type guard

    expect(result.projectId).toBe(projectId);
    expect(result.projectTitle).toBe(projectTitle);

    // Should filter out s3 (no code)
    expect(result.screens).toHaveLength(2);

    // Should sort alphabetically: App Screen -> Zap Screen
    expect(result.screens![0]!.title).toBe("App Screen");
    expect(result.screens![0]!.codeUrl).toBe("http://code2");

    expect(result.screens![1]!.title).toBe("Zap Screen");
    expect(result.screens![1]!.codeUrl).toBe("http://code1");

    expect(mockCallTool).toHaveBeenCalledTimes(2);
  });

  it("should handle error when list_screens fails", async () => {
    mockCallTool.mockImplementation((toolName: string) => {
      if (toolName === "get_project") return Promise.resolve({ title: "P" });
      if (toolName === "list_screens") return Promise.reject(new Error("List failed"));
      return Promise.resolve();
    });

    const handler = new ServeHandler(mockClient);
    const result = await handler.execute("123");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("List failed");
    }
  });
});
