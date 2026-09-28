import {
  DeskError,
  evaluate,
  text,
  type Desk,
  type Kit,
  type Request,
  type Workspace,
} from './desk.js';

export function audit(desk: Desk, action: string, description: string) {
  desk.audit ??= [];
  desk.audit.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action,
    description,
  });
}

export function componentList(value: unknown): string[] {
  const components = text(value, 'Component list', 1000)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    !components.length ||
    components.length > 30 ||
    components.some((c) => c.length > 100) ||
    new Set(components.map((c) => c.toLowerCase())).size !== components.length
  )
    throw new DeskError(
      'List 1–30 distinct components, each up to 100 characters.',
    );
  return components;
}

// CSV is parsed without evaluating cell contents. The preview and commit share this parser.
export function parseEquipmentCsv(
  source: unknown,
): Pick<Kit, 'name' | 'category' | 'components'>[] {
  const csv = text(source, 'CSV data', 40000).replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false,
    closed = false;
  for (let i = 0; i <= csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === undefined)
        throw new DeskError(
          'An opening quote in the CSV is missing its closing quote.',
        );
      if (c === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
    } else if (c === ',' || c === '\n' || c === '\r' || c === undefined) {
      row.push(field.trim());
      field = '';
      closed = false;
      if (c !== ',') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (c === '\r' && csv[i + 1] === '\n') i++;
      }
    } else if (c === '"' && !field && !closed) quoted = true;
    else {
      if (closed || c === '"')
        throw new DeskError('CSV quotes must wrap an entire field.');
      field += c;
    }
  }
  if (
    rows
      .shift()
      ?.map((s) => s.toLowerCase())
      .join(',') !== 'name,category,components'
  )
    throw new DeskError('The first row must be: name,category,components');
  if (!rows.length || rows.length > 100)
    throw new DeskError('Import between 1 and 100 equipment rows at a time.');
  const seen = new Set<string>();
  return rows.map((r, i) => {
    if (r.length !== 3)
      throw new DeskError(
        `CSV row ${i + 2} must have three columns. Wrap a comma-separated component list in quotes.`,
      );
    const name = text(r[0], `Row ${i + 2} equipment name`, 100);
    if (seen.has(name.toLowerCase()))
      throw new DeskError(
        `The name “${name}” appears twice. Give each physical item a distinct name.`,
      );
    seen.add(name.toLowerCase());
    return {
      name,
      category: text(r[1], `Row ${i + 2} category`, 60),
      components: componentList(r[2]),
    };
  });
}

export function importEquipment(desk: Desk, source: unknown) {
  const records = parseEquipmentCsv(source);
  if (desk.kits.length + records.length > 500)
    throw new DeskError(
      'This import would exceed the limit of 500 equipment records.',
    );
  const existing = new Set(desk.kits.map((k) => k.name.toLowerCase()));
  for (const record of records)
    if (existing.has(record.name.toLowerCase()))
      throw new DeskError(
        `“${record.name}” already exists. Rename it in the import first.`,
      );
  for (const record of records)
    desk.kits.push({
      ...record,
      id: crypto.randomUUID(),
      borrower: null,
      due: null,
      holds: 0,
      returned: [],
      renewals: 0,
    });
  audit(
    desk,
    'import',
    `Imported ${records.length} equipment records from CSV.`,
  );
  return records.length;
}

export function manageRecord(desk: Desk, input: Record<string, unknown>) {
  if (input.operation === 'editEquipment') {
    const kit = desk.kits.find((k) => k.id === input.kit);
    if (!kit) throw new DeskError('Equipment not found.', 404);
    const components = componentList(input.components);
    if (
      kit.borrower &&
      JSON.stringify(components) !== JSON.stringify(kit.components)
    )
      throw new DeskError(
        'Return this loan before changing its component manifest.',
        409,
      );
    kit.name = text(input.name, 'Equipment name', 100);
    kit.category = text(input.category, 'Category', 60);
    kit.components = components;
    const maintenance =
      typeof input.maintenance === 'string' ? input.maintenance.trim() : '';
    if (maintenance.length > 500)
      throw new DeskError('Use up to 500 characters for the maintenance note.');
    kit.maintenance = maintenance;
    audit(
      desk,
      'equipment',
      `Updated ${kit.name}${maintenance ? '; held for maintenance' : ''}.`,
    );
  } else if (input.operation === 'archiveEquipment') {
    const kit = desk.kits.find((k) => k.id === input.kit);
    if (!kit) throw new DeskError('Equipment not found.', 404);
    if (typeof input.archived !== 'boolean')
      throw new DeskError('Choose archive or restore.');
    if (input.archived && (kit.borrower || kit.holds))
      throw new DeskError(
        'Resolve this item’s loan and waiting holds before archiving it.',
        409,
      );
    kit.archived = input.archived;
    audit(
      desk,
      'equipment',
      `${kit.archived ? 'Archived' : 'Restored'} ${kit.name}.`,
    );
  } else if (input.operation === 'archiveBorrower') {
    const borrower = desk.borrowers.find((b) => b.id === input.borrower);
    if (!borrower) throw new DeskError('Borrower not found.', 404);
    if (typeof input.archived !== 'boolean')
      throw new DeskError('Choose archive or restore.');
    if (input.archived && desk.kits.some((k) => k.borrower === borrower.id))
      throw new DeskError(
        'Complete this borrower’s returns before archiving them.',
        409,
      );
    borrower.archived = input.archived;
    audit(
      desk,
      'borrower',
      `${borrower.archived ? 'Archived' : 'Restored'} ${borrower.name}.`,
    );
  } else throw new DeskError('Unknown record action.');
}

export function saveRehearsal(desk: Desk, request: Request) {
  desk.rehearsals ??= [];
  const run = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    policyVersion: desk.policy.version,
    request: structuredClone(request),
    decision: evaluate(desk, request),
    contrast: evaluate(desk, { ...request, confirmed: !request.confirmed }),
  };
  desk.rehearsals.unshift(run);
  return run;
}

export function readiness(desk: Desk) {
  return [
    {
      label: 'Equipment recorded',
      done: desk.kits.some((k) => !k.archived),
      detail: 'Add at least one active equipment record.',
      view: 'equipment',
    },
    {
      label: 'Borrower evidence verified',
      done: desk.borrowers.some((b) => !b.archived && b.verified && b.eligible),
      detail: 'Record an eligible borrower and confirm identification.',
      view: 'borrowers',
    },
    {
      label: 'Instructions approved',
      done: desk.history.length > 0,
      detail: 'Approve the explicit lending settings in your handbook.',
      view: 'policy',
    },
    {
      label: 'Substitution boundary chosen',
      done: !!desk.policy.substitution,
      detail: 'Choose borrower confirmation or a staff-only decision.',
      view: 'policy',
    },
    {
      label: 'Current instructions rehearsed',
      done: desk.policy.rehearsedVersion === desk.policy.version,
      detail: 'Save a contrasting request under the current policy.',
      view: 'rehearse',
    },
  ];
}

export function handoff(workspace: Workspace) {
  const d = workspace.data;
  const clean = (s: string) => s.replace(/[\r\n]/g, ' ');
  const lines = [
    `# ${clean(workspace.name)} — desk handoff`,
    '',
    `Generated: ${new Date().toISOString()}`,
    `Workspace revision: ${workspace.revision}`,
    `Records: ${d.sample ? 'fictional sample workspace' : 'operator entered'}`,
    `Shift: ${d.policy.activeVersion === d.policy.version ? 'open' : 'closed'}`,
    '',
    '## Approved instructions',
    `Policy version: ${d.policy.version}`,
    `Loan period: ${d.policy.loanDays} days`,
    `Concurrent loans: ${d.policy.maxLoans}`,
    `Substitution: ${d.policy.substitution || 'not specified'}`,
    '',
    '## Open loans',
  ];
  const loans = d.kits.filter((k) => k.borrower);
  for (const k of loans)
    lines.push(
      `- ${clean(k.name)} — ${clean(d.borrowers.find((b) => b.id === k.borrower)?.name || 'Unknown borrower')}; due ${k.due}; ${k.components.length - k.returned.length} components outstanding${k.holds ? `; ${k.holds} waiting hold(s)` : ''}.`,
    );
  if (!loans.length) lines.push('No open loans.');
  lines.push('', '## Operator follow-up');
  const pending = readiness(d).filter((r) => !r.done);
  pending.forEach((r) => lines.push(`- ${r.detail}`));
  d.kits
    .filter((k) => k.maintenance)
    .forEach((k) =>
      lines.push(`- Maintenance: ${clean(k.name)} — ${clean(k.maintenance!)}`),
    );
  if (!pending.length && !d.kits.some((k) => k.maintenance))
    lines.push('No outstanding setup or maintenance checks.');
  lines.push('', '## Recent receipts');
  d.receipts
    .slice(0, 20)
    .forEach((r) =>
      lines.push(
        `- ${r.at} · ${r.id}: ${r.action} · ${clean(r.kitName)} · ${clean(r.borrowerName)} · policy v${r.policyVersion}.`,
      ),
    );
  lines.push(
    '',
    'This handoff uses saved records and configured rules. Handbook prose has not been interpreted by an AI model.',
  );
  return lines.join('\n');
}
