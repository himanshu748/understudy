# Dependency review, 4 October 2026

Compatible Cloudflare plugin, Wrangler and matching Workers type updates, followed by nonbreaking lockfile fixes, reduced `npm audit` from 21 reported dependency nodes to 13. These counts include packages affected through a shared underlying dependency; they are not counts of independent application vulnerabilities.

On 4 October, a scoped override replaced the old esbuild copy in `@esbuild-kit/core-utils` with `0.28.2`. The refreshed lockfile resolves that loader to the patched version without changing the framework or Drizzle versions. The audit now reports 9 affected dependency nodes, all arising from the remaining braces advisory. The previous 4 moderate nodes from the esbuild development-server advisory are gone.

The updated tree uses `ws@8.21.0`, `sharp@0.35.4` and current Wrangler esbuild. Tests, typechecking, lint and the production build passed after the tool updates. Local D1/HTTP checks also passed for MCP negotiation, the lending lifecycle and archive-boundary recovery. A [clean Linux CI run](https://github.com/himanshu748/understudy/actions/runs/37130383099) passed those checks independently.

One underlying advisory remains:

- [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), with no published patched version at this check, affects the Vinext and shadcn build dependency chains. Understudy does not accept user-controlled glob patterns or run these tools through an application endpoint. Build only trusted source and configuration. This limits the observed exposure; it does not remove the vulnerable dependency.

The scoped loader override is checked by importing the real TypeScript schema through the legacy loader and by running `npm run db:generate`, alongside tests, typechecking, lint and build. Keep development servers bound to localhost.

The audit's suggested force fixes would downgrade the framework, shadcn or Drizzle across incompatible versions. They were not applied. Recheck upstream fixes before a broader production launch. This is a dependency review, not a penetration test or a zero-vulnerability claim.
