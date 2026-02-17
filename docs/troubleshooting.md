---
title: Troubleshooting
description: Diagnosis with doctor, common errors, and environment workarounds.
order: 2
category: getting-started
---

# Troubleshooting

## Run `doctor` first

The `doctor` command runs 7 health checks and tells you exactly what's wrong:

```bash
npx @_davideast/stitch-mcp doctor --verbose
```

The `--verbose` flag prints detailed error information for failed checks.

### What each check diagnoses

| Check | Diagnoses | Fix |
|-------|-----------|-----|
| API Key Detected | `STITCH_API_KEY` env var is present (API key mode) | Set the env var or add to `.env` |
| gcloud Installed | gcloud CLI >= 400.0.0 is available (OAuth mode) | Run `init` to install |
| Authentication | User is authenticated with gcloud (OAuth mode) | Run `gcloud auth login` |
| Application Default Credentials | ADC credentials exist (OAuth mode) | Run `gcloud auth application-default login` |
| Project Configured | Active Google Cloud project is set (OAuth mode) | Run `init` or `gcloud config set project <id>` |
| API Key Connection | Stitch API responds to API key (API key mode) | Check key validity and billing |
| API Connection | Stitch API responds to OAuth token (OAuth mode) | Check project, billing, and API enablement |

## Permission errors

**"Permission Denied" from the Stitch API:**

1. Ensure your Google Cloud project has **billing enabled**
2. Ensure the **Stitch API is enabled**: `gcloud beta services mcp enable stitch.googleapis.com --project=<PROJECT_ID>`
3. Ensure your account has **Owner or Editor role** on the project
4. Run `doctor --verbose` to see the exact HTTP error

## Token expiration

OAuth access tokens expire after 1 hour. If you see authentication errors:

- **Using stdio proxy (recommended):** tokens refresh automatically every 55 minutes. Restart the proxy if it's been stopped.
- **Using HTTP transport:** you need to manually refresh the token. Run `gcloud auth print-access-token` and update your config. Consider switching to stdio transport for automatic refresh.

## Authentication URL not appearing

When `init` runs OAuth, it prints an authentication URL to the terminal. If you don't see it:

1. The URL prints with a 5-second timeout — look for a URL starting with `https://accounts.google.com`
2. If using the proxy with `--debug`, check the log at `/tmp/stitch-proxy-debug.log`
3. In headless environments (WSL, SSH, Docker), the URL may be printed but can't open a browser automatically. Copy it and open it on another machine.

## Auth errors when system gcloud is installed

stitch-mcp installs its own gcloud SDK at `~/.stitch-mcp/`, separate from any system gcloud. If you have both, auth errors often mean you authenticated one but the proxy is using the other.

- **Bundled gcloud** (default): credentials live in `~/.stitch-mcp/config/`.
- **System gcloud**: set `STITCH_USE_SYSTEM_GCLOUD=1` to use your system installation instead.

To check which gcloud the proxy is using, print a token from the bundled instance:

```bash
CLOUDSDK_CONFIG=~/.stitch-mcp/config ~/.stitch-mcp/google-cloud-sdk/bin/gcloud auth print-access-token
```

## Full reset

To start fresh:

```bash
npx @_davideast/stitch-mcp logout --force --clear-config
npx @_davideast/stitch-mcp init
```

`--force` skips confirmation prompts. `--clear-config` deletes the entire gcloud config directory at `~/.stitch-mcp/`.

## WSL / SSH / Docker

Browser-based OAuth doesn't work automatically in headless environments. Workaround:

1. Run `init` as normal
2. When the OAuth URL appears, copy it
3. Open the URL in a browser on a machine that has one
4. Complete the auth flow there — the token is saved back to the headless environment

Alternatively, use **API key authentication** which doesn't require a browser:

```bash
export STITCH_API_KEY="your-api-key"
npx @_davideast/stitch-mcp init
```

## Cloud Shell

Cloud Shell is detected automatically by `init`. The same browser-auth workaround applies. API key auth is the simplest option in Cloud Shell.

## Proxy not connecting

If your agent can't reach the proxy:

1. Verify the proxy starts without errors: `npx @_davideast/stitch-mcp proxy`
2. Enable debug logging: `npx @_davideast/stitch-mcp proxy --debug`
3. Check `/tmp/stitch-proxy-debug.log` for connection details
4. Ensure your MCP client config matches the expected format for your client (see [Connect your agent](connect-your-agent.md))
5. Restart your MCP client (IDE, CLI) after changing config
