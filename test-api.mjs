// Exercise a local Sites development server. Only the test-created workspace is removed.
import assert from 'node:assert/strict';
const root = process.env.UNDERSTUDY_TEST_URL || 'http://localhost:4320';
if (!['localhost', '127.0.0.1'].includes(new URL(root).hostname))
  throw new Error('This development-identity test only runs on localhost.');
const headers = {
  'Content-Type': 'application/json',
  Origin: root,
  Cookie: '__sites_local_auth=1',
};
async function call(payload, expected = 200) {
  const res = await fetch(root + '/api/desk', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  assert.equal(res.status, expected, JSON.stringify(body));
  return body;
}
let w = await call({
  operation: 'create',
  name: 'API lifecycle ' + Date.now(),
  sample: false,
});
async function change(operation, payload = {}, expected = 200) {
  const r = await call(
    { operation, id: w.id, revision: w.revision, ...payload },
    expected,
  );
  if (r.workspace) w = r.workspace;
  return r;
}
assert.equal(w.data.kits.length, 0);
const csv =
  'name,category,components\nProjector east,AV,"Projector, Power lead"\nRecorder south,Audio,"Recorder, Cable"';
const revision = w.revision;
assert.equal((await change('previewImport', { csv })).rows.length, 2);
assert.equal(w.revision, revision);
await change('importEquipment', { csv });
assert.equal(w.data.kits.length, 2);
await change('importEquipment', { csv }, 400);
assert.equal(w.data.kits.length, 2);
await change('borrower', { name: 'Member A', verified: true, eligible: true });
await change('borrower', { name: 'Member B', verified: true, eligible: true });
const [kit] = w.data.kits,
  [a, b] = w.data.borrowers;
await change('editEquipment', {
  kit: kit.id,
  name: kit.name,
  category: kit.category,
  components: kit.components.join(', '),
  maintenance: 'Inspect the power lead',
});
const req = {
  action: 'checkout',
  borrower: a.id,
  kit: kit.id,
  requestedKit: kit.id,
  confirmed: true,
};
assert.equal(
  (await change('preview', { request: req })).decision.kind,
  'blocked',
);
await change('editEquipment', {
  kit: kit.id,
  name: kit.name,
  category: kit.category,
  components: kit.components.join(', '),
  maintenance: '',
});
await change('policy', {
  handbook: 'Operator entered test instructions.',
  sourceUrl: '',
  loanDays: 3,
  maxLoans: 1,
  substitution: 'confirm',
});
await change('rehearse', { request: req });
assert.equal(w.data.rehearsals.length, 1);
assert.equal(w.data.receipts.length, 0);
await change('activate');
const competing = await Promise.all(
  [a, b].map((person, i) =>
    fetch(root + '/api/desk', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operation: 'execute',
        id: w.id,
        revision: w.revision,
        requestId: 'compete-' + i,
        request: { ...req, borrower: person.id },
      }),
    }).then(async (res) => ({ status: res.status, body: await res.json(), i })),
  ),
);
assert.deepEqual(
  competing.map((r) => r.status).sort((a, b) => a - b),
  [200, 409],
);
const winner = competing.find((r) => r.status === 200);
w = winner.body.workspace;
req.borrower = [a, b][winner.i].id;
await change('archiveEquipment', { kit: kit.id, archived: true }, 409);
await change(
  'archiveBorrower',
  { borrower: req.borrower, archived: true },
  409,
);
await change(
  'editEquipment',
  {
    kit: kit.id,
    name: 'Updated name',
    category: 'AV',
    components: 'Other',
    maintenance: '',
  },
  409,
);
await change('deleteWorkspace', { confirmName: w.name }, 409);
await change('revoke');
const replay = await change('execute', {
  request: req,
  requestId: 'compete-' + winner.i,
});
assert.equal(replay.receipt.id, winner.body.receipt.id);
assert.equal(w.data.receipts.length, 1);
await change('activate');
for (const component of kit.components)
  await change('execute', {
    request: { ...req, action: 'return', component },
    requestId: crypto.randomUUID(),
  });
assert.equal(w.data.kits[0].borrower, null);
await change('archiveEquipment', { kit: kit.id, archived: true });
await change('archiveBorrower', { borrower: req.borrower, archived: true });
await change('archiveEquipment', { kit: kit.id, archived: false });
await change('archiveBorrower', { borrower: req.borrower, archived: false });
await change('rename', { name: 'Lifecycle completed' });
const stored = await fetch(root + '/api/desk?id=' + w.id, { headers }).then(
  (r) => r.json(),
);
assert.equal(stored.name, 'Lifecycle completed');
assert.equal(
  stored.data.history[0].policy.handbook,
  'Operator entered test instructions.',
);
assert.ok(stored.data.audit.length >= 8);
const exported = await change('export');
assert.equal(exported.data.receipts.length, 3);
await change('deleteWorkspace', { confirmName: 'incorrect' }, 400);
assert.equal((await fetch(root + '/api/desk')).status, 401);
assert.equal(
  (
    await fetch(root + '/api/desk', {
      headers: {
        'oai-authenticated-user-id': 'pretend',
        'oai-authenticated-user-email': 'pretend@example.test',
      },
    })
  ).status,
  401,
);
assert.equal(
  (
    await fetch(root + '/api/desk', {
      method: 'POST',
      headers: { ...headers, Origin: 'https://unrelated.example' },
      body: JSON.stringify({
        operation: 'rename',
        id: w.id,
        revision: w.revision,
        name: 'forbidden',
      }),
    })
  ).status,
  403,
);
await change('deleteWorkspace', { confirmName: w.name });
assert.equal(
  (await fetch(root + '/api/desk?id=' + w.id, { headers })).status,
  404,
);
console.log(
  'PASS: atomic import and preview, maintenance, saved rehearsal, policy snapshot, concurrent checkout, lifecycle archive guards, closed-shift replay, complete return, rename, audit/export, auth/origin guards and confirmed deletion.',
);
