import { CompilerJob } from '../../context-compiler/src/index.js';
import { FlowGraph, confidence } from '../../../packages/shared-types/src/index.js';

export const demoCompilerJob: CompilerJob = {
  applicationId: 'gmail',
  pageId: 'inbox',
  urlPattern: 'https://mail.google.com/*',
  vocabulary: {
    compose: 'compose email',
    to: 'email recipient',
    recipient: 'email recipient',
    subject: 'email subject',
    message: 'email body',
    attach: 'email attachment',
    send: 'send email',
    sent: 'message sent'
  },
  root: {
    tagName: 'main',
    attributes: {},
    children: [
      { tagName: 'button', textContent: 'Compose', attributes: { 'aria-label': 'Compose', 'data-testid': 'compose-button' }, rect: { x: 24, y: 24, width: 120, height: 44 } },
      { tagName: 'div', attributes: { role: 'dialog', 'aria-label': 'New Message modal' }, children: [
        { tagName: 'input', attributes: { 'aria-label': 'To recipients', placeholder: 'Recipients' }, rect: { x: 460, y: 320, width: 420, height: 32 } },
        { tagName: 'input', attributes: { 'aria-label': 'Subject', placeholder: 'Subject' }, rect: { x: 460, y: 360, width: 420, height: 32 } },
        { tagName: 'textarea', attributes: { 'aria-label': 'Message Body' }, rect: { x: 460, y: 400, width: 420, height: 180 } },
        { tagName: 'input', attributes: { 'aria-label': 'Attach files', type: 'file' }, rect: { x: 470, y: 604, width: 80, height: 32 } },
        { tagName: 'button', textContent: 'Send', attributes: { 'aria-label': 'Send' }, rect: { x: 810, y: 604, width: 72, height: 32 } }
      ] },
      { tagName: 'div', textContent: 'Message sent', attributes: { role: 'status', 'aria-label': 'Message sent' }, rect: { x: 24, y: 720, width: 240, height: 48 } }
    ]
  }
};

export const demoFlow: FlowGraph = {
  id: 'gmail_send_attachment',
  applicationId: 'gmail',
  name: 'Send email with attachment',
  intentExamples: ['Send email with attachment in Gmail', 'Email a report with a file attached', 'Compose and send an attachment'],
  version: 1,
  entryNodeId: 'compose',
  nodes: [
    { id: 'compose', kind: 'primitive', name: 'Open compose', primitive: 'open_compose_modal', targetBusinessMeaning: 'compose email', inputs: {}, assertions: [] },
    { id: 'recipient', kind: 'primitive', name: 'Recipient', primitive: 'fill_email_recipient', targetBusinessMeaning: 'email recipient', inputs: { recipient: 'qa@example.com' }, assertions: [] },
    { id: 'subject', kind: 'primitive', name: 'Subject', primitive: 'fill_email_subject', targetBusinessMeaning: 'email subject', inputs: { subject: 'QA report' }, assertions: [] },
    { id: 'body', kind: 'primitive', name: 'Body', primitive: 'fill_email_body', targetBusinessMeaning: 'email body', inputs: { body: 'Attached is the latest QA report.' }, assertions: [] },
    { id: 'attach', kind: 'primitive', name: 'Attachment', primitive: 'upload_attachment', targetBusinessMeaning: 'email attachment', inputs: { filePath: '/tmp/report.pdf' }, assertions: [] },
    { id: 'send', kind: 'primitive', name: 'Send', primitive: 'submit_form', targetBusinessMeaning: 'send email', inputs: {}, assertions: [{ id: 'sent', businessEvent: 'email_sent_successfully', requiredConfidence: confidence(0.7), evidenceSignals: [{ kind: 'semantic_element', name: 'sent_toast', expected: 'message sent', weight: confidence(1) }] }] }
  ],
  edges: [
    { from: 'compose', to: 'recipient' },
    { from: 'recipient', to: 'subject' },
    { from: 'subject', to: 'body' },
    { from: 'body', to: 'attach' },
    { from: 'attach', to: 'send' }
  ]
};
