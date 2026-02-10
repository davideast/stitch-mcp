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

- **Local dev server** — `serve` runs a Vite server with all screens from a project
- **Site generation** — `site` builds an Astro project from screen-to-route mappings
- **MCP proxy** — `proxy` bridges your IDE's coding agent to Stitch tools with automatic token refresh
- **Virtual tools** — `build_site`, `get_screen_code`, `get_screen_image` give agents direct access to design HTML and screenshots
- **Interactive browser** — `view` navigates projects and screens in the terminal
- **Guided setup** — `init` handles gcloud, auth, and MCP client configuration

## MCP integration

Add this to your MCP client config to give coding agents access to Stitch tools and virtual tools:

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

### `init` — Set up authentication and MCP config

```bash
npx @_davideast/stitch-mcp init [options]
```

| Option | Description |
|--------|-------------|
| `--local` | Install gcloud locally to project directory instead of user home |
| `-y, --yes` | Auto-approve verification prompts |
| `--defaults` | Use default values for prompts |
| `-c, --client <client>` | MCP client to configure (antigravity, vscode, cursor, claude-code, gemini-cli, codex, opencode) |
| `-t, --transport <type>` | Transport type (`http` or `stdio`) |

Walks through a setup wizard: MCP client selection, gcloud installation, OAuth login, application credentials, project selection, IAM permissions, Stitch API enablement, connection test, and config generation.

### `doctor` — Verify configuration health

```bash
npx @_davideast/stitch-mcp doctor [options]
```

| Option | Description |
|--------|-------------|
| `--verbose` | Show detailed error information |

Checks that gcloud is installed, user is authenticated, Application Default Credentials exist, a GCP project is configured, and the Stitch API is reachable.

### `serve` — Local dev server for project screens

```bash
npx @_davideast/stitch-mcp serve -p <project-id>
```

| Option | Description |
|--------|-------------|
| `-p, --project <id>` | **Required.** Project ID |

Fetches all screens from a Stitch project and serves them on a local Vite dev server. Each screen gets its own route for previewing rendered HTML in the browser.

### `screens` — Explore screens in a project

```bash
npx @_davideast/stitch-mcp screens -p <project-id>
```

| Option | Description |
|--------|-------------|
| `-p, --project <id>` | **Required.** Project ID |

Opens an interactive terminal UI for browsing all screens in a project.

### `site` — Build an Astro site from screens

```bash
npx @_davideast/stitch-mcp site -p <project-id> [options]
```

| Option | Description |
|--------|-------------|
| `-p, --project <id>` | **Required.** Project ID |
| `-o, --output <dir>` | Output directory (default: `.`) |
| `-e, --export` | Export screen-to-route config as `build_site` JSON (no interactive UI) |

Launches an interactive screen-to-route mapper, then generates an Astro project with the following structure:

```
├── package.json
├── astro.config.mjs
└── src/
    ├── layouts/Layout.astro
    └── pages/
        ├── index.astro        # screen mapped to "/"
        └── about.astro        # screen mapped to "/about"
```

External assets (fonts, images) are downloaded to `public/assets/` with URLs rewritten to local paths.

Press `e` in the interactive builder to export the current screen-to-route config as JSON to stdout (useful for piping into `build_site`).

### `view` — Interactive resource browser

```bash
npx @_davideast/stitch-mcp view [options]
```

| Option | Description |
|--------|-------------|
| `--projects` | List all projects |
| `--name <name>` | Resource name to view |
| `--sourceScreen <name>` | Source screen resource name |
| `--project <id>` | Project ID |
| `--screen <id>` | Screen ID |
| `--serve` | Serve the screen via local server |

Browse Stitch resources in a navigable JSON tree. Supports drilling into nested objects and performing actions on selected nodes.

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate up/down |
| `Enter` | Expand/collapse or drill into nested object |
| `Backspace` | Go back one level |
| `c` | Copy selected value to clipboard |
| `cc` | Extended copy (downloads content for URLs) |
| `s` | Preview HTML — serves `htmlCode` in-memory and opens browser |
| `o` | Open project in Stitch web app |
| `q` | Quit viewer |

```bash
# Browse all projects
npx @_davideast/stitch-mcp view --projects

# View a specific screen
npx @_davideast/stitch-mcp view --project <project-id> --screen <screen-id>
```

### `tool` — Invoke MCP tools directly

```bash
npx @_davideast/stitch-mcp tool [toolName] [options]
```

| Option | Description |
|--------|-------------|
| `-s, --schema` | Show tool arguments and schema |
| `-d, --data <json>` | JSON data (like `curl -d`) |
| `-f, --data-file <path>` | Read JSON from file (like `curl -d @file`) |
| `-o, --output <format>` | Output format: `json`, `pretty`, `raw` (default: `pretty`) |

Calls any MCP tool (including virtual tools) from the command line. Run without a tool name to list available tools.

**Virtual tools:**

These tools are not part of the upstream Stitch MCP server. They are added by the proxy and combine multiple API calls into higher-level operations for coding agents.

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

### `proxy` — MCP proxy server

```bash
npx @_davideast/stitch-mcp proxy [options]
```

| Option | Description |
|--------|-------------|
| `--transport <type>` | Transport type: `stdio` or `sse` (default: `stdio`) |
| `--port <number>` | Port number (required for `sse`) |
| `--debug` | Enable debug logging to `/tmp/stitch-proxy-debug.log` |

Proxies requests between your MCP client and the Stitch MCP server. Handles automatic token refresh and exposes virtual tools alongside the upstream tools.

**STDIO config (default):**

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

**SSE config:**

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy", "--transport", "sse", "--port", "3100"]
    }
  }
}
```

### `logout` — Revoke credentials

```bash
npx @_davideast/stitch-mcp logout [options]
```

| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation prompts |
| `--clear-config` | Delete entire gcloud config directory |

Revokes both user authentication and Application Default Credentials.

### `snapshot` — Create UI snapshots

```bash
npx @_davideast/stitch-mcp snapshot [options]
```

| Option | Description |
|--------|-------------|
| `-c, --command <command>` | The command to snapshot (e.g. `init`) |
| `-d, --data <file>` | Path to JSON data file |
| `-s, --schema` | Print the data schema for the command |

Creates UI snapshots of CLI commands given a data state. Useful for testing and documentation.

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

Ensure:
- You have Owner or Editor role on the GCP project
- Billing is enabled on your project
- Stitch API is enabled

Run `doctor` to diagnose:
```bash
npx @_davideast/stitch-mcp doctor --verbose
```

### Authentication URL not appearing

The tool prints authentication URLs to the terminal with a 5-second timeout. If the URL doesn't appear:

1. Check your terminal output carefully
2. The URL starts with `https://accounts.google.com`
3. If using proxy with `--debug`, check `/tmp/stitch-proxy-debug.log`

### Already authenticated but showing logged in

The bundled gcloud SDK maintains separate authentication from your global gcloud installation. To fully clear authentication:

```bash
npx @_davideast/stitch-mcp logout --force --clear-config
```

### API connection fails after setup

1. Run the doctor command:
   ```bash
   npx @_davideast/stitch-mcp doctor --verbose
   ```

2. Verify your project has billing enabled

3. Check that Stitch API is enabled:
   ```bash
   gcloud services list --enabled | grep stitch
   ```

4. Try re-authenticating:
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
