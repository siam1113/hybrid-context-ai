import { DeterministicExecutionEngine, registerCorePrimitives } from '../../../packages/execution-primitives/src/index.js';

export function createExecutor(): DeterministicExecutionEngine {
  const engine = new DeterministicExecutionEngine();
  registerCorePrimitives(engine);
  return engine;
}
