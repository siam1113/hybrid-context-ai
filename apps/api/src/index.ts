import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { ContextCompilerService } from '../../context-compiler/src/index.js';
import { createExecutor, InMemoryBrowserDriver } from '../../executor/src/index.js';
import { PlannerService } from '../../planner/src/index.js';
import { FlowMemoryStore, PlanInputOverrides } from '../../../packages/flow-engine/src/index.js';
import { DeterministicExecutionEngine } from '../../../packages/execution-primitives/src/index.js';
import { SemanticDomProcessor } from '../../../packages/dom-processor/src/index.js';
import { InMemorySemanticIndex } from '../../../packages/semantic-engine/src/index.js';
import { EvidenceObservation, FlowGraph, Logger, SemanticUIMap, confidence } from '../../../packages/shared-types/src/index.js';
import { SemanticValidationEngine, StaticEvidenceProvider } from '../../../packages/validation-engine/src/index.js';
import { demoCompilerJob, demoFlow } from './demo.js';

export interface ExecuteFlowRequest {
  readonly applicationId: string;
  readonly intent: string;
  readonly inputs?: PlanInputOverrides;
  readonly evidence?: Readonly<Record<string, EvidenceObservation>>;
}

export interface PlatformServices {
  readonly flows: FlowMemoryStore;
  readonly semantic: InMemorySemanticIndex;
  readonly compiler: ContextCompilerService;
  readonly planner: PlannerService;
  readonly executor: DeterministicExecutionEngine;
  readonly browser: InMemoryBrowserDriver;
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
    const validation = new SemanticValidationEngine(new StaticEvidenceProvider({ ...defaultEvidence(), ...(request.evidence ?? {}) }));
    const events = await this.services.executor.execute(plan, {
      semanticIndex: this.services.semantic,
      validation,
      logger: this.services.logger,
      browser: this.services.browser
    });
    return { plan, events, browserActions: [...this.services.browser.actions] };
  }

  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true });
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
  const services = { flows, semantic, compiler, planner, executor, browser, logger: defaultLogger };
  if (options.seedDemo ?? true) seedDemoData(services);
  return services;
}

export function createApiServer(options: { readonly seedDemo?: boolean } = { seedDemo: true }): ApiServer {
  return new ApiServer(createPlatformServices(options));
}

export async function seedDemoData(services: Pick<PlatformServices, 'compiler' | 'flows'>): Promise<SemanticUIMap> {
  services.flows.upsert(demoFlow);
  return services.compiler.compile(demoCompilerJob);
}

function defaultEvidence(): Readonly<Record<string, EvidenceObservation>> {
  return { sent_toast: { signalName: 'sent_toast', matched: true, detail: 'semantic toast and telemetry matched', confidence: confidence(0.95) } };
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: unknown[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}
function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}
