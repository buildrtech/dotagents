import test from "node:test";
import assert from "node:assert/strict";
import profilerExtension from "./index.ts";

test("registers ext-prof command and handles status", async () => {
  const commands = new Map<
    string,
    (args: string, ctx: { hasUI: boolean; ui: { notify: (...args: unknown[]) => void } }) => Promise<void>
  >();
  let stdout = "";

  const pi = {
    registerCommand(
      name: string,
      options: {
        handler: (args: string, ctx: { hasUI: boolean; ui: { notify: (...args: unknown[]) => void } }) => Promise<void>;
      },
    ) {
      commands.set(name, options.handler);
    },
    on() {
      return undefined;
    },
  } as never;

  const originalWrite = process.stdout.write.bind(process.stdout);
  (process.stdout.write as unknown as (chunk: string) => boolean) = ((chunk: string) => {
    stdout += chunk;
    return true;
  }) as never;

  try {
    await profilerExtension(pi);
    const handler = commands.get("ext-prof");
    assert.ok(handler);
    await handler!("status", { hasUI: false, ui: { notify() {} } });
    assert.match(stdout, /enabled: off/);
  } finally {
    process.stdout.write = originalWrite;
  }
});
