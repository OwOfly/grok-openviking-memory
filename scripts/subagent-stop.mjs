#!/usr/bin/env node
process.env.OPENVIKING_HOOK_EVENT = "subagent-stop";
await import("./grok-hook.mjs");
