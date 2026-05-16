import { ExecutionPlan, ExecutionTraceEvent, FlowNode, Logger, SemanticElement, confidence } from '../../shared-types/src/index.js';
import { InMemorySemanticIndex } from '../../semantic-engine/src/index.js';
import { SemanticValidationEngine } from '../../validation-engine/src/index.js';

export interface BrowserDriver {
  goto(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  setInputFiles(selector: string, filePath: string): Promise<void>;
  waitForSemanticState(name: string, timeoutMs: number): Promise<void>;
}

export interface PrimitiveContext {
  readonly applicationId: string;
  readonly semanticIndex: InMemorySemanticIndex;
  readonly browser: BrowserDriver;
  readonly validation: SemanticValidationEngine;
  readonly logger: Logger;
  emit(event: ExecutionTraceEvent): void;
}

export type PrimitiveHandler = (node: FlowNode, context: PrimitiveContext) => Promise<void>;

export class DeterministicExecutionEngine {
  private readonly primitives = new Map<string, PrimitiveHandler>();
  register(name: string, handler: PrimitiveHandler): void { this.primitives.set(name, handler); }
  async execute(plan: ExecutionPlan, context: Omit<PrimitiveContext, 'applicationId' | 'emit'>): Promise<readonly ExecutionTraceEvent[]> {
    const events: ExecutionTraceEvent[] = [];
    const runtime: PrimitiveContext = { ...context, applicationId: plan.applicationId, emit: (event) => events.push(event) };
    for (const node of plan.nodes) {
      runtime.emit(trace(plan.id, node.id, 'started', `Starting ${node.name}`));
      if (node.kind === 'primitive') {
        const primitive = node.primitive ? this.primitives.get(node.primitive) : undefined;
        if (!primitive) throw new Error(`Primitive not registered: ${node.primitive}`);
        await primitive(node, runtime);
        runtime.emit(trace(plan.id, node.id, 'primitive_executed', `Executed ${node.primitive}`));
      }
      for (const assertion of node.assertions) {
        const result = await runtime.validation.validate(assertion);
        runtime.emit(trace(plan.id, node.id, 'assertion', `Assertion ${assertion.businessEvent}`, { result }));
        if (!result.passed) throw new Error(`Semantic assertion failed: ${assertion.businessEvent}`);
      }
    }
    runtime.emit(trace(plan.id, 'plan', 'completed', 'Execution plan completed'));
    return events;
  }
}

export function registerCorePrimitives(engine: DeterministicExecutionEngine): void {
  engine.register('open_compose_modal', async (node, context) => {
    const target = context.semanticIndex.resolveTarget(context.applicationId, node.targetBusinessMeaning ?? 'compose');
    await context.browser.click(bestSelector(target));
    await context.browser.waitForSemanticState('compose_modal_open', 5000);
  });
  engine.register('fill_email_recipient', async (node, context) => fillTarget(node, context, String(node.inputs.recipient ?? '')));
  engine.register('fill_email_subject', async (node, context) => fillTarget(node, context, String(node.inputs.subject ?? '')));
  engine.register('fill_email_body', async (node, context) => fillTarget(node, context, String(node.inputs.body ?? '')));
  engine.register('upload_attachment', async (node, context) => {
    const target = context.semanticIndex.resolveTarget(context.applicationId, node.targetBusinessMeaning ?? 'attachment');
    await context.browser.setInputFiles(bestSelector(target), String(node.inputs.filePath ?? ''));
  });
  engine.register('submit_form', async (node, context) => {
    const target = context.semanticIndex.resolveTarget(context.applicationId, node.targetBusinessMeaning ?? 'send');
    await context.browser.click(bestSelector(target));
  });
  engine.register('click_target', async (node, context) => {
    const target = context.semanticIndex.resolveTarget(context.applicationId, node.targetBusinessMeaning ?? node.name);
    await context.browser.click(bestSelector(target));
  });
  engine.register('fill_target', async (node, context) => fillTarget(node, context, String(node.inputs.value ?? node.inputs.text ?? '')));
  engine.register('upload_file', async (node, context) => {
    const target = context.semanticIndex.resolveTarget(context.applicationId, node.targetBusinessMeaning ?? node.name);
    await context.browser.setInputFiles(bestSelector(target), String(node.inputs.filePath ?? node.inputs.value ?? ''));
  });
  engine.register('wait_for_state', async (node, context) => {
    const stateName = String(node.inputs.stateName ?? node.targetBusinessMeaning ?? node.name);
    await context.browser.waitForSemanticState(stateName, Number(node.inputs.timeoutMs ?? 5000));
  });
}


async function fillTarget(node: FlowNode, context: PrimitiveContext, value: string): Promise<void> {
  const target = context.semanticIndex.resolveTarget(context.applicationId, node.targetBusinessMeaning ?? node.name);
  await context.browser.fill(bestSelector(target), value);
}

export function bestSelector(element: SemanticElement): string {
  const selector = [...element.selectors].sort((a, b) => Number(b.confidence) - Number(a.confidence))[0];
  if (!selector) throw new Error(`Element ${element.elementId} has no selectors`);
  if (selector.strategy === 'aria') return `[aria-label="${selector.value.replaceAll('"', '\\"')}"]`;
  if (selector.strategy === 'test_id') return `[data-testid="${selector.value.replaceAll('"', '\\"')}"]`;
  if (selector.strategy === 'text') return `text=${selector.value}`;
  return selector.value;
}

export function trace(executionId: string, nodeId: string, type: ExecutionTraceEvent['type'], message: string, attributes: Readonly<Record<string, unknown>> = {}): ExecutionTraceEvent {
  return { executionId, nodeId, type, message, attributes, timestamp: new Date().toISOString() };
}

export function selectorConfidenceFromSignals(signals: readonly number[]): number {
  return Number(confidence(Math.min(1, signals.reduce((sum, value) => sum + value, 0) / Math.max(1, signals.length))));
}
