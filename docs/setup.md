---
title: Setup
description: Authenticate and configure your environment for stitch-mcp.
order: 1
category: getting-started
---

# Setup

## Quick start

Run the guided setup to configure authentication and your MCP client in one step:

```bash
npx @_davideast/stitch-mcp init
```

The wizard handles authentication, project selection, and MCP client configuration. You can skip prompts with flags:

```bash
npx @_davideast/stitch-mcp init --client cursor --transport stdio
```

## The `init` wizard

The wizard walks through 9 steps:

1. **Client selection** — pick your MCP client (Claude Code, VS Code, Cursor, Gemini CLI, Codex, OpenCode, or Antigravity)
2. **Auth mode** — choose between API key or OAuth
3. **gcloud install** — ensures Google Cloud CLI is installed (OAuth only, skipped for API key)
4. **Authentication** — runs `gcloud auth login` and `gcloud auth application-default login` (OAuth only)
5. **Transport** — choose direct HTTP or stdio proxy connection
6. **Project selection** — pick a Google Cloud project (OAuth only)
7. **IAM & API enablement** — checks IAM role, installs gcloud beta, enables the Stitch API (OAuth only)
8. **Config generation** — generates MCP config for your chosen client
9. **Connection test** — verifies the Stitch API is reachable (OAuth only)

## Authentication modes

### API key (recommended)

An API key is a single string that authenticates your requests. No gcloud, no token refresh, no project setup.

There are three ways to provide it:

**Through the `init` wizard** — select "API Key" when prompted for auth mode. The wizard can store the key in your config file or a `.env` file for you.

**In your MCP client config** — add `STITCH_API_KEY` to the `env` block (for stdio/proxy) or `X-Goog-Api-Key` as a header (for HTTP/direct). See [Connect your agent](connect-your-agent.md) for the exact config format for each client.

**As an environment variable:**

```bash
export STITCH_API_KEY="your-api-key"
```

Or in a `.env` file in your project root:

```
STITCH_API_KEY=your-api-key
```

### OAuth

OAuth uses Google Cloud credentials for authentication. The `init` wizard handles the full setup — it installs a bundled gcloud SDK at `~/.stitch-mcp/` (separate from your system gcloud), authenticates you, selects a project, enables the Stitch API, and generates your MCP config.

```bash
npx @_davideast/stitch-mcp init
```

Select "OAuth" when prompted for auth mode.

### Manual gcloud

If you already have gcloud installed and configured:

```bash
gcloud auth application-default login
gcloud config set project <PROJECT_ID>
gcloud beta services mcp enable stitch.googleapis.com --project=<PROJECT_ID>
```

Then set `STITCH_USE_SYSTEM_GCLOUD=1` in your MCP client config so the proxy uses your system gcloud instead of the bundled one. See [Connect your agent](connect-your-agent.md) for config examples.

## Environment variables

| Variable | Description |
|----------|-------------|
| `STITCH_API_KEY` | API key for direct authentication (skips OAuth) |
| `STITCH_ACCESS_TOKEN` | Pre-existing access token |
| `STITCH_USE_SYSTEM_GCLOUD` | Use system gcloud config instead of bundled config |
| `STITCH_PROJECT_ID` | Override project ID |
| `GOOGLE_CLOUD_PROJECT` | Alternative project ID variable |
| `STITCH_HOST` | Custom Stitch API endpoint |

## Verifying your setup

Run `doctor` to check that everything is configured:

```bash
npx @_davideast/stitch-mcp doctor
```

Add `--verbose` for detailed error information:

```bash
npx @_davideast/stitch-mcp doctor --verbose
```

The 7 checks:

| Check | What it verifies |
|-------|-----------------|
| API Key Detected | `STITCH_API_KEY` is present and non-empty (API key mode) |
| gcloud Installed | gcloud CLI is installed with version >= 400.0.0 (OAuth mode) |
| Authentication | User is authenticated with gcloud (OAuth mode) |
| Application Default Credentials | ADC credentials are configured (OAuth mode) |
| Project Configured | An active Google Cloud project is set (OAuth mode) |
| API Key Connection | Stitch API responds using the API key (API key mode) |
| API Connection | Stitch API responds using OAuth token and project (OAuth mode) |

## Special environments

### WSL / SSH / Docker

Browser-based OAuth may not work automatically in headless environments. When `init` detects WSL, SSH, or Docker, it prints the OAuth URL to the terminal. Copy it and open it in a browser on another machine.

### Cloud Shell

Cloud Shell is detected automatically. The same copy-the-URL workaround applies.

### CI / headless servers

Use API key authentication in CI environments where browser auth isn't possible.
