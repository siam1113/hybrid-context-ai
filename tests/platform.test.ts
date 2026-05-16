import { confidence } from '../packages/shared-types/src/index.js';
import { SemanticDomProcessor } from '../packages/dom-processor/src/index.js';
import { InMemorySemanticIndex } from '../packages/semantic-engine/src/index.js';
import { FlowMemoryStore } from '../packages/flow-engine/src/index.js';
import { DeterministicExecutionEngine, registerCorePrimitives } from '../packages/execution-primitives/src/index.js';
import { StaticEvidenceProvider, SemanticValidationEngine } from '../packages/validation-engine/src/index.js';
import { createApiServer, createPlatformServices } from '../apps/api/src/index.js';

const processor = new SemanticDomProcessor();
const elements = processor.process({
  tagName: 'main',
  attributes: {},
  children: [
    { tagName: 'button', textContent: 'Compose', attributes: { 'aria-label': 'Compose' }, rect: { x: 1, y: 1, width: 90, height: 30 } },
    { tagName: 'input', attributes: { 'aria-label': 'To' }, rect: { x: 1, y: 40, width: 250, height: 30 } },
    { tagName: 'input', attributes: { 'aria-label': 'Subject' }, rect: { x: 1, y: 80, width: 250, height: 30 } },
    { tagName: 'textarea', attributes: { 'aria-label': 'Message Body' }, rect: { x: 1, y: 120, width: 250, height: 90 } },
    { tagName: 'input', attributes: { 'aria-label': 'Attach files', type: 'file' }, rect: { x: 1, y: 220, width: 250, height: 30 } },
    { tagName: 'button', textContent: 'Send', attributes: { 'aria-label': 'Send' }, rect: { x: 1, y: 260, width: 90, height: 30 } }
  ]
}, { applicationVocabulary: { compose: 'compose email', to: 'email recipient', subject: 'email subject', message: 'email body', attach: 'email attachment', send: 'send email' }, minConfidence: confidence(0.3) });

if (!elements.some((element) => element.businessMeaning === 'compose email')) throw new Error('compose semantic element was not extracted');

const semantic = new InMemorySemanticIndex();
semantic.upsert({ applicationId: 'gmail', pageId: 'inbox', urlPattern: 'https://mail.google.com/*', extractedAt: new Date().toISOString(), elements, componentGraph: [] });
if (semantic.resolveTarget('gmail', 'email recipient').semanticRole !== 'input') throw new Error('recipient target did not resolve');

const flows = new FlowMemoryStore();
flows.upsert({
  id: 'gmail_send_attachment', applicationId: 'gmail', name: 'Send email with attachment', intentExamples: ['Send email with attachment in Gmail'], version: 1, entryNodeId: 'compose',
  nodes: [
    { id: 'compose', kind: 'primitive', name: 'Open compose', primitive: 'open_compose_modal', targetBusinessMeaning: 'compose email', inputs: {}, assertions: [] },
    { id: 'recipient', kind: 'primitive', name: 'Recipient', primitive: 'fill_email_recipient', targetBusinessMeaning: 'email recipient', inputs: { recipient: 'qa@example.com' }, assertions: [] },
    { id: 'subject', kind: 'primitive', name: 'Subject', primitive: 'fill_email_subject', targetBusinessMeaning: 'email subject', inputs: { subject: 'QA report' }, assertions: [] },
    { id: 'body', kind: 'primitive', name: 'Body', primitive: 'fill_email_body', targetBusinessMeaning: 'email body', inputs: { body: 'Attached report.' }, assertions: [] },
    { id: 'attach', kind: 'primitive', name: 'Attachment', primitive: 'upload_attachment', targetBusinessMeaning: 'email attachment', inputs: { filePath: '/tmp/report.pdf' }, assertions: [] },
    { id: 'send', kind: 'primitive', name: 'Send', primitive: 'submit_form', targetBusinessMeaning: 'send email', inputs: {}, assertions: [{ id: 'sent', businessEvent: 'email_sent_successfully', requiredConfidence: confidence(0.7), evidenceSignals: [{ kind: 'semantic_element', name: 'sent_toast', expected: 'message sent', weight: confidence(1) }] }] }
  ],
  edges: [{ from: 'compose', to: 'recipient' }, { from: 'recipient', to: 'subject' }, { from: 'subject', to: 'body' }, { from: 'body', to: 'attach' }, { from: 'attach', to: 'send' }]
});

const plan = flows.createPlan('gmail', 'Send email with attachment in Gmail');
if (plan.nodes.length !== 6) throw new Error('plan was not topologically built');

const actions: string[] = [];
const executor = new DeterministicExecutionEngine();
registerCorePrimitives(executor);
const validation = new SemanticValidationEngine(new StaticEvidenceProvider({ sent_toast: { signalName: 'sent_toast', matched: true, detail: 'semantic toast and telemetry matched', confidence: confidence(0.95) } }));
const events = await executor.execute(plan, {
  semanticIndex: semantic,
  validation,
  logger: { info() {}, warn() {}, error() {} },
  browser: {
    async goto(url: string) { actions.push(`goto:${url}`); },
    async click(selector: string) { actions.push(`click:${selector}`); },
    async fill(selector: string, value: string) { actions.push(`fill:${selector}:${value}`); },
    async setInputFiles(selector: string, filePath: string) { actions.push(`file:${selector}:${filePath}`); },
    async waitForSemanticState(name: string) { actions.push(`wait:${name}`); }
  }
});
if (!events.some((event) => event.type === 'completed')) throw new Error('execution did not complete');
if (!actions.some((action) => action.startsWith('file:'))) throw new Error('attachment primitive was not executed');

const services = createPlatformServices();
if (services.flows.list('gmail').length !== 1) throw new Error('demo flow was not seeded');
if (services.semantic.list('gmail').length !== 1) throw new Error('demo semantic map was not seeded');

const api = createApiServer();
const result = await api.executeFlow({ applicationId: 'gmail', intent: 'Email a report with a file attached', inputs: { recipient: { recipient: 'ops@example.com' }, attach: { filePath: '/tmp/ops.pdf' } } });
if (!result.events.some((event) => event.type === 'completed')) throw new Error('api execution did not complete');
if (!result.browserActions.some((action) => action === 'fill:[aria-label="To recipients"]:ops@example.com')) throw new Error('api did not apply recipient input override');
if (!result.browserActions.some((action) => action === 'file:[aria-label="Attach files"]:/tmp/ops.pdf')) throw new Error('api did not apply attachment input override');

const customServices = createPlatformServices({ seedDemo: false });
const customApi = createApiServer({ seedDemo: false });
const onboarded = await customApi.onboardApplication({
  applicationId: 'acme_portal',
  name: 'Acme Portal',
  baseUrl: 'https://app.acme.test',
  overview: 'Support portal login smoke test.',
  elements: [
    { label: 'Login email', type: 'input', businessMeaning: 'login email' },
    { label: 'Password', type: 'input', businessMeaning: 'account password' },
    { label: 'Sign in', type: 'button', businessMeaning: 'submit login' },
    { label: 'Dashboard loaded', type: 'status', businessMeaning: 'dashboard loaded' }
  ],
  tests: [{
    name: 'Agent login smoke test',
    intent: 'Verify an agent can sign in and see the dashboard',
    steps: [
      { action: 'fill', target: 'login email', value: 'qa@example.com' },
      { action: 'fill', target: 'account password', value: 'correct-horse-battery-staple' },
      { action: 'click', target: 'submit login' },
      { action: 'assert', target: 'dashboard loaded' }
    ]
  }]
});
if (onboarded.semanticMap.elements.length < 4) throw new Error('application overview did not compile semantic elements');
if (onboarded.flows[0]?.nodes.length !== 4) throw new Error('application overview did not compile flow nodes');
const customExecution = await customApi.executeFlow({ applicationId: 'acme_portal', intent: 'Verify an agent can sign in and see the dashboard' });
if (!customExecution.events.some((event) => event.type === 'completed')) throw new Error('custom UI flow did not complete');
if (!customExecution.browserActions.some((action) => action.includes('qa@example.com'))) throw new Error('custom UI flow did not fill provided email');
if (customServices.flows.list().length !== 0) throw new Error('seed false services should not include demo data');
