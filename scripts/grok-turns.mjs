/**
 * Grok hook payload helpers.
 *
 * Grok stdin is camelCase (sessionId, lastAssistantMessage, promptId, toolInput).
 * UserPromptSubmit may carry `prompt`; Stop carries `lastAssistantMessage` and
 * `reason` (`end_turn` vs session-end observe fires).
 */

const INJECTED_BLOCK_RE = /<openviking-context\b[^>]*>[\s\S]*?<\/openviking-context>/gi;
const RELEVANT_MEMORIES_RE = /<relevant-memories>[\s\S]*?<\/relevant-memories>/gi;
const SYSTEM_REMINDER_RE = /<system-reminder>[\s\S]*?<\/system-reminder>/gi;

export function cleanGrokText(value) {
  return String(value || "")
    .replace(INJECTED_BLOCK_RE, "")
    .replace(RELEVANT_MEMORIES_RE, "")
    .replace(SYSTEM_REMINDER_RE, "")
    .trim();
}

function firstString(...candidates) {
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function textFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (block && typeof block === "object") {
        if (typeof block.text === "string") return block.text;
        if (block.type === "text" && typeof block.content === "string") return block.content;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export function extractPrompt(input = {}) {
  return cleanGrokText(firstString(
    input.prompt,
    input.userPrompt,
    input.user_prompt,
    input.message,
    input.text,
    input.lastUserMessage,
    input.last_user_message,
    textFromContent(input.content),
  ));
}

export function extractAssistant(input = {}) {
  return cleanGrokText(firstString(
    input.lastAssistantMessage,
    input.last_assistant_message,
    input.assistantMessage,
    input.assistant_message,
    input.responseText,
    input.text_content,
  ));
}

export function extractPromptId(input = {}) {
  return String(
    input.promptId
    || input.prompt_id
    || input.generation_id
    || input.request_id
    || "",
  );
}

export function isEndTurnStop(input = {}) {
  const reason = String(input.reason || "").trim();
  if (!reason) return true;
  return reason === "end_turn";
}

export function grokToolAlias(toolName) {
  const raw = String(toolName || "").trim();
  const lower = raw.toLowerCase();
  const aliases = {
    read_file: "read",
    read: "read",
    list_dir: "glob",
    glob: "glob",
    listdir: "glob",
    grep: "grep",
    run_terminal_command: "bash",
    bash: "bash",
  };
  return aliases[lower] || raw;
}
