#!/usr/bin/env node
process.env.OPENVIKING_HOOK_EVENT = "subagent-start";
await import("./grok-hook.mjs");
