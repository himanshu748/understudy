# Try Understudy

Understudy helps an equipment-desk operator discover a missing lending instruction before an agent reaches the counter. It separates a missing rule, missing evidence and a refusal under an approved rule.

1. Use Node 22.14+ (verified with 22.17.1), run `npm ci` then `npm run dev -- --hostname 127.0.0.1 --port 4320`, and open http://127.0.0.1:4320/demo in a signed-out browser. No owner account, database, cloud login or API key is needed for this isolated walkthrough.
2. Run the default request and compare its substitution case. The unset instruction produces an operator decision.
3. Approve the demo substitution instruction and run the same comparison. Remove borrower confirmation; approval of the instruction does not waive that evidence requirement.
4. Select **Download rehearsal** and inspect the recorded request and changed fact. The rehearsal cannot modify inventory.

For a direct before/after check, reset the demo, choose a different **Originally requested** kit while keeping the available equipment selected, and run with borrower confirmation unchecked. Add the demo instruction and rerun: the selected request stays intact, and the original answers appear together with their policy versions. Now check borrower confirmation and rerun to see the allowed outcome. Editing any request field clears the previous-request comparison; changing the instruction cancels any check still using its old revision. Reset clears the whole walkthrough.

The fictional records are fresh for each scenario. Calls use the official MCP SDK, protocol 2025-11-25 and Streamable HTTP. The [event FAQ](https://amazonappdev2026.devpost.com/details/faqs) permits a self-hosted MCP demonstration and locally runnable repository. This entry does not demonstrate an Echo, Alexa+ distribution or an LLM interpreting handbook prose.

The [full local workspace](README.md#full-local-workspace) adds operator-entered inventory, policy approval, explicit checkout, component returns and complete history export. The **Judge checks** workflow verifies these against isolated local D1. Its development identity is for localhost; production requires the documented trusted identity gateway.

Two separate contributions to the official Ring starter support the OSS mini-challenge: [PR 25](https://github.com/AmazonAppDev/ring-api-helloworld/pull/25) and [PR 27](https://github.com/AmazonAppDev/ring-api-helloworld/pull/27). Both were open on 3 October 2026. They are additional contributions, distinct from this primary project; acceptance and scoring remain the judges' decision.

No institution or customer adoption has been verified. See [dependency review](DEPENDENCY-REVIEW.md) for the remaining toolchain advisories.

## Repeat the judge checks

```sh
npm test
npm run check
npm run lint
npm run build
```

All 38 tests and these source checks passed on Node 22.17.1 on 15 October. For full D1/HTTP verification, use the two fresh-database migrations in the README, keep the local server running, then in a second terminal:

```sh
UNDERSTUDY_TEST_URL=http://127.0.0.1:4320 npm run test:demo-api
UNDERSTUDY_TEST_URL=http://127.0.0.1:4320 npm run test:api
UNDERSTUDY_TEST_URL=http://127.0.0.1:4320 npm run test:archive-api
```

These passed against a separate fresh local D1 checkout on 15 October. The API suites create and remove their own fictional workspaces. The archive check accesses only the local database for its test-created workspace; never aim it at a real user's database. CI repeats setup from `npm ci` on Node 22. No hosted owner login is part of the judge path.

Understudy rehearses lending rules for an equipment-desk operator. Reopen helps a project lead revisit a saved decision and approve a later checklist consequence. The users and primary jobs are different; no combined-project or sponsor-scoring result is claimed.
