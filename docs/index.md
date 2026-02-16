---
title: stitch-mcp Documentation
description: Guide hub for stitch-mcp — move AI-generated UI designs into your development workflow.
order: 0
category: overview
---

# stitch-mcp Documentation

stitch-mcp is a CLI for moving AI-generated UI designs from Google's Stitch platform into your development workflow. It previews designs locally, builds sites from them, and feeds design context to coding agents through an MCP proxy.

## Reading paths

Pick the path that matches what you're trying to do:

**Give your coding agent design context**
1. [Set up authentication](setup.md)
2. [Connect your agent](connect-your-agent.md)
3. [Use Stitch tools in agents](use-stitch-tools-in-agents.md)

**Build agent skills with Stitch data**
1. [Set up authentication](setup.md)
2. [Connect your agent](connect-your-agent.md)
3. [Use Stitch tools in agents](use-stitch-tools-in-agents.md)
4. [Build agent skills](build-agent-skills.md)

**Preview and build from designs locally**
1. [Set up authentication](setup.md)
2. [Preview designs](preview-designs.md)
3. [Build a site](build-a-site.md)

## Guides

| Guide | What it covers |
|-------|---------------|
| [Setup](setup.md) | Authentication, environment configuration, and verifying your install |
| [Connect your agent](connect-your-agent.md) | MCP config for Claude Code, VS Code, Cursor, Gemini CLI, Codex, OpenCode, and Antigravity |
| [Use Stitch tools in agents](use-stitch-tools-in-agents.md) | Tool catalog, input schemas, and prompting patterns |
| [Build agent skills](build-agent-skills.md) | Library API, virtual tool architecture, and programmatic usage |
| [Preview designs](preview-designs.md) | Local dev server, terminal browser, and resource viewer |
| [Build a site](build-a-site.md) | Astro site generation from screen-to-route mappings |
| [Troubleshooting](troubleshooting.md) | Common errors, diagnosis with `doctor`, and environment workarounds |
| [Command reference](command-reference.md) | All commands, flags, and environment variables |

## Prerequisites

- Node.js 18+
- A Google Cloud project with billing enabled
- A [Stitch](https://stitch.googleapis.com) account with at least one project

## Quick start

```bash
npx @_davideast/stitch-mcp init
```

See the [README](../README.md) for a condensed overview.
