import { confidence } from '../packages/shared-types/src/index.js';
import { SemanticDomProcessor } from '../packages/dom-processor/src/index.js';
import { InMemorySemanticIndex } from '../packages/semantic-engine/src/index.js';
import { FlowMemoryStore } from '../packages/flow-engine/src/index.js';
import { DeterministicExecutionEngine, registerCorePrimitives } from '../packages/execution-primitives/src/index.js';
import { StaticEvidenceProvider, SemanticValidationEngine } from '../packages/validation-engine/src/index.js';

const processor = new SemanticDomProcessor();
const elements = processor.process({
  tagName: 'main',
  attributes: {},
  children: [
    { tagName: 'button', textContent: 'Compose', attributes: { 'aria-label': 'Compose' }, rect: { x: 1, y: 1, width: 90, height: 30 } },
    { tagName: 'input', attributes: { 'aria-label': 'To' }, rect: { x: 1, y: 40, width: 250, height: 30 } },
    { tagName: 'input', attributes: { 'aria-label': 'Attach files', type: 'file' }, rect: { x: 1, y: 80, width: 250, height: 30 } },
    { tagName: 'button', textContent: 'Send', attributes: { 'aria-label': 'Send' }, rect: { x: 1, y: 120, width: 90, height: 30 } }
  ]
}, { applicationVocabulary: { compose: 'compose email', to: 'email recipient', attach: 'email attachment', send: 'send email' }, minConfidence: confidence(0.3) });

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
    { id: 'attach', kind: 'primitive', name: 'Attachment', primitive: 'upload_attachment', targetBusinessMeaning: 'email attachment', inputs: { filePath: '/tmp/report.pdf' }, assertions: [] },
    { id: 'send', kind: 'primitive', name: 'Send', primitive: 'submit_form', targetBusinessMeaning: 'send email', inputs: {}, assertions: [{ id: 'sent', businessEvent: 'email_sent_successfully', requiredConfidence: confidence(0.7), evidenceSignals: [{ kind: 'semantic_element', name: 'sent_toast', expected: 'message sent', weight: confidence(1) }] }] }
  ],
  edges: [{ from: 'compose', to: 'recipient' }, { from: 'recipient', to: 'attach' }, { from: 'attach', to: 'send' }]
});

const plan = flows.createPlan('gmail', 'Send email with attachment in Gmail');
if (plan.nodes.length !== 4) throw new Error('plan was not topologically built');

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
