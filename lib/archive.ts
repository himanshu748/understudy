import { DeskError, type Desk } from './desk.js';
export const eventKinds = [
  'receipts',
  'rehearsals',
  'history',
  'audit',
] as const;
export type EventKind = (typeof eventKinds)[number];
type Entry =
  | Desk['receipts'][number]
  | NonNullable<Desk['rehearsals']>[number]
  | Desk['history'][number]
  | NonNullable<Desk['audit']>[number];
const limits = { receipts: 500, rehearsals: 100, history: 20, audit: 200 };
export function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
// Reserve the space needed to record every outstanding component before accepting more work.
export function operationalBytes(desk: Desk) {
  return bytes({
    ...desk,
    kits: desk.kits.map((k) =>
      k.borrower ? { ...k, returned: k.components } : k,
    ),
  });
}
export function partitionDesk(data: Desk) {
  const desk = structuredClone(data),
    archives: { kind: EventKind; key: string; entry: Entry }[] = [];
  desk.archivedCounts ??= {};
  function archiveOldest(kind: EventKind) {
    const entry = desk[kind]?.pop();
    if (!entry) return false;
    const key =
      'requestId' in entry
        ? entry.requestId
        : 'id' in entry
          ? entry.id
          : String(entry.version);
    archives.push({ kind, key, entry });
    desk.archivedCounts![kind] = (desk.archivedCounts![kind] || 0) + 1;
    return true;
  }
  for (const kind of eventKinds)
    while ((desk[kind]?.length || 0) > limits[kind]) archiveOldest(kind);
  // Keep headroom for the next receipt even when inventory and handbook are large.
  for (const kind of eventKinds) {
    const minimum = kind === 'history' ? 1 : 0;
    while (
      operationalBytes(desk) > 850000 &&
      (desk[kind]?.length || 0) > minimum
    )
      archiveOldest(kind);
  }
  if (operationalBytes(desk) > 850000)
    throw new DeskError(
      'The active inventory and handbook are too large. Shorten these records before adding more; the saved desk is unchanged.',
      413,
    );
  return { desk, archives };
}

// Archives and the revision update run in one D1 transaction. Stale revisions insert nothing.
export const archiveInsertSql = `INSERT OR IGNORE INTO workspace_archives(workspace_id,owner,kind,event_key,data)
SELECT ?,?,?,json_extract(value,'$.key'),json_extract(value,'$.entry') FROM json_each(?)
WHERE EXISTS(SELECT 1 FROM workspaces WHERE id=? AND owner=? AND revision=?)`;
export const workspaceUpdateSql =
  'UPDATE workspaces SET data=?, name=?, revision=revision+1, updated_at=? WHERE id=? AND owner=? AND revision=?';

export const workspaceReadSql =
  'SELECT id,name,revision,data FROM workspaces WHERE id=? AND owner=?';
export const archiveReadSql =
  'SELECT kind,data FROM workspace_archives WHERE workspace_id=? AND owner=?';
