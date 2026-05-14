import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { FlowMemoryStore } from '../../../packages/flow-engine/src/index.js';
import { InMemorySemanticIndex } from '../../../packages/semantic-engine/src/index.js';

export class ApiServer {
  constructor(private readonly flows: FlowMemoryStore, private readonly semantic: InMemorySemanticIndex) {}
  listen(port: number): void {
    createServer((request, response) => void this.route(request, response)).listen(port);
  }
  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true });
    if (request.method === 'POST' && url.pathname === '/flows/execute') {
      const body = await readJson<{ applicationId: string; intent: string }>(request);
      return json(response, 202, this.flows.createPlan(body.applicationId, body.intent));
    }
    if (request.method === 'GET' && url.pathname === '/semantic/query') {
      return json(response, 200, this.semantic.query(String(url.searchParams.get('applicationId') ?? ''), { businessMeaning: String(url.searchParams.get('q') ?? '') }));
    }
    return json(response, 404, { error: 'not_found' });
  }
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
