import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getWorkspace, findArchivedReceipt } from '@/lib/store';
import { DeskError } from '@/lib/desk';
import { serveDeskMcp } from '@/lib/mcp';

export const dynamic = 'force-dynamic';
const errorResponse = (message: string, status: number) =>
  Response.json(
    { jsonrpc: '2.0', id: null, error: { code: -32000, message } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return errorResponse('Sign in to use your desk tools.', 401);
    const url = new URL(request.url);
    if (
      request.headers.get('origin') !== url.origin ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      return errorResponse(
        'Open this desk directly before using its tools.',
        403,
      );
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return errorResponse('JSON is required.', 415);
    const workspaceId = url.searchParams.get('workspace');
    if (!workspaceId || workspaceId.length > 100)
      return errorResponse('Select one workspace.', 400);
    await getWorkspace(user.userId, workspaceId);
    const reader = request.body?.getReader();
    if (!reader) return errorResponse('A request body is required.', 400);
    let bytes = 0,
      raw = '';
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 64000) {
        await reader.cancel();
        return errorResponse('This tool request is too large.', 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return errorResponse('The tool request could not be read.', 400);
    }
    if (Array.isArray(parsed))
      return errorResponse('Send one tool request at a time.', 400);
    return await serveDeskMcp(request, parsed, {
      read: () => getWorkspace(user.userId, workspaceId),
      receipt: async (requestId) => {
        const workspace = await getWorkspace(user.userId, workspaceId);
        return (
          workspace.data.receipts.find((r) => r.requestId === requestId) ||
          (await findArchivedReceipt(user.userId, workspaceId, requestId))
        );
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof DeskError
        ? error.message
        : 'The desk tools are temporarily unavailable.',
      error instanceof DeskError ? error.status : 500,
    );
  }
}
// This stateless endpoint exposes JSON responses, not a long-running SSE channel.
export function GET() {
  return new Response(null, {
    status: 405,
    headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
  });
}
export const DELETE = GET;
