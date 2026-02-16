---
title: Virtual Tools
description: Build custom tools that combine Stitch API calls into single operations for agents.
order: 2
category: reference
---

# Virtual Tools

The Stitch MCP server exposes upstream tools like `get_screen` and `list_screens` — but these are atomic. An agent that wants a screen's HTML has to call `get_screen`, find the download URL in the response, then fetch the HTML separately. Virtual tools collapse that into one call.

A virtual tool is a TypeScript object that receives an authenticated client and can call any upstream tool through it. The four built-in virtual tools — `get_screen_code`, `get_screen_image`, `build_site`, and `list_tools` — are all built this way. You can add your own.

## The interface

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

That's the entire API. `name` and `execute` are the only things that matter. The `inputSchema` is JSON Schema that tells agents what arguments the tool expects. The `client` gives you access to every upstream Stitch tool.

## What the client gives you

```typescript
// Call any upstream Stitch tool
const screen = await client.callTool('get_screen', { projectId, screenId });

// List all available tools and schemas
const tools = await client.getCapabilities();
```

`client.callTool()` handles authentication, connection, and error parsing. You call remote tools by name and get typed results back.

## Building a virtual tool

### 1. Create the file

Virtual tools live in `src/commands/tool/virtual-tools/`. Create a new file:

```typescript
// src/commands/tool/virtual-tools/compare-screens.ts
import type { VirtualTool } from '../spec.js';
import type { StitchMCPClient } from '../../../services/mcp-client/client.js';

export const compareScreensTool: VirtualTool = {
  name: 'compare_screens',
  description: '(Virtual) Compare two screens and return their structural differences.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID containing both screens.',
      },
      screenIdA: {
        type: 'string',
        description: 'The first screen ID.',
      },
      screenIdB: {
        type: 'string',
        description: 'The second screen ID.',
      },
    },
    required: ['projectId', 'screenIdA', 'screenIdB'],
  },
  execute: async (client: StitchMCPClient, args: any) => {
    const { projectId, screenIdA, screenIdB } = args;

    // Call upstream tools through the client
    const [screenA, screenB] = await Promise.all([
      client.callTool('get_screen', { projectId, screenId: screenIdA }),
      client.callTool('get_screen', { projectId, screenId: screenIdB }),
    ]);

    return {
      screenA: { id: screenIdA, title: (screenA as any).title },
      screenB: { id: screenIdB, title: (screenB as any).title },
      // Agent interprets the structural differences
    };
  },
};
```

### 2. Register it

Add your tool to the array in `src/commands/tool/virtual-tools/index.ts`:

```typescript
import { compareScreensTool } from './compare-screens.js';

export const virtualTools: VirtualTool[] = [
  getScreenCodeTool,
  getScreenImageTool,
  buildSiteTool,
  listToolsTool,
  compareScreensTool,  // your tool
];
```

That's it. Your tool is now callable through the CLI and exposed to agents via MCP.

### 3. Test it

```bash
# Verify it shows up
stitch tool

# Check the schema
stitch tool compare_screens -s

# Call it
stitch tool compare_screens -d '{
  "projectId": "123456",
  "screenIdA": "abc",
  "screenIdB": "def"
}'
```

## Patterns from the built-in tools

### Wrapper — `get_screen_code`

The simplest pattern. Call an upstream tool, fetch additional data, return the enriched result:

```typescript
execute: async (client: StitchMCPClient, args: any) => {
  const { projectId, screenId } = args;

  // 1. Call the upstream tool
  const screen = await client.callTool('get_screen', {
    projectId,
    screenId,
  }) as any;

  // 2. Download the HTML content from the returned URL
  let htmlContent: string | null = null;
  if (screen.htmlCode?.downloadUrl) {
    try {
      htmlContent = await downloadText(screen.htmlCode.downloadUrl);
    } catch (e) {
      console.error(`Error downloading HTML code: ${e}`);
    }
  }

  // 3. Return the screen data + downloaded HTML
  return { ...screen, htmlContent };
},
```

One upstream call, one fetch, one return. This is the pattern you'll use most.

### Orchestrator — `build_site`

Validates input, fetches data in parallel with concurrency limits, and assembles a structured result:

```typescript
execute: async (client: StitchMCPClient, args: any) => {
  const { projectId, routes } = args;

  // Validate
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error('routes must be a non-empty array');
  }
  const routePaths = routes.map((r: any) => r.route);
  const uniqueRoutes = new Set(routePaths);
  if (uniqueRoutes.size !== routePaths.length) {
    throw new Error('Duplicate route paths found');
  }

  // Fetch screens from Stitch
  const syncer = new ProjectSyncer(client);
  const remoteScreens = await syncer.fetchManifest(projectId);

  // Download HTML with concurrency limit
  const limit = pLimit(3);
  await Promise.all(
    routes.map((r: any) =>
      limit(async () => {
        const html = await syncer.fetchContent(screen.downloadUrl);
        htmlContent.set(r.screenId, html);
      })
    )
  );

  // Return structured pages
  return {
    success: true,
    pages: routes.map((r: any) => ({
      screenId: r.screenId,
      route: r.route,
      title: screenMap.get(r.screenId)!.title,
      html: htmlContent.get(r.screenId)!,
    })),
  };
},
```

Key details: `pLimit(3)` caps concurrent fetches. Errors are collected and thrown together, not on first failure.

### Passthrough — `list_tools`

The minimal case. Delegates directly to a client method:

```typescript
execute: async (client: StitchMCPClient, _args: any) => {
  const result = await client.getCapabilities();
  return result.tools || [];
},
```

## Conventions

| Convention | Example |
|-----------|---------|
| Names use `snake_case` | `get_screen_code`, `build_site` |
| Descriptions start with `(Virtual)` | `(Virtual) Retrieves a screen and downloads its HTML` |
| Input schemas use JSON Schema | `{ type: 'object', properties: { ... }, required: [...] }` |
| Errors throw with descriptive messages | `throw new Error('Screen IDs not found: ...')` |
| Concurrent fetches use `pLimit` | `const limit = pLimit(3)` |

## Built-in tools reference

| Tool | What it does |
|------|-------------|
| `get_screen_code` | Calls `get_screen`, downloads the HTML from the returned URL |
| `get_screen_image` | Calls `get_screen`, downloads the screenshot as base64 |
| `build_site` | Maps screens to routes, fetches HTML for each in parallel |
| `list_tools` | Returns all tools and their schemas |
