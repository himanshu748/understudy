import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyDesk,
  evaluate,
  applyAction,
  normalizeRequest,
} from './work/test-build/desk.js';
const request = {
  action: 'checkout',
  borrower: 'ari',
  kit: 'kit-02',
  requestedKit: 'kit-01',
  confirmed: true,
};
function active() {
  const d = emptyDesk(true);
  d.policy.substitution = 'confirm';
  d.policy.rehearsedVersion = 1;
  d.policy.activeVersion = 1;
  return d;
}
test('new operator desk has no fabricated records', () => {
  const d = emptyDesk();
  assert.equal(d.kits.length, 0);
  assert.equal(d.borrowers.length, 0);
  assert.equal(d.sample, false);
});
test('example distinguishes missing instruction, evidence and source refusal', () => {
  const d = emptyDesk(true);
  assert.equal(evaluate(d, request).kind, 'gap');
  assert.equal(evaluate(d, { ...request, borrower: 'omar' }).kind, 'fact');
  assert.equal(
    evaluate(d, { action: 'renew', borrower: 'leila', kit: 'kit-01' }).kind,
    'blocked',
  );
});
test('evaluation is pure and confirmation cannot bypass staff rule', () => {
  const d = active(),
    before = JSON.stringify(d);
  assert.equal(evaluate(d, request).kind, 'ready');
  assert.equal(JSON.stringify(d), before);
  d.policy.substitution = 'staff';
  assert.equal(evaluate(d, request).kind, 'blocked');
  d.policy.substitution = 'confirm';
  assert.equal(evaluate(d, { ...request, confirmed: false }).kind, 'fact');
});
test('custom operator equipment and configured loan length are supported', () => {
  const d = emptyDesk();
  d.borrowers = [
    { id: 'member-1', name: 'Member 001', verified: true, eligible: true },
  ];
  d.kits = [
    {
      id: 'projector',
      name: 'Studio projector',
      category: 'AV',
      components: ['Projector', 'Power lead'],
      borrower: null,
      due: null,
      holds: 0,
      returned: [],
      renewals: 0,
    },
  ];
  d.policy.loanDays = 3;
  d.policy.rehearsedVersion = 1;
  d.policy.activeVersion = 1;
  const r = applyAction(
    d,
    {
      ...request,
      borrower: 'member-1',
      kit: 'projector',
      requestedKit: 'projector',
    },
    'custom',
  );
  assert.equal(r.receipt.kitName, 'Studio projector');
  assert.equal(
    d.kits[0].due,
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  );
});
test('retry has one receipt, conflicting reuse is rejected', () => {
  const d = active();
  const r = applyAction(d, request, 'same');
  assert.equal(applyAction(d, request, 'same').receipt.id, r.receipt.id);
  assert.equal(d.receipts.length, 1);
  assert.throws(() => applyAction(d, { ...request, confirmed: false }, 'same'));
});
test('policy changes and closed shifts invalidate execution', () => {
  let d = active();
  d.policy.version++;
  assert.throws(() => applyAction(d, request, 'x'));
  d = active();
  d.policy.activeVersion = null;
  assert.throws(() => applyAction(d, request, 'x'));
});
test('all components are required to close a loan; duplicate returns fail', () => {
  const d = active();
  applyAction(d, request, 'checkout');
  let i = 0;
  for (const component of d.kits[1].components) {
    const r = { ...request, action: 'return', component };
    applyAction(d, r, 'return-' + i++);
    if (i < 4) {
      assert.equal(d.kits[1].borrower, 'ari');
      assert.equal(evaluate(d, r).kind, 'blocked');
    }
  }
  assert.equal(d.kits[1].borrower, null);
  assert.equal(d.receipts.length, 5);
});
test('unknown records and ineligible borrowers fail closed', () => {
  const d = active();
  assert.equal(evaluate(d, { ...request, kit: 'unknown' }).kind, 'blocked');
  d.borrowers[0].eligible = false;
  assert.equal(evaluate(d, request).kind, 'blocked');
});
test('renewal obeys holds and allows only one extension', () => {
  const d = active(),
    r = { action: 'renew', borrower: 'leila', kit: 'kit-01' };
  assert.equal(evaluate(d, r).kind, 'blocked');
  d.kits[0].holds = 0;
  assert.equal(evaluate(d, r).kind, 'ready');
  applyAction(d, r, 'extend');
  assert.equal(evaluate(d, r).kind, 'gap');
});
test('second borrower cannot check out committed equipment', () => {
  const d = active();
  applyAction(d, request, 'first');
  d.borrowers[1].verified = true;
  assert.equal(evaluate(d, { ...request, borrower: 'omar' }).kind, 'blocked');
});
test('untrusted request fields are normalized and confirmation is strict boolean', () => {
  assert.equal(
    normalizeRequest({ ...request, confirmed: 'true', extra: 'ignored' })
      .confirmed,
    false,
  );
  assert.equal('extra' in normalizeRequest({ ...request, extra: 'x' }), false);
  assert.throws(() => normalizeRequest({ ...request, action: 'delete' }));
});
