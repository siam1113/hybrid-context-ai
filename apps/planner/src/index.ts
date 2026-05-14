import { FlowMemoryStore } from '../../../packages/flow-engine/src/index.js';
import { SelectiveLlmPlanner } from '../../../packages/llm-runtime/src/index.js';

export class PlannerService {
  constructor(private readonly flows: FlowMemoryStore, private readonly llm?: SelectiveLlmPlanner) {}
  async createExecutionPlan(applicationId: string, intent: string) {
    const known = this.flows.findByIntent(applicationId, intent);
    if (known) return this.flows.createPlan(applicationId, intent);
    if (!this.llm) throw new Error(`No known flow and LLM planner unavailable for ${intent}`);
    await this.llm.planWhenNeeded({ intent, knownFlows: [], ambiguity: ['unknown_flow'] });
    throw new Error('Planner requires compiled context before deterministic execution.');
  }
}
