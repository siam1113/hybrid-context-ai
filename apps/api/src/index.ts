import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { ContextCompilerService, CompilerJob } from '../../context-compiler/src/index.js';
import { createExecutor, InMemoryBrowserDriver } from '../../executor/src/index.js';
import { PlannerService } from '../../planner/src/index.js';
import { FlowMemoryStore, PlanInputOverrides } from '../../../packages/flow-engine/src/index.js';
import { DeterministicExecutionEngine } from '../../../packages/execution-primitives/src/index.js';
import { RawDomElement, SemanticDomProcessor } from '../../../packages/dom-processor/src/index.js';
import { InMemorySemanticIndex } from '../../../packages/semantic-engine/src/index.js';
import { EvidenceObservation, FlowGraph, FlowNode, Logger, SemanticUIMap, confidence } from '../../../packages/shared-types/src/index.js';
import { SemanticValidationEngine, StaticEvidenceProvider } from '../../../packages/validation-engine/src/index.js';
import { demoCompilerJob, demoFlow } from './demo.js';

export interface ExecuteFlowRequest {
  readonly applicationId: string;
  readonly intent: string;
  readonly inputs?: PlanInputOverrides;
  readonly evidence?: Readonly<Record<string, EvidenceObservation>>;
}

export interface ApplicationElementOverview {
  readonly label: string;
  readonly type: 'button' | 'input' | 'textarea' | 'file' | 'status' | 'navigation';
  readonly businessMeaning?: string;
  readonly placeholder?: string;
  readonly testId?: string;
}

export interface ApplicationTestStepOverview {
  readonly action: 'click' | 'fill' | 'upload' | 'assert' | 'wait';
  readonly target: string;
  readonly value?: string;
}

export interface ApplicationTestOverview {
  readonly name: string;
  readonly intent: string;
  readonly steps: readonly ApplicationTestStepOverview[];
}

export interface ApplicationOverviewRequest {
  readonly applicationId: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly pageId?: string;
  readonly overview?: string;
  readonly elements?: readonly ApplicationElementOverview[];
  readonly tests?: readonly ApplicationTestOverview[];
}

export interface ApplicationProfile {
  readonly applicationId: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly pageId: string;
  readonly overview: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlatformServices {
  readonly flows: FlowMemoryStore;
  readonly semantic: InMemorySemanticIndex;
  readonly compiler: ContextCompilerService;
  readonly planner: PlannerService;
  readonly executor: DeterministicExecutionEngine;
  readonly browser: InMemoryBrowserDriver;
  readonly applications: Map<string, ApplicationProfile>;
  readonly logger: Logger;
}

const defaultLogger: Logger = { info() {}, warn() {}, error() {} };

export class ApiServer {
  constructor(private readonly services: PlatformServices) {}

  listen(port: number): void {
    createServer((request, response) => void this.route(request, response)).listen(port);
  }

  async executeFlow(request: ExecuteFlowRequest) {
    const plan = await this.services.planner.createExecutionPlan(request.applicationId, request.intent, request.inputs ?? {});
    this.services.browser.reset();
    const validation = new SemanticValidationEngine(new StaticEvidenceProvider({ ...defaultEvidence(plan), ...(request.evidence ?? {}) }));
    const events = await this.services.executor.execute(plan, {
      semanticIndex: this.services.semantic,
      validation,
      logger: this.services.logger,
      browser: this.services.browser
    });
    return { plan, events, browserActions: [...this.services.browser.actions] };
  }

  async onboardApplication(request: ApplicationOverviewRequest) {
    const now = new Date().toISOString();
    const pageId = sanitizeId(request.pageId ?? 'main');
    const applicationId = sanitizeId(request.applicationId);
    const profile: ApplicationProfile = {
      applicationId,
      name: request.name.trim() || applicationId,
      baseUrl: request.baseUrl.trim() || `https://${applicationId}.example.com`,
      pageId,
      overview: request.overview?.trim() ?? '',
      createdAt: this.services.applications.get(applicationId)?.createdAt ?? now,
      updatedAt: now
    };
    const normalized = normalizeOverview({ ...request, applicationId, pageId, name: profile.name, baseUrl: profile.baseUrl });
    const semanticMap = await this.services.compiler.compile(createCompilerJob(profile, normalized.elements));
    const flows = normalized.tests.map((test) => createFlowGraph(applicationId, test));
    for (const flow of flows) this.services.flows.upsert(flow);
    this.services.applications.set(applicationId, profile);
    return { application: profile, semanticMap, flows };
  }

  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method === 'OPTIONS') return empty(response, 204);
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true });
      if (request.method === 'GET' && url.pathname === '/applications') return json(response, 200, [...this.services.applications.values()]);
      if (request.method === 'POST' && url.pathname === '/applications/overview') return json(response, 201, await this.onboardApplication(await readJson<ApplicationOverviewRequest>(request)));
      if (request.method === 'GET' && url.pathname === '/flows') return json(response, 200, this.services.flows.list(String(url.searchParams.get('applicationId') ?? '') || undefined));
      if (request.method === 'POST' && url.pathname === '/flows') {
        const body = await readJson<FlowGraph>(request);
        this.services.flows.upsert(body);
        return json(response, 201, body);
      }
      if (request.method === 'POST' && url.pathname === '/flows/execute') return json(response, 200, await this.executeFlow(await readJson<ExecuteFlowRequest>(request)));
      if (request.method === 'POST' && url.pathname === '/plans') {
        const body = await readJson<ExecuteFlowRequest>(request);
        return json(response, 201, await this.services.planner.createExecutionPlan(body.applicationId, body.intent, body.inputs ?? {}));
      }
      if (request.method === 'POST' && url.pathname === '/semantic/compile') return json(response, 201, await this.services.compiler.compile(await readJson(request)));
      if (request.method === 'GET' && url.pathname === '/semantic/maps') return json(response, 200, this.services.semantic.list(String(url.searchParams.get('applicationId') ?? '') || undefined));
      if (request.method === 'GET' && url.pathname === '/semantic/query') {
        return json(response, 200, this.services.semantic.query(String(url.searchParams.get('applicationId') ?? ''), { businessMeaning: String(url.searchParams.get('q') ?? '') }));
      }
      return json(response, 404, { error: 'not_found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      return json(response, 500, { error: message });
    }
  }
}

export function createPlatformServices(options: { readonly seedDemo?: boolean } = { seedDemo: true }): PlatformServices {
  const flows = new FlowMemoryStore();
  const semantic = new InMemorySemanticIndex();
  const compiler = new ContextCompilerService(new SemanticDomProcessor(), semantic);
  const planner = new PlannerService(flows);
  const executor = createExecutor();
  const browser = new InMemoryBrowserDriver();
  const applications = new Map<string, ApplicationProfile>();
  const services = { flows, semantic, compiler, planner, executor, browser, applications, logger: defaultLogger };
  if (options.seedDemo ?? true) seedDemoData(services);
  return services;
}

export function createApiServer(options: { readonly seedDemo?: boolean } = { seedDemo: true }): ApiServer {
  return new ApiServer(createPlatformServices(options));
}

export async function seedDemoData(services: Pick<PlatformServices, 'compiler' | 'flows' | 'applications'>): Promise<SemanticUIMap> {
  services.flows.upsert(demoFlow);
  services.applications.set('gmail', { applicationId: 'gmail', name: 'Gmail Demo', baseUrl: 'https://mail.google.com', pageId: 'inbox', overview: 'Demo email workflow for sending an attachment.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  return services.compiler.compile(demoCompilerJob);
}

function defaultEvidence(plan?: { readonly runtimeState: { readonly assertions: readonly { readonly evidenceSignals: readonly { readonly name: string }[] }[] } }): Readonly<Record<string, EvidenceObservation>> {
  const evidence: Record<string, EvidenceObservation> = { sent_toast: { signalName: 'sent_toast', matched: true, detail: 'semantic toast and telemetry matched', confidence: confidence(0.95) } };
  for (const assertion of plan?.runtimeState.assertions ?? []) {
    for (const signal of assertion.evidenceSignals) evidence[signal.name] = { signalName: signal.name, matched: true, detail: 'synthetic validation signal supplied for deterministic UI execution', confidence: confidence(0.9) };
  }
  return evidence;
}

function normalizeOverview(request: ApplicationOverviewRequest & { readonly pageId: string }): { readonly elements: readonly ApplicationElementOverview[]; readonly tests: readonly ApplicationTestOverview[] } {
  const tests = request.tests && request.tests.length > 0 ? request.tests : [{ name: 'Smoke test', intent: `Run smoke test for ${request.name}`, steps: inferStepsFromElements(request.elements ?? []) }];
  const elements = request.elements && request.elements.length > 0 ? request.elements : inferElementsFromTests(tests);
  return { elements, tests };
}

function inferStepsFromElements(elements: readonly ApplicationElementOverview[]): readonly ApplicationTestStepOverview[] {
  const steps = elements.map((element): ApplicationTestStepOverview => {
    const target = element.businessMeaning ?? element.label;
    if (element.type === 'input' || element.type === 'textarea') return { action: 'fill', target, value: sampleValue(target) };
    if (element.type === 'file') return { action: 'upload', target, value: '/tmp/sample-file.pdf' };
    if (element.type === 'status') return { action: 'assert', target };
    return { action: 'click', target };
  });
  return steps.length > 0 ? steps : [{ action: 'wait', target: 'application ready', value: 'application_ready' }];
}

function inferElementsFromTests(tests: readonly ApplicationTestOverview[]): readonly ApplicationElementOverview[] {
  const seen = new Set<string>();
  const elements: ApplicationElementOverview[] = [];
  for (const step of tests.flatMap((test) => test.steps)) {
    const businessMeaning = step.target.trim();
    const key = businessMeaning.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const lower = `${step.action} ${businessMeaning}`.toLowerCase();
    const type: ApplicationElementOverview['type'] = step.action === 'fill' ? (lower.includes('message') || lower.includes('description') ? 'textarea' : 'input') : step.action === 'upload' ? 'file' : step.action === 'assert' ? 'status' : 'button';
    elements.push({ label: titleCase(businessMeaning), type, businessMeaning, placeholder: titleCase(businessMeaning), testId: sanitizeId(businessMeaning) });
  }
  return elements;
}

function createCompilerJob(profile: ApplicationProfile, elements: readonly ApplicationElementOverview[]): CompilerJob {
  const vocabulary = Object.fromEntries(elements.flatMap((element) => {
    const businessMeaning = element.businessMeaning ?? element.label;
    return [[businessMeaning, businessMeaning], [element.label, businessMeaning], [sanitizeId(businessMeaning), businessMeaning]];
  }));
  return { applicationId: profile.applicationId, pageId: profile.pageId, urlPattern: `${profile.baseUrl.replace(/\/$/, '')}/*`, vocabulary, root: { tagName: 'main', attributes: { 'aria-label': profile.name }, children: elements.map((element, index) => domElement(element, index)) } };
}

function domElement(element: ApplicationElementOverview, index: number): RawDomElement {
  const businessMeaning = element.businessMeaning ?? element.label;
  const attributes: Record<string, string> = { 'aria-label': element.label, 'data-testid': element.testId ?? sanitizeId(businessMeaning) };
  const rect = { x: 32, y: 32 + index * 56, width: element.type === 'button' ? 160 : 360, height: element.type === 'textarea' ? 120 : 40 };
  if (element.placeholder) attributes.placeholder = element.placeholder;
  if (element.type === 'textarea') return { tagName: 'textarea', attributes, rect };
  if (element.type === 'input') return { tagName: 'input', attributes, rect };
  if (element.type === 'file') return { tagName: 'input', attributes: { ...attributes, type: 'file' }, rect };
  if (element.type === 'status') return { tagName: 'div', textContent: element.label, attributes: { ...attributes, role: 'status' }, rect };
  return { tagName: 'button', textContent: element.label, attributes, rect };
}

function createFlowGraph(applicationId: string, test: ApplicationTestOverview): FlowGraph {
  const nodes = test.steps.map((step, index) => createFlowNode(step, index));
  const fallback = nodes.length > 0 ? nodes : [createFlowNode({ action: 'wait', target: 'application ready', value: 'application_ready' }, 0)];
  return {
    id: `${applicationId}_${sanitizeId(test.name)}`,
    applicationId,
    name: test.name,
    intentExamples: [test.intent, test.name],
    version: 1,
    entryNodeId: fallback[0]?.id ?? 'step_1',
    nodes: fallback,
    edges: fallback.slice(1).map((node, index) => ({ from: fallback[index]?.id ?? 'step_1', to: node.id }))
  };
}

function createFlowNode(step: ApplicationTestStepOverview, index: number): FlowNode {
  const id = `step_${index + 1}_${sanitizeId(step.target)}`;
  if (step.action === 'assert') {
    const signalName = `${id}_evidence`;
    return { id, kind: 'primitive', name: `Assert ${step.target}`, primitive: 'wait_for_state', targetBusinessMeaning: step.target, inputs: { stateName: step.value ?? signalName, timeoutMs: 5000 }, assertions: [{ id: `${id}_assertion`, businessEvent: `${sanitizeId(step.target)}_observed`, requiredConfidence: confidence(0.7), evidenceSignals: [{ kind: 'semantic_element', name: signalName, expected: step.target, weight: confidence(1) }] }] };
  }
  if (step.action === 'fill') return { id, kind: 'primitive', name: `Fill ${step.target}`, primitive: 'fill_target', targetBusinessMeaning: step.target, inputs: { value: step.value ?? sampleValue(step.target) }, assertions: [] };
  if (step.action === 'upload') return { id, kind: 'primitive', name: `Upload ${step.target}`, primitive: 'upload_file', targetBusinessMeaning: step.target, inputs: { filePath: step.value ?? '/tmp/sample-file.pdf' }, assertions: [] };
  if (step.action === 'wait') return { id, kind: 'primitive', name: `Wait for ${step.target}`, primitive: 'wait_for_state', targetBusinessMeaning: step.target, inputs: { stateName: step.value ?? sanitizeId(step.target), timeoutMs: 5000 }, assertions: [] };
  return { id, kind: 'primitive', name: `Click ${step.target}`, primitive: 'click_target', targetBusinessMeaning: step.target, inputs: {}, assertions: [] };
}

function sampleValue(target: string): string {
  const lower = target.toLowerCase();
  if (lower.includes('email') || lower.includes('recipient')) return 'qa@example.com';
  if (lower.includes('password')) return 'correct-horse-battery-staple';
  if (lower.includes('search')) return 'sample search';
  return `Sample ${target}`;
}

function sanitizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'app';
}

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: unknown[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}
function corsHeaders(contentType?: string): Record<string, string> {
  return {
    ...(contentType ? { 'content-type': contentType } : {}),
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}
function empty(response: ServerResponse, status: number): void { response.writeHead(status, corsHeaders()); response.end(); }
function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, corsHeaders('application/json'));
  response.end(JSON.stringify(body));
}
