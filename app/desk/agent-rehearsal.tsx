'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CircleAlert,
  Download,
  LoaderCircle,
  RefreshCw,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Workspace, Request } from '@/lib/desk';
import type { Probe } from '@/lib/probe';

type Props = {
  workspace: Workspace;
  endpoint?: string;
  demo?: boolean;
  onPrepare: (request: Request) => void;
  onPolicy: () => void;
};
type AgentClient = { close: () => Promise<void> };
export function AgentRehearsal({
  workspace,
  onPrepare,
  onPolicy,
  endpoint,
  demo = false,
}: Props) {
  const [request, setRequest] = useState<Request>({
    action: 'checkout',
    kit: workspace.data.kits[0]?.id || '',
    requestedKit: workspace.data.kits[0]?.id || '',
    borrower: workspace.data.borrowers[0]?.id || '',
    confirmed: false,
  });
  const [report, setReport] = useState<Probe | null>(null);
  const [previousReport, setPreviousReport] = useState<Probe | null>(null);
  const [revisionNotice, setRevisionNotice] = useState('');
  const [selected, setSelected] = useState('');
  const [trace, setTrace] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0),
    connection = useRef<AgentClient | null>(null);
  const currentReport = useRef(report);
  useEffect(() => { currentReport.current = report; }, [report]);
  const lastWorkspace = useRef({ id: workspace.id, revision: workspace.revision });
  useEffect(() => {
    const previous = lastWorkspace.current;
    lastWorkspace.current = { id: workspace.id, revision: workspace.revision };
    if (previous.id === workspace.id && previous.revision === workspace.revision)
      return;
    // A changed instruction must invalidate even a check still in flight.
    generation.current += 1;
    void connection.current?.close().catch(() => {});
    connection.current = null;
    setBusy(false);
    setPreviousReport(previous.id === workspace.id ? currentReport.current : null);
    setReport(null);
    setTrace([]);
    setError('');
    setRevisionNotice(
      workspace.data.kits.some((item) => item.id === request.kit) &&
      workspace.data.borrowers.some((item) => item.id === request.borrower)
        ? 'The desk changed. Your request is still selected. Run it again against the current instruction.'
        : 'The desk changed. Some selected records are unavailable. Choose current equipment and a borrower before running again.',
    );
  }, [
    workspace.id,
    workspace.revision,
    workspace.data.kits,
    workspace.data.borrowers,
    request.kit,
    request.borrower,
  ]);
  useEffect(
    () => () => {
      generation.current += 1;
      void connection.current?.close().catch(() => {});
    },
    [],
  );
  const kit = workspace.data.kits.find((k) => k.id === request.kit);
  const borrower = workspace.data.borrowers.find(
    (b) => b.id === request.borrower,
  );
  const stale =
    report &&
    (report.workspaceId !== workspace.id ||
      report.revision !== workspace.revision);
  const contrast =
    report?.contrasts.find((c) => c.id === selected) || report?.contrasts[0];
  const sameRequest = previousReport && report &&
    previousReport.request.action === report.request.action &&
    previousReport.request.borrower === report.request.borrower &&
    previousReport.request.kit === report.request.kit &&
    previousReport.request.requestedKit === report.request.requestedKit &&
    previousReport.request.confirmed === report.request.confirmed &&
    previousReport.request.component === report.request.component;
  function update(patch: Partial<Request>) {
    setRequest((old) => ({ ...old, ...patch }));
    setReport(null);
    setPreviousReport(null);
    setRevisionNotice('');
    setTrace([]);
    setError('');
  }
  async function run() {
    if (busy || !kit || !borrower) return;
    const runId = ++generation.current;
    setBusy(true);
    setError('');
    setReport(null);
    setTrace([]);
    let client: AgentClient | undefined;
    try {
      const { DeskToolClient } = await import('@/lib/mcp-browser');
      if (runId !== generation.current) return;
      const url = new URL(endpoint || '/api/mcp', window.location.origin);
      if (!demo) url.searchParams.set('workspace', workspace.id);
      const session = new DeskToolClient(url);
      client = session;
      connection.current = session;
      await session.connect();
      if (runId !== generation.current) return;
      setTrace([
        demo
          ? 'Connected to the fictional demonstration’s MCP tools.'
          : 'Connected to this workspace’s desk tools.',
      ]);
      const tools = await session.listTools();
      if (!tools.tools.some((tool) => tool.name === 'probe_request'))
        throw new Error(
          'The rehearsal tool is unavailable. Refresh and try again.',
        );
      const inspected = await session.callTool({
        name: 'inspect_desk',
        arguments: { kit: request.kit, borrower: request.borrower },
      });
      if (inspected.isError)
        throw new Error(
          'The selected records could not be checked. Refresh the workspace.',
        );
      if (runId !== generation.current) return;
      setTrace((old) => [
        ...old,
        demo
          ? 'Read the fictional borrower, equipment and demo policy.'
          : 'Read the saved borrower, equipment and approved policy.',
      ]);
      const response = await session.callTool({
        name: 'probe_request',
        arguments: { request },
      });
      if (response.isError || !response.structuredContent)
        throw new Error(
          'The desk could not rehearse this request. Check its equipment and borrower.',
        );
      const probe = response.structuredContent as unknown as Probe;
      if (
        probe.workspaceId !== workspace.id ||
        probe.revision !== inspected.structuredContent?.revision
      )
        throw new Error(
          'The desk changed during this check. Run the rehearsal again.',
        );
      if (runId !== generation.current) return;
      setReport(probe);
      setRevisionNotice('');
      setSelected(
        probe.contrasts.find((c) => c.decision.kind === 'gap')?.id ||
          probe.contrasts.find((c) => c.changedOutcome)?.id ||
          probe.contrasts[0]?.id ||
          '',
      );
      setTrace((old) => [
        ...old,
        `Evaluated the request and ${probe.contrasts.length} separate changes.`,
        'Finished without changing inventory or policy.',
      ]);
    } catch (failure) {
      if (runId === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'The rehearsal could not finish. Try again.',
        );
    } finally {
      await client?.close().catch(() => {});
      if (runId === generation.current) {
        connection.current = null;
        setBusy(false);
      }
    }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              ...report,
              provenance: demo
                ? 'Fictional demo records and hypothetical one-fact changes. No private records, observed counterfactuals or LLM interpretation.'
                : 'Operator records and hypothetical one-fact changes. No observed counterfactuals or LLM interpretation.',
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'understudy-rehearsal.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="agent-rehearsal" aria-label="Agent rehearsal">
      <div className="agent-heading-row">
        <p className="agent-intro">
          Give your substitute a real request. See which facts it checks, then
          test the instruction by changing one thing.
        </p>
        <span className="agent-readonly">
          <Check size={14} /> Read-only rehearsal
        </span>
      </div>
      <div className="agent-columns">
        <form
          className="agent-request"
          onSubmit={(event) => {
            event.preventDefault();
            void run();
          }}
        >
          <h2>The next request</h2>
          {revisionNotice && (
            <output className="agent-revision-notice">
              <RefreshCw size={17} /> {revisionNotice}
            </output>
          )}
          <fieldset disabled={busy}>
            <legend className="sr-only">Choose a request to rehearse</legend>
            <label>
              Action
              <select
                aria-label="Agent action"
                value={request.action}
                onChange={(event) =>
                  update({
                    action: event.target.value as Request['action'],
                    component: kit?.components[0],
                  })
                }
              >
                <option value="checkout">Check out equipment</option>
                <option value="renew">Renew a loan</option>
                <option value="return">Return a component</option>
              </select>
            </label>
            <label>
              Borrower
              <select
                aria-label="Agent borrower"
                value={request.borrower}
                onChange={(event) => update({ borrower: event.target.value })}
              >
                {!workspace.data.borrowers.length && (
                  <option value="">Add a borrower first</option>
                )}
                {!!workspace.data.borrowers.length && !borrower && (
                  <option value={request.borrower} disabled>
                    Choose a current borrower
                  </option>
                )}
                {workspace.data.borrowers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.archived ? ' · Archived' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Equipment
              <select
                aria-label="Agent equipment"
                value={request.kit}
                onChange={(event) => {
                  const target = workspace.data.kits.find(
                    (k) => k.id === event.target.value,
                  );
                  update({
                    kit: event.target.value,
                    component: target?.components[0],
                  });
                }}
              >
                {!workspace.data.kits.length && (
                  <option value="">Add equipment first</option>
                )}
                {!!workspace.data.kits.length && !kit && (
                  <option value={request.kit} disabled>
                    Choose current equipment
                  </option>
                )}
                {workspace.data.kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                    {k.archived ? ' · Archived' : ''}
                  </option>
                ))}
              </select>
            </label>
            {request.action === 'checkout' && (
              <>
                <label>
                  Originally requested
                  <select
                    aria-label="Agent originally requested"
                    value={request.requestedKit}
                    onChange={(event) =>
                      update({ requestedKit: event.target.value })
                    }
                  >
                    {workspace.data.kits.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="agent-check">
                  <input
                    type="checkbox"
                    checked={request.confirmed}
                    onChange={(event) =>
                      update({ confirmed: event.target.checked })
                    }
                  />
                  Borrower confirmed a substitute
                </label>
              </>
            )}
            {request.action === 'return' && (
              <label>
                Component
                <select
                  aria-label="Agent component"
                  value={request.component || kit?.components[0] || ''}
                  onChange={(event) =>
                    update({ component: event.target.value })
                  }
                >
                  {kit?.components.map((part) => (
                    <option key={part}>{part}</option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>
          {(!kit || !borrower) && (
            <p className="agent-note">
              {!kit && !borrower
                ? 'The selected equipment and borrower are unavailable.'
                : !kit
                  ? 'The selected equipment is unavailable.'
                  : 'The selected borrower is unavailable.'}{' '}
              Choose current records above. If none are available, add records
              in your workspace first.
            </p>
          )}
          <Button
            className="desk-button"
            type="submit"
            disabled={busy || !kit || !borrower}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Workflow size={17} />
            )}
            {busy ? 'Checking the instruction…' : 'Run agent rehearsal'}
          </Button>
          <p className="agent-note">
            {demo
              ? 'Uses isolated fictional records.'
              : 'Uses your saved records.'}{' '}
            This rehearsal cannot lend equipment or approve policy.
          </p>
          {error && (
            <div role="alert" className="agent-error">
              <CircleAlert size={17} />
              <p>{error}</p>
            </div>
          )}
          <ol
            className="agent-trace"
            aria-live="polite"
            aria-label="Completed checks"
          >
            {trace.map((step) => (
              <li key={step}>
                <Check size={15} />
                {step}
              </li>
            ))}
          </ol>
        </form>
        <div
          className="agent-findings"
          aria-live={report ? 'polite' : 'off'}
          aria-busy={busy}
        >
          {!report ? (
            <div className="agent-empty">
              <h2>Find the instruction’s edge.</h2>
              <p>
                A borrower’s missing verification is a fact to check. A
                substitution rule you never set is a decision to make. The
                rehearsal keeps those separate.
              </p>
              <ol className="agent-preview-path">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Read the desk</strong>
                    <p>Check the saved borrower, equipment and policy.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Change one fact</strong>
                    <p>Compare independent hypothetical requests.</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Find the missing instruction</strong>
                    <p>Review what needs your judgment before a handoff.</p>
                  </div>
                </li>
              </ol>
            </div>
          ) : (
            <>
              <div className="agent-result-header">
                <span className={`agent-kind kind-${report.decision.kind}`}>
                  {report.decision.kind === 'fact'
                    ? 'Fact to verify'
                    : report.decision.kind === 'gap'
                      ? 'Instruction missing'
                      : report.decision.kind === 'blocked'
                        ? 'Rule prevents this'
                        : 'Request allowed'}
                </span>
                <span>Policy v{report.policyVersion}</span>
              </div>
              <h2>{report.decision.title}</h2>
              <p>{report.decision.explanation}</p>
              {previousReport && !stale && sameRequest && (
                <section className="agent-policy-comparison" aria-label="Same request across saved desk revisions">
                  <h3>{previousReport.policyVersion !== report.policyVersion
                    ? 'Same request. Updated policy.'
                    : 'Same request. Updated desk records.'}</h3>
                  <p>Only the saved desk changed; the selected request stayed the same.</p>
                  <dl>
                    <div>
                      <dt>Previous check · Desk revision {previousReport.revision} · Policy v{previousReport.policyVersion}</dt>
                      <dd>{previousReport.decision.title}</dd>
                    </div>
                    <div>
                      <dt>Current check · Desk revision {report.revision} · Policy v{report.policyVersion}</dt>
                      <dd>{report.decision.title}</dd>
                    </div>
                  </dl>
                  <p>{previousReport.policyVersion === report.policyVersion
                    ? 'The policy version is unchanged; saved desk records changed.'
                    : demo
                      ? 'The fictional records are unchanged; only the substitution instruction changed.'
                      : 'The policy version changed. Other saved records may also have changed.'} This comparison is a rehearsal, not a lending receipt.</p>
                </section>
              )}
              <p className="agent-references">
                Rules checked:{' '}
                {report.decision.refs.join(' · ') || 'Record checks'}
              </p>
              {stale && (
                <p className="agent-error">
                  <RefreshCw size={17} />
                  The desk has changed. Run again before preparing this request.
                </p>
              )}
              <div className="agent-contrasts">
                <h3>Change one thing.</h3>
                <p>
                  Each case below is hypothetical.{' '}
                  {demo
                    ? 'The fictional source records stay as they are.'
                    : 'Your saved records stay as they are.'}
                </p>
                <p className="agent-comparison-count">
                  {report.contrasts.length} cases checked ·{' '}
                  {
                    report.contrasts.filter((item) => item.changedOutcome)
                      .length
                  }{' '}
                  different answers ·{' '}
                  {
                    report.contrasts.filter(
                      (item) => item.decision.kind === 'gap',
                    ).length
                  }{' '}
                  {report.contrasts.filter(
                    (item) => item.decision.kind === 'gap',
                  ).length === 1
                    ? 'instruction gap'
                    : 'instruction gaps'}
                </p>
                <div className="agent-comparison-layout">
                  <fieldset
                    className="agent-contrast-options"
                    aria-label="Select a contrasting case"
                  >
                    {report.contrasts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={item.id === contrast?.id}
                        onClick={() => setSelected(item.id)}
                      >
                        {item.question}
                        <span>
                          {item.decision.kind === 'gap'
                            ? 'Instruction missing'
                            : item.decision.kind === 'fact'
                              ? 'Fact to verify'
                              : item.changedOutcome
                                ? 'Different answer'
                                : 'Same answer'}
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  </fieldset>
                  {contrast && (
                    <div className="agent-contrast-detail" key={contrast.id}>
                      <dl>
                        <div>
                          <dt>{contrast.field}</dt>
                          <dd>
                            {contrast.before} <ArrowRight size={15} />{' '}
                            {contrast.after}
                          </dd>
                        </div>
                      </dl>
                      <h4>{contrast.decision.title}</h4>
                      <p>{contrast.decision.explanation}</p>
                      <small>
                        Rules checked:{' '}
                        {contrast.decision.refs.join(' · ') || 'Record checks'}
                      </small>
                      {contrast.decision.kind === 'gap' && (
                        <Button
                          className="desk-button contrast-policy-action"
                          onClick={onPolicy}
                        >
                          Review missing instruction <ArrowRight size={16} />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="agent-actions">
                {report.decision.kind === 'gap' ? (
                  <Button className="desk-button" onClick={onPolicy}>
                    Review the missing instruction <ArrowRight size={16} />
                  </Button>
                ) : (
                  <Button
                    className="desk-button"
                    disabled={!!stale}
                    onClick={() => onPrepare(report.request)}
                  >
                    {demo
                      ? 'Open your private workspace'
                      : 'Prepare original desk request'}{' '}
                    <ArrowRight size={16} />
                  </Button>
                )}
                <Button variant="ghost" onClick={download}>
                  <Download size={16} />
                  Download rehearsal
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
      <details className="agent-connection">
        <summary>How this rehearsal works</summary>
        <p>
          This is a simulated Alexa+ workflow using the official MCP SDK and a
          Streamable HTTP client.{' '}
          {demo
            ? 'It reads only isolated fictional demo records'
            : 'It reads this authenticated workspace'}
          , and runs a deterministic sequence of checks. The comparison engine
          applies explicit lending rules; it does not interpret handbook prose
          with an LLM. Alexa+ distribution and AWS are not connected.
        </p>
        <p>
          Endpoint:{' '}
          <code>{endpoint || `/api/mcp?workspace=${workspace.id}`}</code>.
          Protocol: <code>2025-11-25</code>. Tools: inspect desk, probe request,
          read receipt.{' '}
          {demo
            ? 'The demo endpoint has no database access, private records or committed receipts.'
            : 'The endpoint requires this site’s authenticated session and origin.'}{' '}
          It has no tools for changing policy, lending equipment or reading
          another owner’s records.
        </p>
      </details>
    </section>
  );
}
