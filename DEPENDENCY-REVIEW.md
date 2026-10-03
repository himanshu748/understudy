# Dependency review, 3 October 2026

Compatible Cloudflare plugin, Wrangler and matching Workers type updates, followed by nonbreaking lockfile fixes, reduced `npm audit` from 21 reported dependency nodes to 13. These counts include packages affected through a shared underlying dependency; they are not counts of independent application vulnerabilities.

The updated tree uses `ws@8.21.0`, `sharp@0.35.4` and current Wrangler esbuild. Tests, typechecking, lint and the production build passed after the tool updates. Local D1/HTTP checks also passed for MCP negotiation, the lending lifecycle and archive-boundary recovery. A clean Linux CI run remains a separate check.

Two underlying advisories remain:

- [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), with no published patched version at this check, affects the Vinext and shadcn build dependency chains. Understudy does not accept user-controlled glob patterns or run these tools through an application endpoint. Build only trusted source and configuration. This limits the observed exposure; it does not remove the vulnerable dependency.
- [esbuild development-server cross-origin reads](https://github.com/advisories/GHSA-67mh-4wv8-2f99) affects the old copy inside Drizzle's esbuild-kit loader. The schema-generation loader is a local development tool. Do not expose a development server on a public interface. The application's Vite/Wrangler esbuild copies are separate updated versions.

The audit's suggested force fixes would downgrade the framework, shadcn or Drizzle across incompatible versions. They were not applied. Recheck upstream fixes before a broader production launch. This is a dependency review, not a penetration test or a zero-vulnerability claim.
