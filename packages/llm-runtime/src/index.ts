import { FlowGraph } from '../../shared-types/src/index.js';

export interface LlmClient { createResponse(input: LlmPlanningRequest): Promise<LlmPlanningResponse>; }
export interface LlmPlanningRequest { readonly intent: string; readonly knownFlows: readonly FlowGraph[]; readonly ambiguity: readonly string[]; }
export interface LlmPlanningResponse { readonly selectedFlowId?: string; readonly rationale: string; readonly missingContext: readonly string[]; }

export class SelectiveLlmPlanner {
  constructor(private readonly client: LlmClient) {}
  async planWhenNeeded(request: LlmPlanningRequest): Promise<LlmPlanningResponse> {
    if (request.knownFlows.length === 1 && request.ambiguity.length === 0) {
      const selectedFlowId = request.knownFlows[0]?.id;
      return selectedFlowId
        ? { selectedFlowId, rationale: 'Known flow selected without LLM browser loop.', missingContext: [] }
        : { rationale: 'No deterministic flow available.', missingContext: ['flow'] };
    }
    return this.client.createResponse(request);
  }
}

export class OpenAIResponsesClient implements LlmClient {
  constructor(private readonly apiKey: string, private readonly model = 'gpt-5.5') {}
  async createResponse(input: LlmPlanningRequest): Promise<LlmPlanningResponse> {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: [{ role: 'system', content: 'Select or adapt a deterministic QA flow. Never emit live click-observe loops.' }, { role: 'user', content: JSON.stringify(input) }] })
    });
    if (!response.ok) throw new Error(`OpenAI Responses API failed: ${response.status}`);
    const data = await response.json() as { output_text?: string };
    const selectedFlowId = input.knownFlows[0]?.id;
    return selectedFlowId
      ? { rationale: data.output_text ?? 'LLM response received.', missingContext: [], selectedFlowId }
      : { rationale: data.output_text ?? 'LLM response received.', missingContext: ['flow'] };
  }
}
