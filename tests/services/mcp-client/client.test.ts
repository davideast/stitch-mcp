import { describe, it, expect, mock, beforeEach } from "bun:test";
import { StitchMCPClient } from "../../../src/services/mcp-client/client.js";
import { execSync } from "child_process";

// Mock child_process
mock.module("child_process", () => ({
  execSync: mock(),
}));

describe("StitchMCPClient", () => {
  beforeEach(() => {
     // Reset mocks
     (execSync as any).mockReset();
  });

  it("should skip OAuth validation when API key is present", async () => {
    // Setup
    const client = new StitchMCPClient({
      apiKey: "test-api-key",
      projectId: "test-project"
    });

    // Mock fetch to fail if called (which would trigger re-auth flow in original code)
    global.fetch = mock(async () => ({
      ok: false,
      status: 401
    } as Response));

    // Mock execSync to throw like gcloud missing
    (execSync as any).mockImplementation(() => {
      throw new Error("Command not found: gcloud");
    });

    // Access private method
    const validateToken = (client as any).validateToken.bind(client);

    // Act
    await validateToken();

    // Assert
    // execSync should NOT be called if we have API key (with the fix)
    // If without fix, it WILL be called.
    expect(execSync).toHaveBeenCalledTimes(0);
  });
});
