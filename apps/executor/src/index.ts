import { BrowserDriver, DeterministicExecutionEngine, registerCorePrimitives } from '../../../packages/execution-primitives/src/index.js';

export function createExecutor(): DeterministicExecutionEngine {
  const engine = new DeterministicExecutionEngine();
  registerCorePrimitives(engine);
  return engine;
}

export class InMemoryBrowserDriver implements BrowserDriver {
  readonly actions: string[] = [];
  private readonly semanticStates = new Set<string>(['compose_modal_open']);

  async goto(url: string): Promise<void> { this.actions.push(`goto:${url}`); }
  async click(selector: string): Promise<void> { this.actions.push(`click:${selector}`); }
  async fill(selector: string, value: string): Promise<void> { this.actions.push(`fill:${selector}:${value}`); }
  async setInputFiles(selector: string, filePath: string): Promise<void> { this.actions.push(`file:${selector}:${filePath}`); }
  async waitForSemanticState(name: string, timeoutMs: number): Promise<void> {
    this.actions.push(`wait:${name}:${timeoutMs}`);
    if (!this.semanticStates.has(name)) throw new Error(`Timed out waiting for semantic state: ${name}`);
  }

  setSemanticState(name: string): void { this.semanticStates.add(name); }
  reset(): void { this.actions.splice(0); }
}
