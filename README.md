# Hybrid Context AI

Hybrid Context AI is a production foundation for a hybrid Context-Compiled AI QA platform. It is designed for application operational intelligence: compiled application context, semantic UI memory, reusable flow graphs, deterministic browser execution primitives, semantic validation, and targeted LLM reasoning for planning, ambiguity, recovery, and unknown flows.

The guiding principle is **do not run a pure `LLM -> click -> observe -> think -> repeat` browser loop by default**. Instead, the platform compiles stable application context ahead of time and uses LLM reasoning only where deterministic context is incomplete or ambiguous.

## What is in this repository?

This repository is a TypeScript npm workspace with small app entry points, reusable packages, tests, and local infrastructure definitions.

```text
.
├── apps/
│   ├── api/                 # HTTP API surface for health, flow execution, and semantic queries
│   ├── context-compiler/    # Service that turns DOM snapshots into semantic UI maps
│   ├── dashboard/           # Next.js dashboard shell for monitoring and exploration
│   ├── executor/            # Factory for deterministic execution primitives
│   ├── planner/             # Planner service that selects known flows or escalates to LLM planning
│   └── recovery-agent/      # Semantic rematching and selector-promotion recovery logic
├── packages/
│   ├── dom-processor/       # Raw DOM to semantic element extraction
│   ├── execution-primitives/# Deterministic primitive execution engine
│   ├── flow-engine/         # Flow memory store and plan construction
│   ├── llm-runtime/         # Selective LLM planner abstraction
│   ├── semantic-engine/     # In-memory semantic index and similarity helpers
│   ├── shared-types/        # Core platform data types
│   └── validation-engine/   # Semantic/business-event validation
├── docs/                    # Architecture, execution model, flow memory, and semantic memory notes
├── infrastructure/
│   ├── docker/              # Local dependency stack
│   ├── monitoring/          # OpenTelemetry and Prometheus configuration
│   └── terraform/           # Production infrastructure notes
├── tests/                   # Node test runner integration smoke tests
├── package.json             # Root workspace scripts
└── tsconfig.json            # Root TypeScript build configuration
```

## Platform architecture

The platform is split into these layers:

1. **Context Compiler Layer** crawls or receives DOM snapshots, extracts semantic UI maps, builds selector confidence, and stores application context.
2. **Business Knowledge Memory** models domain terms, business events, evidence signals, and action vocabulary.
3. **Semantic DOM Intelligence** turns raw DOM into semantic elements with roles, business meanings, selector candidates, component relationships, and fingerprints.
4. **Flow Memory System** stores reusable DAG/state-machine flows that can be selected by user intent.
5. **Deterministic Execution Engine** executes registered browser primitives such as opening a compose modal, filling recipients, uploading attachments, and submitting forms.
6. **Validation & Assertion Engine** evaluates business events through weighted semantic, network, URL, storage, database, and telemetry evidence.
7. **Recovery & Self-Healing Layer** rematches changed UI elements through semantic similarity, alternate selectors, nearby components, and historical patterns.
8. **LLM Planning Layer** is reserved for unknown flows, ambiguous instructions, or gaps in compiled context.
9. **Episodic Learning System** is intended to record failures, retries, flaky elements, timings, and recovery patterns.
10. **API + Dashboard Layer** exposes execution, semantic memory, history, graph, replay, and compiler controls.

See the supporting documentation for more detail:

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/execution-model.md`](docs/execution-model.md)
- [`docs/flows.md`](docs/flows.md)
- [`docs/semantic-memory.md`](docs/semantic-memory.md)
- [`infrastructure/terraform/README.md`](infrastructure/terraform/README.md)

## Prerequisites

Install the following before running the project locally:

- **Node.js 22 or newer**. The root `package.json` declares `node >=22.0.0`.
- **npm** bundled with your Node.js installation.
- **Docker Desktop** or compatible Docker Engine with Docker Compose, if you want to run local infrastructure.
- Optional but recommended: a TypeScript-aware editor such as VS Code.

Verify your local tools:

```bash
node --version
npm --version
docker --version
docker compose version
```

## Quick start

From the repository root:

```bash
npm install
npm run check
```

`npm run check` runs the complete repository validation at the root: TypeScript compilation followed by the Node test suite. The API seeds a demo Gmail-style workflow so the end-to-end compile → plan → execute → validate path works immediately after build.

## Install dependencies

Install all workspace dependencies from the root:

```bash
npm install
```

This project uses npm workspaces for `apps/*` and `packages/*`, so a root install is the recommended workflow. Avoid running independent installs in each package unless you intentionally need to debug npm workspace behavior.

## Build the project

Compile all TypeScript included by the root `tsconfig.json`:

```bash
npm run build
```

Compiled output is written to `dist/`. The root build includes the TypeScript apps, packages, tests, and type declarations configured in `tsconfig.json`. The Next.js dashboard is excluded from the root TypeScript build and has its own scripts.

## Run tests

Run the full root check:

```bash
npm run check
```

Or run build and tests separately:

```bash
npm run build
npm test
```

The test suite uses Node's built-in test runner against compiled files in `dist/tests/*.test.js`, so run `npm run build` before `npm test` if you execute the commands separately.

## Run local infrastructure

The local dependency stack is defined in [`infrastructure/docker/docker-compose.yml`](infrastructure/docker/docker-compose.yml). It includes:

| Service | Purpose | Default URL / port |
| --- | --- | --- |
| PostgreSQL | Plans, executions, assertions, audit records | `localhost:5432` |
| Redis | Runtime state, locks, queue hints, live status | `localhost:6379` |
| Qdrant | Semantic UI and business-context embeddings | `localhost:6333` |
| Neo4j | Flow, UI, business, and relation graphs | `http://localhost:7474`, Bolt `localhost:7687` |
| Temporal | Compiler, execution, validation, and recovery workflows | `localhost:7233` |
| OpenTelemetry Collector | Trace and metric ingestion | `localhost:4317`, `localhost:4318` |
| Prometheus | Metrics storage/querying | `http://localhost:9090` |
| Grafana | Dashboards | `http://localhost:3001` |

Start the stack:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Check running services:

```bash
docker compose -f infrastructure/docker/docker-compose.yml ps
```

View logs for a single service:

```bash
docker compose -f infrastructure/docker/docker-compose.yml logs -f postgres
```

Stop the stack:

```bash
docker compose -f infrastructure/docker/docker-compose.yml down
```

Remove local service volumes as well when you need a clean slate:

```bash
docker compose -f infrastructure/docker/docker-compose.yml down -v
```

### Default local credentials

The compose file is intended for local development only. Current defaults are:

- PostgreSQL user: `hybrid`
- PostgreSQL password: `hybrid`
- PostgreSQL database: `hybrid_context`
- Neo4j user: `neo4j`
- Neo4j password: `hybrid-context`

Do not reuse these credentials in shared or production environments.

## Run the dashboard

The dashboard is a Next.js application under `apps/dashboard`.

Start it from the repository root with npm workspace targeting:

```bash
npm run dev --workspace @hybrid-context/dashboard
```

Then open:

```text
http://localhost:3000
```

Build the dashboard for production:

```bash
npm run build --workspace @hybrid-context/dashboard
```

The dashboard provides the operator UI shell for live execution monitoring, semantic UI exploration, flow visualization, memory graph inspection, execution replay, flaky element analysis, and selector confidence views. It is designed around the API endpoints listed below.

## API service usage

`apps/api` exports `createApiServer()` and `createPlatformServices()` for fully wired in-memory local operation. The default server seeds a Gmail-style semantic map and reusable attachment flow, then wires together the context compiler, semantic index, flow store, planner, deterministic executor, in-memory browser adapter, and semantic validation engine.

Build and start the API from the repository root:

```bash
npm run build
PORT=8080 npm run start:api
```

Available routes:

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Returns `{ "ok": true }` for service health checks. |
| `GET` | `/flows?applicationId=gmail` | Lists registered flow graphs. |
| `POST` | `/flows` | Registers or replaces a flow graph after DAG validation. |
| `POST` | `/plans` | Creates a deterministic execution plan from `{ "applicationId", "intent", "inputs" }`. |
| `POST` | `/flows/execute` | Plans and executes an intent end to end, returning the plan, trace events, and browser-adapter actions. |
| `POST` | `/semantic/compile` | Compiles a raw DOM snapshot into a `SemanticUIMap` and stores it in semantic memory. |
| `GET` | `/semantic/maps?applicationId=gmail` | Lists compiled semantic UI maps. |
| `GET` | `/semantic/query?applicationId=gmail&q=email%20recipient` | Queries semantic memory by business meaning. |

Example local API calls:

```bash
curl http://localhost:8080/health

curl 'http://localhost:8080/flows?applicationId=gmail'

curl -X POST http://localhost:8080/plans \
  -H 'content-type: application/json' \
  -d '{"applicationId":"gmail","intent":"Email a report with a file attached","inputs":{"recipient":{"recipient":"ops@example.com"},"attach":{"filePath":"/tmp/ops.pdf"}}}'

curl -X POST http://localhost:8080/flows/execute \
  -H 'content-type: application/json' \
  -d '{"applicationId":"gmail","intent":"Email a report with a file attached","inputs":{"recipient":{"recipient":"ops@example.com"},"attach":{"filePath":"/tmp/ops.pdf"}}}'

curl 'http://localhost:8080/semantic/query?applicationId=gmail&q=email%20recipient'
```

The default execution uses an `InMemoryBrowserDriver`, so it is deterministic and safe for local tests. Replace that adapter at the app boundary when connecting to Playwright or another browser runtime.

## Core usage workflow

A typical platform flow looks like this:

1. **Compile application context**
   - Capture or provide a DOM snapshot.
   - Pass it to `ContextCompilerService` with an application vocabulary.
   - Store the resulting `SemanticUIMap` in semantic memory.

2. **Define reusable flows**
   - Create flow DAGs in `FlowMemoryStore`.
   - Model each user-visible action as a deterministic primitive node.
   - Attach semantic assertions for required business events.

3. **Plan from user intent**
   - Use `PlannerService` to match an intent to a known flow.
   - Pass optional node or primitive input overrides such as recipient, subject, body, or attachment path.
   - Escalate to `SelectiveLlmPlanner` only when compiled memory cannot produce a deterministic plan.

4. **Execute deterministically**
   - Create an executor with `createExecutor()` or `DeterministicExecutionEngine` plus `registerCorePrimitives()`.
   - Provide semantic memory, validation, logging, and a browser adapter.
   - Run the generated execution plan.

5. **Validate business outcomes**
   - Use `SemanticValidationEngine` and an evidence provider.
   - Combine weighted evidence signals into assertion confidence.

6. **Recover and learn**
   - Use `RecoveryAgent` to rank semantic rematch candidates if selectors drift.
   - Promote newly verified selectors.
   - Persist recovery outcomes as episodic memory when persistence is implemented.

## Minimal in-code example

The integration smoke test in `tests/platform.test.ts` is the best executable reference for the current API. It demonstrates:

- Creating semantic DOM elements from a raw DOM tree.
- Upserting a semantic UI map.
- Creating a Gmail-style attachment flow.
- Building an execution plan from intent.
- Registering deterministic primitives.
- Running execution with a mock browser adapter.
- Validating a semantic business event.
- Exercising the fully wired API service with seeded demo data and input overrides.

To run the example path:

```bash
npm run check
```

## Development guide

### Recommended workflow

1. Create or update types in `packages/shared-types` first when changing cross-package contracts.
2. Implement reusable behavior in `packages/*`.
3. Add service orchestration in `apps/*`.
4. Add or update tests in `tests/`.
5. Run `npm run check` before opening a pull request.
6. Update this README or docs when behavior, setup, or architecture changes.

### Package responsibilities

| Package | Responsibility | Common changes |
| --- | --- | --- |
| `packages/shared-types` | Core interfaces and branded primitives | New plan, semantic, assertion, evidence, or telemetry types |
| `packages/dom-processor` | DOM normalization and semantic extraction | Role detection, vocabulary mapping, selector candidates, fingerprints |
| `packages/semantic-engine` | Semantic memory and similarity | Target resolution, indexing, ranking, embedding integration |
| `packages/flow-engine` | Flow storage and execution-plan creation | Flow matching, DAG validation, versioning, persistence adapters |
| `packages/execution-primitives` | Deterministic execution runtime | New browser primitives, primitive registry behavior, event emission |
| `packages/validation-engine` | Assertion evaluation | New evidence providers, confidence weighting, business-event rules |
| `packages/llm-runtime` | Selective LLM planning abstraction | Model/provider integration, prompt contracts, guardrails |

### App responsibilities

| App | Responsibility | Development notes |
| --- | --- | --- |
| `apps/context-compiler` | Orchestrates DOM processing and semantic index writes | Add crawling, scheduling, and persistence integration here. |
| `apps/planner` | Selects known flows or escalates to LLM planning | Keep deterministic flow selection as the default path. |
| `apps/executor` | Creates a primitive-enabled execution engine | Integrate Playwright and runtime adapters here. |
| `apps/recovery-agent` | Ranks replacement elements and promotes selectors | Add historical-pattern and component-neighborhood signals here. |
| `apps/api` | Exposes HTTP endpoints and the default in-memory platform wiring | Add authentication, request validation, and persistence-backed handlers here. |
| `apps/dashboard` | Provides the operator UI | Connect panels to API endpoints and live telemetry streams. |

### TypeScript conventions

- Keep `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` passing.
- Prefer explicit domain types from `packages/shared-types` over ad hoc object shapes.
- Keep deterministic logic in packages and orchestration in apps.
- Add tests for new primitives, flow planning behavior, validation logic, and recovery scoring.
- Avoid broad framework coupling in packages; adapters should live at app boundaries.

### Adding a new deterministic primitive

1. Define the primitive name and required inputs.
2. Add the implementation in `packages/execution-primitives`.
3. Resolve targets by business meaning through semantic memory rather than hard-coded selectors.
4. Emit useful execution events for traceability.
5. Add semantic assertions where the primitive represents a business outcome.
6. Register the primitive in the core registry or in an app-specific registry.
7. Add tests with a mock browser adapter before connecting to Playwright.

### Adding or changing a flow

1. Model the flow as a DAG with a stable `id`, `applicationId`, `name`, `version`, and `entryNodeId`.
2. Use intent examples that represent how users ask for the workflow.
3. Keep each node focused on one primitive or decision.
4. Use `targetBusinessMeaning` instead of CSS selectors.
5. Attach assertions to nodes that must prove business state changed.
6. Validate topological ordering and failure behavior in tests.

### Extending semantic memory

When improving semantic extraction or indexing:

- Add vocabulary entries for domain-specific meanings.
- Prefer ARIA labels, roles, test IDs, text similarity, visual hierarchy, and DOM neighborhood over brittle CSS selectors.
- Treat raw CSS selectors as fallback evidence.
- Preserve stable fingerprints where possible so recovery can reason about UI drift.
- Add tests for confidence scoring and target resolution.

### Adding persistence

The current code uses in-memory stores for the foundation. When adding persistence:

- Use PostgreSQL for durable plans, executions, assertions, and audit records.
- Use Redis for runtime state, locks, queues, and live status.
- Use Qdrant for embedding-backed semantic and business-context retrieval.
- Use Neo4j for flow, UI, business, and relation graph traversal.
- Use Temporal for long-running compiler, execution, validation, and recovery workflows.
- Keep persistence behind interfaces so package tests can remain fast and deterministic.

### Adding OpenAI or other LLM integration

The LLM layer should stay selective and constrained:

- Use it for unknown flows, ambiguous user intent, recovery escalation, and adaptation.
- Do not let it become the default driver for every browser action.
- Pass compiled context, known flows, ambiguity reasons, and guardrails into planning calls.
- Validate generated plans against available primitives and semantic targets before execution.
- Log prompts, model outputs, plan decisions, and safety decisions according to your data-retention policy.

## Observability and operations

Local observability configuration lives under `infrastructure/monitoring` and is referenced by Docker Compose.

Development targets:

- Emit trace events from planning, execution, validation, and recovery.
- Export service metrics through OpenTelemetry Collector.
- Store metrics in Prometheus.
- Build Grafana dashboards for execution latency, selector confidence, flaky elements, flow success rate, recovery success rate, and validation confidence.

## Troubleshooting

### `npm run check` fails because tests cannot be found

Run `npm run build` first, or use `npm run check`, which builds before running tests. `npm test` expects compiled test files under `dist/tests/*.test.js`.

### TypeScript cannot resolve workspace imports

Install dependencies from the repository root with `npm install`. The root `tsconfig.json` defines path mappings for workspace packages.

### Dashboard dependencies are missing

Run `npm install` at the repository root, then start the dashboard with:

```bash
npm run dev --workspace @hybrid-context/dashboard
```

### Docker ports are already in use

Stop the conflicting local services or edit `infrastructure/docker/docker-compose.yml` to map services to different host ports.

### Compose services start but data looks stale

Reset local service data with:

```bash
docker compose -f infrastructure/docker/docker-compose.yml down -v
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

## Production considerations

Before production deployment, add or harden:

- Authentication and authorization on API and dashboard routes.
- Request validation and schema versioning.
- Durable persistence adapters for all in-memory stores.
- Secrets management for database, LLM provider, and telemetry credentials.
- Managed PostgreSQL, Redis-compatible cache, Qdrant, Neo4j, Temporal Cloud, and observability services.
- Multi-environment Terraform modules and CI/CD workflows.
- Browser execution sandboxing and artifact retention policies.
- Audit logging for user intents, generated plans, executions, validations, and recovery decisions.
- Data-retention and privacy policies for DOM snapshots, prompts, screenshots, traces, and execution artifacts.

## Useful commands

| Command | Description |
| --- | --- |
| `npm install` | Install all workspace dependencies. |
| `npm run build` | Compile root TypeScript sources to `dist/`. |
| `npm test` | Run compiled Node tests from `dist/tests/*.test.js`. |
| `npm run check` | Build and run tests. |
| `npm run start:api` | Start the seeded local API from compiled `dist/` output. |
| `npm run dev --workspace @hybrid-context/dashboard` | Start the Next.js dashboard in development mode. |
| `npm run build --workspace @hybrid-context/dashboard` | Build the dashboard. |
| `docker compose -f infrastructure/docker/docker-compose.yml up -d` | Start local infrastructure. |
| `docker compose -f infrastructure/docker/docker-compose.yml ps` | Show local infrastructure status. |
| `docker compose -f infrastructure/docker/docker-compose.yml logs -f <service>` | Tail logs for one service. |
| `docker compose -f infrastructure/docker/docker-compose.yml down` | Stop local infrastructure. |
| `docker compose -f infrastructure/docker/docker-compose.yml down -v` | Stop local infrastructure and remove volumes. |

## Current maturity

This repository is now a fully wired in-memory reference implementation for local end-to-end operation: demo context compilation, semantic memory, flow registration, intent planning, deterministic primitive execution, semantic validation, API routes, dashboard shell, docs, and smoke tests are connected. Production use still requires durable persistence adapters, authentication, a real browser/runtime adapter, LLM provider configuration, CI/CD, and operational hardening.
