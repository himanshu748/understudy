'use client';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CircleHelp,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import type { Decision } from '@/lib/desk';

const cases = [
  { label: 'Find the gap', policy: 'source', confirmed: true },
  { label: 'Add the instruction', policy: 'addition', confirmed: true },
  { label: 'Test the boundary', policy: 'addition', confirmed: false },
] as const;

export default function Example() {
  const [selected, setSelected] = useState(0);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const current = cases[selected];
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/example?policy=${current.policy}&confirmed=${current.confirmed}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error('Example unavailable');
        const result = (await response.json()) as Decision;
        if (!controller.signal.aborted) setDecision(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            'The example could not load. Check your connection and try again.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [current, retry]);

  function selectCase(index: number) {
    if (index === selected) return;
    setBusy(true);
    setDecision(null);
    setError('');
    setSelected(index);
  }
  return (
    <section
      className="rehearsal-preview"
      id="example"
      aria-label="Interactive rehearsal with fictional records"
    >
      <div className="preview-toolbar">
        <span>
          <span className="preview-mark" /> The rehearsal desk
        </span>
        <span>Fictional example</span>
      </div>
      <div className="preview-body">
        <div className="preview-person">
          <span className="preview-avatar">AP</span>
          <div>
            <strong>Ari Patel</strong>
            <span>Equipment checkout</span>
          </div>
          <span className="preview-status">
            <Check size={13} /> Verified borrower
          </span>
        </div>
        <blockquote>
          “The camera I wanted is out.
          <br />
          Could I take the other one?”
        </blockquote>
        <div className="preview-facts">
          <span>
            <Check size={14} /> Alternative available
          </span>
          <span>
            {current.confirmed ? <Check size={14} /> : <CircleHelp size={14} />}
            {current.confirmed ? 'Borrower confirmed' : 'Confirmation missing'}
          </span>
        </div>
        <fieldset className="preview-stepper">
          <legend className="sr-only">Rehearsal stages</legend>
          {cases.map((item, index) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={selected === index}
              onClick={() => selectCase(index)}
            >
              <span>{index + 1}</span>
              {item.label}
            </button>
          ))}
        </fieldset>
        <div className="preview-rule">
          <span>{selected === 0 ? 'P1–P5' : 'D1'}</span>
          <p>
            {selected === 0
              ? 'The source rules have no instruction for a substitute kit.'
              : 'Offer an available substitute only after the borrower explicitly confirms.'}
          </p>
        </div>
        <div
          className="preview-result"
          data-kind={decision?.kind}
          aria-live="polite"
          aria-atomic="true"
          aria-busy={busy}
        >
          {busy ? (
            <p className="preview-loading">
              <LoaderCircle className="spin" size={18} /> Checking the
              instruction…
            </p>
          ) : error ? (
            <div role="alert">
              <p>{error}</p>
              <button
                className="preview-retry"
                onClick={() => {
                  setBusy(true);
                  setError('');
                  setRetry((value) => value + 1);
                }}
              >
                <RotateCcw size={14} /> Try again
              </button>
            </div>
          ) : decision ? (
            <>
              <div className="preview-verdict-icon">
                {decision.kind === 'ready' ? (
                  <ShieldCheck size={23} />
                ) : (
                  <CircleHelp size={23} />
                )}
              </div>
              <div>
                <h2>{decision.title}</h2>
                <p>{decision.explanation}</p>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div className="preview-footer">
        <span>
          Same evaluator as your desk.
          <br />
          No workspace records changed.
        </span>
        <button onClick={() => selectCase((selected + 1) % cases.length)}>
          {selected === 2 ? 'Start again' : 'Next step'}
          <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}
