# stitch-mcp

A CLI for moving AI-generated UI designs into your development workflow — preview them locally, build sites from them, and feed them to coding agents.

## Why

AI-generated designs in Google's Stitch platform live as HTML/CSS behind an API. Getting them into a local development environment — for previewing, building, or handing off to coding agents — requires fetching, serving, and structuring them. stitch-mcp handles this through a set of CLI commands that connect to Stitch.

## Quick start

```bash
# Set up authentication and MCP client config
npx @_davideast/stitch-mcp init

# Serve all project screens on a local dev server
npx @_davideast/stitch-mcp serve -p <project-id>

# Build an Astro site by mapping screens to routes
npx @_davideast/stitch-mcp site -p <project-id>
```

## Features

- **Preview designs locally** — serve all screens from a project on a Vite dev server
- **Build an Astro site from your designs** — map screens to routes and generate a deployable project
- **Give your agent design context** — proxy Stitch tools to your IDE's coding agent with automatic token refresh
- **Explore your design data** — browse projects, screens, and metadata in the terminal or via CLI
- **Browse projects in your terminal** — navigate screens interactively with copy, preview, and open actions
- **Set up in one command** — guided wizard handles gcloud, auth, and MCP client configuration

## MCP integration

Add this to your MCP client config to give coding agents access to Stitch tools:

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"]
    }
  }
}
```

Supported clients: VS Code, Cursor, Claude Code, Gemini CLI, Codex, OpenCode.

### Virtual tools

The proxy exposes these tools alongside the upstream Stitch MCP tools. They combine multiple API calls into higher-level operations for coding agents:

- **`build_site`** — Builds a site from a project by mapping screens to routes. Returns the design HTML for each page.
- **`get_screen_code`** — Retrieves a screen and downloads its HTML code content.
- **`get_screen_image`** — Retrieves a screen and downloads its screenshot image as base64.

`build_site` input schema:

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

Example:

```bash
npx @_davideast/stitch-mcp tool build_site -d '{
  "projectId": "123456",
  "routes": [
    { "screenId": "abc", "route": "/" },
    { "screenId": "def", "route": "/about" }
  ]
}'
```

## Explore your designs

Use `view` and `tool` to browse your design data and understand what's available before prompting agents.

```bash
# Browse all projects
npx @_davideast/stitch-mcp view --projects

# Inspect a specific screen
npx @_davideast/stitch-mcp view --project <project-id> --screen <screen-id>

# Invoke any MCP tool from the CLI
npx @_davideast/stitch-mcp tool [toolName]
```

Inside the `view` browser: `c` copies the selected value, `s` previews HTML in your browser, `o` opens the project in Stitch, and `q` quits. Use arrow keys to navigate and Enter to drill into nested data.

Run `tool` without a name to list all available tools, or with `-s` to see a tool's schema.

---

## Installation

Run directly with `npx` (no install needed):

```bash
npx @_davideast/stitch-mcp <command>
```

Or install globally:

```bash
npm install -g @_davideast/stitch-mcp
stitch-mcp <command>
```

## Commands

| Command | Description |
|---------|-------------|
| **Setup** | |
| `init` | Set up auth, gcloud, and MCP client config |
| `doctor` | Verify configuration health |
| `logout` | Revoke credentials |
| **Development** | |
| `serve -p <id>` | Preview project screens locally |
| `screens -p <id>` | Browse screens in terminal |
| `view` | Interactive resource browser |
| **Build** | |
| `site -p <id>` | Generate Astro project from screens |
| `snapshot` | Save screen state to file |
| **Integration** | |
| `tool [name]` | Invoke MCP tools from CLI |
| `proxy` | Run MCP proxy for agents |

Run any command with `--help` for full options.

## Authentication

**Automatic (recommended):** Run `init` and follow the wizard. It handles gcloud installation, OAuth, credentials, and project setup.

```bash
npx @_davideast/stitch-mcp init
```

**API key:** Set the `STITCH_API_KEY` environment variable to skip OAuth entirely.

```bash
export STITCH_API_KEY="your-api-key"
```

**Manual (existing gcloud):** If you already have gcloud configured:

```bash
gcloud auth application-default login
gcloud config set project <PROJECT_ID>
gcloud beta services mcp enable stitch.googleapis.com --project=<PROJECT_ID>
```

Then use the proxy with `STITCH_USE_SYSTEM_GCLOUD=1`:

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_USE_SYSTEM_GCLOUD": "1"
      }
    }
  }
}
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `STITCH_API_KEY` | API key for direct authentication (skips OAuth) |
| `STITCH_ACCESS_TOKEN` | Pre-existing access token |
| `STITCH_USE_SYSTEM_GCLOUD` | Use system gcloud config instead of isolated config |
| `STITCH_PROJECT_ID` | Override project ID |
| `GOOGLE_CLOUD_PROJECT` | Alternative project ID variable |
| `STITCH_HOST` | Custom Stitch API endpoint |

## Troubleshooting

### "Permission Denied" errors

Ensure you have Owner or Editor role, billing is enabled, and the Stitch API is enabled. Run `doctor --verbose` to diagnose.

### Authentication URL not appearing

The tool prints authentication URLs to the terminal with a 5-second timeout. Look for a URL starting with `https://accounts.google.com`. If using proxy with `--debug`, check `/tmp/stitch-proxy-debug.log`.

### Already authenticated but showing logged in

The bundled gcloud SDK maintains separate authentication from your global gcloud installation. To fully clear authentication:

```bash
npx @_davideast/stitch-mcp logout --force --clear-config
```

### API connection fails after setup

Run `doctor --verbose` to diagnose. Verify your project has billing and the Stitch API enabled. If issues persist, re-authenticate:

```bash
npx @_davideast/stitch-mcp logout --force
npx @_davideast/stitch-mcp init
```

### WSL / SSH / Docker environments

The CLI detects WSL, SSH sessions, Docker containers, and Cloud Shell. In these environments, browser-based auth may not work automatically. Copy the OAuth URL from your terminal and open it in a browser manually.

## Development

```bash
# Install dependencies
bun install

# Run locally
bun run dev init

# Run tests
bun test

# Build
bun run build

# Verify package
bun run verify-pack
```

## License

Apache 2.0 © David East

## Disclaimer

> [!WARNING]
> **Experimental Project** - This is an independent, experimental tool.

This project is:
- **NOT** affiliated with, endorsed by, or sponsored by Google LLC, Alphabet Inc., or the Stitch API team
- Provided **AS-IS** with **NO WARRANTIES** of any kind
- **NOT** guaranteed to be maintained, secure, or compatible with future API versions

"Stitch" and "Google Cloud" are trademarks of Google LLC.

**USE AT YOUR OWN RISK.**
