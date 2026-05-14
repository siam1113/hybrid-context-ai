const panels = [
  'Live Execution Monitor',
  'Semantic UI Explorer',
  'Flow Graph Visualizer',
  'Memory Graph Viewer',
  'Execution Replay',
  'Flaky Element Analysis',
  'Selector Confidence Viewer'
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <section className="mx-auto max-w-7xl space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Application Operational Intelligence</p>
          <h1 className="mt-3 text-4xl font-semibold">Hybrid Context-Compiled QA Control Plane</h1>
          <p className="mt-4 max-w-3xl text-slate-300">Monitor deterministic executions, inspect compiled semantic memory, replay failures, and promote self-healing recovery patterns without running a pure LLM browser loop.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {panels.map((panel) => <article key={panel} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl"><h2 className="text-lg font-medium">{panel}</h2><p className="mt-2 text-sm text-slate-400">Connected to API endpoints for traces, semantic maps, flow DAGs, and episodic learning signals.</p></article>)}
        </div>
      </section>
    </main>
  );
}
