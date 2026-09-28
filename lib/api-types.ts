import type { Decision, Kit, Receipt, Workspace } from './desk';
export type WorkspaceSummary = { id: string; name: string; revision: number };
export type ApiResult = Partial<Workspace> & {
  workspace?: Workspace;
  workspaces?: WorkspaceSummary[];
  decision?: Decision;
  contrast?: Decision;
  contrastLabel?: string;
  receipt?: Receipt;
  replayed?: boolean;
  deleted?: string;
  error?: string;
  imported?: number;
  rows?: Pick<Kit, 'name' | 'category' | 'components'>[];
};
export type Mutation = (
  operation: string,
  payload?: Record<string, unknown>,
) => Promise<ApiResult>;
export function workspaceResult(value: ApiResult): Workspace {
  if (
    !value.id ||
    typeof value.name !== 'string' ||
    typeof value.revision !== 'number' ||
    !value.data
  )
    throw new Error(
      'The server returned an incomplete workspace. Refresh to load the saved record.',
    );
  return {
    id: value.id,
    name: value.name,
    revision: value.revision,
    data: value.data,
  };
}
