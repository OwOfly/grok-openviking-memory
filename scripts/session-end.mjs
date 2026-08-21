#!/usr/bin/env node
process.env.OPENVIKING_HOOK_EVENT = "session-end";
await import("./grok-hook.mjs");
