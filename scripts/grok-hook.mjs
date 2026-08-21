#!/usr/bin/env node

/**
 * OpenViking lifecycle adapter for Grok.
 *
 * Grok hook events match Claude/Codex names, but stdin is camelCase and
 * Stop additionalContext would keep the agent working. This dispatcher:
 *   - SessionStart / UserPromptSubmit: inject via hookSpecificOutput only
 *   - Stop / PreCompact / SessionEnd: capture/commit with empty stdout
 *
 * Reuses memory-plugin-shared; no duplicated recall/capture logic.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  addAgentMessages,
  buildAgentProfile,
  commitAgentSession,
  createAgentLogger,
  loadAgentHookConfig,
  makeAgentFetchJSON,
  readHookState,
  recallForPrompt,
  replayAgentPending,
  resolveAgentCwd,
  resolveNativeSessionId,
  shouldBypassAgent,
  stableHash,
  withAgentHookLock,
  writeHookState,
} from "./shared/agent-hook-runtime.mjs";
import { maybeDetach, readHookStdin } from "./shared/async-writer.mjs";
import { deriveHarnessSessionId } from "./shared/session-model.mjs";
import {
  cleanGrokText,
  extractAssistant,
  extractPrompt,
  extractPromptId,
  isEndTurnStop,
} from "./grok-turns.mjs";

const CLIENT_ID = "grok";
const PREFIX = "gx-";

function normalizeEvent(raw) {
  return String(raw || "").trim().toLowerCase().replace(/_/g, "-");
}

const eventName = normalizeEvent(
  process.env.OPENVIKING_HOOK_EVENT || process.env.GROK_HOOK_EVENT || process.argv[2] || "",
);

const cfg = loadAgentHookConfig(CLIENT_ID);
const { log, logError } = createAgentLogger(CLIENT_ID, eventName, cfg);

function outputJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function outputContext(additionalContext, hookEventName) {
  if (!additionalContext) return;
  outputJson({
    hookSpecificOutput: {
      hookEventName,
      additionalContext,
    },
  });
}

function writeLastInject(content) {
  try {
    const path = join(homedir(), ".openviking", "last_inject.md");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  } catch {
    /* audit file only */
  }
}

function subagentSuffix(input = {}) {
  return String(input.subagentType || input.agent_type || input.agentId || input.agent_id || "").trim();
}

function stateKey(nativeSessionId, input) {
  const suffix = subagentSuffix(input);
  return suffix ? `${nativeSessionId}__${suffix}` : nativeSessionId;
}

function ovSessionIdFor(nativeSessionId, input) {
  return deriveHarnessSessionId(PREFIX, nativeSessionId, subagentSuffix(input));
}

async function flushPendingTurn(fetchJSON, sessionId, state, logFn) {
  const pending = state.pendingTurn || {};
  const user = cleanGrokText(pending.user || "");
  const assistant = cleanGrokText(pending.assistant || "");
  const payloads = [];
  if (user) payloads.push({ role: "user", content: user });
  if (assistant) payloads.push({ role: "assistant", content: assistant });
  if (payloads.length === 0) {
    return { ...state, pendingTurn: null };
  }

  const result = await addAgentMessages(fetchJSON, sessionId, payloads);
  const captured = Number(result.sent || 0) + Number(result.queued || 0);
  logFn("flush", {
    sessionId,
    sent: result.sent,
    queued: result.queued,
    failed: result.failed,
    payloads: payloads.length,
  });
  if (captured < payloads.length) return state;

  let capturedSinceCommit = Number(state.capturedSinceCommit || 0) + captured;
  if (capturedSinceCommit >= cfg.commitTurnThreshold) {
    const committed = await commitAgentSession(fetchJSON, sessionId, logFn);
    if (committed.ok) capturedSinceCommit = 0;
  }
  return {
    ...state,
    pendingTurn: null,
    capturedSinceCommit,
  };
}

let input = {};
let nativeSessionId = "";
let sessionId = "";
let cwd = "";
let fetchJSON;

async function main() {
  if (!cfg.enabled || shouldBypassAgent(cfg, input)) return;

  const key = stateKey(nativeSessionId, input);

  if (eventName === "session-start") {
    const profile = await withAgentHookLock(CLIENT_ID, key, async () => {
      let state = await readHookState(CLIENT_ID, key);
      const now = Date.now();
      if (now - Number(state.lastSessionStartAt || 0) < 2000) return null;
      state = { ...state, lastSessionStartAt: now };
      await writeHookState(CLIENT_ID, key, state);
      await replayAgentPending(fetchJSON, log).catch((error) => logError("pending", error));
      return buildAgentProfile(fetchJSON, cfg, cwd).catch((error) => {
        logError("profile", error);
        return null;
      });
    });
    if (profile) {
      const block = `<openviking-context source="session-start">\n${profile}\n</openviking-context>`;
      writeLastInject(block);
      outputContext(block, "SessionStart");
    }
    return;
  }

  if (eventName === "user-prompt-submit") {
    const prompt = extractPrompt(input);
    if (!prompt) return;
    const promptId = extractPromptId(input);
    const recallBlock = await withAgentHookLock(CLIENT_ID, key, async () => {
      let state = await readHookState(CLIENT_ID, key);
      state = await flushPendingTurn(fetchJSON, sessionId, state, log);
      const promptHash = stableHash(prompt);
      const now = Date.now();
      const duplicateEvent = promptId
        ? state.promptEventId === promptId
        : state.promptHash === promptHash && now - Number(state.promptAt || 0) < 500;
      if (duplicateEvent) {
        await writeHookState(CLIENT_ID, key, state);
        return state.recallBlock || null;
      }
      const block = state.promptHash === promptHash && state.recallBlock
        ? state.recallBlock
        : await recallForPrompt(fetchJSON, cfg, prompt, cwd, log, { sessionId }).catch((error) => {
          logError("recall", error);
          return null;
        });
      await writeHookState(CLIENT_ID, key, {
        ...state,
        promptHash,
        promptEventId: promptId,
        promptAt: now,
        recallBlock: block,
        pendingTurn: { promptId, user: prompt, assistant: "" },
      });
      return block;
    });
    if (recallBlock) {
      writeLastInject(recallBlock);
      outputContext(recallBlock, "UserPromptSubmit");
    }
    return;
  }

  if (eventName === "stop") {
    if (!cfg.autoCapture) return;
    if (!isEndTurnStop(input)) {
      log("skip", { reason: "not_end_turn", stopReason: input.reason });
      return;
    }
    await withAgentHookLock(CLIENT_ID, key, async () => {
      let state = await readHookState(CLIENT_ID, key);
      const assistant = extractAssistant(input);
      const pending = state.pendingTurn || {};
      const nextPending = {
        promptId: extractPromptId(input) || pending.promptId || "",
        user: pending.user || extractPrompt(input),
        assistant: assistant || pending.assistant || "",
      };
      await writeHookState(CLIENT_ID, key, { ...state, pendingTurn: nextPending });
    });
    return;
  }

  if (eventName === "pre-compact" || eventName === "session-end") {
    if (!cfg.autoCapture) return;
    await withAgentHookLock(CLIENT_ID, key, async () => {
      let state = await readHookState(CLIENT_ID, key);
      state = await flushPendingTurn(fetchJSON, sessionId, state, log);
      await commitAgentSession(fetchJSON, sessionId, log);
      await writeHookState(CLIENT_ID, key, state);
    });
    return;
  }

  if (eventName === "subagent-start") {
    log("subagent-start", {
      sessionId,
      subagentType: subagentSuffix(input),
    });
    return;
  }

  if (eventName === "subagent-stop") {
    if (!cfg.autoCapture) return;
    await withAgentHookLock(CLIENT_ID, key, async () => {
      let state = await readHookState(CLIENT_ID, key);
      const assistant = extractAssistant(input);
      if (assistant) {
        state = {
          ...state,
          pendingTurn: {
            ...(state.pendingTurn || {}),
            assistant,
          },
        };
      }
      state = await flushPendingTurn(fetchJSON, sessionId, state, log);
      await commitAgentSession(fetchJSON, sessionId, log);
      await writeHookState(CLIENT_ID, key, state);
    });
  }
}

async function run() {
  const writeEvents = new Set(["stop", "pre-compact", "session-end", "subagent-stop"]);
  if (writeEvents.has(eventName) && cfg.enabled && cfg.autoCapture) {
    const detached = await maybeDetach(cfg, { approve() {} });
    if (detached) return;
  }

  try {
    input = JSON.parse(await readHookStdin() || "{}");
  } catch {
    input = {};
  }

  if (!input.session_id && input.sessionId) input.session_id = input.sessionId;
  if (!input.sessionId && process.env.GROK_SESSION_ID) {
    input.sessionId = process.env.GROK_SESSION_ID;
    input.session_id = process.env.GROK_SESSION_ID;
  }

  nativeSessionId = resolveNativeSessionId(input);
  sessionId = ovSessionIdFor(nativeSessionId, input);
  cwd = resolveAgentCwd(input);
  ({ fetchJSON } = makeAgentFetchJSON(cfg, cwd));

  log("start", {
    eventName,
    nativeSessionId,
    sessionId,
    cwd,
    keys: Object.keys(input).slice(0, 24),
  });

  await main();
}

run().catch((error) => {
  logError("uncaught", error);
});
