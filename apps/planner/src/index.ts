import { FlowMemoryStore, PlanInputOverrides } from '../../../packages/flow-engine/src/index.js';
import { ExecutionPlan } from '../../../packages/shared-types/src/index.js';
import { SelectiveLlmPlanner } from '../../../packages/llm-runtime/src/index.js';

export class PlannerService {
  constructor(private readonly flows: FlowMemoryStore, private readonly llm?: SelectiveLlmPlanner) {}

  async createExecutionPlan(applicationId: string, intent: string, inputOverrides: PlanInputOverrides = {}): Promise<ExecutionPlan> {
    const known = this.flows.findByIntent(applicationId, intent);
    if (known) return this.flows.createPlanFromFlow(known.id, intent, inputOverrides);
    if (!this.llm) throw new Error(`No known flow and LLM planner unavailable for ${intent}`);
    const response = await this.llm.planWhenNeeded({ intent, knownFlows: this.flows.list(applicationId), ambiguity: ['unknown_flow'] });
    if (response.selectedFlowId) return this.flows.createPlanFromFlow(response.selectedFlowId, intent, inputOverrides);
    throw new Error(`Planner requires compiled context before deterministic execution: ${response.missingContext.join(', ')}`);
  }
}
