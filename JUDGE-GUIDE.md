# Try Understudy

Understudy helps an equipment-desk operator discover a missing lending instruction before an agent reaches the counter. It separates a missing rule, missing evidence and a refusal under an approved rule.

1. Follow the [judge quick start](README.md#judge-quick-start) and open `/demo`. No account, database or API key is needed for this isolated walkthrough.
2. Run the default request and compare its substitution case. The unset instruction produces an operator decision.
3. Approve the demo substitution instruction and run the same comparison. Remove borrower confirmation; approval of the instruction does not waive that evidence requirement.
4. Download the report and inspect the recorded request and changed fact. The rehearsal cannot modify inventory.

The fictional records are fresh for each scenario. Calls use the official MCP SDK, protocol 2025-11-25 and Streamable HTTP. The [event FAQ](https://amazonappdev2026.devpost.com/details/faqs) permits a self-hosted MCP demonstration and locally runnable repository. This entry does not demonstrate an Echo, Alexa+ distribution or an LLM interpreting handbook prose.

The [full local workspace](README.md#full-local-workspace) adds operator-entered inventory, policy approval, explicit checkout, component returns and complete history export. The **Judge checks** workflow verifies these against isolated local D1. Its development identity is for localhost; production requires the documented trusted identity gateway.

Two separate contributions to the official Ring starter support the OSS mini-challenge: [PR 25](https://github.com/AmazonAppDev/ring-api-helloworld/pull/25) and [PR 27](https://github.com/AmazonAppDev/ring-api-helloworld/pull/27). Both were open on 3 October 2026. They are additional contributions, distinct from this primary project; acceptance and scoring remain the judges' decision.

No institution or customer adoption has been verified. See [dependency review](DEPENDENCY-REVIEW.md) for the remaining toolchain advisories.
