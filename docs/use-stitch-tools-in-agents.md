---
title: Use Stitch Tools in Agents
description: Prompting patterns and debugging workflows for agent-driven design tasks.
order: 3
category: agent-integration
---

# Use Stitch Tools in Agents

Once your agent is [connected](connect-your-agent.md), it has access to both upstream Stitch tools and virtual tools added by the proxy. See the [Tool Catalog](tool-catalog.md) for full schemas and parameter details.

## Prompting patterns

These natural language prompts work well with connected agents:

**Explore available designs:**
> "List my Stitch projects and show me the screens in project X."

**Get design context for implementation:**
> "Use get_screen_code to fetch the landing page screen, then implement it as a React component."

**Build a multi-page site:**
> "Use build_site to create a site from project 123 with the home screen at / and the about screen at /about. Then scaffold a Next.js app using the returned HTML as design reference."

**Visual design review:**
> "Get the screenshot for screen abc in project 123 and describe the layout, colors, and components you see."

**Generate new designs:**
> "Generate a new screen in project 123 with a pricing page that has three tiers: Free, Pro, and Enterprise."

## Debugging with the `tool` CLI

The `tool` command lets you invoke any MCP tool directly from the terminal — useful for testing and debugging before asking your agent to use them.

```bash
# List all available tools
npx @_davideast/stitch-mcp tool

# Show a tool's input schema
npx @_davideast/stitch-mcp tool build_site -s

# Invoke a tool with JSON data
npx @_davideast/stitch-mcp tool get_screen_code -d '{
  "projectId": "123456",
  "screenId": "abc123"
}'

# Output as raw JSON (useful for piping)
npx @_davideast/stitch-mcp tool list_projects -o json
```
