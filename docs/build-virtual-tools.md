---
title: Build a Virtual Tool
description: Create custom virtual tools that combine Stitch API calls into single operations.
order: 3
category: reference
---

# Build a Virtual Tool

Virtual tools let you combine multiple Stitch API calls into a single agent-callable operation. This guide walks through creating, registering, and testing one. See [Virtual Tools](virtual-tools.md) for the interface reference and conventions.

## 1. Create the file

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

## 2. Register it

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

## 3. Test it

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

The simplest pattern. Call an upstream tool, fetch additional data, return the combined result:

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

Start here for most virtual tools — one upstream call, one fetch, one return.

### Orchestrator — `build_site`

For tools that coordinate multiple fetches, validate input first, use `pLimit` to cap concurrency, and assemble a structured result:

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

Use `pLimit(3)` to cap concurrent fetches. Collect errors and throw them together rather than failing on the first one.

### Passthrough — `list_tools`

When you only need to forward a single client method, delegate directly:

```typescript
execute: async (client: StitchMCPClient, _args: any) => {
  const result = await client.getCapabilities();
  return result.tools || [];
},
```
