import test from 'node:test';
import assert from 'node:assert/strict';
import { demoWorkspace } from './work/test-build/demo.js';
import { probeRequest } from './work/test-build/probe.js';

test('demo scenarios expose a gap, close it with consent, and preserve the boundary without consent', () => {
  const source = demoWorkspace();
  const request = {
    action: 'checkout',
    kit: 'kit-02',
    requestedKit: 'kit-02',
    borrower: 'ari',
    confirmed: true,
  };
  const original = probeRequest(source, request);
  assert.equal(original.decision.kind, 'ready');
  assert.equal(
    original.contrasts.find((c) => c.id === 'substitution').decision.kind,
    'gap',
  );
  const substitution = { ...request, requestedKit: 'kit-01' };
  assert.equal(probeRequest(source, substitution).decision.kind, 'gap');
  assert.equal(
    probeRequest(demoWorkspace(true), substitution).decision.kind,
    'ready',
  );
  assert.equal(
    probeRequest(demoWorkspace(true), { ...substitution, confirmed: false })
      .decision.kind,
    'fact',
  );
});
test('fictional demo records are fresh and cannot carry changes between visitors or scenarios', () => {
  const a = demoWorkspace();
  a.data.borrowers[0].name = 'Changed';
  a.data.policy.substitution = 'confirm';
  const b = demoWorkspace();
  assert.equal(b.data.borrowers[0].name, 'Ari Patel');
  assert.equal(b.data.policy.substitution, '');
  assert.equal(b.data.sample, true);
  assert.deepEqual(b.data.receipts, []);
  assert.deepEqual(demoWorkspace(), b);
  assert.notEqual(b.revision, demoWorkspace(true).revision);
});
