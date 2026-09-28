import { env } from 'cloudflare:workers';
import { DeskError, type Workspace, type Desk, type Receipt } from './desk';
import {
  partitionDesk,
  eventKinds,
  archiveInsertSql,
  workspaceUpdateSql,
  workspaceReadSql,
  archiveReadSql,
  type EventKind,
} from './archive';
export function db() {
  if (!env.DB)
    throw new DeskError(
      'Workspace storage is unavailable. Please try again later.',
      503,
    );
  return env.DB;
}
export async function getWorkspace(
  owner: string,
  id: string,
): Promise<Workspace> {
  const row = await db()
    .prepare(
      'SELECT id,name,revision,data FROM workspaces WHERE id=? AND owner=?',
    )
    .bind(id, owner)
    .first<{ id: string; name: string; revision: number; data: string }>();
  if (!row) throw new DeskError('Workspace not found.', 404);
  return { ...row, data: JSON.parse(row.data) };
}
export async function saveWorkspace(
  owner: string,
  workspace: Workspace,
  data: Desk,
) {
  const { desk, archives } = partitionDesk(data);
  const statements = [];
  for (const kind of eventKinds) {
    const entries = archives.filter((a) => a.kind === kind);
    for (let offset = 0; offset < entries.length; offset += 100) {
      statements.push(
        db()
          .prepare(archiveInsertSql)
          .bind(
            workspace.id,
            owner,
            kind,
            JSON.stringify(entries.slice(offset, offset + 100)),
            workspace.id,
            owner,
            workspace.revision,
          ),
      );
    }
  }
  statements.push(
    db()
      .prepare(workspaceUpdateSql)
      .bind(
        JSON.stringify(desk),
        workspace.name,
        new Date().toISOString(),
        workspace.id,
        owner,
        workspace.revision,
      ),
  );
  const results = await db().batch(statements);
  const updated = results[results.length - 1];
  if (updated.meta.changes !== 1)
    throw new DeskError(
      'Another request updated this workspace. Refresh and retry; your action was not saved.',
      409,
    );
  return { ...workspace, revision: workspace.revision + 1, data: desk };
}

export async function findArchivedReceipt(
  owner: string,
  id: string,
  requestId: string,
) {
  const row = await db()
    .prepare(
      "SELECT data FROM workspace_archives WHERE workspace_id=? AND owner=? AND kind='receipts' AND event_key=?",
    )
    .bind(id, owner, requestId)
    .first<{ data: string }>();
  return row ? (JSON.parse(row.data) as Receipt) : undefined;
}

export async function exportWorkspace(owner: string, workspace: Workspace) {
  // Both reads share one D1 batch transaction. A concurrent compaction cannot
  // put an event in both the old recent list and the new archive in one export.
  const [current, archived] = await db().batch([
    db().prepare(workspaceReadSql).bind(workspace.id, owner),
    db().prepare(archiveReadSql).bind(workspace.id, owner),
  ]);
  const row = current.results[0] as
    | { id: string; name: string; revision: number; data: string }
    | undefined;
  if (!row) throw new DeskError('Workspace not found.', 404);
  const rows = archived.results as { kind: EventKind; data: string }[];
  const data: Desk = JSON.parse(row.data);
  for (const kind of eventKinds) {
    const entries = [
      ...(data[kind] || []),
      ...rows.filter((r) => r.kind === kind).map((r) => JSON.parse(r.data)),
    ];
    entries.sort((a, b) => b.at.localeCompare(a.at));
    data[kind] = entries;
  }
  return { ...row, data };
}
