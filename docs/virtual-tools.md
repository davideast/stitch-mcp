---
title: Virtual Tools
description: Interface reference for virtual tools — custom operations that combine multiple Stitch API calls.
order: 1
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

Ready to create your own? See [Build a Virtual Tool](build-virtual-tools.md) for the full walkthrough.
