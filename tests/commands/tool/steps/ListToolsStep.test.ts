import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ListToolsStep } from "../../../../src/commands/tool/steps/ListToolsStep.js";
import type { ToolContext } from "../../../../src/commands/tool/context.js";
import { StitchToolClient } from '@google/stitch-sdk';
import { createMockStitch, createMockProject } from '../../../../src/services/stitch-sdk/MockStitchSDK.js';

describe("ListToolsStep (SDK)", () => {
  let step: ListToolsStep;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      listTools: mock(),
      callTool: mock(),
    };
    step = new ListToolsStep();
  });

  function makeContext(overrides: Partial<ToolContext["input"]> = {}): ToolContext {
    return {
      input: { showSchema: false, output: "pretty", ...overrides },
      client: mockClient,
      stitch: createMockStitch(createMockProject('test-proj', [])),
      virtualTools: [{ name: "virtual1", execute: mock() }] as any,
    };
  }

  describe("shouldRun", () => {
    it("should run when no toolName is provided", async () => {
      expect(await step.shouldRun(makeContext())).toBe(true);
    });

    it("should run when toolName is 'list'", async () => {
      expect(await step.shouldRun(makeContext({ toolName: "list" }))).toBe(true);
    });

    it("should not run when a specific toolName is given", async () => {
      expect(await step.shouldRun(makeContext({ toolName: "get_screen" }))).toBe(false);
    });
  });

  describe("run", () => {
    it("calls listTools() on StitchToolClient and tags tools with virtual field", async () => {
      const serverTools = [{ name: "server_tool", description: "desc" }];
      mockClient.listTools.mockResolvedValue({ tools: serverTools });

      const context = makeContext();
      await step.run(context);

      expect(mockClient.listTools).toHaveBeenCalled();
      expect(context.result).toBeDefined();
      expect(context.result!.success).toBe(true);
      // Virtual tools tagged with virtual: true
      expect(context.result!.data).toContainEqual(expect.objectContaining({ name: "virtual1", virtual: true }));
      // Server tools tagged with virtual: false
      expect(context.result!.data).toContainEqual(expect.objectContaining({ name: "server_tool", virtual: false }));
      // Execute function should be stripped from virtual tools
      const virtualEntry = context.result!.data.find((t: any) => t.name === "virtual1");
      expect(virtualEntry.execute).toBeUndefined();
    });

    it("should handle empty server tools", async () => {
      mockClient.listTools.mockResolvedValue({ tools: undefined });

      const context = makeContext();
      await step.run(context);

      expect(context.result!.success).toBe(true);
      expect(context.result!.data).toHaveLength(1); // just the virtual tool
      expect(context.result!.data[0].virtual).toBe(true);
    });

    it.skip('StitchToolClient auto-connects on first callTool() call', async () => {
      // TODO: Verify StitchToolClient auto-connects vs. requires explicit .connect().
    });
  });
});
