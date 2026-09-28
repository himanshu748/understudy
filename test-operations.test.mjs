import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDesk, evaluate, applyAction } from './work/test-build/desk.js';
import {
  parseEquipmentCsv,
  importEquipment,
  manageRecord,
  saveRehearsal,
  handoff,
  readiness,
} from './work/test-build/operations.js';
const request = {
  action: 'checkout',
  borrower: 'ari',
  kit: 'kit-02',
  requestedKit: 'kit-02',
  confirmed: true,
};
const csv =
  'name,category,components\r\n"Projector, west",AV,"Projector, Power lead"\r\nRecorder,Audio,"Recorder, Cable"';
test('CSV preserves quoted commas, escaped quotes and BOM; rejects malformed or duplicate rows', () => {
  assert.equal(parseEquipmentCsv('\ufeff' + csv)[0].name, 'Projector, west');
  assert.equal(
    parseEquipmentCsv('name,category,components\n"Kit ""A""",AV,Body')[0].name,
    'Kit "A"',
  );
  for (const source of [
    'x,y,z\na,b,c',
    'name,category,components\nA,B,"unclosed',
    'name,category,components\nA,B,C\na,b,c',
    'name,category,components\nA,B,"Body, body"',
    'name,category,components\nA,B,Body,Charger',
  ])
    assert.throws(() => parseEquipmentCsv(source));
});
test('a failed import leaves equipment unchanged; retrying an imported set refuses duplicates', () => {
  const d = emptyDesk();
  importEquipment(d, csv);
  const before = JSON.stringify(d);
  assert.throws(() => importEquipment(d, csv));
  assert.equal(JSON.stringify(d), before);
  assert.throws(() =>
    importEquipment(
      d,
      'name,category,components\nNew,AV,Body\nRecorder,Audio,Cable',
    ),
  );
  assert.equal(JSON.stringify(d), before);
  assert.equal(d.audit.length, 1);
});
test('maintenance prevents loans and extensions while component return stays available', () => {
  const d = emptyDesk(true);
  d.kits[1].maintenance = 'Check lens mount';
  assert.equal(evaluate(d, request).kind, 'blocked');
  d.kits[1].borrower = 'ari';
  assert.equal(evaluate(d, { ...request, action: 'renew' }).kind, 'blocked');
  assert.equal(
    evaluate(d, { ...request, action: 'return', component: 'Lens' }).kind,
    'ready',
  );
});
test('archive cannot hide open loans or waiting holds; restore re-enables otherwise eligible records', () => {
  const d = emptyDesk(true);
  assert.throws(() =>
    manageRecord(d, {
      operation: 'archiveEquipment',
      kit: 'kit-01',
      archived: true,
    }),
  );
  assert.throws(() =>
    manageRecord(d, {
      operation: 'archiveBorrower',
      borrower: 'leila',
      archived: true,
    }),
  );
  manageRecord(d, {
    operation: 'archiveEquipment',
    kit: 'kit-02',
    archived: true,
  });
  assert.equal(evaluate(d, request).kind, 'blocked');
  manageRecord(d, {
    operation: 'archiveEquipment',
    kit: 'kit-02',
    archived: false,
  });
  assert.equal(evaluate(d, request).kind, 'ready');
});
test('editing an on-loan component manifest is blocked', () => {
  const d = emptyDesk(true);
  assert.throws(() =>
    manageRecord(d, {
      operation: 'editEquipment',
      kit: 'kit-01',
      name: 'new',
      category: 'AV',
      components: 'Body',
      maintenance: '',
    }),
  );
  manageRecord(d, {
    operation: 'editEquipment',
    kit: 'kit-01',
    name: 'Camera updated',
    category: 'AV',
    components: d.kits[0].components.join(', '),
    maintenance: 'Inspect on return',
  });
  assert.equal(d.kits[0].name, 'Camera updated');
});
test('saved rehearsal retains the exact request and version without changing inventory', () => {
  const d = emptyDesk(true);
  d.policy.substitution = 'confirm';
  const before = JSON.stringify(d.kits),
    r = { ...request, requestedKit: 'kit-01' };
  saveRehearsal(d, r);
  r.confirmed = false;
  d.policy.version++;
  assert.equal(d.rehearsals[0].request.confirmed, true);
  assert.equal(d.rehearsals[0].policyVersion, 1);
  assert.equal(d.rehearsals[0].decision.kind, 'ready');
  assert.equal(d.rehearsals[0].contrast.kind, 'fact');
  assert.equal(JSON.stringify(d.kits), before);
});
test('renewal rechecks current eligibility but returns do not strand ineligible borrowers', () => {
  const d = emptyDesk(true);
  d.kits[0].holds = 0;
  d.borrowers[2].eligible = false;
  assert.equal(
    evaluate(d, {
      ...request,
      borrower: 'leila',
      kit: 'kit-01',
      action: 'renew',
    }).kind,
    'blocked',
  );
  assert.equal(
    evaluate(d, {
      ...request,
      borrower: 'leila',
      kit: 'kit-01',
      action: 'return',
      component: 'Lens',
    }).kind,
    'ready',
  );
});
test('receipt replay after a closed shift does not repeat its mutation', () => {
  const d = emptyDesk(true);
  d.policy.activeVersion = 1;
  d.policy.rehearsedVersion = 1;
  const first = applyAction(d, request, 'once');
  d.policy.activeVersion = null;
  assert.equal(applyAction(d, request, 'once').receipt.id, first.receipt.id);
  assert.equal(d.receipts.length, 1);
  assert.throws(() => applyAction(d, { ...request, confirmed: false }, 'once'));
});
test('handoff includes current outstanding components, maintenance and explicit sample provenance', () => {
  const d = emptyDesk(true);
  d.kits[0].returned = ['Lens'];
  d.kits[1].maintenance = 'Charger fault';
  const out = handoff({ id: 'test', name: 'Media desk', revision: 7, data: d });
  assert.match(out, /fictional sample/);
  assert.match(out, /3 components outstanding/);
  assert.match(out, /Charger fault/);
  assert.equal(readiness(emptyDesk()).filter((r) => r.done).length, 0);
});
