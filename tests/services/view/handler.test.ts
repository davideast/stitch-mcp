import { expect, test, describe, beforeEach, spyOn, mock } from "bun:test";
import { ViewHandler } from "../../../src/services/view/handler.js";
import { StitchMCPClient } from "../../../src/services/mcp-client/client.js";

// Mocking dependencies if necessary, but here we can inject the mock client.

describe("ViewHandler", () => {
  let mockClient: any;
  let handler: ViewHandler;

  beforeEach(() => {
    mockClient = {
      connect: mock(() => Promise.resolve()),
      close: mock(() => Promise.resolve()),
      listResources: mock(() => Promise.resolve({ resources: [] })),
      readResource: mock(() => Promise.resolve({ contents: [] })),
    };

    handler = new ViewHandler(mockClient as unknown as StitchMCPClient);
  });

  test("handles --projects flag", async () => {
    await handler.execute({ projects: true });
    expect(mockClient.listResources).toHaveBeenCalled();
  });

  test("handles --name flag", async () => {
    await handler.execute({ projects: false, name: "projects/123" });
    expect(mockClient.readResource).toHaveBeenCalledWith("projects/123");
  });

  test("handles --sourceScreen flag", async () => {
    await handler.execute({ projects: false, sourceScreen: "projects/1/screens/2" });
    expect(mockClient.readResource).toHaveBeenCalledWith("projects/1/screens/2");
  });

  test("handles --project and --screen flags", async () => {
    await handler.execute({ projects: false, project: "1", screen: "2" });
    expect(mockClient.readResource).toHaveBeenCalledWith("projects/1/screens/2");
  });

  test("handles --project flag only", async () => {
    await handler.execute({ projects: false, project: "1" });
    expect(mockClient.readResource).toHaveBeenCalledWith("projects/1");
  });

  test("returns parsed JSON data", async () => {
    mockClient.readResource.mockResolvedValue({
        contents: [
            { text: '{"key": "value"}', mimeType: 'application/json' }
        ]
    });

    const result = await handler.execute({ projects: false, name: "test" });

    expect(result.success).toBe(true);
    if (result.success) {
        expect(result.data.contents[0].data).toEqual({ key: "value" });
    }
  });

  test("returns error for invalid args", async () => {
      const result = await handler.execute({ projects: false });
      expect(result.success).toBe(false);
      if (!result.success) {
          expect(result.error.code).toBe("INVALID_ARGS");
      }
  });
});
