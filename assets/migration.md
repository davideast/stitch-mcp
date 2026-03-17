# Migration Plan: `stitch-mcp` CLI → `@google/stitch-sdk`

> **TDD approach:** Each phase follows 🔴 Red → 🟢 Green → 🟡 Yellow.
> - 🔴 **Red** — Write the failing test first, using SDK-shaped mocks. Run `bun test` and watch it fail.
> - 🟢 **Green** — Write the minimal SDK implementation to make the test pass.
> - 🟡 **Yellow** — Pending (`it.skip`) tests guarding unverified SDK behaviour. Promote to Red when the gap is resolved.
>
> Run all tests at any time: `bun test --preload ./tests/setup.ts`

---

## 1. Current Architecture Audit

The CLI's networking layer lives entirely in `src/services/mcp-client/client.ts` as `StitchMCPClient`. It is a hand-rolled MCP transport client built directly on `@modelcontextprotocol/sdk` primitives.

### What `StitchMCPClient` does today

| Responsibility | Implementation |
|---|---|
| Transport | `StreamableHTTPClientTransport` from MCP SDK |
| Auth (API key) | `X-Goog-Api-Key` header injected via custom `fetch` wrapper |
| Auth (OAuth) | `Bearer` token via `GcloudHandler`, with 55-min auto-refresh |
| Project resolution | `GcloudHandler.getProjectId()` when `projectId` is not set |
| Tool invocation | `client.callTool(name, args)` with JSON/structuredContent parsing |
| Tool listing | `client.getCapabilities()` → `listTools()` |
| Host override | Reads `STITCH_HOST` env var |

### Where `StitchMCPClient` is used

| Command/Service | Tools called | Notes |
|---|---|---|
| `ServeHandler` | `get_project`, `list_screens` | Reads `screen.htmlCode.downloadUrl` |
| `ScreensHandler` | `get_project`, `list_screens` | Reads `htmlCode.downloadUrl` + `screenshot.downloadUrl` |
| `ToolCommandHandler` | any tool by name + `listTools` | Passes client to step pipeline |
| `ViewHandler` | `list_projects`, `get_project`, `get_screen` | Returns raw API response to tree viewer |
| Virtual tool: `get_screen_code` | `get_screen` | Fetches raw HTML text |
| Virtual tool: `build_site` | `list_screens` via `ProjectSyncer` | Bulk HTML fetch |
| Virtual tool: `get_screen_image` | `get_screen` | Reads `screenshot.downloadUrl` |

### `ProxyHandler` (entirely separate)
Does **not** use `StitchMCPClient`. Implements its own `HttpPostTransport → StdioServerTransport` bridge with a 55-minute gcloud token-refresh loop — a manual reimplementation of exactly what `StitchProxy` provides in the official SDK.

---

## 2. Official SDK Surface Area (relevant to this CLI)

### `stitch.project(id)` — the identity map
Returns a `Project` reference with no immediate network call. Methods fetch lazily.

```ts
const project = stitch.project("project-id");   // synchronous, no I/O
const screens  = await project.screens();         // → Screen[]
const screen   = await project.getScreen(id);     // → Screen
const html     = await screen.getHtml();          // → download URL string | null
const imageUrl = await screen.getImage();         // → download URL string | null
```

### `stitch.callTool()` / `StitchToolClient` — agent API
```ts
const result = await stitch.callTool("tool_name", { arg: "value" });
const { tools } = await stitch.listTools();
```

### `StitchProxy` — the MCP bridge
```ts
import { StitchProxy } from "@google/stitch-sdk";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const proxy = new StitchProxy({ apiKey: "..." });
await proxy.start(new StdioServerTransport());
```

### Auth
The SDK reads `STITCH_API_KEY` or `STITCH_ACCESS_TOKEN` + `GOOGLE_CLOUD_PROJECT` from the environment — the same env vars the CLI already sets during `init`. No config change for users.

---

## 3. API Pattern Decision

**Both patterns are needed.** They solve different problems.

| Command | Pattern | Why |
|---|---|---|
| `proxy` | `StitchProxy` | Complete replacement for 250-line `ProxyHandler` |
| `serve` | `stitch.project()` identity map | Domain objects; removes manual field parsing |
| `screens` | `stitch.project()` identity map | Same as above |
| `site` / virtual tools | `stitch.project()` identity map | Eliminates `ProjectSyncer` |
| `tool` | `StitchToolClient` agent API | Raw tool invocation _is_ the feature |
| `view` | `stitch.callTool()` agent API | Raw API shape _is_ the feature; SDK objects would break it |

---

## 4. Test Infrastructure

### Existing test harness conventions

The codebase uses **Bun test** (`bun test --preload ./tests/setup.ts`) with two test locations:
- `tests/` — integration tests per command
- `src/.../handler.test.ts` — co-located unit tests

**Three mock patterns in use:**
```ts
// 1. Inline anonymous mock client (most common in tests/commands/)
const mockClient = { callTool: mock(), getCapabilities: mock() };

// 2. Class-level spy (used in tests/services/mcp-client/client.test.ts)
spyOn(StitchMCPClient.prototype, 'connect').mockResolvedValue(undefined);

// 3. Subclass mock (src/services/mcp-client/MockStitchMCPClient.ts)
class MockStitchMCPClient extends StitchMCPClient {
  override async connect() { /* no-op */ }
  override async callTool(name, args) { /* fixture return */ }
}
```

**Handler result contract:**
Every `execute()` returns `{ success: true, data }` or `{ success: false, error: { code, message } }`. Tests always assert `result.success` before drilling into `result.data`.

### New mock shape for SDK migration

Add `src/services/stitch-sdk/MockStitchSDK.ts` once (used across all new tests):

```ts
// src/services/stitch-sdk/MockStitchSDK.ts
import { mock } from 'bun:test';

export function createMockScreen(overrides: Partial<MockScreen> = {}): MockScreen {
  return {
    screenId: 'screen-1',
    title: 'Screen One',
    projectId: 'proj-1',
    getHtml: mock(() => Promise.resolve('https://cdn.example.com/html/screen-1')),
    getImage: mock(() => Promise.resolve('https://cdn.example.com/img/screen-1')),
    ...overrides,
  };
}

export function createMockProject(
  id: string,
  screens: MockScreen[] = [],
  overrides: Partial<MockProject> = {}
): MockProject {
  return {
    id,
    projectId: id,
    title: 'Mock Project',                        // ⚠️ Gap #1 — verify SDK exposes this
    screens: mock(() => Promise.resolve(screens)),
    getScreen: mock((screenId: string) =>
      Promise.resolve(screens.find(s => s.screenId === screenId) ?? null)
    ),
    ...overrides,
  };
}

export function createMockStitch(project: MockProject) {
  return {
    project: mock((_id: string) => project),
    projects: mock(() => Promise.resolve([project])),
    callTool: mock(() => Promise.resolve({})),
    listTools: mock(() => Promise.resolve({ tools: [] })),
  };
}
```

---

## 5. Phase-by-Phase TDD Migration

### Phase 0 — Install the SDK

```bash
bun add @google/stitch-sdk
```

No code changes yet. All existing tests must still pass (they do — nothing is deleted yet).

---

### Phase 1 — `proxy` command

> Deletes `src/services/proxy/handler.ts` (~250 lines). Highest ROI change.

#### 🔴 Red

```ts
// tests/commands/proxy/handler.test.ts
import { describe, it, expect, spyOn, beforeEach, afterEach, mock } from 'bun:test';
import { StitchProxy } from '@google/stitch-sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ProxyCommandHandler } from '../../../src/commands/proxy/handler.js';

describe('ProxyCommandHandler (SDK)', () => {
  let startSpy: any;
  let transportSpy: any;

  beforeEach(() => {
    startSpy = spyOn(StitchProxy.prototype, 'start').mockResolvedValue(undefined);
    // StdioServerTransport constructor — just ensure it's instantiated
    transportSpy = spyOn(StdioServerTransport.prototype, 'start' as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    startSpy.mockRestore();
    transportSpy.mockRestore();
  });

  it('starts StitchProxy with a StdioServerTransport', async () => {
    const handler = new ProxyCommandHandler();
    const result = await handler.execute({ port: undefined });

    expect(result.success).toBe(true);
    expect(startSpy).toHaveBeenCalledTimes(1);
    // First arg to start() should be a StdioServerTransport instance
    expect(startSpy.mock.calls[0][0]).toBeInstanceOf(StdioServerTransport);
  });

  it('passes STITCH_API_KEY env var to StitchProxy', async () => {
    const constructorSpy = spyOn(StitchProxy, 'constructor' as any);
    process.env.STITCH_API_KEY = 'test-key';
    const handler = new ProxyCommandHandler();
    await handler.execute({});
    // Proxy reads from env — confirm it doesn't throw when key is set
    expect(result.success).toBe(true);
    delete process.env.STITCH_API_KEY;
  });
});
```

Run `bun test tests/commands/proxy/handler.test.ts` → **fails** (old `ProxyCommandHandler` still uses `HttpPostTransport`).

#### 🟢 Green

```ts
// src/commands/proxy/handler.ts — replace entirely
import { StitchProxy } from '@google/stitch-sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export interface StartProxyInput {
  port?: number;
  debug?: boolean;
}

export class ProxyCommandHandler {
  async execute(input: StartProxyInput): Promise<{ success: boolean; error?: string }> {
    try {
      const proxy = new StitchProxy({
        apiKey: process.env.STITCH_API_KEY,
        // STITCH_ACCESS_TOKEN + GOOGLE_CLOUD_PROJECT read automatically
      });
      const transport = new StdioServerTransport();
      await proxy.start(transport);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
```

Delete `src/services/proxy/handler.ts`. Run tests → **passes**.

#### 🟡 Yellow

```ts
// tests/commands/proxy/handler.test.ts — add alongside the green tests

it.skip('writes debug log to ~/.stitch/proxy-debug.log when --debug is passed', async () => {
  // TODO: Confirm StitchProxy exposes an event/hook for debug logging.
  // If not, wrap proxy.start() with the existing FileStream setup before delegating.
  // Gap #2 in gap list.
});

it.skip('respects STITCH_USE_SYSTEM_GCLOUD env var via pre-obtained access token', async () => {
  // TODO: Confirm StitchProxy reads STITCH_ACCESS_TOKEN when STITCH_USE_SYSTEM_GCLOUD=1.
  // Gap #3 in gap list.
});
```

---

### Phase 2 — `serve` command

#### 🔴 Red

```ts
// tests/commands/serve/handler.test.ts — replace existing mock-client tests
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { ServeHandler } from '../../../src/commands/serve/handler.js';
import { createMockStitch, createMockProject, createMockScreen } from
  '../../../src/services/stitch-sdk/MockStitchSDK.js';

describe('ServeHandler (SDK)', () => {
  it('returns screens with code URLs from SDK project', async () => {
    const screens = [
      createMockScreen({ screenId: 'home', title: 'Home' }),
      createMockScreen({
        screenId: 'settings',
        title: 'Settings',
        getHtml: mock(() => Promise.resolve(null)),  // no HTML — should be excluded
      }),
    ];
    const project = createMockProject('proj-1', screens);
    const stitch = createMockStitch(project);

    const handler = new ServeHandler(stitch as any);
    const result = await handler.execute('proj-1');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(stitch.project).toHaveBeenCalledWith('proj-1');
    expect(project.screens).toHaveBeenCalled();
    expect(result.screens).toHaveLength(1);
    expect(result.screens[0].screenId).toBe('home');
    expect(result.screens[0].codeUrl).toBe('https://cdn.example.com/html/screen-1');
  });

  it('returns projectTitle from SDK project', async () => {
    const project = createMockProject('proj-1', []);
    const stitch = createMockStitch(project);
    const handler = new ServeHandler(stitch as any);
    const result = await handler.execute('proj-1');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.projectTitle).toBe('Mock Project');
  });

  it('returns error result on SDK failure', async () => {
    const stitch = { project: mock(() => { throw new Error('Network error'); }) };
    const handler = new ServeHandler(stitch as any);
    const result = await handler.execute('proj-1');
    expect(result.success).toBe(false);
  });
});
```

Run → **fails** (handler still accepts `StitchMCPClient`).

#### 🟢 Green

```ts
// src/commands/serve/handler.ts
import type { StitchSDK } from '@google/stitch-sdk';

export class ServeHandler {
  constructor(private readonly stitch: StitchSDK) {}

  async execute(projectId: string): Promise<ServeHandlerResult> {
    try {
      const project = this.stitch.project(projectId);
      const screens = await project.screens();

      const withHtml = await Promise.all(
        screens.map(async s => ({
          screenId: s.screenId,
          title: s.title ?? s.screenId,
          codeUrl: await s.getHtml(),
        }))
      );

      return {
        success: true,
        projectId,
        projectTitle: project.title ?? projectId,
        screens: withHtml.filter(s => s.codeUrl !== null),
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
```

Update the command entry point to pass the SDK singleton:
```ts
// src/commands/serve/command.ts
import { stitch } from '@google/stitch-sdk';
const handler = new ServeHandler(stitch);
```

Run tests → **passes**.

#### 🟡 Yellow

```ts
it.skip('project.title is exposed on SDK Project objects', async () => {
  // TODO: Verify actual SDK source exposes .title on Project.
  // If not: swap to stitch.callTool('get_project', { name: `projects/${id}` })
  // and read .title from raw response. Gap #1.
});

it.skip('screen.getHtml() returns null (not throws) for screens without HTML', async () => {
  // TODO: Confirm null vs. StitchError('NOT_FOUND') contract. Gap #4.
  // Used in the .filter(s => s.codeUrl !== null) line above.
});
```

---

### Phase 3 — `screens` command

The existing tests in `tests/commands/screens/handler.test.ts` mock `callTool('list_screens', ...)` and `callTool('get_project', ...)` using inline mock objects. Replace with the new mock shape.

#### 🔴 Red

```ts
// tests/commands/screens/handler.test.ts — rewrite
import { describe, it, expect, mock } from 'bun:test';
import { ScreensHandler } from '../../../src/commands/screens/handler.js';
import { createMockStitch, createMockProject, createMockScreen } from
  '../../../src/services/stitch-sdk/MockStitchSDK.js';

describe('ScreensHandler (SDK)', () => {
  it('sorts screens: code-available first, then alphabetical within each group', async () => {
    const screens = [
      createMockScreen({ screenId: 's1', title: 'Zebra', getHtml: mock(() => Promise.resolve(null)) }),
      createMockScreen({ screenId: 's2', title: 'Beta' }),
      createMockScreen({ screenId: 's3', title: 'Alpha' }),
      createMockScreen({ screenId: 's4', title: 'Apple', getHtml: mock(() => Promise.resolve(null)) }),
    ];
    const stitch = createMockStitch(createMockProject('123', screens));

    const handler = new ScreensHandler(stitch as any);
    const result = await handler.execute('123');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.screens[0].title).toBe('Alpha');
    expect(result.screens[0].hasCode).toBe(true);
    expect(result.screens[1].title).toBe('Beta');
    expect(result.screens[2].title).toBe('Apple');
    expect(result.screens[2].hasCode).toBe(false);
    expect(result.screens[3].title).toBe('Zebra');
  });

  it('maps SDK Screen fields to handler output shape', async () => {
    const screen = createMockScreen({
      screenId: 'my-screen-id',
      title: 'My Screen',
      getHtml: mock(() => Promise.resolve('http://code')),
      getImage: mock(() => Promise.resolve('http://image')),
    });
    const stitch = createMockStitch(createMockProject('123', [screen]));

    const handler = new ScreensHandler(stitch as any);
    const result = await handler.execute('123');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.screens[0].screenId).toBe('my-screen-id');
    expect(result.screens[0].title).toBe('My Screen');
    expect(result.screens[0].hasCode).toBe(true);
    expect(result.screens[0].codeUrl).toBe('http://code');
    expect(result.screens[0].hasImage).toBe(true);
  });
});
```

Run → **fails** (handler uses `callTool` raw API).

#### 🟢 Green

```ts
// src/commands/screens/handler.ts
import type { StitchSDK } from '@google/stitch-sdk';

export class ScreensHandler {
  constructor(private readonly stitch: StitchSDK) {}

  async execute(projectId: string): Promise<ScreensResult> {
    try {
      const project = this.stitch.project(projectId);
      const screens = await project.screens();

      const mapped = await Promise.all(screens.map(async s => {
        const codeUrl = await s.getHtml();
        const imageUrl = await s.getImage();
        return {
          screenId: s.screenId,
          title: s.title ?? s.screenId,
          hasCode: codeUrl !== null,
          codeUrl,
          hasImage: imageUrl !== null,
        };
      }));

      const sorted = mapped.sort((a, b) => {
        if (a.hasCode !== b.hasCode) return a.hasCode ? -1 : 1;
        return a.title.localeCompare(b.title);
      });

      return { success: true, projectTitle: project.title ?? projectId, screens: sorted };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
```

Run tests → **passes**. Note: the existing sort-logic tests from the old test file should still pass — the sort predicate is unchanged.

#### 🟡 Yellow

```ts
it.skip('getHtml() and getImage() use cached data after screens() call (no double fetch)', async () => {
  // TODO: Verify the SDK caches per-screen data after a project.screens() call.
  // If each getHtml()/getImage() fires a new network request, switch to
  // calling project.screens({ includeHtml: true }) or equivalent.
});
```

---

### Phase 4 — Virtual tools (`get_screen_code`, `get_screen_image`, `build_site`)

These three virtual tools currently call `StitchMCPClient.callTool('get_screen', ...)` and then read raw `htmlCode`/`screenshot` fields. Replace with the identity map.

#### 🔴 Red

```ts
// tests/commands/tool/virtual-tools/get-screen-code.test.ts — add to existing suite
import { describe, it, expect, mock } from 'bun:test';
import { createMockStitch, createMockProject, createMockScreen } from
  '../../../src/services/stitch-sdk/MockStitchSDK.js';

describe('get_screen_code virtual tool (SDK)', () => {
  it('fetches HTML text via SDK screen.getHtml()', async () => {
    const screen = createMockScreen({ screenId: 'home', projectId: 'proj-1' });
    const stitch = createMockStitch(createMockProject('proj-1', [screen]));
    global.fetch = mock(() => Promise.resolve(new Response('<html>hello</html>', { status: 200 })));

    const { execute } = createGetScreenCodeTool(stitch as any);
    const result = await execute({ projectId: 'proj-1', screenId: 'home' });

    expect(result.screenId).toBe('home');
    expect(result.htmlContent).toBe('<html>hello</html>');
    expect(screen.getHtml).toHaveBeenCalled();
  });

  it('returns null htmlContent when getHtml() returns null', async () => {
    const screen = createMockScreen({
      screenId: 'no-code',
      getHtml: mock(() => Promise.resolve(null)),
    });
    const stitch = createMockStitch(createMockProject('proj-1', [screen]));

    const { execute } = createGetScreenCodeTool(stitch as any);
    const result = await execute({ projectId: 'proj-1', screenId: 'no-code' });

    expect(result.htmlContent).toBeNull();
  });
});
```

```ts
// tests/commands/tool/virtual-tools/build-site.test.ts — add
describe('build_site virtual tool (SDK)', () => {
  it('resolves screens from SDK project instead of ProjectSyncer', async () => {
    const screens = [
      createMockScreen({ screenId: 'home', title: 'Home' }),
      createMockScreen({ screenId: 'about', title: 'About' }),
    ];
    const stitch = createMockStitch(createMockProject('proj-1', screens));
    global.fetch = mock(() => Promise.resolve(new Response('<html/>', { status: 200 })));

    const { execute } = createBuildSiteTool(stitch as any);
    const result = await execute({
      projectId: 'proj-1',
      routes: [{ screenId: 'home', route: '/' }, { screenId: 'about', route: '/about' }],
    });

    expect(result.success).toBe(true);
    expect(stitch.project).toHaveBeenCalledWith('proj-1');
    // ProjectSyncer constructor should NOT be called
  });
});
```

Run → **fails**.

#### 🟢 Green

```ts
// src/commands/tool/virtual-tools/get-screen-code.ts
import type { StitchSDK } from '@google/stitch-sdk';

export function createGetScreenCodeTool(stitch: StitchSDK) {
  return {
    name: 'get_screen_code',
    execute: async (args: { projectId: string; screenId: string }) => {
      const screen = await stitch.project(args.projectId).getScreen(args.screenId);
      const htmlUrl = await screen.getHtml();
      const htmlContent = htmlUrl
        ? await fetch(htmlUrl).then(r => r.text())
        : null;
      return { screenId: screen.screenId, projectId: screen.projectId, htmlContent };
    },
  };
}
```

```ts
// src/commands/tool/virtual-tools/build-site.ts — replace ProjectSyncer
import type { StitchSDK } from '@google/stitch-sdk';
import pLimit from 'p-limit';

export function createBuildSiteTool(stitch: StitchSDK) {
  return {
    name: 'build_site',
    execute: async (args: { projectId: string; routes: { screenId: string; route: string }[] }) => {
      const project = stitch.project(args.projectId);
      const sdkScreens = await project.screens();
      const screenMap = new Map(sdkScreens.map(s => [s.screenId, s]));

      const limit = pLimit(3);
      const pages = await Promise.all(
        args.routes.map(r => limit(async () => {
          const screen = screenMap.get(r.screenId);
          if (!screen) throw new Error(`Screen not found: ${r.screenId}`);
          const htmlUrl = await screen.getHtml();
          const html = htmlUrl ? await fetch(htmlUrl).then(res => res.text()) : '';
          return { screenId: r.screenId, route: r.route, title: screen.title ?? r.screenId, html };
        }))
      );

      return { success: true, pages };
    },
  };
}
```

Delete `src/commands/site/utils/ProjectSyncer.ts` after updating all call sites. Run tests → **passes**.

#### 🟡 Yellow

```ts
it.skip('build_site respects ProjectSyncer.fetchContent 429 retry logic via SDK', async () => {
  // TODO: Confirm whether the SDK's screen.getHtml() URL fetch needs retry logic,
  // or whether the SDK handles rate-limiting internally.
  // The old ProjectSyncer.test.ts has exhaustive 429/backoff tests — keep until confirmed.
});
```

---

### Phase 5 — `tool` command

The `ToolCommandHandler` already uses an injected client with `{ callTool, getCapabilities }`. This is the **smallest change** in the migration — one method rename.

#### 🔴 Red

```ts
// tests/commands/tool/steps/ListToolsStep.test.ts — add new case
import { StitchToolClient } from '@google/stitch-sdk';

it('calls listTools() on StitchToolClient (not getCapabilities())', async () => {
  const mockListTools = mock(() => Promise.resolve({ tools: [{ name: 'create_project' }] }));
  const mockClient = { listTools: mockListTools, callTool: mock() };

  const step = new ListToolsStep();
  await step.run({ client: mockClient as any, showSchema: false, output: 'pretty' });

  expect(mockListTools).toHaveBeenCalled();
});
```

Run → **fails** (`ListToolsStep` calls `getCapabilities()`, not `listTools()`).

#### 🟢 Green

```ts
// src/commands/tool/steps/ListToolsStep.ts — one-line change
// Before: const caps = await context.client.getCapabilities();
// After:
const caps = await context.client.listTools();
```

```ts
// src/commands/tool/handler.ts — update type
import { StitchToolClient } from '@google/stitch-sdk';

export class ToolCommandHandler {
  constructor(private readonly client: StitchToolClient = new StitchToolClient()) {}
  // rest unchanged
}
```

Update the four step classes:
- `ListToolsStep`: `client.listTools()` → `{ tools }` (was `getCapabilities()`)
- `ExecuteToolStep`: `client.callTool(name, args)` — **signature unchanged**, no edits needed
- `ValidateToolStep`, `ShowSchemaStep`, `ParseArgsStep`: no changes

Run tests → **passes**. All existing `handler.test.ts` and `orchestration.test.ts` tests continue to pass because the mock shape `{ callTool: mock() }` is unchanged; only the `getCapabilities → listTools` rename needs updating in those fixtures.

#### 🟡 Yellow

```ts
it.skip('StitchToolClient auto-connects on first callTool() call', async () => {
  // TODO: Verify StitchToolClient auto-connects vs. requires explicit .connect().
  // If explicit, add connect() call in ToolCommandHandler before step pipeline,
  // and close() in finally (same pattern as current StitchMCPClient).
});
```

---

### Phase 6 — `view` command

**No pattern change.** The `ViewHandler` intentionally exposes raw API response objects to the interactive tree viewer. Migrating to SDK domain objects would destroy the feature (fields like `htmlCode`, `screenshot`, raw `name` paths would be abstracted away).

The only change: replace `StitchMCPClient` injection with the `stitch` singleton's `callTool`.

#### 🔴 Red

```ts
// tests/services/view/handler.test.ts — these tests already pass with the mock shape
// Only update the import/type — no logic changes needed
// The existing mock: { callTool: mock(), connect: mock(), close: mock() }
// maps perfectly to the stitch singleton's callTool interface.

it('still passes with stitch.callTool() shape', async () => {
  const mockStitch = {
    callTool: mock(() => Promise.resolve({ key: 'value' })),
  };
  const handler = new ViewHandler(mockStitch as any);
  const result = await handler.execute({ projects: false, name: 'projects/123' });
  expect(result.success).toBe(true);
});
```

#### 🟢 Green

```ts
// src/services/view/handler.ts — update constructor type only
import { stitch as defaultStitch } from '@google/stitch-sdk';

export class ViewHandler {
  constructor(private readonly stitch = defaultStitch) {}
  // All callTool() calls are identical — no body changes
}
```

Run tests → **passes**. All nine existing `ViewHandler` tests continue to pass without modification.

---

### Phase 7 — Delete `StitchMCPClient`

At this point all consumers have been migrated. Delete:

```
src/services/mcp-client/client.ts
src/services/mcp-client/spec.ts
src/services/mcp-client/MockStitchMCPClient.ts
tests/services/mcp-client/client.test.ts
```

Run full test suite: `bun test --preload ./tests/setup.ts` → all green, no imports of `StitchMCPClient` remain.

---

## 6. Gaps — Promote 🟡 → 🔴 When Resolved

| # | Gap | Affected phases | How to resolve |
|---|---|---|---|
| 1 | `project.title` and `screen.title` on SDK objects | 2, 3, 4 | Inspect SDK source or `console.log(project)` against a real project. If not available, keep `stitch.callTool('get_project', ...)` for title retrieval. |
| 2 | `StitchProxy` debug log hook | 1 | Check `StitchProxy` API for event emitter or options. If absent, wrap `proxy.start()` with existing `FileStream` setup. |
| 3 | `STITCH_USE_SYSTEM_GCLOUD` support in proxy | 1 | Confirm `StitchProxy` honours `STITCH_ACCESS_TOKEN` env var to support pre-obtained tokens. |
| 4 | `screen.getHtml()` null vs. throw contract | 2, 3, 4 | Test with a screen that has no HTML. Determines whether `.filter(s => s.codeUrl !== null)` is safe or needs a try/catch. |

---

## 7. Files Deleted by End of Migration

| File / Directory | Replaced by |
|---|---|
| `src/services/mcp-client/client.ts` | `StitchToolClient` (tool/view) + `stitch` singleton (serve/screens) |
| `src/services/mcp-client/spec.ts` | SDK types |
| `src/services/mcp-client/MockStitchMCPClient.ts` | `MockStitchSDK` helper (Phase 0) |
| `src/services/proxy/handler.ts` | `StitchProxy` (Phase 1) |
| `src/commands/site/utils/ProjectSyncer.ts` | `stitch.project().screens()` (Phase 4) |

---

## 8. Migration Summary

| Phase | Command | TDD colour on day 1 | LOC Δ |
|---|---|---|---|
| 1 | `proxy` | 🔴 → 🟢 | −250 lines of `ProxyHandler` |
| 2 | `serve` | 🔴 → 🟢 | −40 lines of field parsing |
| 3 | `screens` | 🔴 → 🟢 | −35 lines; sort logic unchanged |
| 4 | Virtual tools + `site` | 🔴 → 🟢 | Eliminates `ProjectSyncer` |
| 5 | `tool` | 🔴 → 🟢 | 1-line rename (`getCapabilities` → `listTools`) |
| 6 | `view` | 🔴 → 🟢 | Type annotation change only |
| 7 | Delete `StitchMCPClient` | — | −350+ lines net |

**Bottom line:** Write the 🟡 Yellow skipped tests first to document the gaps, then tackle them in order. Each resolved gap promotes one yellow test to red, which gates the phase going green. The `proxy` command is the highest-ROI starting point.
