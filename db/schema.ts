import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    revision: integer('revision').notNull().default(1),
    data: text('data').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('workspaces_owner_idx').on(table.owner)],
);
export const workspaceArchives = sqliteTable(
  'workspace_archives',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    owner: text('owner').notNull(),
    kind: text('kind').notNull(),
    eventKey: text('event_key').notNull(),
    data: text('data').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.kind, table.eventKey] }),
    index('workspace_archives_owner_idx').on(table.owner, table.workspaceId),
  ],
);
