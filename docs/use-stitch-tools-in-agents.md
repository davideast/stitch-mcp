---
title: Use Stitch Tools in Agents
description: Tool catalog, input schemas, and prompting patterns for agent workflows.
order: 2
category: agent-integration
---

# Use Stitch Tools in Agents

Once your agent is [connected](connect-your-agent.md), it has access to both upstream Stitch tools and virtual tools added by the proxy.

## Upstream Stitch tools

These are the tools provided directly by the Stitch MCP API:

| Tool | Description |
|------|-------------|
| `list_projects` | List all Stitch projects accessible to the user |
| `get_project` | Get details for a specific project by resource name |
| `list_screens` | List all screens within a project |
| `get_screen` | Get details for a specific screen (metadata, download URLs) |
| `generate_screen_from_text` | Generate a new screen from a text prompt |
| `edit_screens` | Edit existing screens using a text prompt |
| `generate_variants` | Generate design variants of existing screens |

## Virtual tools

The proxy adds these tools on top of the upstream set. They combine multiple API calls into higher-level operations designed for coding agents.

### `build_site`

Builds a site from a project by mapping screens to routes. Returns the design HTML for each page.

**Input schema:**

```json
{
  "projectId": "string (required)",
  "routes": [
    {
      "screenId": "string (required)",
      "route": "string (required, e.g. \"/\" or \"/about\")"
    }
  ]
}
```

**Returns:** An object with `success`, `pages` (array of `{ screenId, route, title, html }`), and `message`.

**When to use:** When your agent needs to generate a multi-page site from designs. The returned HTML gives the agent full design context for code generation.

### `get_screen_code`

Retrieves a screen and downloads its HTML code content.

**Input schema:**

```json
{
  "projectId": "string (required)",
  "screenId": "string (required)"
}
```

**Returns:** The screen object with an added `htmlContent` field containing the full HTML source.

**When to use:** When your agent needs the raw HTML of a single screen — for implementing a component, extracting styles, or understanding layout structure.

### `get_screen_image`

Retrieves a screen and downloads its screenshot image as base64.

**Input schema:**

```json
{
  "projectId": "string (required)",
  "screenId": "string (required)"
}
```

**Returns:** The screen object with an added `screenshotBase64` field containing a base64-encoded PNG.

**When to use:** When your agent needs a visual reference for the design — useful for multimodal models that can interpret images.

### `list_tools`

Lists all available tools with their descriptions and schemas.

**Input schema:** No parameters.

**Returns:** An array of tool objects with `name`, `description`, and `inputSchema`.

**When to use:** For discovery — see what tools are available and their expected inputs.

## Prompting patterns

These natural language prompts work well with connected agents:

**Explore available designs:**
> "List my Stitch projects and show me the screens in project X."

**Get design context for implementation:**
> "Use get_screen_code to fetch the landing page screen, then implement it as a React component."

**Build a multi-page site:**
> "Use build_site to create a site from project 123 with the home screen at / and the about screen at /about. Then scaffold a Next.js app using the returned HTML as design reference."

**Visual design review:**
> "Get the screenshot for screen abc in project 123 and describe the layout, colors, and components you see."

**Generate new designs:**
> "Generate a new screen in project 123 with a pricing page that has three tiers: Free, Pro, and Enterprise."

## Using `tool` CLI for debugging

The `tool` command lets you invoke any MCP tool directly from the terminal — useful for testing and debugging before asking your agent to use them.

```bash
# List all available tools
npx @_davideast/stitch-mcp tool

# Show a tool's input schema
npx @_davideast/stitch-mcp tool build_site -s

# Invoke a tool with JSON data
npx @_davideast/stitch-mcp tool get_screen_code -d '{
  "projectId": "123456",
  "screenId": "abc123"
}'

# Output as raw JSON (useful for piping)
npx @_davideast/stitch-mcp tool list_projects -o json
```

## Common mistakes

**Forgetting `projectId`:** Every screen-level tool requires a `projectId`. Use `list_projects` first if you don't have one.

**Screen name vs screen ID:** The `screenId` parameter expects the screen's ID (e.g., `98b50e2ddc9943efb387052637738f61`), not its display name. Use `list_screens` to find screen IDs.

**Duplicate routes in `build_site`:** Each route path must be unique. The tool validates this and returns an error if duplicates are found.

**Missing screens:** If a `screenId` doesn't exist in the project, `build_site` returns an error listing the missing IDs. Verify screen IDs with `list_screens` first.
