---
title: Tool Catalog
description: All Stitch tools available to agents — schemas, return types, and parameter details.
order: 1
category: reference
---

# Tool Catalog

Every tool available through the Stitch MCP server. Upstream tools come directly from the Stitch API. Virtual tools are added by the proxy and combine multiple API calls into single operations.

## Upstream tools

Available in both proxy and direct connection modes.

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

Available only through the proxy. See [Connection Modes](connection-modes.md) for proxy vs direct.

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

### `list_tools`

Lists all available tools with their descriptions and schemas.

**Input schema:** No parameters.

**Returns:** An array of tool objects with `name`, `description`, and `inputSchema`.

## Common parameter mistakes

**Forgetting `projectId`:** Every screen-level tool requires a `projectId`. Use `list_projects` first if you don't have one.

**Screen name vs screen ID:** The `screenId` parameter expects the screen's ID (e.g., `98b50e2ddc9943efb387052637738f61`), not its display name. Use `list_screens` to find screen IDs.

**Duplicate routes in `build_site`:** Each route path must be unique. The tool validates this and returns an error if duplicates are found.

**Missing screens:** If a `screenId` doesn't exist in the project, `build_site` returns an error listing the missing IDs. Verify screen IDs with `list_screens` first.
