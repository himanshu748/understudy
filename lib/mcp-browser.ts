// The desk uses a private, stateless JSON transport. OAuth and SSE are not
// needed for its same-origin session, so keep those dependencies off the page.
const PROTOCOL = '2025-11-25';
type JsonObject = Record<string, unknown>;
export type DeskToolResult = {
  isError?: boolean;
  structuredContent?: JsonObject;
};
function object(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export class DeskToolClient {
  private sequence = 0;
  private ready = false;
  private closed = false;
  private pending = new Set<AbortController>();

  constructor(
    private url: URL,
    private fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {}

  private async send(
    method: string,
    params?: JsonObject,
    notification = false,
  ) {
    if (this.closed) throw new Error('The rehearsal connection has closed.');
    const id = notification ? undefined : ++this.sequence;
    const controller = new AbortController();
    this.pending.add(controller);
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await this.fetcher(this.url, {
        method: 'POST',
        credentials: 'same-origin',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': PROTOCOL,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403)
          throw new Error(
            'Your desk session needs to be refreshed. Sign in and try again.',
          );
        throw new Error(
          'The desk connection could not complete this check. Try again.',
        );
      }
      if (notification) {
        if (response.status !== 202)
          throw new Error(
            'The desk did not acknowledge the rehearsal connection.',
          );
        return {};
      }
      if (!response.headers.get('content-type')?.includes('application/json'))
        throw new Error(
          'The desk returned an unsupported response. Refresh and try again.',
        );
      const message: unknown = await response.json();
      if (!object(message) || message.jsonrpc !== '2.0' || message.id !== id)
        throw new Error(
          'The desk response did not match this check. Run it again.',
        );
      if (message.error || !object(message.result))
        throw new Error(
          'The desk could not complete this check. Refresh and try again.',
        );
      return message.result;
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error(
          this.closed
            ? 'The rehearsal was cancelled.'
            : 'The desk took too long to respond. Try again.',
        );
      throw error;
    } finally {
      clearTimeout(timeout);
      this.pending.delete(controller);
    }
  }

  async connect() {
    const result = await this.send('initialize', {
      protocolVersion: PROTOCOL,
      capabilities: {},
      clientInfo: { name: 'understudy-rehearsal-client', version: '0.2.0' },
    });
    if (
      result.protocolVersion !== PROTOCOL ||
      !object(result.capabilities) ||
      !object(result.capabilities.tools)
    )
      throw new Error('The desk does not support this rehearsal protocol.');
    await this.send('notifications/initialized', undefined, true);
    this.ready = true;
  }

  async listTools(): Promise<{ tools: { name: string }[] }> {
    if (!this.ready)
      throw new Error('Connect to the desk before checking tools.');
    const result = await this.send('tools/list', {});
    if (
      !Array.isArray(result.tools) ||
      !result.tools.every(
        (tool) => object(tool) && typeof tool.name === 'string',
      )
    )
      throw new Error('The desk did not return a valid tool list.');
    return result as { tools: { name: string }[] };
  }

  async callTool(params: {
    name: string;
    arguments: JsonObject;
  }): Promise<DeskToolResult> {
    if (!this.ready)
      throw new Error('Connect to the desk before checking records.');
    const result = await this.send('tools/call', params);
    if (
      result.structuredContent !== undefined &&
      !object(result.structuredContent)
    )
      throw new Error('The desk returned an invalid check result.');
    return result as DeskToolResult;
  }

  async close() {
    this.closed = true;
    this.ready = false;
    for (const controller of this.pending) controller.abort();
    this.pending.clear();
  }
}
