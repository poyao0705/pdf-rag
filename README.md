# OpenUI x assistant-ui Dashboards

A text-only [assistant-ui](https://www.assistant-ui.com) chat whose model builds live dashboards about any npm package or GitHub repository. Each dashboard is an artifact: a card in the chat that opens it full size beside the conversation. It's stored in OpenUI Cloud and built from [`@openuidev/dashboard-library`](https://www.npmjs.com/package/@openuidev/dashboard-library), but its numbers load live every time it opens: downloads and releases from npm, stars and commit activity from GitHub, and known vulnerabilities from [OSV.dev](https://osv.dev) through an MCP server. Ask for a change and the same dashboard updates in place.

It runs on Next.js, assistant-ui, a TypeScript LangChain Deep Agent using OpenUI Gateway's Chat Completions API, and `@openuidev/server`'s dashboards. AI SDK remains only as the message/stream transport for assistant-ui, not the agent execution engine. Threads stay in the browser's `localStorage`; OpenUI Cloud builds, stores, and streams the dashboards. No separate LangGraph server is required.

## Run

Requirements: Node.js 22.13+ and pnpm. This is a standalone example outside the package workspace.

```bash
pnpm install
```

Mint a `THESYS_API_KEY` into `.env.local`, or create one in the [Thesys Console](https://console.thesys.dev/keys) and add it there yourself. The same key runs the chat and the dashboards:

```bash
pnpm run generate:apiKey
```

The default models are paid, so running the example uses [credits](https://www.openui.com/docs/gateway/pricing-credits). To run it without credits, use your own provider key with [BYOK](https://www.openui.com/docs/gateway/byok), or set `OPENUI_MODEL` and `OPENUI_DASHBOARD_MODEL` to one of the [free models](https://www.openui.com/cloud/gateway/models). Free models build lower-quality dashboards than `anthropic/claude-sonnet-5.5`.

Optional settings, also in `.env.local` (see `.env.example`):

- `GITHUB_TOKEN` raises GitHub's rate limit from 60 to 5,000 requests an hour. Any token works; public repositories need no scopes. Without it, a few GitHub dashboards an hour are fine.
- `OPENUI_MODEL` selects the chat model, as a Gateway `provider/model` identifier; the default is `anthropic/claude-sonnet-5.5`.
- `OPENUI_DASHBOARD_MODEL` selects the model that builds dashboards; the default, and the recommended model, is `anthropic/claude-sonnet-5.5`.
- `THESYS_BASE_URL` points the app at another OpenUI Cloud deployment, such as a local stack at `http://localhost:3102`; the default is `https://api.thesys.dev`. The browser then reaches it through this app's origin, so set it before `pnpm run dev` or `pnpm run build`.

```bash
pnpm run dev
```

Open http://localhost:3000. To use another port, run `pnpm run dev --port 3001`.

Try:

- “Compare weekly npm downloads for react, vue and svelte over the last 6 months.”
- “A health dashboard for vercel/next.js: stars, open issues, release cadence and npm downloads.”
- “Security overview for lodash: known vulnerabilities by severity and which versions fix them.”
- With a dashboard open: “add a GitHub stars row for each framework.”
- Reload the page: your chats are under **Chats**, and your dashboards, with pin, unpin and delete, under **Dashboards**.

## Data sources

Dashboards load their data from three kinds of source, all public and free:

| Source                                         | Tools                                                                  | Notes                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| npm (`src/lib/data/npm.ts`)                    | `get_npm_downloads`, `get_npm_package`                                 | No key. Downloads per day, week, or month for up to five packages; metadata and release history |
| GitHub (`src/lib/data/github.ts`)              | `get_github_repo`, `get_github_commit_activity`, `get_github_releases` | 60 requests an hour without `GITHUB_TOKEN`, 5,000 with it                                       |
| OSV.dev MCP server (`src/lib/data/osv-mcp.ts`) | `osv.vulnerabilities`, `osv.compare_packages`                          | An MCP server running in this process, offered with `defineDashboard({ mcp })`                  |

Each data tool has a description, a JSON Schema for its arguments, and a static example output, so generated dashboards know the data's shape without calling the APIs. Calls time out after 10 seconds or when the dashboard's request ends, results are cached for a few minutes to stay inside the rate limits, and arguments are read leniently: a filter nobody has picked yet arrives as `""` or `null`, and limits are clamped.

The OSV tools come from a real MCP server (`McpServer` from `@modelcontextprotocol/sdk`) connected over MCP's in-memory transport. In your app, pass the client of any MCP server your agent already uses; `defineDashboard` offers its read-only tools to dashboards, with `outputs` as their example results.

## How it works

```
browser (assistant-ui)               /api/chat (Deep Agents)                  OpenUI Cloud
Thread ──messages──────────────────► toBaseMessages → createDeepAgent
                                     model calls create_dashboard ─execute──► dashboards.create()
                                     ◄─ result: a sentence + the dashboard's reference ─┘
card (the tool's render) ◄─────────── streamed with the reply
  opens the panel ─► LiveArtifactRenderer streams the dashboard by its reference
                     Query() ─► /api/interpreter ─► data tools, MCP tools, generated scripts
```

1. The chat sends the full thread to `/api/chat`, which validates it, converts it with `toBaseMessages`, and runs a request-scoped Deep Agent. Its two dashboard tools are `create_dashboard` and `edit_dashboard`; `toUIMessageStream` preserves the AI SDK streaming protocol expected by assistant-ui.
2. The model calls `create_dashboard` with a title and a description of the dashboard. The LangChain tool runs on this server and calls `dashboards.create()`, which starts generating in OpenUI Cloud and returns as soon as the dashboard has an id. The result, written by OpenUI Cloud, is a sentence for the model plus the dashboard's reference, and the model replies in a sentence or two.
3. assistant-ui renders the tool call with the toolkit's `render`: a card in the chat. When the result arrives, the card opens the dashboard beside the chat, and `LiveArtifactRenderer` streams it from OpenUI Cloud as it's generated.
4. The dashboard loads its data with `Query()` calls. The renderer sends each one to `/api/interpreter`, where `dashboards.interpreter.execute()` runs the matching data tool or MCP tool on this server, or a script the dashboard was generated with, which calls the same tools.
5. For a change, the model calls `edit_dashboard` with the id from the first tool result. The open dashboard stays on screen until the new version is ready, then every renderer showing it switches over.

## Chats and dashboards

The sidebar has two tabs:

- **Chats** is assistant-ui's thread list, kept in this browser. `src/components/threads.tsx` is a `RemoteThreadListAdapter` with a history adapter over `localStorage`: it creates, lists, titles and deletes threads, and saves each message in assistant-ui's own format, tool calls included, so a thread reloads with its dashboard cards. Swap its storage helpers for your database to keep threads on your server; OpenUI Cloud never sees them.
- **Dashboards** lists the user's dashboards with `useArtifactList()` from `@openuidev/react-ui/cloud`: pinned ones first, then the rest, newest first, each with pin, unpin, and delete. Every list and renderer shares one cache, so a change shows everywhere at once. A row opens its dashboard by id; a new dashboard joins the list once it finishes generating and OpenUI Cloud saves it.

## The toolkit

`src/lib/toolkit.tsx` is a client-only assistant-ui registry for rendering backend tool calls. Both tools render standalone, so their card sits in the message rather than in the tool-call group. It has no executors or server imports; the installed backend-tool contract keeps schemas and descriptions on the server. `src/lib/dashboard-tool-contracts.ts` owns those Zod schemas and descriptions, and `src/lib/chat-agent.ts` wraps the existing OpenUI methods as LangChain tools. The generative compiler and `AISDKToolkit` are no longer used.

## The Deep Agent

`src/lib/chat-agent.ts` creates a fresh `createDeepAgent` with `ChatOpenAI`, the existing plain-text `chatPrompt`, and the dashboard tools for each request. The model still uses `OPENUI_MODEL`, `THESYS_BASE_URL`, and the server's existing `THESYS_API_KEY`. Dashboard generation remains independent and still uses `OPENUI_DASHBOARD_MODEL`.

Deep Agents includes bundled planning, filesystem, summarization and general-purpose-subagent features. Its default filesystem is an in-memory StateBackend, not this application's host filesystem or a shell/sandbox. No custom subagents, skills, checkpointer, or persistent agent store are configured. Scratch files and other agent state are ephemeral; only the conversation carried by the existing browser history survives between requests.

Runs are bounded to 24 graph steps (not 24 model turns). Request cancellation reaches the graph and dashboard SDK calls; failed dashboard operations return sanitized per-tool errors. There is no automatic whole-run/mutation replay, and cancellation cannot undo a dashboard already created in OpenUI Cloud.

The route uses the official adapter's `values`/`messages` stream modes. With the installed versions, additionally enabling `tools` emits serialized duplicate tool results, so it is intentionally omitted. Next.js loads `deepagents` as a server external to preserve Node's handling of optional integrations without bundling unused optional WebSocket dependencies.

The chat is assistant-ui's `Thread` and `ThreadList` from its shadcn registry, in `src/components/assistant-ui/`, trimmed for a text-only chat: no attachments, files, images, or thread search.

## The component library

`src/library.ts` exports `library` from `@openuidev/dashboard-library`: 46 dashboard components, from the `Dashboard` root, sections, card rows and filters to metrics, charts and tables. `pnpm run generate` writes its specification to `src/generated/spec.json`, which the server builds dashboards from, so it never loads React components; the browser renders dashboards with the library itself. `src/lib/openui.ts` passes the library's examples and rules to the model that builds them, with this app's own preamble.

## The server

`src/lib/openui.ts` defines every dashboard once with `openui.defineDashboard({ library, model, tools, mcp, promptOptions })`. `/api/frontend-token` returns `openui.createFrontendToken({ userId })`, a short-lived token that reads only that user's dashboards. The dashboard tools pass the same `userId`, so the dashboards they create belong to that user. There's no sign-in, so every browser shares one local user (`DEMO_USER_ID`, default `assistant-ui-dashboards-demo`).

## Files

| File                                  | Purpose                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `src/lib/data/`                       | npm, GitHub, and OSV.dev data tools, with timeouts and caching        |
| `src/lib/openui.ts`                   | `OpenUIClient`, the dashboard definition, the base URL and local user |
| `src/lib/toolkit.tsx`                 | Browser-only backend-tool card registrations                        |
| `src/lib/dashboard-tool-contracts.ts` | Dashboard tool schemas and descriptions                              |
| `src/lib/chat-agent.ts`               | Request-scoped Deep Agent, Gateway model, and dashboard tool execution |
| `src/lib/prompt.ts`                   | Chat instructions and the data dashboards can show                    |
| `src/library.ts`                      | The kit's library, for `pnpm run generate`                            |
| `src/app/api/chat/route.ts`           | Validates history and streams the Deep Agent through the AI SDK adapter |
| `src/app/api/interpreter/route.ts`    | Runs dashboards' `Query()` calls with `dashboards.interpreter`        |
| `src/app/api/frontend-token/route.ts` | The user's frontend token for OpenUI Cloud                            |
| `src/components/app.tsx`              | Runtime, providers, and the chat and panel layout                     |
| `src/components/threads.tsx`          | assistant-ui's thread list, kept in `localStorage`                    |
| `src/components/dashboard-list.tsx`   | The Dashboards tab: `useArtifactList()` with pin, unpin, and delete   |
| `src/components/assistant-ui/`        | assistant-ui's `Thread` and `ThreadList`, from its registry           |
| `src/components/dashboard.tsx`        | The dashboard card and the panel with `LiveArtifactRenderer`          |

`pnpm run generate` creates the ignored component specification before dev/build/verify.

## Deploying

The app binds to loopback and every browser shares one local user. For deployment, add [authentication](https://www.openui.com/docs/gateway/authentication) and use the signed-in user's id for the frontend token and the dashboard tools. Pass the user as the interpreter's `context` if data tools should return only what they may see. Add request-size and rate limits to the routes, and set `GITHUB_TOKEN`.

OpenUI Cloud stores each dashboard's definition, not its data: numbers reach the browser only through `/api/interpreter`, from your server. OpenUI Gateway receives the conversation to run the chat model; dashboard generation receives only each dashboard's title and description, and the data tools' descriptions and example outputs.

## Verify

```bash
pnpm test
pnpm run verify
```

Tests run offline, including a real Deep Agent with a deterministic test model and mocked OpenUI calls. They cover stream compatibility, persisted tool history, ownership, cancellation, safe errors and rendering. The production build also checks TypeScript. Live create/edit/reopen checks require configured credentials and can use model credits; they are not part of the offline suite.
