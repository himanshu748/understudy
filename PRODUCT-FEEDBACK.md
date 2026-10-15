# Product feedback (owner-editable draft)

Draft answers for the exact Devpost questions. No form has been edited.

- **Tools/SDKs used and why:** Official MCP SDK server/client for instruction-gap rehearsals using Streamable HTTP and protocol 2025-11-25; React/Vinext for the operator interface; Cloudflare D1 for owner-scoped lending history and atomic revisions; TypeScript and Node 22 for verification. OpenAI Codex assisted this polish/verification pass. Kiro use is not claimed.
- **What worked:** All 38 suite tests, typecheck, lint, build and fresh local D1/HTTP judge workflows passed on Node 22.17.1. The isolated fictional demo requires no owner login and makes actual MCP calls. Missing lending instructions and missing borrower evidence stay separate.
- **What needs work:** Public hosted signed-out access, Alexa+ distribution/Echo hardware and real institutional use remain unverified. Handbook prose is retained for review; no LLM interprets it. The dated dependency review documents its own toolchain limitations.
- **Onboarding:** The `/demo` path needs only a local install and dev server. The full lending workspace additionally needs both local D1 migrations and the explicitly local development identity; it does not use the hosted owner's login.
- **Would you build again?** Draft: yes, because exposing an instruction gap before a checkout can make operator judgment clearer. The owner must confirm that opinion from actual experience.
- **AWS Builder:** Not claimed. No real Bedrock/AgentCore runtime call or AWS credentials were available for validation; this pass keeps the verified evaluator and Cloudflare storage accurately described.

Confirm actual prior tools, SDK versions and personal opinions before copying answers. Tests and fictional records are not customer adoption or physical-device proof.
