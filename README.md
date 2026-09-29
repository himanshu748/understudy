# Understudy operator app

Understudy is a private lending desk for shared equipment. Start with an empty workspace, import equipment from CSV, record borrower references, approve explicit lending settings and rehearse a request before opening a shift. The desk commits checkouts, renewals and individual component returns. Equipment becomes available again only after every recorded component returns.

The daily overview shows actual open loans, outstanding components, maintenance notes and setup requirements. Operators can edit records, archive inactive equipment and borrowers, save rehearsals, review policy snapshots, download a shift handoff and export the full workspace. An optional sample workspace is clearly labeled and stored separately.

**Agent rehearsal** checks an actual request through an authenticated MCP endpoint, then changes one fact at a time to expose missing instructions. A verified borrower can receive the requested recorder; asking for a substitute exposes an unset substitution rule. The operator can inspect each hypothetical case, download the report, review the missing instruction or prepare the original desk request. Running a probe never changes inventory or approves policy.

[Local introduction](http://localhost:4320) · [Judge demo](http://localhost:4320/demo)

Submitted to the Amazon Developer Hackathon on 28 September 2026: [Devpost entry](https://devpost.com/software/understudy-lf5dbt) · [public demo video](https://www.youtube.com/watch?v=s8CCvcBZOeo). The entry uses the permitted self-hosted MCP demonstration route. It does not claim Alexa+ distribution or an Echo-device demonstration.

## Storage and identity

Sign in with ChatGPT identifies the visitor. Server reads and writes check workspace ownership. Cloudflare D1 persists records; a compare-and-swap revision commits inventory changes and receipts together. Request IDs return the original receipt when a response is lost, including after a shift closes or the receipt enters the archive.

Older receipts, rehearsals, policy snapshots and activity entries move into an owner-scoped D1 archive in the same transaction as each workspace update. The interface shows recent records; the JSON export includes the complete history. Compaction reserves space for outstanding component returns before accepting new work. There is no receipt-count cutoff. Current record limits are 20 workspaces per account, 500 equipment records and 500 borrower references per workspace, and 100 equipment rows per CSV import. Active inventory and handbook content have an 850 KB budget including reserved return space; large additions are refused without changing saved records.

Deleting a workspace requires its exact name, a current revision and no open loans. Its archived history is deleted in the same database cascade. Export is a download for recordkeeping; restoring an export is not implemented.

## Judge quick start

Use Node 22.13 or later. The isolated MCP walkthrough needs no database, login or credentials:

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 4320
```

Open http://localhost:4320/demo. Run the default request, select the substitution comparison, add the demo instruction, then request kit 01 using available kit 02 with borrower confirmation. Inspect the comparison with confirmation removed. Records are fictional; the protocol calls and evaluator are real.

For the full operator workspace, initialize the local database with the following steps.

## Full local workspace

Use Node 22.13 or later, then:

```sh
npm ci
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_fine_sebastian_shaw.sql --yes
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_wakeful_juggernaut.sql --yes
npm run dev -- --port 4320
```

Run each migration once on a fresh database; existing local installations need only the new migration. The Sites plugin supplies a local-only test sign-in account. Hosted authentication does not use that identity. This repository includes generic local D1 bindings in `.openai/hosting.json` and no owner project identifier. No cloud account or API key is needed for the local demo. Keep the development server bound to localhost. Production deployment requires a trusted identity gateway that strips caller-supplied authentication headers; do not expose the private workspace routes behind an untrusted proxy.

## Verification

```sh
npm test
npm run check
npm run lint
npm run build
# With the initialized local development server running:
npm run test:api
npm run test:archive-api
```

The 35 domain, SQLite, MCP and demo tests cover decision boundaries, imports, record lifecycle, rehearsal snapshots, receipt replay, return completeness, history compaction, capacity reservation, revision-scoped archival and deletion. MCP tests exercise the official SDK client and the browser client against the actual stateless server, including protocol negotiation, tool schemas, independent counterfactuals, cancellation and unchanged source records. HTTP verification covers a complete operator lifecycle, competing checkouts, lost-response retries, ownership/origin guards, exports and deletion. The archive regression seeds only a test-created local workspace to exercise the former 3,000-receipt boundary, historical retries and full export through the real D1-backed API; it removes its fixture afterward.

Browser verification used stored operator-entered test records to exercise empty-workspace creation, CSV import, borrower setup, maintenance, handbook approval, saved contrasts, checkout, handoff download and reload. Desktop and 390px mobile checks found no horizontal overflow or browser errors. Lint covers application and domain code; generated `components/ui` scaffolding is excluded from lint but remains typechecked. These checks do not establish production sign-in or real institutional validation.

## Integration status

`POST /api/mcp?workspace=<owned-workspace-id>` uses the official `@modelcontextprotocol/sdk` server, protocol **2025-11-25**, and stateless Streamable HTTP with JSON responses. It exposes `inspect_desk`, `probe_request` and `read_receipt`. Each request requires the site's authenticated session and matching origin; the server scopes all reads to that owner and workspace, including archived receipts. GET and DELETE return 405 because this endpoint has no SSE stream or persistent sessions. Tools cannot modify policy or execute loans. The browser uses a small same-origin transport; the official SDK client is independently covered by the interoperability tests.

The rehearsal is a deterministic workflow using explicit configured rules. Handbook prose is retained for operator review; an LLM does not interpret it. Alexa+ distribution, external-agent OAuth, Bedrock and AgentCore are not connected. Do not present the browser rehearsal as an Echo recording or a completed Alexa+ integration. The submitted evidence uses the permitted self-hosted MCP route.

The hosted audience is owner-only. Team invitations, public sign-up, billing and account recovery outside the identity provider are not implemented. Identification is an operator-attested boolean; the app does not collect identification documents. No customer adoption or institutional affiliation is claimed.

## Two-minute demonstration

1. Show an operator-owned desk with two equipment records and a verified borrower. Leave substitution unspecified.
2. Run Agent rehearsal on a normal checkout. Inspect the missing-identity case and the substitute case: one needs evidence, the other needs an operator decision.
3. Review and approve the missing instruction, then run the same request again. Show the changed policy version and the recorded rule behind the answer.
4. Prepare the original request, rehearse and open the working shift, then explicitly commit the checkout. Show its receipt and outstanding components.
5. State that the MCP calls and lending transaction work, while Alexa+ distribution and AI interpretation remain unconnected. Any fictional records must be labeled throughout.

The [official rules](https://amazonappdev2026.devpost.com/rules) were reviewed on 28 September 2026. A public licensed GitHub repository or private reviewer access, a public video under three minutes and product feedback are separate submission deliverables. The Alexa+ FAQ accepts a locally runnable repository plus demo video; public hosting is optional.

## September 28 judge walkthrough

Open `/demo` for an isolated fictional rehearsal that requires no application login or database. Its `/api/demo/mcp` route invokes the same official MCP SDK server over Streamable HTTP, using only fresh sample records. It cannot select a private workspace or read committed receipts. Toggle the demo substitution instruction, run a request, and compare its consent boundary. The hosting platform may still apply an outer private-access gate; deployment and signed-out judge access must be verified separately.

The landing page now contains a React-controlled three-stage example backed by the existing evaluator. Agent rehearsal prioritizes instruction gaps and provides a direct policy-review action for a selected gap. Sample workspace creation opens on Agent rehearsal.

Run `npm test` before `npm run test:demo-api`; the latter uses the compiled browser client against localhost. September 28 validation: 35 suite tests, TypeScript, lint, production build, demo HTTP checks and the existing lending API lifecycle passed. Desktop and fixed-width phone/tablet browser checks passed without horizontal overflow. The public source and video were submitted; a publicly accessible hosted app has not been verified.

## Repeatable judge checks

The **Judge checks** GitHub Actions workflow installs from the lockfile on Node 22, runs the test suite, typecheck, lint and production build, then initializes a disposable local D1 database. It exercises the demo MCP endpoint, full lending lifecycle and archive-boundary regression over HTTP. It uses only the localhost development identity and fictional test records; no cloud credentials, hosted database or production account are involved. A passing run establishes a clean Linux checkout, not hosted sign-in or Alexa hardware behavior.
