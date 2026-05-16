'use client';

import { useMemo, useState } from 'react';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

const starterElements = [
  { label: 'Login email', type: 'input', businessMeaning: 'login email', placeholder: 'user@example.com' },
  { label: 'Password', type: 'input', businessMeaning: 'account password', placeholder: 'password' },
  { label: 'Sign in', type: 'button', businessMeaning: 'submit login' },
  { label: 'Dashboard loaded', type: 'status', businessMeaning: 'dashboard loaded' }
];

const starterSteps = [
  { action: 'fill', target: 'login email', value: 'qa@example.com' },
  { action: 'fill', target: 'account password', value: 'correct-horse-battery-staple' },
  { action: 'click', target: 'submit login' },
  { action: 'assert', target: 'dashboard loaded' }
];

export default function DashboardPage() {
  const [applicationId, setApplicationId] = useState('acme_portal');
  const [name, setName] = useState('Acme Portal');
  const [baseUrl, setBaseUrl] = useState('https://app.acme.test');
  const [overview, setOverview] = useState('Customer operations portal used by support agents to sign in, search accounts, and verify dashboard health.');
  const [testName, setTestName] = useState('Agent login smoke test');
  const [intent, setIntent] = useState('Verify an agent can sign in and see the dashboard');
  const [elements, setElements] = useState(starterElements);
  const [steps, setSteps] = useState(starterSteps);
  const [selectedIntent, setSelectedIntent] = useState('Verify an agent can sign in and see the dashboard');
  const [onboarded, setOnboarded] = useState(null);
  const [execution, setExecution] = useState(null);
  const [status, setStatus] = useState('Ready to compile application context.');
  const [error, setError] = useState(null);

  const semanticHealth = useMemo(() => {
    if (!onboarded) return { label: 'Waiting for context', value: 0 };
    const count = onboarded.semanticMap.elements.length;
    const avg = count === 0 ? 0 : onboarded.semanticMap.elements.reduce((sum, element) => sum + Number(element.confidence), 0) / count;
    return { label: `${count} semantic elements`, value: Math.round(avg * 100) };
  }, [onboarded]);

  async function onboard(event) {
    event.preventDefault();
    setError(null);
    setExecution(null);
    setStatus('Compiling semantic map and deterministic test flow...');
    try {
      const response = await fetch(`${apiBaseUrl}/applications/overview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ applicationId, name, baseUrl, overview, elements, tests: [{ name: testName, intent, steps }] })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Failed to onboard application');
      setOnboarded(payload);
      setSelectedIntent(payload.flows[0]?.intentExamples[0] ?? intent);
      setStatus('Application context compiled. You can now run the test from the UI.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unknown onboarding error');
      setStatus('Onboarding failed.');
    }
  }

  async function runTest() {
    setError(null);
    setStatus('Executing deterministic browser primitives via API...');
    try {
      const response = await fetch(`${apiBaseUrl}/flows/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ applicationId, intent: selectedIntent })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Failed to execute flow');
      setExecution(payload);
      setStatus('Execution completed. Review trace events, browser actions, and selectors below.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unknown execution error');
      setStatus('Execution failed.');
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#164e63,transparent_34%),#020617] p-6 text-slate-100 md:p-10">
      <section className="mx-auto max-w-7xl space-y-8">
        <header className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Production QA Control Plane</p>
            <h1 className="mt-3 text-4xl font-semibold md:text-6xl">Share an app overview, compile context, and run UI tests.</h1>
            <p className="mt-5 max-w-3xl text-lg text-slate-300">The dashboard now connects to the API to turn application details into semantic UI memory, deterministic flow graphs, execution traces, selector telemetry, and browser action replay.</p>
          </div>
          <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-5 shadow-2xl shadow-cyan-950/40">
            <p className="text-sm text-cyan-200">API endpoint</p>
            <p className="mt-2 break-all font-mono text-sm text-white">{apiBaseUrl}</p>
            <p className="mt-4 text-sm text-slate-300">{status}</p>
            {error ? <p className="mt-3 rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Semantic confidence" value={`${semanticHealth.value}%`} detail={semanticHealth.label} />
          <Metric label="Flows compiled" value={String(onboarded?.flows.length ?? 0)} detail="Ready for API execution" />
          <Metric label="Trace events" value={String(execution?.events.length ?? 0)} detail="Latest run" />
          <Metric label="Browser actions" value={String(execution?.browserActions.length ?? 0)} detail="Deterministic replay" />
        </div>

        <form onSubmit={onboard} className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="panel space-y-5">
            <div>
              <p className="eyebrow">Application overview</p>
              <h2 className="section-title">Tell the platform what you are testing</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Application ID" value={applicationId} onChange={setApplicationId} />
              <Field label="Display name" value={name} onChange={setName} />
            </div>
            <Field label="Base URL" value={baseUrl} onChange={setBaseUrl} />
            <label className="block text-sm text-slate-300">Overview
              <textarea className="field mt-2 min-h-32" value={overview} onChange={(event) => setOverview(event.target.value)} />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Test name" value={testName} onChange={setTestName} />
              <Field label="Natural-language intent" value={intent} onChange={setIntent} />
            </div>
            <button className="primary-button" type="submit">Compile application context</button>
          </section>

          <section className="panel space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Test model</p>
                <h2 className="section-title">Elements and steps</h2>
              </div>
              <button className="secondary-button" type="button" onClick={() => { setElements([...elements, { label: 'New control', type: 'button', businessMeaning: 'new control' }]); setSteps([...steps, { action: 'click', target: 'new control' }]); }}>Add step</button>
            </div>
            <div className="space-y-3">
              {elements.map((element, index) => (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4" key={`${element.businessMeaning}-${index}`}>
                  <div className="grid gap-3 md:grid-cols-[1fr_0.7fr_1fr]">
                    <input className="field" value={element.label} onChange={(event) => updateElement(index, { label: event.target.value })} aria-label={`Element ${index + 1} label`} />
                    <select className="field" value={element.type} onChange={(event) => updateElement(index, { type: event.target.value })} aria-label={`Element ${index + 1} type`}>
                      {['button', 'input', 'textarea', 'file', 'status', 'navigation'].map((type) => <option key={type}>{type}</option>)}
                    </select>
                    <input className="field" value={element.businessMeaning} onChange={(event) => updateElement(index, { businessMeaning: event.target.value })} aria-label={`Element ${index + 1} business meaning`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[0.6fr_1fr_1fr]" key={`${step.target}-${index}`}>
                  <select className="field" value={step.action} onChange={(event) => updateStep(index, { action: event.target.value })} aria-label={`Step ${index + 1} action`}>
                    {['fill', 'click', 'upload', 'assert', 'wait'].map((action) => <option key={action}>{action}</option>)}
                  </select>
                  <input className="field" value={step.target} onChange={(event) => updateStep(index, { target: event.target.value })} aria-label={`Step ${index + 1} target`} />
                  <input className="field" value={step.value ?? ''} onChange={(event) => updateStep(index, { value: event.target.value })} placeholder="Optional value" aria-label={`Step ${index + 1} value`} />
                </div>
              ))}
            </div>
          </section>
        </form>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <article className="panel space-y-4">
            <p className="eyebrow">Run center</p>
            <h2 className="section-title">Execute any compiled test</h2>
            <select className="field" value={selectedIntent} onChange={(event) => setSelectedIntent(event.target.value)}>
              {(onboarded?.flows ?? []).map((flow) => <option key={flow.id} value={flow.intentExamples[0]}>{flow.name}</option>)}
              {!onboarded ? <option>{intent}</option> : null}
            </select>
            <button className="primary-button" type="button" onClick={runTest} disabled={!onboarded}>Run test via API</button>
            <div className="rounded-2xl bg-slate-950/70 p-4">
              <p className="text-sm font-medium text-slate-200">Compiled flow</p>
              <ol className="mt-3 space-y-2 text-sm text-slate-300">
                {(onboarded?.flows[0]?.nodes ?? []).map((node) => <li key={node.id}>• {node.name} <span className="text-cyan-300">{node.primitive}</span></li>)}
              </ol>
            </div>
          </article>

          <article className="panel space-y-4">
            <p className="eyebrow">Live execution monitor</p>
            <h2 className="section-title">Trace, replay, and selector evidence</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <ResultList title="Trace events" empty="Run a test to see execution events." items={(execution?.events ?? []).map((event) => `${event.type} · ${event.nodeId} · ${event.message}`)} />
              <ResultList title="Browser actions" empty="No browser actions yet." items={execution?.browserActions ?? []} />
            </div>
            <ResultList title="Semantic selectors" empty="Compile context to inspect selector candidates." items={(onboarded?.semanticMap.elements ?? []).map((element) => `${element.businessMeaning} · ${element.semanticRole} · ${element.selectors[0]?.strategy}:${element.selectors[0]?.value}`)} />
          </article>
        </section>
      </section>
    </main>
  );

  function updateElement(index, patch) {
    setElements(elements.map((element, current) => current === index ? { ...element, ...patch } : element));
  }

  function updateStep(index, patch) {
    setSteps(steps.map((step, current) => current === index ? { ...step, ...patch } : step));
  }
}

function Metric({ label, value, detail }) {
  return <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-semibold text-white">{value}</p><p className="mt-1 text-xs text-cyan-200">{detail}</p></article>;
}

function Field({ label, value, onChange }) {
  return <label className="block text-sm text-slate-300">{label}<input className="field mt-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ResultList({ title, empty, items }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"><p className="text-sm font-medium text-slate-200">{title}</p>{items.length === 0 ? <p className="mt-3 text-sm text-slate-500">{empty}</p> : <ul className="mt-3 max-h-72 space-y-2 overflow-auto text-sm text-slate-300">{items.map((item, index) => <li className="rounded-xl bg-slate-900/80 p-3 font-mono text-xs" key={`${item}-${index}`}>{item}</li>)}</ul>}</div>;
}
