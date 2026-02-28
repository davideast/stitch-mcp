import { describe, it, expect, mock, beforeEach, spyOn, afterEach } from "bun:test";
import { StitchMCPClient } from "../../../src/services/mcp-client/client.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { GcloudHandler } from "../../../src/services/gcloud/handler.js";

describe("StitchMCPClient", () => {
  let originalFetch: any;
  let fetchMock: any;

  // Spies
  let clientConnectSpy: any;
  let clientCallToolSpy: any;
  let clientListToolsSpy: any;
  let transportCloseSpy: any;
  let gcloudEnsureInstalledSpy: any;
  let gcloudGetAccessTokenSpy: any;
  let gcloudGetProjectIdSpy: any;

  beforeEach(() => {
    // Reset fetch
    originalFetch = global.fetch;
    fetchMock = mock(async () => new Response(JSON.stringify({}), { status: 200 }));
    global.fetch = fetchMock;

    // Spy on Client methods
    clientConnectSpy = spyOn(Client.prototype, "connect").mockResolvedValue(undefined);
    clientCallToolSpy = spyOn(Client.prototype, "callTool").mockResolvedValue({ isError: false, content: [] } as any);
    clientListToolsSpy = spyOn(Client.prototype, "listTools").mockResolvedValue({ tools: [] } as any);

    // Spy on Transport methods
    // Note: StreamableHTTPClientTransport might not have 'close' on its prototype if it's defined in constructor or parent,
    // but usually it is on prototype. Check source if possible, or assume it's standard.
    // If it fails, we might need to mock the property on the instance.
    // But since we can't easily access the instance created inside StitchMCPClient, let's try prototype.
    // However, StreamableHTTPClientTransport inherits from Transport?
    // Let's assume close is on prototype.
    transportCloseSpy = spyOn(StreamableHTTPClientTransport.prototype, "close").mockResolvedValue(undefined);

    // We also need to mock 'onerror' setter or property?
    // The code does: this.transport.onerror = ...
    // This assigns to a property. We don't need to spy on it unless we want to trigger it.

    // Spy on GcloudHandler methods
    gcloudEnsureInstalledSpy = spyOn(GcloudHandler.prototype, "ensureInstalled").mockResolvedValue({ success: true, data: {} as any });
    gcloudGetAccessTokenSpy = spyOn(GcloudHandler.prototype, "getAccessToken").mockResolvedValue("mock-access-token");
    gcloudGetProjectIdSpy = spyOn(GcloudHandler.prototype, "getProjectId").mockResolvedValue("mock-project-id");
  });

  afterEach(() => {
    global.fetch = originalFetch;

    // Restore all spies
    clientConnectSpy.mockRestore();
    clientCallToolSpy.mockRestore();
    clientListToolsSpy.mockRestore();
    transportCloseSpy.mockRestore();
    gcloudEnsureInstalledSpy.mockRestore();
    gcloudGetAccessTokenSpy.mockRestore();
    gcloudGetProjectIdSpy.mockRestore();
  });

  describe("Configuration", () => {
    it("should initialize with provided config", () => {
      const client = new StitchMCPClient({
        apiKey: "test-key",
        projectId: "test-project",
        baseUrl: "https://custom.url"
      });

      expect(client["config"].apiKey).toBe("test-key");
      expect(client["config"].projectId).toBe("test-project");
      expect(client["config"].baseUrl).toBe("https://custom.url");
    });
  });

  describe("Connection (API Key)", () => {
    it("should skip token validation and set API key header", async () => {
      const client = new StitchMCPClient({
        apiKey: "test-key",
        baseUrl: "https://api.stitch.com"
      });

      await client.connect();

      // Should not call GcloudHandler
      expect(gcloudEnsureInstalledSpy).not.toHaveBeenCalled();
      expect(gcloudGetAccessTokenSpy).not.toHaveBeenCalled();

      // Trigger custom fetch to check headers
      const transport: any = client["transport"];
      const customFetch = transport["_fetch"];
      await customFetch("https://api.stitch.com/test", { method: "POST" });

      // Check the mock we created, which is called by customFetch
      const lastCall = fetchMock.mock.lastCall;
      const headers = lastCall[1].headers;

      expect(headers.get("X-Goog-Api-Key")).toBe("test-key");
      expect(headers.get("Authorization")).toBeNull();
      expect(headers.get("X-Goog-User-Project")).toBeNull();
      expect(headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("Connection (OAuth)", () => {
    it("should fetch project ID if missing", async () => {
      const client = new StitchMCPClient({
        accessToken: "initial-token"
      });

      // Mock GcloudHandler to return project ID
      gcloudGetProjectIdSpy.mockResolvedValue("fetched-project-id");

      await client.connect();

      expect(gcloudEnsureInstalledSpy).toHaveBeenCalled();
      expect(gcloudGetProjectIdSpy).toHaveBeenCalled();
      expect(client["config"].projectId).toBe("fetched-project-id");
    });

    it("should validate token and set OAuth headers", async () => {
      const client = new StitchMCPClient({
        accessToken: "valid-token",
        projectId: "test-project",
        baseUrl: "https://api.stitch.com"
      });

      // Mock successful token validation
      fetchMock = mock(async (url: any) => {
        if (url.toString().includes("tokeninfo")) {
          return new Response("{}", { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });
      global.fetch = fetchMock;

      await client.connect();

      // Should check token info
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("tokeninfo"));

      // Trigger custom fetch to check headers
      const transport: any = client["transport"];
      const customFetch = transport["_fetch"];
      await customFetch("https://api.stitch.com/test", { method: "POST" });

      const lastCall = fetchMock.mock.lastCall;
      const headers = lastCall[1].headers;

      expect(headers.get("Authorization")).toBe("Bearer valid-token");
      expect(headers.get("X-Goog-User-Project")).toBe("test-project");
      expect(headers.get("X-Goog-Api-Key")).toBeNull();
      expect(headers.get("Content-Type")).toBe("application/json");
    });

    it("should refresh token if validation fails", async () => {
      const client = new StitchMCPClient({
        accessToken: "invalid-token",
        projectId: "test-project"
      });

      // Mock fetch to fail first (validation), then succeed (refresh), then succeed (re-validation)
      let callCount = 0;
      fetchMock = mock(async (url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes("tokeninfo")) {
            callCount++;
            if (callCount === 1) return new Response("{}", { status: 401 }); // First validation fails
            return new Response("{}", { status: 200 }); // Second validation succeeds
        }
        return new Response("{}", { status: 200 });
      });
      global.fetch = fetchMock;

      gcloudGetAccessTokenSpy.mockResolvedValue("new-refreshed-token");

      await client.connect();

      expect(gcloudEnsureInstalledSpy).toHaveBeenCalled();
      expect(gcloudGetAccessTokenSpy).toHaveBeenCalled();
      expect(client["config"].accessToken).toBe("new-refreshed-token");
    });

    it("should throw if refresh fails", async () => {
      const client = new StitchMCPClient({
        accessToken: "invalid-token",
        projectId: "test-project"
      });

      // Mock fetch to fail validation
      fetchMock = mock(async (url: any) => {
         if (url.toString().includes("tokeninfo")) {
            return new Response("{}", { status: 401 });
         }
         return new Response("{}", { status: 200 });
      });
      global.fetch = fetchMock;

      // Mock refresh failure
      gcloudGetAccessTokenSpy.mockResolvedValue(null);

      try {
        await client.connect();
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("Could not refresh token via gcloud");
      }
    });
  });

  describe("Tool Execution", () => {
    it("should call tool successfully", async () => {
        const client = new StitchMCPClient({ apiKey: "test-key" });
        await client.connect();

        clientCallToolSpy.mockResolvedValue({
            isError: false,
            content: [{ type: "text", text: JSON.stringify({ result: "success" }) }]
        });

        const result = await client.callTool("test-tool", { arg: "val" });
        expect(result).toEqual({ result: "success" });
        expect(clientCallToolSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "test-tool",
                arguments: { arg: "val" }
            }),
            undefined,
            expect.any(Object)
        );
    });

    it("should handle tool errors", async () => {
        const client = new StitchMCPClient({ apiKey: "test-key" });
        await client.connect();

        clientCallToolSpy.mockResolvedValue({
            isError: true,
            content: [{ type: "text", text: "Something went wrong" }]
        });

        try {
            await client.callTool("test-tool", {});
            expect(true).toBe(false);
        } catch (e: any) {
            expect(e.message).toContain("Tool Call Failed [test-tool]: Something went wrong");
        }
    });

    it("should return raw text if JSON parsing fails", async () => {
        const client = new StitchMCPClient({ apiKey: "test-key" });
        await client.connect();

        clientCallToolSpy.mockResolvedValue({
            isError: false,
            content: [{ type: "text", text: "Not JSON" }]
        });

        const result = await client.callTool("test-tool", {});
        expect(result).toBe("Not JSON");
    });

    it("should return structured content if available", async () => {
        const client = new StitchMCPClient({ apiKey: "test-key" });
        await client.connect();

        const structuredData = { some: "data" };
        clientCallToolSpy.mockResolvedValue({
            isError: false,
            structuredContent: structuredData,
            content: []
        });

        const result = await client.callTool("test-tool", {});
        expect(result).toEqual(structuredData);
    });
  });

  describe("Capabilities", () => {
      it("should list tools", async () => {
          const client = new StitchMCPClient({ apiKey: "test-key" });
          await client.connect();

          clientListToolsSpy.mockResolvedValue({
              tools: [{ name: "tool1" }]
          });

          const caps = await client.getCapabilities();
          expect(caps).toEqual({ tools: [{ name: "tool1" }] });
          expect(clientListToolsSpy).toHaveBeenCalled();
      });
  });

  describe("Cleanup", () => {
      it("should close transport", async () => {
          const client = new StitchMCPClient({ apiKey: "test-key" });
          await client.connect();
          await client.close();
          expect(transportCloseSpy).toHaveBeenCalled();
      });
  });
});
