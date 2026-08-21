#!/usr/bin/env node
process.env.OPENVIKING_HOOK_EVENT = "pre-compact";
await import("./grok-hook.mjs");
