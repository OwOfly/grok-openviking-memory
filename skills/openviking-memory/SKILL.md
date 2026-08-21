---
name: openviking-memory
description: 用 OpenViking 做跨会话长期记忆。新任务、回忆偏好/项目约定、用户说记住或忘掉、以及需要和 Codex 共享记忆时使用。
---

长期记忆在 MCP 服务器 `openviking`，不要写进 `~/.grok/memory/`。

Grok 插件 `openviking-memory` 已挂 hooks：SessionStart 注入画像，UserPromptSubmit 自动召回，Stop/SessionEnd 自动捕获。模型不必每轮主动 search。若当前轮没有 `<openviking-context>` 块，再补一次 `search`（`mode=context`）。

先 `search_tool` 再 `use_tool`。工具全名形如 `openviking__search`。

| 工具 | 何时用 |
| --- | --- |
| `health` | 连通性、工具报错时 |
| `search` | 语义检索。需要可注入上下文时 `mode=context`，`query` 用当前问题 |
| `find` | 无 session 的快速检索 |
| `read` | 读 `viking://` URI 原文 |
| `remember` | 写入长期记忆；`messages` 为 `{role, content}` 列表 |
| `forget` | 删除 `viking://` URI |

1. 任务会用到历史偏好、项目约定或先前结论时，先 `search`（`mode=context`）。
2. 用户明确要求记住的事实、稳定偏好、重要结论，用 `remember`。
3. 命中的 URI 用 `read` 取原文，不要凭摘要编造。
4. 工具失败时先 `health`，不要改连本地 MEMORY.md。
