import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyDesk, applyAction } from './work/test-build/desk.js';
import {
  partitionDesk,
  bytes,
  operationalBytes,
  archiveInsertSql,
  workspaceUpdateSql,
  workspaceReadSql,
  archiveReadSql,
} from './work/test-build/archive.js';
const request = {
  action: 'checkout',
  borrower: 'ari',
  kit: 'kit-02',
  requestedKit: 'kit-02',
  confirmed: true,
};
function crowdedDesk() {
  const d = emptyDesk(true);
  d.policy.activeVersion = d.policy.rehearsedVersion = 1;
  const receipt = applyAction(d, request, 'original').receipt;
  d.receipts = Array.from({ length: 3000 }, (_, i) => ({
    ...receipt,
    requestId: `receipt-${i}`,
    id: `fixture-${i}`,
    refs: ['Boundary fixture '.repeat(20)],
  }));
  return d;
}
test('a final component return survives the former receipt and byte limits without losing history', () => {
  const d = crowdedDesk();
  assert.ok(bytes(d) > 900000);
  d.kits[1].returned = ['Camera body', 'Lens', 'Battery'];
  applyAction(
    d,
    { ...request, action: 'return', component: 'Charger' },
    'last-return',
  );
  const saved = partitionDesk(d);
  assert.equal(saved.desk.kits[1].borrower, null);
  assert.ok(operationalBytes(saved.desk) <= 850000);
  assert.equal(saved.desk.receipts.length + saved.archives.length, 3001);
  assert.equal(saved.desk.archivedCounts.receipts, saved.archives.length);
  assert.equal(d.receipts.length, 3001, 'partition does not mutate its caller');
});
test('archived exact retries retain their receipt after the shift closes', () => {
  const { desk, archives } = partitionDesk(crowdedDesk());
  const receipt = archives.find((a) => a.kind === 'receipts').entry;
  desk.policy.activeVersion = null;
  desk.receipts.unshift(receipt);
  assert.equal(applyAction(desk, request, receipt.requestId).replayed, true);
  assert.throws(
    () =>
      applyAction(desk, { ...request, confirmed: false }, receipt.requestId),
    /different action/,
  );
});
test('capacity accounts for components still to be returned and rejects oversized active records', () => {
  const d = crowdedDesk();
  d.receipts = [];
  const reserved = operationalBytes(d);
  d.kits[1].returned = ['Lens'];
  assert.equal(operationalBytes(d), reserved);
  d.policy.handbook = 'a'.repeat(860000);
  assert.throws(() => partitionDesk(d), /active inventory/);
});
test('policy, rehearsal and activity history move into the archive without being dropped', () => {
  const d = emptyDesk();
  d.history = Array.from({ length: 25 }, (_, i) => ({
    version: 25 - i,
    at: new Date().toISOString(),
    description: 'Fixture approval',
  }));
  d.audit = Array.from({ length: 240 }, (_, i) => ({
    id: String(i),
    at: new Date().toISOString(),
    action: 'fixture',
    description: 'Fixture activity',
  }));
  d.rehearsals = Array.from({ length: 110 }, (_, i) => ({
    id: String(i),
    at: new Date().toISOString(),
    policyVersion: 1,
    request,
    decision: { kind: 'ready' },
    contrast: { kind: 'ready' },
  }));
  const { desk, archives } = partitionDesk(d);
  assert.deepEqual(desk.archivedCounts, {
    rehearsals: 10,
    history: 5,
    audit: 40,
  });
  assert.equal(archives.length, 55);
  assert.equal(partitionDesk(desk).archives.length, 0);
});
test('archive SQL and revision update are atomic, owner-scoped and stale revisions insert nothing', () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  for (const path of [
    'drizzle/0000_fine_sebastian_shaw.sql',
    'drizzle/0001_wakeful_juggernaut.sql',
  ])
    sql.exec(readFileSync(path, 'utf8'));
  sql
    .prepare('INSERT INTO workspaces VALUES(?,?,?,?,?,?)')
    .run('desk', 'owner', 'Archive fixture', 1, '{}', 'now');
  const entry = JSON.stringify([
    { key: 'receipt', entry: { requestId: 'receipt' } },
  ]);
  sql.exec('BEGIN');
  assert.equal(
    sql
      .prepare(archiveInsertSql)
      .run('desk', 'owner', 'receipts', entry, 'desk', 'owner', 1).changes,
    1,
  );
  assert.equal(
    sql
      .prepare(workspaceUpdateSql)
      .run('{}', 'Archive fixture', 'now', 'desk', 'owner', 1).changes,
    1,
  );
  sql.exec('COMMIT');
  assert.equal(
    sql
      .prepare(archiveInsertSql)
      .run(
        'desk',
        'owner',
        'receipts',
        '[{"key":"stale","entry":{}}]',
        'desk',
        'owner',
        1,
      ).changes,
    0,
  );
  assert.equal(
    sql
      .prepare(archiveInsertSql)
      .run(
        'desk',
        'other',
        'receipts',
        '[{"key":"other","entry":{}}]',
        'desk',
        'other',
        2,
      ).changes,
    0,
  );
  assert.equal(
    sql
      .prepare('SELECT COUNT(*) AS n FROM workspace_archives WHERE owner=?')
      .get('other').n,
    0,
  );
  assert.deepEqual(
    JSON.parse(sql.prepare('SELECT data FROM workspace_archives').get().data),
    { requestId: 'receipt' },
  );
  sql.exec('BEGIN');
  sql
    .prepare(archiveInsertSql)
    .run(
      'desk',
      'owner',
      'receipts',
      '[{"key":"rollback","entry":{}}]',
      'desk',
      'owner',
      2,
    );
  sql.exec('ROLLBACK');
  assert.equal(
    sql.prepare('SELECT COUNT(*) AS n FROM workspace_archives').get().n,
    1,
  );
  sql.prepare('DELETE FROM workspaces WHERE id=?').run('desk');
  assert.equal(
    sql.prepare('SELECT COUNT(*) AS n FROM workspace_archives').get().n,
    0,
  );
  sql.close();
});

test('export snapshot remains consistent when a writer archives between its two reads', () => {
  const dir = mkdtempSync(join(tmpdir(), 'understudy-export-'));
  const reader = new DatabaseSync(join(dir, 'test.sqlite'));
  const writer = new DatabaseSync(join(dir, 'test.sqlite'));
  try {
    reader.exec('PRAGMA journal_mode=WAL');
    for (const path of [
      'drizzle/0000_fine_sebastian_shaw.sql',
      'drizzle/0001_wakeful_juggernaut.sql',
    ])
      reader.exec(readFileSync(path, 'utf8'));
    reader
      .prepare('INSERT INTO workspaces VALUES(?,?,?,?,?,?)')
      .run(
        'desk',
        'owner',
        'Before',
        1,
        JSON.stringify({ receipts: [{ requestId: 'old' }] }),
        'before',
      );
    // The export batch opens its snapshot, then an independent writer compacts.
    reader.exec('BEGIN');
    const row = reader.prepare(workspaceReadSql).get('desk', 'owner');
    writer.exec('BEGIN');
    writer
      .prepare(archiveInsertSql)
      .run(
        'desk',
        'owner',
        'receipts',
        '[{"key":"old","entry":{"requestId":"old"}}]',
        'desk',
        'owner',
        1,
      );
    writer
      .prepare(workspaceUpdateSql)
      .run(
        JSON.stringify({ receipts: [{ requestId: 'new' }] }),
        'After',
        'after',
        'desk',
        'owner',
        1,
      );
    writer.exec('COMMIT');
    const history = reader.prepare(archiveReadSql).all('desk', 'owner');
    reader.exec('COMMIT');
    const ids = [
      ...JSON.parse(row.data).receipts,
      ...history.map((r) => JSON.parse(r.data)),
    ].map((r) => r.requestId);
    assert.deepEqual(ids, ['old']);
    assert.equal(row.revision, 1);
    assert.equal(row.name, 'Before');
    const latest = reader.prepare(workspaceReadSql).get('desk', 'owner');
    const latestHistory = reader.prepare(archiveReadSql).all('desk', 'owner');
    assert.deepEqual(
      [
        ...JSON.parse(latest.data).receipts,
        ...latestHistory.map((r) => JSON.parse(r.data)),
      ].map((r) => r.requestId),
      ['new', 'old'],
    );
    assert.equal(latest.revision, 2);
  } finally {
    reader.close();
    writer.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
