# Understudy: hosted operator release

Approved direction: hosted accounts and private workspaces, with the existing visual refinement and responsive interaction work carried forward. The first usable slice lets an equipment operator create an empty desk, add their own assets and borrower references, record a handbook and explicit lending rules, rehearse a concrete request, open a version-bound shift, and commit lending actions with durable receipts. A separate sample workspace is optional.

Authentication uses Sign in with ChatGPT. Every workspace query and mutation checks ownership on the server. The database persists state with compare-and-swap revisions so competing requests cannot loan one item twice. Rehearsal never changes inventory. Source text is retained for operator review; the current evaluator applies explicitly configured rules and does not pretend to interpret arbitrary prose. AI-generated policy suggestions remain a separate integration, which must be identified truthfully in the UI until connected.

No real institution is represented as a customer. No shared public desk or public borrower records. No team invites, arbitrary script execution, billing or production claims are implied by this initial operator release.

## September 8 operating scope

The approved continuation adds CSV preview and atomic import, an overview based on saved loans, maintenance and archived records, stored contrasting rehearsals, approved policy snapshots, desk activity, handoff downloads and workspace rename/export/deletion. Empty accounts receive no fabricated records. Historical events are archived transactionally in D1; receipt retries and full exports continue to include those records. Capacity checks reserve space for outstanding returns.
