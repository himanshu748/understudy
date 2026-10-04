'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, RotateCcw } from 'lucide-react';
import { AgentRehearsal } from '../desk/agent-rehearsal';
import { demoWorkspace } from '@/lib/demo';

export default function DemoPage() {
  const [instruction, setInstruction] = useState(false);
  const [session, setSession] = useState(0);
  const policyControl = useRef<HTMLButtonElement>(null);
  return (
    <div className="judge-demo">
      <header className="demo-nav">
        <Link href="/" className="brand">
          Understudy.
        </Link>
        <Link href="/desk" className="plain-link">
          Your private workspace <ArrowUpRight size={15} />
        </Link>
      </header>
      <main>
        <Link className="demo-back" href="/">
          <ArrowLeft size={14} /> Back to the introduction
        </Link>
        <div className="demo-heading">
          <h1>
            Meet your next
            <br />
            <em>missing instruction.</em>
          </h1>
          <p>
            Try the real rehearsal tools with fictional equipment and borrowers.
            No sign-in, saved changes, or private records.
          </p>
        </div>
        <div className="demo-instruction">
          <div>
            <BookOpen size={21} />
            <div>
              <strong>
                {instruction
                  ? 'Substitutes need borrower confirmation.'
                  : 'The substitution instruction is missing.'}
              </strong>
              <p>
                {instruction
                  ? 'Your request stays selected. Run it again to see the consent boundary.'
                  : 'Run the request first. Inspect what happens when it becomes a substitution.'}
              </p>
            </div>
          </div>
          <div className="demo-policy-buttons">
            <button
              ref={policyControl}
              type="button"
              className="button"
              aria-pressed={instruction}
              onClick={() => setInstruction(!instruction)}
            >
              {instruction ? 'Remove demo instruction' : 'Add demo instruction'}
            </button>
            <button
              type="button"
              className="demo-reset"
              onClick={() => {
                setInstruction(false);
                setSession((value) => value + 1);
              }}
              aria-label="Reset demonstration"
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </div>
        <AgentRehearsal
          key={session}
          workspace={demoWorkspace(instruction)}
          demo
          endpoint={`/api/demo/mcp?instruction=${instruction ? 'confirm' : 'missing'}`}
          onPolicy={() => {
            policyControl.current?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                .matches
                ? 'auto'
                : 'smooth',
              block: 'center',
            });
            policyControl.current?.focus({ preventScroll: true });
          }}
          onPrepare={() => {
            window.location.href = '/desk';
          }}
        />
        <footer className="demo-disclosure">
          Fictional sample · Real MCP calls · Deterministic rule evaluation
          <br />
          Alexa+ distribution and AWS services are not connected. Private
          lending actions require your own workspace.
        </footer>
      </main>
    </div>
  );
}
