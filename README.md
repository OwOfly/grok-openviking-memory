# Grok OpenViking Memory

Community [OpenViking](https://github.com/volcengine/OpenViking) memory plugin for [Grok Build](https://github.com/xai-org/grok-build). Official OpenViking does not ship a Grok harness; this adapter wires the same auto-recall / auto-capture loop to Grok hooks.

Not an official OpenViking or xAI product.

## Install

Requires [Grok](https://github.com/xai-org/grok-build) and [Node.js](https://nodejs.org/) 18+. Point Grok at a running OpenViking server (`~/.openviking/ovcli.conf` or `OPENVIKING_*` env vars). Credentials stay on the machine; they are not in this repo.

```bash
grok plugin install OwOfly/grok-openviking-memory --trust
grok plugin enable openviking-memory
```

Then reload plugins (`/plugins` → `r`) or start a new Grok session.

Local checkout:

```bash
git clone git@github.com:OwOfly/grok-openviking-memory.git
grok plugin install ./grok-openviking-memory --trust
```

## What it does

| Hook | Behavior |
| --- | --- |
| SessionStart | Inject user profile / memory index |
| UserPromptSubmit | Recall memories for the current prompt |
| Stop | Buffer user/assistant turns (empty stdout; Grok Stop must not inject context) |
| PreCompact / SessionEnd | Flush and commit the OpenViking session |
| PreToolUse (`Read\|Glob\|Grep`) | Block raw `viking://` filesystem reads |
| SubagentStart / SubagentStop | Isolate subagent sessions as `gx-<id>__<type>` |

MCP tools still come from Grok's existing `openviking` MCP server config. This plugin does not register a second MCP.

## Configure

Same chain as the Claude Code / Codex plugins:

1. `OPENVIKING_*` environment variables
2. `~/.openviking/ovcli.conf`
3. `~/.openviking/ov.conf`
4. Default `http://127.0.0.1:1933` with no auth

Debug:

```bash
set OPENVIKING_DEBUG=1
```

Logs: `~/.openviking/logs/grok-hooks.log`

## License

[GNU AGPL v3](LICENSE). `scripts/shared/` is vendored from OpenViking `memory-plugin-shared`.
