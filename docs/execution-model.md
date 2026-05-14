# Execution Model

The executor consumes an `ExecutionPlan` and runs deterministic primitives against semantic targets. Each primitive resolves a business target through semantic memory, chooses the highest-confidence selector candidate, performs a Playwright action, and validates expected business state.

## Runtime loop

1. Load plan and runtime state.
2. For each topologically sorted node, emit trace events.
3. Resolve target by business meaning and semantic role.
4. Execute the registered primitive.
5. Evaluate semantic assertions.
6. On failure, invoke recovery before escalating to selective LLM reasoning.
7. Persist episodic memory and telemetry.

This avoids `LLM -> click -> observe -> think -> repeat` as the default operating model.
