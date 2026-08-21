# Grok OpenViking Memory

**Make Grok remember you.** New sessions should not start from zero. Share one long-term memory across projects — and across Codex, Claude Code, and Grok.

English | [简体中文](README.zh-CN.md)

[OpenViking](https://github.com/volcengine/OpenViking) ships hook-based auto-recall for Claude Code and Codex. Grok only had MCP: if the model forgets to call `search`, last week's preferences and decisions never show up. This community plugin wires the same **auto-recall + auto-capture** loop into Grok's lifecycle, so memory does not depend on the model remembering to look it up.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Grok plugin](https://img.shields.io/badge/Grok-plugin-black)](https://github.com/xai-org/grok-build)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-339933)](https://nodejs.org/)

> Not an official OpenViking or xAI product.

## After install

| MCP only | With this plugin |
| --- | --- |
| Every new chat is a blank slate | Session start injects your profile and memory index |
| The model must remember to `search` | Every prompt auto-injects relevant memories |
| Nothing is stored unless you say "remember this" | Each turn is written back to OpenViking |
| Codex remembers; Grok forgets | All three talk to the same OpenViking server |

Injected context looks like this — the model can use it immediately:

```xml
<openviking-context source="auto-recall">
  <memory uri="viking://user/…/code-comment-conventions.md" type="preferences">
    Public APIs need comments: what it does, params, return value, edge cases.
  </memory>
</openviking-context>
```

MCP tools still use your existing Grok `openviking` server. This plugin **does not register a second MCP**, and it never ships API keys in the repo.

## Install

You need [Grok](https://github.com/xai-org/grok-build), [Node.js 18+](https://nodejs.org/), and a running [OpenViking](https://docs.openviking.ai/en/getting-started/02-quickstart) server.

```bash
grok plugin install OwOfly/grok-openviking-memory --trust
grok plugin enable openviking-memory
```

Reload plugins (`/plugins` → `r`) or start a new Grok session.

From a local checkout:

```bash
git clone git@github.com:OwOfly/grok-openviking-memory.git
grok plugin install ./grok-openviking-memory --trust
```

## When it runs

You do not need this table to use the plugin. It is here if you want to verify behavior:

| Event | What it does |
| --- | --- |
| Session start | Inject user profile + memory index |
| Each submitted prompt | Recall memories for the current prompt |
| Turn end | Buffer user / assistant (Stop writes no extra context, so Grok does not treat it as a keep-going gate) |
| Before compact / session end | Flush the buffer into OpenViking |
| File read hits `viking://` | Deny and point at MCP `read` / `search` |
| Subagent | Isolated session: `gx-<id>__<type>` |

## Configure

Same chain as the Claude Code / Codex plugins. Credentials are **read on the machine at runtime**, never committed:

1. `OPENVIKING_*` environment variables
2. `~/.openviking/ovcli.conf` (`url`, `api_key`, optional `account` / `user`)
3. `~/.openviking/ov.conf`
4. Fallback: `http://127.0.0.1:1933` with no auth

Skip config for a local unauthenticated server. For a remote server, fill in `ovcli.conf`.

Debug:

```bash
set OPENVIKING_DEBUG=1
```

Logs: `~/.openviking/logs/grok-hooks.log`

## Relation to official plugins

For Claude Code and Codex, use the [official installer](https://docs.openviking.ai/en/agent-integrations/01-overview). This repo only fills the Grok gap. Recall/capture runtime is vendored from OpenViking `memory-plugin-shared`.

## License

[GNU AGPL v3](LICENSE). `scripts/shared/` comes from OpenViking, so the whole plugin is distributed under AGPL.
