import { demoWorkspace } from '@/lib/demo';
import { serveDeskMcp } from '@/lib/mcp';
export const dynamic = 'force-dynamic';
const fail = (message: string, status: number) =>
  Response.json(
    { jsonrpc: '2.0', id: null, error: { code: -32000, message } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );

// No user lookup, database, archive, saved state or workspace selector.
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (
    request.headers.get('origin') !== url.origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return fail('Open the demonstration directly to use its tools.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return fail('JSON is required.', 415);
  if (Array.from(url.searchParams.keys()).some((key) => key !== 'instruction'))
    return fail('This demonstration cannot select a private workspace.', 400);
  const instruction = url.searchParams.get('instruction');
  if (
    instruction !== null &&
    instruction !== 'missing' &&
    instruction !== 'confirm'
  )
    return fail('Choose a demonstration instruction.', 400);
  const reader = request.body?.getReader();
  if (!reader) return fail('A request body is required.', 400);
  const decoder = new TextDecoder();
  let raw = '',
    bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 64000) {
        await reader.cancel();
        return fail('This tool request is too large.', 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch {
    return fail('The tool request could not be read.', 400);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail('The tool request could not be read.', 400);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return fail('Send one tool request at a time.', 400);
  try {
    return await serveDeskMcp(request, parsed, {
      scope: 'fictional-demo',
      read: async () => demoWorkspace(instruction === 'confirm'),
      receipt: async () => undefined,
    });
  } catch {
    return fail(
      'The demonstration could not complete this check. Try again.',
      500,
    );
  }
}
export function GET() {
  return new Response(null, {
    status: 405,
    headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
  });
}
export const DELETE = GET;
