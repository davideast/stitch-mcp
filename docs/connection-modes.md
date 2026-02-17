---
title: Connection Modes
description: How the proxy and direct connection modes work, why each exists, and when to use each.
order: 2
category: agent-integration
---

# Connection Modes

There are two ways your agent can talk to Stitch: through a local proxy or directly over HTTP. Each exists for a reason, and understanding the trade-offs helps you pick the right one.

## Proxy (stdio)

Your MCP client launches the stitch-mcp proxy as a local process. The proxy talks to the Stitch API on behalf of your agent.

```
Agent  <-stdio->  stitch-mcp proxy  <-HTTP->  Stitch API
```

The proxy exists because the upstream Stitch API exposes atomic operations — list projects, get a screen, edit a screen — but coding agents need higher-level workflows. An agent implementing a design needs a screen's HTML source, but the `get_screen` API returns metadata with a download URL, not the HTML itself. The proxy's virtual tools handle that orchestration: `get_screen_code` calls `get_screen`, follows the download URL, and returns the HTML in one step.

The proxy also manages OAuth token lifecycle. Stitch access tokens expire after one hour. The proxy refreshes them automatically every 55 minutes, so long-running agent sessions don't hit auth errors mid-workflow.

stdio is the transport because it's how MCP clients (Claude Code, VS Code, Cursor) launch tool servers — as child processes communicating over stdin/stdout. No port configuration, no firewall rules, no process management. The client starts the proxy and owns its lifecycle.

## Direct (HTTP)

Your MCP client connects straight to the Stitch API with no proxy in between.

```
Agent  <-HTTP->  Stitch API
```

Direct mode is simpler: one HTTPS connection, no child process, no local state. It works well for API key authentication where there's no token to refresh, and for environments where spawning child processes is impractical (CI pipelines, serverless, constrained containers).

The trade-off is that direct mode only exposes the upstream Stitch tools. Virtual tools like `build_site` and `get_screen_code` aren't available — your agent would need to replicate their logic in its own prompts.

## Comparison

| | Proxy (stdio) | Direct (HTTP) |
|---|--------------|---------------|
| **Virtual tools** | `build_site`, `get_screen_code`, `get_screen_image` — higher-level operations that combine multiple API calls | Not available — only upstream Stitch tools |
| **Token refresh** | Automatic every 55 min (OAuth) | Manual — tokens expire after 1 hour (OAuth) |
| **API key auth** | Works | Works |
| **Setup** | `npx @_davideast/stitch-mcp proxy` runs in the background | Just a URL and headers |

## When to use each

Start with the **proxy** if you're working interactively with a coding agent. The virtual tools save significant back-and-forth, and automatic token refresh means you won't debug auth errors during a long session.

Use **direct** if you only need the upstream Stitch tools and want the simplest possible config — an API key and a URL. This is common in CI pipelines, automated scripts, or setups where you can't spawn child processes.

If you start with direct and later need virtual tools, switching to the proxy is a config change — same auth credentials, different transport.

## Next steps

See [Connect Your Agent](connect-your-agent.md) for per-client configuration.
