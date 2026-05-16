import { ExecutionPlan, FlowGraph, FlowNode, RuntimeState } from '../../shared-types/src/index.js';

export type PlanInputOverrides = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export class FlowMemoryStore {
  private readonly flows = new Map<string, FlowGraph>();

  upsert(flow: FlowGraph): void { this.assertDag(flow); this.flows.set(flow.id, flow); }

  list(applicationId?: string): readonly FlowGraph[] {
    return [...this.flows.values()].filter((flow) => !applicationId || flow.applicationId === applicationId);
  }

  get(flowGraphId: string): FlowGraph | undefined { return this.flows.get(flowGraphId); }

  findByIntent(applicationId: string, intent: string): FlowGraph | undefined {
    const normalized = intent.toLowerCase();
    const ranked = [...this.flows.values()]
      .filter((flow) => flow.applicationId === applicationId)
      .map((flow) => ({ flow, score: Math.max(...flow.intentExamples.map((example) => lexicalOverlap(normalized, example.toLowerCase())), 0) }))
      .sort((a, b) => b.score - a.score)[0];
    return ranked && ranked.score > 0 ? ranked.flow : undefined;
  }

  createPlan(applicationId: string, intent: string, inputOverrides: PlanInputOverrides = {}): ExecutionPlan {
    const flow = this.findByIntent(applicationId, intent);
    if (!flow) throw new Error(`Unknown flow for intent: ${intent}`);
    return this.createPlanFromFlow(flow.id, intent, inputOverrides);
  }

  createPlanFromFlow(flowGraphId: string, intent: string, inputOverrides: PlanInputOverrides = {}): ExecutionPlan {
    const flow = this.flows.get(flowGraphId);
    if (!flow) throw new Error(`Unknown flow graph: ${flowGraphId}`);
    const nodes = topologicalSort(flow).map((node) => ({ ...node, inputs: { ...node.inputs, ...(inputOverrides[node.id] ?? {}), ...(node.primitive ? inputOverrides[node.primitive] ?? {} : {}) } }));
    const runtimeState: RuntimeState = { activeWorkflow: flow.name, expectedNextState: flow.entryNodeId, assertions: flow.nodes.flatMap((node) => node.assertions) };
    return { id: `plan_${Date.now()}`, intent, applicationId: flow.applicationId, flowGraphId: flow.id, nodes, edges: flow.edges, runtimeState };
  }

  private assertDag(flow: FlowGraph): void {
    const nodeIds = new Set(flow.nodes.map((node) => node.id));
    if (!nodeIds.has(flow.entryNodeId)) throw new Error(`flow ${flow.id} entry node does not exist: ${flow.entryNodeId}`);
    for (const edge of flow.edges) {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) throw new Error(`flow ${flow.id} contains an edge with an unknown node`);
    }
    const sorted = topologicalSort(flow);
    if (sorted.length !== flow.nodes.length) throw new Error(`flow ${flow.id} is not a valid DAG`);
  }
}

export function topologicalSort(flow: FlowGraph): readonly FlowNode[] {
  const incoming = new Map(flow.nodes.map((node) => [node.id, 0]));
  for (const edge of flow.edges) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  const queue = flow.nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0);
  const result: FlowNode[] = [];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;
    result.push(node);
    for (const edge of flow.edges.filter((candidate) => candidate.from === node.id)) {
      const nextCount = (incoming.get(edge.to) ?? 0) - 1;
      incoming.set(edge.to, nextCount);
      if (nextCount === 0) {
        const next = flow.nodes.find((candidate) => candidate.id === edge.to);
        if (next) queue.push(next);
      }
    }
  }
  return result;
}

function lexicalOverlap(a: string, b: string): number {
  const left = new Set(a.split(/\W+/).filter(Boolean));
  const right = new Set(b.split(/\W+/).filter(Boolean));
  return [...left].filter((token) => right.has(token)).length;
}
