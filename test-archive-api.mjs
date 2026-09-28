// Seeds only a test-created local workspace to exercise the old capacity boundary through D1 and HTTP.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync } from 'node:fs';
import { emptyDesk, applyAction } from './work/test-build/desk.js';
const root = process.env.UNDERSTUDY_TEST_URL || 'http://localhost:4320';
if (!['localhost', '127.0.0.1'].includes(new URL(root).hostname))
  throw new Error('Local development server only.');
const headers = {
  'Content-Type': 'application/json',
  Origin: root,
  Cookie: '__sites_local_auth=1',
};
const call = async (input, status = 200) => {
  const res = await fetch(root + '/api/desk', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30000),
  });
  const out = await res.json();
  assert.equal(res.status, status, JSON.stringify(out));
  return out;
};
const name = 'Archive boundary fixture ' + Date.now();
let w = await call({ operation: 'create', name, sample: false });
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const directory = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const candidates = readdirSync(directory).filter(
  (p) => p.endsWith('.sqlite') && p !== 'metadata.sqlite',
);
let fixtureDb;
for (const candidate of candidates) {
  const db = new DatabaseSync(directory + '/' + candidate);
  try {
    if (
      db
        .prepare('SELECT id FROM workspaces WHERE id=? AND name=?')
        .get(w.id, name)
    ) {
      fixtureDb = db;
      break;
    }
  } catch {
    /* A different local D1 binding. */
  }
  db.close();
}
if (!fixtureDb)
  throw new Error(
    'The test-created workspace was not found in local D1 storage.',
  );
fixtureDb.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
function localSql(sql) {
  fixtureDb.exec(sql);
}

try {
  const d = emptyDesk(true);
  d.policy.activeVersion = d.policy.rehearsedVersion = 1;
  const req = {
    action: 'checkout',
    borrower: 'ari',
    kit: 'kit-02',
    requestedKit: 'kit-02',
    confirmed: true,
  };
  const receipt = applyAction(d, req, 'original').receipt;
  d.receipts = Array.from({ length: 3000 }, (_, i) => ({
    ...receipt,
    requestId: `boundary-${i}`,
    id: `fixture-${i}`,
  }));
  d.kits[1].returned = ['Camera body', 'Lens', 'Battery'];
  localSql(
    `UPDATE workspaces SET data=${quote(JSON.stringify(d))} WHERE id=${quote(w.id)} AND name=${quote(name)};`,
  );
  const result = await call({
    operation: 'execute',
    id: w.id,
    revision: w.revision,
    requestId: 'final-return',
    request: { ...req, action: 'return', component: 'Charger' },
  });
  w = result.workspace;
  assert.equal(w.data.kits[1].borrower, null);
  assert.equal(w.data.archivedCounts.receipts, 2501);
  assert.equal(w.data.receipts.length, 500);
  w = (await call({ operation: 'revoke', id: w.id, revision: w.revision }))
    .workspace;
  const replay = await call({
    operation: 'execute',
    id: w.id,
    revision: 1,
    requestId: 'boundary-2999',
    request: req,
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.receipt.id, 'fixture-2999');
  await call(
    {
      operation: 'execute',
      id: w.id,
      revision: w.revision,
      requestId: 'boundary-2999',
      request: { ...req, confirmed: false },
    },
    409,
  );
  const full = await call({ operation: 'export', id: w.id });
  assert.equal(full.data.receipts.length, 3001);
  assert.equal(new Set(full.data.receipts.map((r) => r.requestId)).size, 3001);
  // Close the other sample loan before exercising the normal delete endpoint.
  d.kits[0].borrower = null;
  localSql(
    `UPDATE workspaces SET data=json_set(data,'$.kits[0].borrower',NULL) WHERE id=${quote(w.id)} AND name=${quote(name)};`,
  );
  await call({
    operation: 'deleteWorkspace',
    id: w.id,
    revision: w.revision,
    confirmName: name,
  });
  assert.equal(
    fixtureDb
      .prepare(
        'SELECT COUNT(*) AS n FROM workspace_archives WHERE workspace_id=?',
      )
      .get(w.id).n,
    0,
  );
  console.log(
    'PASS: real local D1 final return at 3000 receipts, archival, closed-shift historical retry, conflicting retry, complete export and deletion cascade.',
  );
} finally {
  localSql(
    `DELETE FROM workspaces WHERE id=${quote(w.id)} AND name=${quote(name)};`,
  );
  fixtureDb.close();
}
