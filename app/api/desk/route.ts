import { getChatGPTUser } from '@/app/chatgpt-auth';
import {
  db,
  getWorkspace,
  saveWorkspace,
  findArchivedReceipt,
  exportWorkspace,
} from '@/lib/store';
import {
  audit,
  componentList,
  importEquipment,
  manageRecord,
  parseEquipmentCsv,
  saveRehearsal,
} from '@/lib/operations';
import {
  emptyDesk,
  evaluate,
  normalizeRequest,
  applyAction,
  text,
  number,
  DeskError,
  type Policy,
} from '@/lib/desk';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function fail(error: unknown) {
  return json(
    {
      error:
        error instanceof DeskError
          ? error.message
          : 'The workspace could not complete this request. Try again.',
    },
    error instanceof DeskError ? error.status : 500,
  );
}
export async function GET(request: globalThis.Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return json({ error: 'Sign in to use your workspaces.' }, 401);
    const id = new URL(request.url).searchParams.get('id');
    if (id) return json(await getWorkspace(user.userId, id));
    const rows = await db()
      .prepare(
        'SELECT id,name,revision,updated_at FROM workspaces WHERE owner=? ORDER BY updated_at DESC',
      )
      .bind(user.userId)
      .all();
    return json({ workspaces: rows.results });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: globalThis.Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return json({ error: 'Sign in to use your workspaces.' }, 401);
    const origin = request.headers.get('origin');
    if (
      !origin ||
      origin !== new URL(request.url).origin ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      throw new DeskError('Open this workspace directly before saving.', 403);
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new DeskError('JSON is required.', 415);
    const reader = request.body?.getReader();
    if (!reader) throw new DeskError('A request body is required.');
    const decoder = new TextDecoder();
    let raw = '',
      bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 180000) {
        await reader.cancel();
        throw new DeskError('This request is too large.', 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    if (raw.length > 60000)
      throw new DeskError('This request is too large.', 413);
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      throw new DeskError('The request could not be read.');
    }
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new DeskError('A valid request is required.');
    if (input.operation === 'create') {
      const count = await db()
        .prepare('SELECT COUNT(*) AS total FROM workspaces WHERE owner=?')
        .bind(user.userId)
        .first<{ total: number }>();
      if ((count?.total ?? 0) >= 20)
        throw new DeskError(
          'This release supports up to 20 workspaces per account.',
        );
      const id = crypto.randomUUID(),
        name = text(input.name, 'Workspace name', 80),
        data = emptyDesk(input.sample === true);
      const created = await db()
        .prepare(
          'INSERT INTO workspaces(id,owner,name,revision,data,updated_at) SELECT ?,?,?,1,?,? WHERE (SELECT COUNT(*) FROM workspaces WHERE owner=?) < 20',
        )
        .bind(
          id,
          user.userId,
          name,
          JSON.stringify(data),
          new Date().toISOString(),
          user.userId,
        )
        .run();
      if (created.meta.changes !== 1)
        throw new DeskError('This account has reached 20 workspaces.', 409);
      return json({ id, name, revision: 1, data });
    }
    const workspace = await getWorkspace(
      user.userId,
      text(input.id, 'Workspace'),
    );
    if (input.operation === 'export')
      return json(await exportWorkspace(user.userId, workspace));
    const desk = structuredClone(workspace.data);
    if (input.operation === 'previewImport') {
      const rows = parseEquipmentCsv(input.csv);
      const trial = structuredClone(desk);
      importEquipment(trial, input.csv);
      return json({ rows });
    }
    if (input.operation === 'preview') {
      const r = normalizeRequest(input.request);
      return json({
        decision: evaluate(desk, r),
        contrast: evaluate(desk, { ...r, confirmed: !r.confirmed }),
        contrastLabel: r.confirmed
          ? 'Without borrower confirmation'
          : 'With borrower confirmation',
      });
    }
    // Receipt history keeps the same retry identity after it moves out of the recent desk view.
    if (input.operation === 'execute') {
      const requestId = text(input.requestId, 'Request identifier');
      const archived = desk.receipts.some((r) => r.requestId === requestId)
        ? undefined
        : await findArchivedReceipt(user.userId, workspace.id, requestId);
      if (archived) desk.receipts.unshift(archived);
      if (desk.receipts.some((r) => r.requestId === requestId)) {
        return json({
          ...applyAction(desk, normalizeRequest(input.request), requestId),
          workspace,
        });
      }
    }
    if (input.revision !== workspace.revision)
      throw new DeskError(
        'This workspace changed in another window. Refresh before saving.',
        409,
      );
    let extra: Record<string, unknown> = {};
    if (input.operation === 'rename') {
      workspace.name = text(input.name, 'Workspace name', 80);
      audit(desk, 'workspace', `Renamed workspace to ${workspace.name}.`);
    } else if (input.operation === 'deleteWorkspace') {
      if (input.confirmName !== workspace.name)
        throw new DeskError('Type the workspace name exactly before deleting.');
      if (desk.kits.some((k) => k.borrower))
        throw new DeskError(
          'Complete all open loans before deleting the workspace.',
          409,
        );
      const result = await db()
        .prepare(
          'DELETE FROM workspaces WHERE id=? AND owner=? AND revision=? RETURNING id',
        )
        .bind(workspace.id, user.userId, workspace.revision)
        .first<{ id: string }>();
      if (!result)
        throw new DeskError(
          'The workspace changed. Refresh before deleting.',
          409,
        );
      return json({ deleted: workspace.id });
    } else if (input.operation === 'importEquipment') {
      extra = { imported: importEquipment(desk, input.csv) };
    } else if (
      ['editEquipment', 'archiveEquipment', 'archiveBorrower'].includes(
        input.operation,
      )
    ) {
      manageRecord(desk, input);
    } else if (input.operation === 'borrower') {
      if (desk.borrowers.length >= 500 && !input.borrowerId)
        throw new DeskError(
          'This release supports 500 borrower records per workspace.',
        );
      const record = {
        id: input.borrowerId
          ? text(input.borrowerId, 'Borrower')
          : crypto.randomUUID(),
        name: text(input.name, 'Borrower name or reference', 100),
        verified: input.verified === true,
        eligible: input.eligible === true,
      };
      if (input.borrowerId) {
        const at = desk.borrowers.findIndex((b) => b.id === record.id);
        if (at < 0) throw new DeskError('Borrower not found.', 404);
        desk.borrowers[at] = { ...desk.borrowers[at], ...record };
      } else desk.borrowers.push(record);
      audit(
        desk,
        'borrower',
        `${input.borrowerId ? 'Updated' : 'Added'} borrower ${record.name}.`,
      );
    } else if (input.operation === 'equipment') {
      if (desk.kits.length >= 500)
        throw new DeskError(
          'This release supports 500 equipment records per workspace.',
        );
      const components = componentList(input.components);
      desk.kits.push({
        id: crypto.randomUUID(),
        name: text(input.name, 'Equipment name', 100),
        category: text(input.category, 'Category', 60),
        components,
        borrower: null,
        due: null,
        holds: 0,
        returned: [],
        renewals: 0,
      });
      audit(desk, 'equipment', `Added equipment ${desk.kits.at(-1)!.name}.`);
    } else if (input.operation === 'holds') {
      const kit = desk.kits.find((k) => k.id === input.kit);
      if (!kit) throw new DeskError('Equipment not found.', 404);
      if (kit.archived)
        throw new DeskError(
          'Restore this item before adding waiting holds.',
          409,
        );
      kit.holds = number(input.holds, 'Hold count', 0, 100);
      audit(
        desk,
        'holds',
        `Set waiting holds for ${kit.name} to ${kit.holds}.`,
      );
    } else if (input.operation === 'policy') {
      if (!['confirm', 'staff', ''].includes(input.substitution))
        throw new DeskError('Choose a substitution rule.');
      const handbook =
        typeof input.handbook === 'string' ? input.handbook.trim() : '';
      if (handbook.length > 30000)
        throw new DeskError('Use up to 30,000 characters of handbook text.');
      const sourceUrl =
        typeof input.sourceUrl === 'string' ? input.sourceUrl.trim() : '';
      if (sourceUrl) {
        let url;
        try {
          url = new URL(sourceUrl);
        } catch {
          throw new DeskError('Enter a valid source URL.');
        }
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          sourceUrl.length > 2000
        )
          throw new DeskError('Use an HTTP or HTTPS source URL.');
      }
      desk.policy = {
        version: desk.policy.version + 1,
        handbook,
        sourceUrl,
        loanDays: number(input.loanDays, 'Loan days', 1, 365),
        maxLoans: number(input.maxLoans, 'Concurrent loans', 1, 20),
        substitution: input.substitution as Policy['substitution'],
        rehearsedVersion: null,
        activeVersion: null,
      };
      desk.history.unshift({
        version: desk.policy.version,
        policy: structuredClone(desk.policy),
        at: new Date().toISOString(),
        description: `Approved ${desk.policy.loanDays}-day loans, ${desk.policy.maxLoans} concurrent loan(s), substitution: ${desk.policy.substitution || 'unspecified'}.`,
      });
    } else if (input.operation === 'rehearse') {
      const r = normalizeRequest(input.request),
        decision = evaluate(desk, r);
      if (
        !desk.borrowers.some((b) => b.id === r.borrower) ||
        !desk.kits.some((k) => k.id === r.kit)
      )
        throw new DeskError('Choose a recorded borrower and equipment first.');
      saveRehearsal(desk, r);
      desk.policy.rehearsedVersion = desk.policy.version;
      extra = {
        decision,
        contrast: evaluate(desk, { ...r, confirmed: !r.confirmed }),
        contrastLabel: r.confirmed
          ? 'Without borrower confirmation'
          : 'With borrower confirmation',
      };
    } else if (input.operation === 'activate') {
      if (!desk.history.length)
        throw new DeskError(
          'Approve your desk instructions before opening the first shift.',
          409,
        );
      if (desk.policy.rehearsedVersion !== desk.policy.version)
        throw new DeskError(
          'Rehearse the current policy before opening a shift.',
          409,
        );
      desk.policy.activeVersion = desk.policy.version;
      audit(
        desk,
        'shift',
        `Opened a shift under policy v${desk.policy.version}.`,
      );
    } else if (input.operation === 'revoke') {
      desk.policy.activeVersion = null;
      audit(desk, 'shift', 'Closed the lending shift.');
    } else if (input.operation === 'execute') {
      extra = applyAction(
        desk,
        normalizeRequest(input.request),
        text(input.requestId, 'Request identifier'),
      );
      if (extra.decision) return json({ ...extra, workspace });
    } else throw new DeskError('Unknown workspace action.', 404);
    return json({
      ...extra,
      workspace: await saveWorkspace(user.userId, workspace, desk),
    });
  } catch (error) {
    return fail(error);
  }
}
