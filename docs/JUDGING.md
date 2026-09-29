# Judge walkthrough

Track: Alexa+. Route: self-hosted MCP 2025-11-25 over Streamable HTTP.

## No credentials required

Install Node 22.13 or newer, run `npm ci`, then `npm run dev -- --hostname 127.0.0.1 --port 4320`. Open http://localhost:4320/demo. No cloud account, API key, database migration or gated Alexa tool is required for this route.

1. Leave the demo instruction missing. Run the default checkout for Ari and kit 02. The baseline permits checkout.
2. Inspect the selected comparison: requesting kit 01 instead reveals an unset substitution instruction.
3. Click Review missing instruction, then Add demo instruction. This explicitly requires borrower confirmation.
4. Choose kit 01 under Originally requested, retain kit 02 as Equipment, tick Borrower confirmed a substitute, and run. The result permits the request.
5. Select the comparison that removes borrower confirmation. The result requires confirmation.
6. Expand How this rehearsal works to inspect the tool sequence and protocol scope. Reset demonstration restores the initial fictional scenario.

The endpoint executes the same MCP SDK server and rule evaluator used by the private workspace. It receives fresh fictional records on each request. It cannot commit loans, read private workspaces, or retrieve private receipts. The evaluator is deterministic; it does not use an LLM to interpret handbook prose. Alexa+ distribution and AWS services are not connected.

## Verify the protocol

With the local server running, run `npm test` and `npm run test:demo-api`. These exercise negotiation, tool discovery, policy outcomes, consent and isolation. `npm run check`, `npm run lint`, and `npm run build` validate the application.

## Full operator workflow

Follow Full local workspace in README to build and initialize D1. Sign in locally with the development account supplied by the Sites plugin. Create a labelled sample workspace. Approve its handbook, rehearse and open a shift, commit a checkout, inspect its durable receipt, then return every recorded component. `npm run test:api` checks this lifecycle using its own disposable workspace.

The development identity is for localhost only. This project is not packaged as a generic publicly deployable authenticated service: production private routes require the trusted Sites identity gateway. Public hosting is optional for this hackathon's Alexa+ route.
