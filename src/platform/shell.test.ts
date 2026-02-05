import { describe, expect, test } from "bun:test";
import { execCommand } from "./shell";

describe("shell", () => {
  test("should capture stdout", async () => {
    const result = await execCommand(["node", "-e", "process.stdout.write('hello')"]);
    expect(result.success).toBe(true);
    expect(result.stdout).toBe("hello");
  });

  test("should capture stderr", async () => {
    const result = await execCommand(["node", "-e", "process.stderr.write('error')"]);
    expect(result.success).toBe(true);
    expect(result.stderr).toBe("error");
  });

  test("should handle split multibyte characters correctly", async () => {
    // The character '🚀' is \xF0\x9F\x9A\x80 in UTF-8
    // We split it across two writes to simulate chunk fragmentation
    const script = `
      process.stdout.write(Buffer.from([0xF0, 0x9F]));
      setTimeout(() => {
        process.stdout.write(Buffer.from([0x9A, 0x80]));
      }, 50);
    `;
    const result = await execCommand(["node", "-e", script]);
    expect(result.success).toBe(true);
    // The previous implementation would have decoded [0xF0, 0x9F] -> replacement char
    // and [0x9A, 0x80] -> replacement char(s), resulting in corrupted output.
    // The optimized Buffer implementation should wait and join them to form '🚀'.
    expect(result.stdout).toBe("🚀");
  });
});
