import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { emptyDesk } from './work/test-build/desk.js';
import { probeRequest } from './work/test-build/probe.js';
import { serveDeskMcp } from './work/test-build/mcp.js';
import { DeskToolClient } from './work/test-build/mcp-browser.js';

const makeWorkspace = () => {
  const data = emptyDesk();
  data.policy.substitution = '';
  data.borrowers = [
    { id: 'member-a', name: 'Member A', eligible: true, verified: true },
  ];
  data.kits = ['camera-a', 'camera-b'].map((id) => ({
    id,
    name: id,
    category: 'Camera',
    components: ['Body', 'Cable'],
    borrower: null,
    due: null,
    holds: 0,
    returned: [],
    renewals: 0,
  }));
  return { id: 'workspace-a', name: 'Contract fixture', revision: 4, data };
};
const request = {
  action: 'checkout',
  kit: 'camera-a',
  requestedKit: 'camera-a',
  borrower: 'member-a',
  confirmed: false,
};

test('contrast suite exposes an unspecified substitution rule without mutating its source', () => {
  const workspace = makeWorkspace(),
    before = JSON.stringify(workspace);
  const probe = probeRequest(workspace, request);
  assert.equal(probe.decision.kind, 'ready');
  assert.equal(
    probe.contrasts.find((c) => c.id === 'substitution').decision.kind,
    'gap',
  );
  assert.equal(
    probe.contrasts.find((c) => c.id === 'identity').decision.kind,
    'fact',
  );
  assert.equal(JSON.stringify(workspace), before);
  assert.equal(probe.revision, 4);
});
test('a recorded hold affects renewal independently from identity checks', () => {
  const workspace = makeWorkspace();
  workspace.data.kits[0].borrower = 'member-a';
  workspace.data.kits[0].due = '2026-10-01';
  const probe = probeRequest(workspace, { ...request, action: 'renew' });
  assert.equal(probe.decision.kind, 'ready');
  const hold = probe.contrasts.find((c) => c.id === 'hold');
  assert.equal(hold.before, '0');
  assert.equal(hold.after, '1');
  assert.equal(hold.decision.kind, 'blocked');
  assert.equal(workspace.data.kits[0].holds, 0);
});
test('return probes preserve recorded components and distinguish duplicate returns', () => {
  const workspace = makeWorkspace();
  workspace.data.kits[0].borrower = 'member-a';
  const probe = probeRequest(workspace, {
    ...request,
    action: 'return',
    component: 'Body',
  });
  assert.equal(probe.contrasts.length, 1);
  assert.equal(probe.contrasts[0].decision.kind, 'blocked');
  assert.deepEqual(workspace.data.kits[0].returned, []);
  assert.throws(() =>
    probeRequest(workspace, { ...request, kit: 'not-owned' }),
  );
});

async function connect(workspace) {
  const calls = [];
  const receipt = { id: 'receipt-a', requestId: 'request-a', policyVersion: 1 };
  const client = new Client({
    name: 'understudy-contract-test',
    version: '1.0.0',
  });
  const fetch = async (url, init) => {
    const incoming = new Request(url, init);
    if (incoming.method !== 'POST') return new Response(null, { status: 405 });
    const parsed = await incoming.clone().json();
    calls.push(parsed);
    return serveDeskMcp(incoming, parsed, {
      read: async () => structuredClone(workspace),
      receipt: async (id) => (id === 'request-a' ? receipt : undefined),
    });
  };
  await client.connect(
    new StreamableHTTPClientTransport(
      new URL('http://contract.test/api/mcp?workspace=workspace-a'),
      { fetch },
    ),
  );
  return { client, calls };
}
test('official SDK client negotiates 2025-11-25 and calls actual read-only tools over Streamable HTTP', async () => {
  const workspace = makeWorkspace(),
    before = JSON.stringify(workspace);
  const { client, calls } = await connect(workspace);
  try {
    assert.equal(calls[0].params.protocolVersion, '2025-11-25');
    const list = await client.listTools();
    assert.deepEqual(list.tools.map((t) => t.name).sort(), [
      'inspect_desk',
      'probe_request',
      'read_receipt',
    ]);
    assert.ok(list.tools.every((t) => t.annotations.readOnlyHint));
    const inspect = await client.callTool({
      name: 'inspect_desk',
      arguments: { kit: 'camera-a', borrower: 'member-a' },
    });
    assert.equal(inspect.structuredContent.equipment.id, 'camera-a');
    const probe = await client.callTool({
      name: 'probe_request',
      arguments: { request },
    });
    assert.equal(probe.structuredContent.workspaceId, workspace.id);
    assert.equal(
      probe.structuredContent.contrasts.find((c) => c.id === 'substitution')
        .decision.kind,
      'gap',
    );
    assert.equal(JSON.stringify(workspace), before);
  } finally {
    await client.close();
  }
});
test('tool schemas reject foreign records, extra request fields and unsupported writes', async () => {
  const { client } = await connect(makeWorkspace());
  try {
    const foreign = await client.callTool({
      name: 'inspect_desk',
      arguments: { kit: 'foreign-kit', borrower: 'member-a' },
    });
    assert.equal(foreign.isError, true);
    const invalid = await client.callTool({
      name: 'probe_request',
      arguments: { request: { ...request, operation: 'execute' } },
    });
    assert.equal(invalid.isError, true);
    const write = await client.callTool({
      name: 'execute',
      arguments: { request },
    });
    assert.equal(write.isError, true);
    const absent = await client.callTool({
      name: 'read_receipt',
      arguments: { requestId: 'another-workspace' },
    });
    assert.equal(absent.isError, true);
    const saved = await client.callTool({
      name: 'read_receipt',
      arguments: { requestId: 'request-a' },
    });
    assert.equal(saved.structuredContent.receipt.id, 'receipt-a');
  } finally {
    await client.close();
  }
});

test('the lightweight browser client interoperates with the official stateless server', async () => {
  const workspace = makeWorkspace();
  const calls = [];
  const client = new DeskToolClient(
    new URL('http://contract.test/api/mcp?workspace=workspace-a'),
    async (url, init) => {
      assert.equal(init.credentials, 'same-origin');
      const incoming = new Request(url, init);
      assert.equal(incoming.headers.get('MCP-Protocol-Version'), '2025-11-25');
      const parsed = await incoming.clone().json();
      calls.push(parsed);
      return serveDeskMcp(incoming, parsed, {
        read: async () => structuredClone(workspace),
        receipt: async () => undefined,
      });
    },
  );
  try {
    await client.connect();
    const list = await client.listTools();
    assert.equal(list.tools.length, 3);
    const result = await client.callTool({
      name: 'probe_request',
      arguments: { request },
    });
    assert.equal(result.structuredContent.revision, 4);
    assert.equal(result.structuredContent.decision.kind, 'ready');
    assert.equal(calls[1].method, 'notifications/initialized');
    assert.equal(calls[1].id, undefined);
  } finally {
    await client.close();
  }
});

test('the browser client rejects an unrelated response and closes pending requests', async () => {
  const unrelated = new DeskToolClient(
    new URL('http://contract.test/api/mcp'),
    async () => Response.json({ jsonrpc: '2.0', id: 99, result: {} }),
  );
  await assert.rejects(unrelated.connect(), /did not match/);
  await unrelated.close();
  const pending = new DeskToolClient(
    new URL('http://contract.test/api/mcp'),
    async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          'abort',
          () => reject(new Error('aborted')),
          { once: true },
        );
      }),
  );
  const connection = pending.connect();
  await pending.close();
  await assert.rejects(connection, /cancelled/);
  await assert.rejects(pending.listTools(), /Connect/);
});
