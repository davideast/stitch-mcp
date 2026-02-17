---
title: Connection Modes
description: How the proxy and direct connection modes work and when to use each.
order: 2
category: agent-integration
---

# Connection Modes

There are two ways your agent can talk to Stitch. Understanding the trade-offs helps you pick the right one for your setup.

## Proxy (stdio)

Your MCP client launches the stitch-mcp proxy as a local process. The proxy talks to the Stitch API on behalf of your agent.

```
Agent  <-stdio->  stitch-mcp proxy  <-HTTP->  Stitch API
```

## Direct (HTTP)

Your MCP client connects straight to the Stitch API with no proxy in between.

```
Agent  <-HTTP->  Stitch API
```

## Comparison

| | Proxy (stdio) | Direct (HTTP) |
|---|--------------|---------------|
| **Virtual tools** | `build_site`, `get_screen_code`, `get_screen_image` — higher-level operations that combine multiple API calls | Not available — only upstream Stitch tools |
| **Token refresh** | Automatic every 55 min (OAuth) | Manual — tokens expire after 1 hour (OAuth) |
| **API key auth** | Works | Works |
| **Setup** | `npx @_davideast/stitch-mcp proxy` runs in the background | Just a URL and headers |

Use the proxy if you want virtual tools or automatic token refresh. Use direct if you only need the upstream Stitch tools and want a simpler config with an API key.

## What virtual tools add

The upstream Stitch API provides tools for listing projects, getting screens, generating designs, and editing screens. The proxy adds virtual tools on top of these that are designed for coding agents:

- **`build_site`** — maps screens to routes and returns the design HTML for each page
- **`get_screen_code`** — fetches a screen and downloads its HTML source
- **`get_screen_image`** — fetches a screen and downloads its screenshot as base64

These combine multiple API calls into single operations. See [Virtual Tools](virtual-tools.md) for the full interface and conventions.

## Next steps

Ready to connect? See [Connect Your Agent](connect-your-agent.md) for per-client configuration.
