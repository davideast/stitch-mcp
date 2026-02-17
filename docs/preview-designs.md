---
title: Preview Designs
description: Local dev server, terminal browser, and interactive resource viewer.
order: 1
category: workflows
---

# Preview Designs

## Serve screens locally

Start a Vite dev server that serves all screens from a project:

```bash
npx @_davideast/stitch-mcp serve -p <project-id>
```

Each screen is available at `/screens/{screenId}`. The server includes:

- Hot reload on source changes
- An asset proxy at `/_stitch/asset?url=<encoded-url>` that fetches external resources (fonts, images) through the server
- CSS `url()` rewriting so fonts and images resolve correctly through the proxy
- Disk caching at `.stitch-mcp/cache/` for faster reloads

Open the URL printed in your terminal to browse screens in a web browser.

## Browse screens in terminal

View screen thumbnails and metadata without leaving the terminal:

```bash
npx @_davideast/stitch-mcp screens -p <project-id>
```

Keyboard shortcuts:

| Key | Action |
|-----|--------|
| `v` | Preview screen HTML in your default browser |
| `c` | Copy screen data to clipboard |
| `o` | Open the project in the Stitch web UI |
| `q` | Quit |

## Interactive resource viewer

The `view` command provides a tree browser for exploring projects and screens:

```bash
# Browse all projects
npx @_davideast/stitch-mcp view --projects

# View a specific screen
npx @_davideast/stitch-mcp view --project <project-id> --screen <screen-id>
```

Keyboard shortcuts:

| Key | Action |
|-----|--------|
| Arrow keys | Navigate the tree |
| Enter | Drill into nested data |
| `c` | Copy the selected value |
| `cc` | Copy all visible content |
| `s` | Preview HTML in your browser |
| `o` | Open the project in Stitch |
| `q` | Quit |

Additional `view` flags:

| Flag | Description |
|------|-------------|
| `--name <name>` | View a resource by its full resource name |
| `--sourceScreen <name>` | View a source screen resource |
| `--serve` | Serve the screen via local server |

## Finding your project ID

Your project ID appears in several places:

1. **`view --projects`** — lists all projects with their IDs
2. **Stitch web UI** — the project ID is in the URL when viewing a project
3. **`tool list_projects`** — returns project data including IDs as JSON

The project ID is a numeric string (e.g., `4044680601076201931`).

