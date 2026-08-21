#!/usr/bin/env node

/**
 * Deny direct filesystem reads of viking:// URIs and point Grok at MCP tools.
 * Grok PreToolUse uses { decision: "deny", reason } (Claude permissionDecision
 * is also included for compatibility).
 */

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evaluateAgentUriGuard } from "./shared/agent-uri-guard.mjs";
import { grokToolAlias } from "./grok-turns.mjs";

function readInput() {
  try {
    const raw = readFileSync(0, "utf8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function evaluateGrokUriGuard(input = {}) {
  const toolName = grokToolAlias(input.tool_name ?? input.toolName ?? input.name ?? input.tool);
  const toolInput = input.tool_input ?? input.toolInput ?? input.input ?? {};
  const decision = evaluateAgentUriGuard(toolName, toolInput);
  if (!decision) return {};
  return {
    decision: "deny",
    reason: decision.reason,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: decision.reason,
    },
  };
}

const isEntrypoint =
  process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
if (isEntrypoint) {
  const output = evaluateGrokUriGuard(readInput());
  if (Object.keys(output).length > 0) {
    process.stdout.write(`${JSON.stringify(output)}\n`);
  }
}
