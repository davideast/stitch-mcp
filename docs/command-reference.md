---
title: Command Reference
description: All commands, flags, and environment variables.
order: 99
category: reference
---

# Command Reference

Run any command with `--help` for full options.

## Setup

| Command | Flags | Guide |
|---------|-------|-------|
| `init` | `--local` `--yes` `-y` `--defaults` `-c, --client <client>` `-t, --transport <transport>` | [Setup](setup.md) |
| `doctor` | `--verbose` | [Setup](setup.md#verifying-your-setup), [Troubleshooting](troubleshooting.md) |
| `logout` | `--force` `--clear-config` | [Troubleshooting](troubleshooting.md#full-reset) |

### `init`

Initialize authentication and MCP configuration.

| Flag | Description | Default |
|------|-------------|---------|
| `--local` | Install gcloud locally to project directory instead of user home | `false` |
| `-y, --yes` | Auto-approve verification commands | `false` |
| `--defaults` | Use default values for prompts | `false` |
| `-c, --client <client>` | MCP client to configure (antigravity, vscode, cursor, claude-code, gemini-cli, codex, opencode) | prompted |
| `-t, --transport <transport>` | Transport type (http or stdio) | prompted |

### `doctor`

Verify configuration health.

| Flag | Description | Default |
|------|-------------|---------|
| `--verbose` | Show detailed error information | `false` |

### `logout`

Log out of Google Cloud and revoke credentials.

| Flag | Description | Default |
|------|-------------|---------|
| `--force` | Skip confirmation prompts | `false` |
| `--clear-config` | Delete entire gcloud config directory | `false` |

## Development

| Command | Flags | Guide |
|---------|-------|-------|
| `serve -p <id>` | `-p, --project <id>` (required) | [Preview designs](preview-designs.md) |
| `screens -p <id>` | `-p, --project <id>` (required) | [Preview designs](preview-designs.md#browse-screens-in-terminal) |
| `view` | `--projects` `--name <name>` `--sourceScreen <name>` `--project <id>` `--screen <id>` `--serve` | [Preview designs](preview-designs.md#interactive-resource-viewer) |

### `serve`

Serve project HTML screens via local web server.

| Flag | Description | Required |
|------|-------------|----------|
| `-p, --project <id>` | Project ID | Yes |

### `screens`

Explore all screens in a project.

| Flag | Description | Required |
|------|-------------|----------|
| `-p, --project <id>` | Project ID | Yes |

### `view`

Interactively view Stitch resources.

| Flag | Description | Default |
|------|-------------|---------|
| `--projects` | List all projects | `false` |
| `--name <name>` | Resource name to view | — |
| `--sourceScreen <name>` | Source screen resource name | — |
| `--project <id>` | Project ID | — |
| `--screen <id>` | Screen ID | — |
| `--serve` | Serve the screen via local server | `false` |

## Build

| Command | Flags | Guide |
|---------|-------|-------|
| `site -p <id>` | `-p, --project <id>` (required) `-o, --output <dir>` `-e, --export` | [Build a site](build-a-site.md) |
| `snapshot` | `-c, --command <command>` `-d, --data <file>` `-s, --schema` | — |

### `site`

Build a structured site from Stitch screens.

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --project <id>` | Project ID | required |
| `-o, --output <dir>` | Output directory | `.` |
| `-e, --export` | Export screen-to-route config as `build_site` JSON | `false` |

### `snapshot`

Create a UI snapshot given a data state.

| Flag | Description | Default |
|------|-------------|---------|
| `-c, --command <command>` | The command to snapshot | — |
| `-d, --data <file>` | Path to JSON data file | — |
| `-s, --schema` | Print the data schema for the command | `false` |

## Integration

| Command | Flags | Guide |
|---------|-------|-------|
| `tool [name]` | `-s, --schema` `-d, --data <json>` `-f, --data-file <path>` `-o, --output <format>` | [Use Stitch tools in agents](use-stitch-tools-in-agents.md) |
| `proxy` | `--transport <type>` `--port <number>` `--debug` | [Connect your agent](connect-your-agent.md) |

### `tool`

Invoke MCP tools directly.

| Flag | Description | Default |
|------|-------------|---------|
| `-s, --schema` | Show tool arguments and schema | `false` |
| `-d, --data <json>` | JSON data (like curl `-d`) | — |
| `-f, --data-file <path>` | Read JSON from file (like curl `-d @file`) | — |
| `-o, --output <format>` | Output format: json, pretty, raw | `pretty` |

Run `tool` without a name to list all available tools.

### `proxy`

Start the Stitch MCP proxy server.

| Flag | Description | Default |
|------|-------------|---------|
| `--transport <type>` | Transport type | `stdio` |
| `--port <number>` | Port number | — |
| `--debug` | Enable debug logging to file | `false` |

## Environment variables

| Variable | Description |
|----------|-------------|
| `STITCH_API_KEY` | API key for direct authentication (skips OAuth) |
| `STITCH_ACCESS_TOKEN` | Pre-existing access token |
| `STITCH_USE_SYSTEM_GCLOUD` | Use system gcloud config instead of bundled config |
| `STITCH_PROJECT_ID` | Override project ID |
| `GOOGLE_CLOUD_PROJECT` | Alternative project ID variable |
| `STITCH_HOST` | Custom Stitch API endpoint |
