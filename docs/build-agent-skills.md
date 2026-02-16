---
title: Build Agent Skills
description: Programmatic usage, library API, and virtual tool architecture for skill builders.
order: 3
category: agent-integration
---

# Build Agent Skills

This guide covers how to use stitch-mcp programmatically to build agent skills, automations, and custom tooling.

## The design-to-code pattern

The typical agent workflow:

1. **Generate** — create or select designs in Stitch
2. **Fetch** — use `get_screen_code` or `build_site` to get design HTML
3. **Implement** — pass the HTML to a coding agent as context for code generation
4. **Iterate** — edit designs with `edit_screens`, re-fetch, and refine

## `build_site` + code generation

The `build_site` virtual tool is designed for agents that scaffold entire applications. It maps screens to routes and returns the design HTML for each page:

```bash
npx @_davideast/stitch-mcp tool build_site -d '{
  "projectId": "123456",
  "routes": [
    { "screenId": "abc", "route": "/" },
    { "screenId": "def", "route": "/about" }
  ]
}'
```

Returns:

```json
{
  "success": true,
  "pages": [
    { "screenId": "abc", "route": "/", "title": "Home", "html": "<!DOCTYPE html>..." },
    { "screenId": "def", "route": "/about", "title": "About", "html": "<!DOCTYPE html>..." }
  ],
  "message": "Built 2 page(s) with design HTML"
}
```

Agents can use the returned HTML as the ground truth for layout, colors, and component structure.

## `site --export` for agent consumption

The `site` command has an `--export` flag that outputs the screen-to-route mapping as JSON instead of generating an Astro project:

```bash
npx @_davideast/stitch-mcp site -p 123456 --export
```

This outputs `build_site`-compatible JSON that an agent can pass directly to the `build_site` tool. Useful when a human picks routes interactively and hands off to an agent for implementation.

## Library API

Install stitch-mcp as a dependency for programmatic access:

```bash
npm install @_davideast/stitch-mcp
```

### Available exports

| Export | Description |
|--------|-------------|
| `GcloudHandler` | Manage gcloud installation, auth, and projects |
| `StitchHandler` | Configure IAM, enable API, test connections |
| `McpConfigHandler` | Generate MCP client configurations |
| `ProjectHandler` | Interactive project selection |
| `InitHandler` | Full setup wizard |
| `DoctorHandler` | Health check diagnostics |

### Authenticate and get a token

```typescript
import { GcloudHandler } from '@_davideast/stitch-mcp';

const gcloud = new GcloudHandler();

const installResult = await gcloud.ensureInstalled({ forceLocal: false });
if (!installResult.success) {
  console.error('gcloud not available:', installResult.error.message);
  process.exit(1);
}

const authResult = await gcloud.authenticate({ skipIfActive: true });
if (authResult.success) {
  console.log(`Authenticated as: ${authResult.data.account}`);
}

const token = await gcloud.getAccessToken();
```

### Test Stitch API connectivity

```typescript
import { StitchHandler, GcloudHandler } from '@_davideast/stitch-mcp';

const gcloud = new GcloudHandler();
const stitch = new StitchHandler();
const token = await gcloud.getAccessToken();

const result = await stitch.testConnection({
  projectId: 'my-project-id',
  accessToken: token!,
});

if (result.success) {
  console.log(`Connected (HTTP ${result.data.statusCode})`);
}
```

### Generate MCP config for a client

```typescript
import { McpConfigHandler } from '@_davideast/stitch-mcp';

const configGenerator = new McpConfigHandler();
const result = await configGenerator.generateConfig({
  client: 'vscode',
  projectId: 'my-project',
  transport: 'stdio',
  apiKey: 'your-api-key',
});

if (result.success) {
  console.log(result.data.config);
}
```

### Run diagnostics

```typescript
import { DoctorHandler } from '@_davideast/stitch-mcp';

const doctor = new DoctorHandler();
const result = await doctor.execute({ verbose: true });

if (result.success) {
  result.data.checks.forEach(check => {
    console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}: ${check.message}`);
  });
}
```

## Virtual tool architecture

Virtual tools extend the proxy with operations that combine multiple upstream API calls. They're defined using the `VirtualTool` interface:

```typescript
interface VirtualTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  execute: (client: StitchMCPClient, args: any) => Promise<any>;
}
```

Each virtual tool receives the authenticated `StitchMCPClient` and can call upstream tools through `client.callTool(toolName, args)`.

The four built-in virtual tools are in `src/commands/tool/virtual-tools/`:

- `build-site.ts` — orchestrates screen fetching and HTML download for multi-page sites
- `get-screen-code.ts` — fetches a screen then downloads its HTML content
- `get-screen-image.ts` — fetches a screen then downloads its screenshot as base64
- `list-tools.ts` — returns all available tools and their schemas

## Example: a skill that scaffolds an app

Here's the flow for an agent skill that creates a web app from Stitch designs:

1. Call `list_projects` to find available projects
2. Call `list_screens` with the chosen project ID
3. Present screens to the user and collect route assignments
4. Call `build_site` with the project ID and route mappings
5. Use the returned HTML to scaffold components in the chosen framework
6. Optionally call `get_screen_image` for visual reference during implementation

The `site --export` command automates steps 2-3 by providing an interactive picker that outputs `build_site`-compatible JSON.

## Type safety

All handlers export their TypeScript interfaces for mocking in tests:

```typescript
import type {
  GcloudService,
  StitchService,
  McpConfigService
} from '@_davideast/stitch-mcp';
```
