import { describe, it, expect, mock, spyOn, afterEach } from "bun:test";

// Mock external dependencies to avoid environment issues
mock.module("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {}
}));
mock.module("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: class {}
}));
mock.module("@modelcontextprotocol/sdk/server/stdio.js", () => ({}));
mock.module("p-limit", () => () => (fn: any) => fn());

import { ToolCommandHandler, deps } from "../../../src/commands/tool/handler.js";

describe("ToolCommandHandler Orchestration", () => {
  afterEach(() => {
    (deps.runSteps as any).mockRestore?.();
    (deps.ListToolsStep as any).mockRestore?.();
    (deps.ShowSchemaStep as any).mockRestore?.();
    (deps.ParseArgsStep as any).mockRestore?.();
    (deps.ValidateToolStep as any).mockRestore?.();
    (deps.ExecuteToolStep as any).mockRestore?.();
  });

  it("should initialize steps in the correct order", () => {
    // Spy on constructors
    const listSpy = spyOn(deps, 'ListToolsStep').mockImplementation(() => ({ id: 'list-tools', name: 'List' } as any));
    const showSpy = spyOn(deps, 'ShowSchemaStep').mockImplementation(() => ({ id: 'show-schema', name: 'Show Schema' } as any));
    const parseSpy = spyOn(deps, 'ParseArgsStep').mockImplementation(() => ({ id: 'parse-args', name: 'Parse Args' } as any));
    const validateSpy = spyOn(deps, 'ValidateToolStep').mockImplementation(() => ({ id: 'validate-tool', name: 'Validate Tool' } as any));
    const executeSpy = spyOn(deps, 'ExecuteToolStep').mockImplementation(() => ({ id: 'execute-tool', name: 'Execute Tool' } as any));

    const handler = new ToolCommandHandler();
    const steps = (handler as any).steps;

    expect(steps).toHaveLength(5);
    expect(listSpy).toHaveBeenCalled();
    expect(showSpy).toHaveBeenCalled();
    expect(parseSpy).toHaveBeenCalled();
    expect(validateSpy).toHaveBeenCalled();
    expect(executeSpy).toHaveBeenCalled();

    expect(steps[0].id).toBe('list-tools');
    expect(steps[1].id).toBe('show-schema');
    expect(steps[2].id).toBe('parse-args');
    expect(steps[3].id).toBe('validate-tool');
    expect(steps[4].id).toBe('execute-tool');
  });

  it("should call runSteps with initialized steps and context", async () => {
    const runStepsSpy = spyOn(deps, 'runSteps').mockResolvedValue({ completed: true, results: [] });

    const mockClient = {} as any;
    const mockTools = [{ name: 'test-tool' }] as any;
    const handler = new ToolCommandHandler(mockClient, mockTools);

    const input = { toolName: 'test-tool', output: 'pretty' as const };
    await handler.execute(input);

    expect(runStepsSpy).toHaveBeenCalled();
    const [steps, context, callbacks] = runStepsSpy.mock.calls[0];

    expect(steps).toBe((handler as any).steps);
    expect(context.input).toBe(input);
    expect(context.client).toBe(mockClient);
    expect(context.virtualTools).toBe(mockTools);
    expect(callbacks?.onAfterStep).toBeDefined();
  });

  it("should return context.result if set by steps", async () => {
    const expectedResult = { success: true, data: "test-data" };
    spyOn(deps, 'runSteps').mockImplementation(async (_steps, context: any) => {
      context.result = expectedResult;
      return { completed: false, results: [], stoppedAt: { step: 'some-step', result: { success: true } } };
    });

    const handler = new ToolCommandHandler();
    const result = await handler.execute({ toolName: 'test-tool' });

    expect(result).toBe(expectedResult as any);
  });

  it("should return failure if no step produces a result", async () => {
    spyOn(deps, 'runSteps').mockResolvedValue({ completed: true, results: [] });

    const handler = new ToolCommandHandler();
    const result = await handler.execute({ toolName: 'test-tool' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No step produced a result');
  });

  it("onAfterStep should return true if context.result is set", async () => {
    const runStepsSpy = spyOn(deps, 'runSteps').mockResolvedValue({ completed: true, results: [] });
    const handler = new ToolCommandHandler();
    await handler.execute({ toolName: 'test-tool' });

    const callbacks = runStepsSpy.mock.calls[0][2];
    const onAfterStep = callbacks?.onAfterStep;

    expect(onAfterStep).toBeDefined();
    if (onAfterStep) {
        const context: any = { result: undefined };
        expect(onAfterStep({} as any, {} as any, context)).toBe(false);
        context.result = { success: true };
        expect(onAfterStep({} as any, {} as any, context)).toBe(true);
    }
  });
});
