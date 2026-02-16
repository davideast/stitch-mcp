---
title: Connect Your Agent
description: Configure your MCP client to give coding agents access to Stitch tools.
order: 1
category: agent-integration
---

# Connect Your Agent

Before connecting, make sure you have credentials configured. See [Setup](setup.md) if you haven't authenticated yet.

## Proxy vs direct connection

There are two ways your agent can talk to Stitch:

**Proxy (stdio)** — your MCP client launches the stitch-mcp proxy as a local process. The proxy talks to the Stitch API on behalf of your agent.

```
Agent  ←stdio→  stitch-mcp proxy  ←HTTP→  Stitch API
```

**Direct (HTTP)** — your MCP client connects straight to the Stitch API with no proxy in between.

```
Agent  ←HTTP→  Stitch API
```

### When to use each

| | Proxy (stdio) | Direct (HTTP) |
|---|--------------|---------------|
| **Virtual tools** | `build_site`, `get_screen_code`, `get_screen_image` — higher-level operations that combine multiple API calls | Not available — only upstream Stitch tools |
| **Token refresh** | Automatic every 55 min (OAuth) | Manual — tokens expire after 1 hour (OAuth) |
| **API key auth** | Works | Works |
| **Setup** | `npx @_davideast/stitch-mcp proxy` runs in the background | Just a URL and headers |

Use the proxy if you want virtual tools or automatic token refresh. Use direct if you only need the upstream Stitch tools and want a simpler config with an API key.

### What virtual tools add

The upstream Stitch API provides tools for listing projects, getting screens, generating designs, and editing screens. The proxy adds virtual tools on top of these that are designed for coding agents:

- **`build_site`** — maps screens to routes and returns the design HTML for each page
- **`get_screen_code`** — fetches a screen and downloads its HTML source
- **`get_screen_image`** — fetches a screen and downloads its screenshot as base64

These combine multiple API calls into single operations. See [Use Stitch tools in agents](use-stitch-tools-in-agents.md) for full schemas and usage.

## Per-client configuration

The `init` wizard generates the right config for you:

```bash
npx @_davideast/stitch-mcp init
```

Or manually configure your client below. Each client shows the proxy config first (with API key auth), then the direct config.

### Claude Code

**Proxy with API key:**

```bash
claude mcp add stitch -e STITCH_API_KEY=YOUR_API_KEY \
  -- npx @_davideast/stitch-mcp proxy
```

**Proxy with OAuth:**

```bash
claude mcp add stitch -- npx @_davideast/stitch-mcp proxy
```

**Direct with API key:**

```bash
claude mcp add stitch \
  --transport http https://stitch.googleapis.com/mcp \
  --header "X-Goog-Api-Key: YOUR_API_KEY" \
  -s user
```

`-s user` saves to `$HOME/.claude.json`. Use `-s project` for `./.mcp.json`.

### VS Code

Add to `.vscode/mcp.json`. Open with: Command Palette > "MCP: Open User Configuration" or "MCP: Open Workspace Folder Configuration".

**Proxy with API key:**

```json
{
  "servers": {
    "stitch": {
      "type": "stdio",
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

**Proxy with OAuth:**

```json
{
  "servers": {
    "stitch": {
      "type": "stdio",
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_PROJECT_ID": "YOUR_PROJECT_ID"
      }
    }
  }
}
```

**Direct with API key:**

```json
{
  "servers": {
    "stitch": {
      "type": "http",
      "url": "https://stitch.googleapis.com/mcp",
      "headers": {
        "Accept": "application/json",
        "X-Goog-Api-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

**Proxy with API key:**

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

**Proxy with OAuth:**

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_PROJECT_ID": "YOUR_PROJECT_ID"
      }
    }
  }
}
```

**Direct with API key:**

```json
{
  "mcpServers": {
    "stitch": {
      "url": "https://stitch.googleapis.com/mcp",
      "headers": {
        "X-Goog-Api-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

### Gemini CLI

Install the Stitch extension:

```bash
gemini extensions install https://github.com/gemini-cli-extensions/stitch
```

No JSON config needed — the extension handles connectivity.

### Codex

Add to `~/.codex/config.toml`:

**Proxy with API key:**

```toml
[mcp_servers.stitch]
command = "npx"
args = ["@_davideast/stitch-mcp", "proxy"]

[mcp_servers.stitch.env]
STITCH_API_KEY = "YOUR_API_KEY"
```

**Proxy with OAuth:**

```toml
[mcp_servers.stitch]
command = "npx"
args = ["@_davideast/stitch-mcp", "proxy"]

[mcp_servers.stitch.env]
STITCH_PROJECT_ID = "YOUR_PROJECT_ID"
```

**Direct with API key:**

```toml
[mcp_servers.stitch]
url = "https://stitch.googleapis.com/mcp"

[mcp_servers.stitch.env_http_headers]
X-Goog-Api-Key = "YOUR_API_KEY"
```

### OpenCode

Add to `opencode.json` in your project root:

**Proxy with API key:**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "stitch": {
      "type": "local",
      "command": ["npx", "@_davideast/stitch-mcp", "proxy"],
      "environment": {
        "STITCH_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

**Proxy with OAuth:**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "stitch": {
      "type": "local",
      "command": ["npx", "@_davideast/stitch-mcp", "proxy"],
      "environment": {
        "STITCH_PROJECT_ID": "YOUR_PROJECT_ID"
      }
    }
  }
}
```

**Direct with API key:**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "stitch": {
      "type": "remote",
      "url": "https://stitch.googleapis.com/mcp",
      "headers": {
        "X-Goog-Api-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

### Antigravity

Add via: Agent Panel > three dots > MCP Servers > Manage MCP Servers > View raw config.

**Proxy with API key:**

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

**Proxy with OAuth:**

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_PROJECT_ID": "YOUR_PROJECT_ID"
      }
    }
  }
}
```

**Direct with API key:**

```json
{
  "mcpServers": {
    "stitch": {
      "serverUrl": "https://stitch.googleapis.com/mcp",
      "headers": {
        "X-Goog-Api-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

Note: Antigravity uses `serverUrl` instead of `url` for HTTP connections.

## Verifying the connection

List available tools to confirm your agent can reach Stitch:

```bash
npx @_davideast/stitch-mcp tool
```

If you see both upstream tools (like `list_projects`) and virtual tools (like `build_site`), the proxy is working. If you only see upstream tools, you're connected directly.

Run `doctor` to diagnose authentication issues:

```bash
npx @_davideast/stitch-mcp doctor --verbose
```
