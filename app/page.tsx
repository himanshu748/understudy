import Link from 'next/link';
import {
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  Check,
  FileCheck2,
  LockKeyhole,
} from 'lucide-react';
import Example from './example';

export default function Home() {
  return (
    <div className="landing">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="landing-nav">
        <Link href="/" className="brand" aria-label="Understudy home">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M5 7v12a8 8 0 0 0 16 0V7M11 7v12a8 8 0 0 0 16 0V7" />
          </svg>
          Understudy<span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Main">
          <a className="how-link" href="#method">
            The method
          </a>
          <Link className="how-link" href="/demo">
            Try the demo
          </Link>
          <Link className="button small" href="/desk">
            Open your workspace <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">
              Good judgment
              <br />
              needs a<br />
              <em>dress rehearsal.</em>
            </h1>
            <p className="hero-description">
              Your handbook can’t cover every request. Find the missing
              instruction, decide what should happen, and rehearse it before you
              open a lending shift.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/demo">
                Start a rehearsal <ArrowUpRight size={17} />
              </Link>
              <a className="plain-link" href="#example">
                Try the exception <ArrowDown size={16} />
              </a>
            </div>
            <p className="demo-caption">
              <LockKeyhole size={13} /> Your records. Your rules. Your private
              desk.
            </p>
          </div>
          <Example />
        </section>
        <div
          className="principles"
          aria-label="How your desk stays accountable"
        >
          <p>
            <BookOpen size={19} /> Published rules stay traceable.
          </p>
          <p>
            <Check size={19} /> You approve every desk addition.
          </p>
          <p>
            <FileCheck2 size={19} /> Every committed action gets a receipt.
          </p>
        </div>
        <section className="method" id="method" aria-labelledby="method-title">
          <div className="method-heading">
            <h2 id="method-title">
              Make the judgment
              <br />
              <em>explicit.</em>
            </h2>
            <p>
              A small exception is all it takes to find where the handbook ends.
              Keep the decision, its reason, and the rule together.
            </p>
          </div>
          <div className="method-steps">
            <article>
              <span className="method-number">01 / FIND</span>
              <div>
                <h3>Give the rules a difficult request.</h3>
                <p>
                  A different camera. An unverified borrower. A renewal with
                  someone waiting. Each case tests a different boundary.
                </p>
              </div>
            </article>
            <article>
              <span className="method-number">02 / REHEARSE</span>
              <div>
                <h3>Decide once. Then change one fact.</h3>
                <p>
                  Approve a desk instruction and replay the case. Compare what
                  happens when the borrower hasn’t confirmed.
                </p>
              </div>
            </article>
            <article>
              <span className="method-number">03 / HAND OVER</span>
              <div>
                <h3>Open a shift. Keep the receipt.</h3>
                <p>
                  Apply an approved request to your saved inventory. Each
                  committed change records the policy version that allowed it.
                </p>
              </div>
            </article>
          </div>
        </section>
        <section className="closing">
          <h2>
            The next request
            <br />
            is waiting at the desk.
          </h2>
          <div>
            <Link className="button" href="/desk">
              Open your workspace <ArrowUpRight size={17} />
            </Link>
            <p>
              Private workspaces · Sign in with ChatGPT.
              <br />
              Configure rules, rehearse requests, record loans.
            </p>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Link className="brand" href="/">
          Understudy<span className="brand-dot">.</span>
        </Link>
        <p>
          Example inspired by a subset of{' '}
          <a
            href="https://library.csun.edu/technology/cms/equipment-checkout"
            target="_blank"
            rel="noreferrer"
          >
            CSUN Library’s published lending policy <ArrowUpRight size={12} />
          </a>
        </p>
        <p>
          Independent equipment desk.
          <br />
          No institutional affiliation.
        </p>
      </footer>
    </div>
  );
}
