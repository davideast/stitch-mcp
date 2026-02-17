---
title: Agent Skills
description: What Agent Skills are, why they pair with Stitch, and the existing skills ecosystem.
order: 4
category: agent-integration
---

# Agent Skills

Your agent can already call Stitch tools. But every time it does, you're writing the same prompts from scratch — "fetch the screen, compare it to my code, tell me what's off." Agent Skills let you write those instructions once and reuse them forever.

An [Agent Skill](https://agentskills.io) is a directory with a `SKILL.md` file. No SDK, no runtime, no build step. Just markdown that any coding agent — Claude Code, Cursor, Gemini CLI, Codex — can discover and execute.

## Why Stitch + Agent Skills

Stitch gives agents design context through MCP tools — screen HTML, images, project metadata. That's the raw material. Agent Skills are the recipes that tell an agent what to *do* with it.

The built-in tools handle atomic operations: fetch a screen, list projects, get an image. But the interesting work happens when you combine them with agent intelligence — reviewing implementations against designs, extracting component patterns across screens, generating design system documentation.

Without a skill, you explain that workflow every session. With one, the agent already knows it. You say "review my header against the Stitch design" and it runs.

## What this looks like in practice

Say you've implemented a landing page and want to verify it matches the original Stitch design. Here's what a **design review** skill instructs the agent to do:

**Step 1 — Get the design source:**

```bash
stitch tool get_screen_code -d '{
  "projectId": "8837201",
  "screenId": "a1b2c3"
}'
```

The agent gets back the full design HTML — every color value, spacing token, font stack, and layout decision the designer made.

**Step 2 — Get the visual reference:**

```bash
stitch tool get_screen_image -d '{
  "projectId": "8837201",
  "screenId": "a1b2c3"
}'
```

Now the agent has a screenshot of the intended design. It can see the page the way a human would.

**Step 3 — The agent reads your code and compares.**

This is the part no built-in command can do. The agent reads your `src/pages/index.tsx`, diffs the computed styles against the design HTML, eyeballs the screenshot against your running dev server, and reports:

- "The hero heading uses `text-4xl` but the design specifies `44px` — should be `text-[44px]`"
- "The card grid has `gap-4` but the design uses `24px` gap — should be `gap-6`"
- "The CTA button background is `#3b82f6` but the design uses `#2563eb`"

Two tool calls gave the agent eyes. The skill told it where to look.

## Existing skills

The [stitch-skills](https://github.com/google-labs-code/stitch-skills) repository has production-ready skills you can install and study:

| Skill | What it does |
|-------|-------------|
| `react-components` | Converts Stitch screens into React component systems with design token consistency |
| `design-md` | Analyzes a Stitch project and generates a `DESIGN.md` documenting the design system |
| `stitch-loop` | Generates complete multi-page websites from a single prompt |
| `enhance-prompt` | Transforms vague UI ideas into polished, Stitch-optimized generation prompts |
| `remotion` | Generates walkthrough videos from Stitch projects with transitions and overlays |
| `shadcn-ui` | Integrates shadcn/ui components with Stitch design output |

Install any of them:

```bash
npx skills add google-labs-code/stitch-skills --list
npx skills add google-labs-code/stitch-skills --skill react-components
```

## Next steps

Ready to create your own? See [Build an Agent Skill](build-agent-skills.md) for the full walkthrough.
