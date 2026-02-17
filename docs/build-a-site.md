---
title: Build a Site
description: Generate an Astro project from Stitch designs by mapping screens to routes.
order: 2
category: workflows
---

# Build a Site

## Generate an Astro project

The `site` command creates a deployable Astro project from your Stitch designs:

```bash
npx @_davideast/stitch-mcp site -p <project-id>
```

This opens an interactive screen-to-route mapper where you assign each screen to a URL path.

## Mapping workflow

The mapper presents each screen and lets you:

1. **Include** — assign a route path (e.g., `/`, `/about`, `/pricing`)
2. **Exclude** — skip the screen but keep it available for later
3. **Discard** — remove the screen from consideration entirely

Use keyboard controls to navigate and assign routes.

## Generated project structure

The output is a ready-to-run Astro project:

```
your-output-dir/
  package.json          # Astro dependencies
  astro.config.mjs      # Astro configuration
  src/
    layouts/
      Layout.astro      # Shared layout shell
    pages/
      index.astro       # Route: /
      about.astro       # Route: /about (example)
  public/
    assets/             # Downloaded images and fonts
```

Each page file contains the design HTML from the mapped screen, wrapped in the shared layout.

## Command flags

See [Command Reference — `site`](command-reference.md#site) for the full flag list. The essentials:

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --project <id>` | Project ID (required) | — |
| `-o, --output <dir>` | Output directory | `.` (current directory) |
| `-e, --export` | Export screen-to-route config as JSON instead of building | `false` |

## Running the generated site

```bash
cd your-output-dir
npm install
npm run dev
```

The site starts on `http://localhost:4321` by default.

## Export for agents

The `--export` flag outputs a JSON mapping instead of generating the Astro project:

```bash
npx @_davideast/stitch-mcp site -p 123456 --export
```

This outputs JSON compatible with the `build_site` virtual tool:

```json
{
  "projectId": "123456",
  "routes": [
    { "screenId": "abc", "route": "/" },
    { "screenId": "def", "route": "/about" }
  ]
}
```

You can feed this to an agent or use it with the `build_site` tool directly:

```bash
npx @_davideast/stitch-mcp tool build_site -d "$(npx @_davideast/stitch-mcp site -p 123456 --export)"
```

This workflow lets a human pick routes interactively, then hand off to an agent for implementation.

## Feeding output to agents

The `build_site` virtual tool (available through the [MCP proxy](connect-your-agent.md)) performs the same mapping programmatically. Agents can:

1. Use `list_screens` to see available screens
2. Decide route assignments based on screen titles and metadata
3. Call `build_site` with the mapping to get design HTML for each page
4. Generate framework-specific code using the HTML as context

See [Use Stitch tools in agents](use-stitch-tools-in-agents.md) for tool details and prompting patterns.
