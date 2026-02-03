import { expect, test, describe, beforeEach, spyOn, mock } from "bun:test";
import { ViewHandler } from "../../../src/services/view/handler.js";
import { StitchMCPClient } from "../../../src/services/mcp-client/client.js";

describe("ViewHandler", () => {
  let mockClient: any;
  let handler: ViewHandler;

  beforeEach(() => {
    mockClient = {
      connect: mock(() => Promise.resolve()),
      close: mock(() => Promise.resolve()),
      callTool: mock(() => Promise.resolve({})),
    };

    handler = new ViewHandler(mockClient as unknown as StitchMCPClient);
  });

  test("handles --projects flag", async () => {
    await handler.execute({ projects: true });
    expect(mockClient.callTool).toHaveBeenCalledWith("list_projects", {});
  });

  test("handles --name flag for project", async () => {
    await handler.execute({ projects: false, name: "projects/123" });
    expect(mockClient.callTool).toHaveBeenCalledWith("get_project", { name: "projects/123" });
  });

  test("handles --name flag for screen", async () => {
    await handler.execute({ projects: false, name: "projects/1/screens/2" });
    expect(mockClient.callTool).toHaveBeenCalledWith("get_screen", { projectId: "1", screenId: "2" });
  });

  test("handles --sourceScreen flag", async () => {
    await handler.execute({ projects: false, sourceScreen: "projects/1/screens/2" });
    expect(mockClient.callTool).toHaveBeenCalledWith("get_screen", { projectId: "1", screenId: "2" });
  });

  test("handles --project and --screen flags", async () => {
    await handler.execute({ projects: false, project: "1", screen: "2" });
    expect(mockClient.callTool).toHaveBeenCalledWith("get_screen", { projectId: "1", screenId: "2" });
  });

  test("handles --project flag only", async () => {
    await handler.execute({ projects: false, project: "1" });
    expect(mockClient.callTool).toHaveBeenCalledWith("get_project", { name: "projects/1" });
  });

  test("returns data from callTool", async () => {
    mockClient.callTool.mockResolvedValue({ key: "value" });

    const result = await handler.execute({ projects: false, name: "projects/123" });

    expect(result.success).toBe(true);
    if (result.success) {
        expect(result.data).toEqual({ key: "value" });
    }
  });

  test("returns error for invalid args", async () => {
      const result = await handler.execute({ projects: false });
      expect(result.success).toBe(false);
      if (!result.success) {
          expect(result.error.code).toBe("INVALID_ARGS");
      }
  });

  test("returns error for invalid name format", async () => {
      const result = await handler.execute({ projects: false, name: "invalid" });
      expect(result.success).toBe(false);
      if (!result.success) {
          expect(result.error.code).toBe("FETCH_FAILED");
          expect(result.error.message).toContain("Invalid resource name format");
      }
  });
});
