// Uses only the public fictional demonstration. Never creates or reads private records.
import assert from 'node:assert/strict';
import { DeskToolClient } from './work/test-build/mcp-browser.js';
const root = process.env.UNDERSTUDY_TEST_URL || 'http://localhost:4320';
if (!['localhost', '127.0.0.1'].includes(new URL(root).hostname))
  throw new Error('Run this check against localhost.');
const fetcher = (input, init) =>
  fetch(input, { ...init, headers: { ...init.headers, Origin: root } });
const endpoint = root + '/api/demo/mcp';
const request = {
  action: 'checkout',
  kit: 'kit-02',
  requestedKit: 'kit-01',
  borrower: 'ari',
  confirmed: true,
};
for (const [instruction, expected] of [
  ['missing', 'gap'],
  ['confirm', 'ready'],
]) {
  const client = new DeskToolClient(
    new URL(endpoint + '?instruction=' + instruction),
    fetcher,
  );
  await client.connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [
    'inspect_desk',
    'probe_request',
    'read_receipt',
  ]);
  const result = await client.callTool({
    name: 'probe_request',
    arguments: { request },
  });
  assert.equal(result.structuredContent.decision.kind, expected);
  assert.equal(result.structuredContent.workspaceId, 'fictional-demo');
  const inspection = await client.callTool({
    name: 'inspect_desk',
    arguments: { kit: 'kit-02', borrower: 'ari' },
  });
  assert.match(inspection.structuredContent.scope, /Fictional/);
  const foreign = await client.callTool({
    name: 'inspect_desk',
    arguments: { kit: 'private-record', borrower: 'ari' },
  });
  assert.equal(foreign.isError, true);
  const receipt = await client.callTool({
    name: 'read_receipt',
    arguments: { requestId: 'any-private-receipt' },
  });
  assert.equal(receipt.isError, true);
  if (instruction === 'confirm') {
    const consent = await client.callTool({
      name: 'probe_request',
      arguments: { request: { ...request, confirmed: false } },
    });
    assert.equal(consent.structuredContent.decision.kind, 'fact');
  }
  await client.close();
}
const headers = { 'Content-Type': 'application/json', Origin: root };
/** @type {Array<[string, RequestInit, number]>} */
const cases = [
  [endpoint, { method: 'GET' }, 405],
  [
    endpoint,
    {
      method: 'POST',
      headers: { ...headers, Origin: 'https://foreign.example' },
      body: '{}',
    },
    403,
  ],
  [
    endpoint,
    {
      method: 'POST',
      headers: { ...headers, 'sec-fetch-site': 'cross-site' },
      body: '{}',
    },
    403,
  ],
  [endpoint, { method: 'POST', headers: { Origin: root }, body: '{}' }, 415],
  [
    endpoint + '?workspace=private-workspace',
    { method: 'POST', headers, body: '{}' },
    400,
  ],
  [
    endpoint + '?instruction=unexpected',
    { method: 'POST', headers, body: '{}' },
    400,
  ],
  [endpoint, { method: 'POST', headers, body: '[' }, 400],
  [endpoint, { method: 'POST', headers, body: '[]' }, 400],
  [endpoint, { method: 'POST', headers, body: 'x'.repeat(64001) }, 413],
];
for (const [url, options, status] of cases) {
  const response = await fetch(url, options);
  assert.equal(response.status, status, `${options.method} ${url}`);
  // Vinext rejects a foreign Origin before this route and returns plain Forbidden.
  if (options.headers?.Origin === 'https://foreign.example') {
    assert.equal(await response.text(), 'Forbidden');
  } else {
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
}
for (const [policy, confirmed, expected] of [
  ['source', true, 'gap'],
  ['addition', true, 'ready'],
  ['addition', false, 'fact'],
]) {
  const response = await fetch(
    `${root}/api/example?policy=${policy}&confirmed=${confirmed}`,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).kind, expected);
}
console.log(
  'Demo API passed: MCP negotiation, both policies, consent boundary, provenance, private-record isolation, nine HTTP guards and three landing stages.',
);
