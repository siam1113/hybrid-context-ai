export type UUID = string;
export type ISODateTime = string;

export type ConfidenceScore = number & { readonly __brand: 'ConfidenceScore' };
export const confidence = (value: number): ConfidenceScore => {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`confidence must be 0..1, got ${value}`);
  return value as ConfidenceScore;
};

export type SemanticRole =
  | 'navigation'
  | 'button'
  | 'input'
  | 'textarea'
  | 'modal'
  | 'menu'
  | 'table'
  | 'toast'
  | 'file_dropzone'
  | 'unknown';

export interface SelectorCandidate {
  readonly strategy: 'aria' | 'role' | 'text' | 'test_id' | 'css' | 'xpath' | 'semantic_fingerprint';
  readonly value: string;
  readonly confidence: ConfidenceScore;
  readonly lastVerifiedAt?: ISODateTime;
}

export interface VisualPosition {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly zIndex?: number;
}

export interface SemanticElement {
  readonly elementId: string;
  readonly semanticRole: SemanticRole;
  readonly businessMeaning: string;
  readonly selectors: readonly SelectorCandidate[];
  readonly confidence: ConfidenceScore;
  readonly visualPosition?: VisualPosition;
  readonly parentComponent?: string;
  readonly text?: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly relatedActions: readonly string[];
  readonly fingerprint: string;
}

export interface SemanticUIMap {
  readonly applicationId: string;
  readonly pageId: string;
  readonly urlPattern: string;
  readonly extractedAt: ISODateTime;
  readonly elements: readonly SemanticElement[];
  readonly componentGraph: readonly ComponentRelation[];
}

export interface ComponentRelation {
  readonly fromElementId: string;
  readonly toElementId: string;
  readonly relation: 'contains' | 'labels' | 'opens' | 'submits' | 'validates' | 'near';
  readonly confidence: ConfidenceScore;
}

export interface BusinessContext {
  readonly applicationId: string;
  readonly domainTerms: readonly string[];
  readonly businessEvents: readonly BusinessEventDefinition[];
  readonly actionVocabulary: readonly ActionVocabularyEntry[];
}

export interface BusinessEventDefinition {
  readonly eventName: string;
  readonly meaning: string;
  readonly evidenceSignals: readonly EvidenceSignal[];
}

export interface EvidenceSignal {
  readonly kind: 'semantic_element' | 'network' | 'url' | 'storage' | 'database' | 'telemetry';
  readonly name: string;
  readonly expected: string;
  readonly weight: ConfidenceScore;
}

export interface ActionVocabularyEntry {
  readonly phrase: string;
  readonly primitiveName: string;
  readonly requiredTargets: readonly string[];
}

export type FlowNodeKind = 'primitive' | 'assertion' | 'branch' | 'recovery' | 'llm_plan';

export interface FlowNode {
  readonly id: string;
  readonly kind: FlowNodeKind;
  readonly name: string;
  readonly primitive?: string;
  readonly targetBusinessMeaning?: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly assertions: readonly SemanticAssertion[];
}

export interface FlowEdge {
  readonly from: string;
  readonly to: string;
  readonly condition?: string;
}

export interface FlowGraph {
  readonly id: string;
  readonly applicationId: string;
  readonly name: string;
  readonly intentExamples: readonly string[];
  readonly version: number;
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
  readonly entryNodeId: string;
}

export interface ExecutionPlan {
  readonly id: string;
  readonly intent: string;
  readonly applicationId: string;
  readonly flowGraphId: string;
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
  readonly runtimeState: RuntimeState;
}

export interface RuntimeState {
  readonly currentPage?: string;
  readonly currentModal?: string;
  readonly activeWorkflow: string;
  readonly expectedNextState?: string;
  readonly assertions: readonly SemanticAssertion[];
}

export interface SemanticAssertion {
  readonly id: string;
  readonly businessEvent: string;
  readonly requiredConfidence: ConfidenceScore;
  readonly evidenceSignals: readonly EvidenceSignal[];
}

export interface AssertionResult {
  readonly assertionId: string;
  readonly passed: boolean;
  readonly confidence: ConfidenceScore;
  readonly evidence: readonly EvidenceObservation[];
}

export interface EvidenceObservation {
  readonly signalName: string;
  readonly matched: boolean;
  readonly detail: string;
  readonly confidence: ConfidenceScore;
}

export interface ExecutionTraceEvent {
  readonly executionId: string;
  readonly timestamp: ISODateTime;
  readonly nodeId: string;
  readonly type: 'started' | 'selector_resolved' | 'primitive_executed' | 'assertion' | 'retry' | 'recovery' | 'completed' | 'failed';
  readonly message: string;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface EpisodicMemoryRecord {
  readonly id: UUID;
  readonly applicationId: string;
  readonly flowGraphId: string;
  readonly elementId?: string;
  readonly outcome: 'success' | 'failure' | 'recovered';
  readonly failureMode?: 'changed_selector' | 'modal_interference' | 'timing' | 'stale_element' | 'partial_flow';
  readonly recoveryPattern?: string;
  readonly durationMs: number;
  readonly createdAt: ISODateTime;
}

export interface Logger {
  info(message: string, attributes?: Readonly<Record<string, unknown>>): void;
  warn(message: string, attributes?: Readonly<Record<string, unknown>>): void;
  error(message: string, attributes?: Readonly<Record<string, unknown>>): void;
}
