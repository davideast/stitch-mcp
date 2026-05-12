import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ParseArgsStep } from "../../../../src/commands/tool/steps/ParseArgsStep.js";
import type { ToolContext } from "../../../../src/commands/tool/context.js";

const tmpDir = mkdtempSync(join(tmpdir(), "parse-args-test-"));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

describe("ParseArgsStep", () => {
  let step: ParseArgsStep;

  beforeEach(() => {
    step = new ParseArgsStep();
  });

  function makeContext(overrides: Partial<ToolContext["input"]> = {}): ToolContext {
    return {
      input: { showSchema: false, output: "pretty", ...overrides },
      client: {} as any,
      virtualTools: [],
    };
  }

  describe("shouldRun", () => {
    it("should run when toolName is set and not list or schema", async () => {
      expect(await step.shouldRun(makeContext({ toolName: "create_project" }))).toBe(true);
    });

    it("should not run without toolName", async () => {
      expect(await step.shouldRun(makeContext())).toBe(false);
    });

    it("should not run when toolName is 'list'", async () => {
      expect(await step.shouldRun(makeContext({ toolName: "list" }))).toBe(false);
    });

    it("should not run when showSchema is true", async () => {
      expect(await step.shouldRun(makeContext({ toolName: "create_project", showSchema: true }))).toBe(false);
    });
  });

  describe("run", () => {
    it("should parse JSON data from -d flag", async () => {
      const context = makeContext({ toolName: "create_project", data: '{"title": "Test"}' });
      await step.run(context);

      expect(context.parsedArgs).toEqual({ title: "Test" });
    });

    it("should parse JSON data from @file", async () => {
      const filePath = join(tmpDir, "data.json");
      writeFileSync(filePath, '{"title": "From File"}', "utf-8");

      const context = makeContext({ toolName: "create_project", dataFile: `@${filePath}` });
      await step.run(context);

      expect(context.parsedArgs).toEqual({ title: "From File" });
    });

    it("should default to empty args when no data provided", async () => {
      const context = makeContext({ toolName: "create_project" });
      await step.run(context);

      expect(context.parsedArgs).toEqual({});
    });
  });
});
