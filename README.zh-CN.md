# Grok OpenViking Memory

**让 Grok 记住你。** 不是再开一个会话就从零开始，而是跨项目、跨 Codex / Claude / Grok 共用同一份长期记忆。

[English](README.md) | 简体中文

[OpenViking](https://github.com/volcengine/OpenViking) 官方接了 Claude Code 和 Codex 的 hooks，Grok 只有 MCP。模型一偷懒、一漏调 `search`，上次说好的偏好和结论就没了。这个社区插件把同一套 **自动召回 + 自动捕获** 接到 Grok 生命周期上——模型不必先想起来去翻记忆。

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Grok plugin](https://img.shields.io/badge/Grok-plugin-black)](https://github.com/xai-org/grok-build)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-339933)](https://nodejs.org/)

> 非 OpenViking / xAI 官方产品。

## 装完会发生什么

| 以前（只接 MCP） | 现在 |
| --- | --- |
| 新对话是一张白纸 | 开场就带上你的画像和记忆索引 |
| 全靠模型自觉去 `search` | 每句提问前自动注入相关记忆 |
| 说了「记住这个」才落盘 | 每轮结束静默写回 OpenViking |
| Codex 记得、Grok 忘了 | 三边读同一台 OpenViking |

注入进对话的是这样一块上下文，模型当场就能用：

```xml
<openviking-context source="auto-recall">
  <memory uri="viking://user/…/代码注释规范.md" type="preferences">
    新增 public API 必须写注释：做什么、参数、返回值、边界。
  </memory>
</openviking-context>
```

MCP 工具仍走你已经配好的 Grok `openviking` 服务器。插件 **不重复注册 MCP**，也不会把 API Key 打进仓库。

## 安装

需要：[Grok](https://github.com/xai-org/grok-build)、[Node.js 18+](https://nodejs.org/)、一台已运行的 [OpenViking](https://docs.openviking.ai/zh/getting-started/02-quickstart)。

```bash
grok plugin install OwOfly/grok-openviking-memory --trust
grok plugin enable openviking-memory
```

然后 `/plugins` 按 `r` 重载，或新开一个 Grok 会话。

从本地目录装：

```bash
git clone git@github.com:OwOfly/grok-openviking-memory.git
grok plugin install ./grok-openviking-memory --trust
```

### 报错 `schannel: failed to receive handshake`

`grok plugin install 用户名/仓库` 会走 **HTTPS**（`https://github.com/OwOfly/grok-openviking-memory/`）。Windows 上 Git 默认 `http.sslBackend=schannel`，连 GitHub 时 TLS 握手经常失败（代理、公司网关、线路不稳）。仓库是公开的，这不是没权限或 404。

改用 SSH（Grok 接受完整 git URL）：

```bash
grok plugin install git@github.com:OwOfly/grok-openviking-memory.git --trust
grok plugin enable openviking-memory
```

或自己 clone 再从目录装：

```bash
git clone git@github.com:OwOfly/grok-openviking-memory.git
grok plugin install ./grok-openviking-memory --trust
```

想继续用 `OwOfly/grok-openviking-memory` 这种简写，可把本机 Git 改成 OpenSSL：

```bash
git config --global http.sslBackend openssl
```

## 它在哪些时机工作

不必记这些也能用。想核对行为时对着看：

| 时机 | 做什么 |
| --- | --- |
| 会话开始 | 注入用户画像 + 记忆目录 |
| 每次提交问题 | 按当前 prompt 召回相关记忆 |
| 一轮结束 | 缓存 user / assistant（Stop 不往对话里塞东西，避免 Grok 把 Stop 当续写） |
| 压缩前 / 会话结束 | 把缓存提交进 OpenViking |
| 读文件碰到 `viking://` | 拦住，改走 MCP `read` / `search` |
| 子代理 | 独立 session：`gx-<id>__<type>`，不和主会话串台 |

## 配置

和 Claude Code / Codex 插件同一条链，**运行时在本机读**，不进 git：

1. 环境变量 `OPENVIKING_*`
2. `~/.openviking/ovcli.conf`（`url`、`api_key`，可选 `account` / `user`）
3. `~/.openviking/ov.conf`
4. 都没有则默认 `http://127.0.0.1:1933`，无鉴权

本地 OpenViking 可先跳过配置。远程服务器写好 `ovcli.conf` 即可。

排障：

```bash
set OPENVIKING_DEBUG=1
```

日志在 `~/.openviking/logs/grok-hooks.log`。

## 和官方插件的关系

Claude Code、Codex 请走 [官方安装脚本](https://docs.openviking.ai/zh/agent-integrations/01-overview)。本仓库只补 Grok 缺的那一截 hooks，召回/捕获运行时内嵌自 OpenViking `memory-plugin-shared`。

## License

[GNU AGPL v3](LICENSE)。`scripts/shared/` 来自 OpenViking，因此整个插件按 AGPL 分发。
