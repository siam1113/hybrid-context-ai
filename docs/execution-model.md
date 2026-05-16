# Execution Model

The executor consumes an `ExecutionPlan` and runs deterministic primitives against semantic targets. Each primitive resolves a business target through semantic memory, chooses the highest-confidence selector candidate, performs a browser-adapter action, and validates expected business state.

## Wired local path

The local API uses `createPlatformServices()` to wire the runtime end to end:

1. `ContextCompilerService` compiles the seeded or submitted DOM snapshot into a `SemanticUIMap`.
2. `InMemorySemanticIndex` stores semantic UI maps and resolves business targets such as `email recipient`.
3. `FlowMemoryStore` stores validated DAGs and creates topologically sorted plans with optional input overrides.
4. `PlannerService` selects a known deterministic flow by intent or escalates to the selective LLM planner if configured.
5. `DeterministicExecutionEngine` executes registered primitives from `createExecutor()`.
6. `InMemoryBrowserDriver` records safe local browser actions; production adapters can replace it at the app boundary.
7. `SemanticValidationEngine` evaluates weighted evidence and emits assertion trace events.
8. `/flows/execute` returns the generated plan, trace events, and browser actions.

## Runtime loop

1. Load plan and runtime state.
2. For each topologically sorted node, emit trace events.
3. Resolve target by business meaning and semantic role.
4. Execute the registered primitive.
5. Evaluate semantic assertions.
6. On failure, surface a failed execution response for API callers and reserve recovery or selective LLM reasoning for follow-up orchestration.
7. Persist episodic memory and telemetry when production persistence adapters are added.

This avoids `LLM -> click -> observe -> think -> repeat` as the default operating model.

## Local execution example

After `npm run build`, start the seeded API with:

```bash
PORT=8080 npm run start:api
```

Execute the demo workflow:

```bash
curl -X POST http://localhost:8080/flows/execute \
  -H 'content-type: application/json' \
  -d '{"applicationId":"gmail","intent":"Email a report with a file attached","inputs":{"recipient":{"recipient":"ops@example.com"},"attach":{"filePath":"/tmp/ops.pdf"}}}'
```

The response includes the plan, trace events, and deterministic browser actions such as filling the recipient and uploading the attachment.
