export type Borrower = {
  id: string;
  name: string;
  verified: boolean;
  eligible: boolean;
  archived?: boolean;
};
export type Kit = {
  id: string;
  name: string;
  category: string;
  components: string[];
  borrower: string | null;
  due: string | null;
  holds: number;
  returned: string[];
  renewals: number;
  archived?: boolean;
  maintenance?: string;
};
export type Policy = {
  version: number;
  handbook: string;
  sourceUrl: string;
  loanDays: number;
  maxLoans: number;
  substitution: 'confirm' | 'staff' | '';
  rehearsedVersion: number | null;
  activeVersion: number | null;
};
export type Request = {
  action: 'checkout' | 'renew' | 'return';
  borrower: string;
  kit: string;
  requestedKit: string;
  confirmed: boolean;
  component?: string;
};
export type Decision = {
  kind: 'ready' | 'gap' | 'fact' | 'blocked';
  title: string;
  explanation: string;
  refs: string[];
};
export type Receipt = {
  id: string;
  requestId: string;
  fingerprint: string;
  action: string;
  borrower: string;
  borrowerName: string;
  kit: string;
  kitName: string;
  policyVersion: number;
  at: string;
  due: string | null;
  refs: string[];
  component?: string;
};
export type Desk = {
  archivedCounts?: Partial<
    Record<'receipts' | 'rehearsals' | 'history' | 'audit', number>
  >;
  sample: boolean;
  policy: Policy;
  borrowers: Borrower[];
  kits: Kit[];
  receipts: Receipt[];
  history: {
    at: string;
    version: number;
    description: string;
    policy?: Policy;
  }[];
  rehearsals?: {
    id: string;
    at: string;
    policyVersion: number;
    request: Request;
    decision: Decision;
    contrast: Decision;
  }[];
  audit?: { id: string; at: string; action: string; description: string }[];
};
export type Workspace = {
  id: string;
  name: string;
  revision: number;
  data: Desk;
};
export class DeskError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function emptyDesk(sample = false): Desk {
  const desk: Desk = {
    sample,
    policy: {
      version: 1,
      handbook: '',
      sourceUrl: '',
      loanDays: 14,
      maxLoans: 1,
      substitution: '',
      rehearsedVersion: null,
      activeVersion: null,
    },
    borrowers: [],
    kits: [],
    receipts: [],
    history: [],
  };
  if (sample) {
    desk.borrowers = [
      { id: 'ari', name: 'Ari Patel', verified: true, eligible: true },
      { id: 'omar', name: 'Omar Chen', verified: false, eligible: true },
      { id: 'leila', name: 'Leila Brooks', verified: true, eligible: true },
    ];
    desk.kits = [
      {
        id: 'kit-01',
        name: 'Mirrorless kit 01',
        category: 'Camera',
        components: ['Camera body', 'Lens', 'Battery', 'Charger'],
        borrower: 'leila',
        due: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        holds: 1,
        returned: [],
        renewals: 0,
      },
      {
        id: 'kit-02',
        name: 'Mirrorless kit 02',
        category: 'Camera',
        components: ['Camera body', 'Lens', 'Battery', 'Charger'],
        borrower: null,
        due: null,
        holds: 0,
        returned: [],
        renewals: 0,
      },
    ];
    desk.policy.handbook =
      'Sample practice rules: verify eligibility and identification; one concurrent loan per borrower; 14-day loans; no renewal while someone is waiting; every component must be returned. Substitution handling has deliberately been left unspecified.';
  }
  return desk;
}
const result = (
  kind: Decision['kind'],
  title: string,
  explanation: string,
  refs: string[] = [],
): Decision => ({ kind, title, explanation, refs });
export function evaluate(desk: Desk, request: Request): Decision {
  const borrower = desk.borrowers.find((b) => b.id === request.borrower),
    kit = desk.kits.find((k) => k.id === request.kit),
    policy = desk.policy;
  if (!borrower || !kit)
    return result(
      'blocked',
      'Select the desk records',
      'Choose a borrower and an equipment record from this workspace.',
    );
  if (request.action === 'return') {
    if (kit.borrower !== borrower.id)
      return result(
        'blocked',
        'This loan belongs to someone else',
        'Match the equipment to its current borrower.',
        ['R4'],
      );
    if (!request.component || !kit.components.includes(request.component))
      return result(
        'blocked',
        'Choose a listed component',
        'Select a component from the kit manifest.',
        ['R4'],
      );
    if (kit.returned.includes(request.component))
      return result(
        'blocked',
        'Already returned',
        'This component has already been recorded.',
        ['R4'],
      );
    return result(
      'ready',
      'Record this component',
      'The loan will close when every component is back.',
      ['R4'],
    );
  }
  if (request.action === 'renew') {
    if (borrower.archived || !borrower.eligible || !borrower.verified)
      return result(
        'blocked',
        'Borrower needs operator review',
        'Confirm current eligibility and identification before extending this loan.',
        ['R1'],
      );
    if (kit.maintenance || kit.archived)
      return result(
        'blocked',
        'Equipment needs to come back',
        'This item is archived or awaiting maintenance. Complete its return before using it again.',
        ['R2'],
      );
    if (kit.borrower !== borrower.id)
      return result(
        'blocked',
        'Loan does not match',
        'This borrower does not have this equipment.',
        ['R3'],
      );
    if (kit.holds > 0)
      return result(
        'blocked',
        'Someone is waiting',
        'The desk rule blocks renewal when a hold exists.',
        ['R3'],
      );
    if (kit.renewals >= 1)
      return result(
        'gap',
        'A further renewal needs a decision',
        'The configured rule allows one extension. Handle any further extension outside this automated shift.',
        ['R3'],
      );
    return result(
      'ready',
      'Renewal permitted',
      `Extend the existing due date by ${policy.loanDays} days.`,
      ['R3'],
    );
  }
  if (request.action !== 'checkout')
    return result(
      'blocked',
      'Unsupported action',
      'Choose checkout, renewal or return.',
    );
  if (borrower.archived || kit.archived)
    return result(
      'blocked',
      'This record is archived',
      'Restore the record before creating another loan.',
      ['R2'],
    );
  if (kit.maintenance)
    return result('blocked', 'Equipment needs maintenance', kit.maintenance, [
      'R2',
    ]);
  if (!borrower.verified)
    return result(
      'fact',
      'Verify the borrower first',
      'Identification has not been recorded as verified. A policy addition cannot replace this evidence.',
      ['R1'],
    );
  if (!borrower.eligible)
    return result(
      'blocked',
      'Borrower is not eligible',
      'The operator has marked this borrower ineligible.',
      ['R1'],
    );
  if (
    desk.kits.filter((k) => k.borrower === borrower.id).length >=
    policy.maxLoans
  )
    return result(
      'blocked',
      'Loan limit reached',
      `This desk allows ${policy.maxLoans} concurrent loan${policy.maxLoans === 1 ? '' : 's'} per borrower.`,
      ['R2'],
    );
  if (kit.borrower)
    return result(
      'blocked',
      'Equipment is on loan',
      'Choose an available item. Another action may have changed availability.',
      ['R2'],
    );
  const requested = desk.kits.find((k) => k.id === request.requestedKit);
  if (!requested)
    return result(
      'blocked',
      'Choose the requested equipment',
      'Record what the borrower originally requested.',
    );
  if (requested.id !== kit.id) {
    if (!policy.substitution)
      return result(
        'gap',
        'An instruction is missing',
        'This desk has not approved a rule for offering substitute equipment.',
        ['D1'],
      );
    if (policy.substitution === 'staff')
      return result(
        'blocked',
        'Refer the substitution to staff',
        'The approved instruction reserves substitute requests for a staff member.',
        ['D1'],
      );
    if (request.confirmed !== true)
      return result(
        'fact',
        'Ask the borrower to confirm',
        'Record explicit agreement to the different equipment before checkout.',
        ['D1'],
      );
  }
  return result(
    'ready',
    'Checkout permitted',
    `Eligibility and availability are verified. The loan will be due in ${policy.loanDays} days.`,
    requested.id !== kit.id ? ['R1', 'R2', 'D1'] : ['R1', 'R2'],
  );
}
export function text(value: unknown, label: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new DeskError(`${label} is required (up to ${max} characters).`);
  return value.trim();
}
export function number(
  value: unknown,
  label: string,
  min: number,
  max: number,
) {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())
  )
    throw new DeskError(`${label} must be a number.`);
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new DeskError(`${label} must be between ${min} and ${max}.`);
  return n;
}
export function normalizeRequest(value: unknown): Request {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new DeskError('A desk request is required.');
  const r = value as Record<string, unknown>;
  if (!['checkout', 'renew', 'return'].includes(String(r.action)))
    throw new DeskError('Choose a supported action.');
  return {
    action: r.action as Request['action'],
    borrower: text(r.borrower, 'Borrower'),
    kit: text(r.kit, 'Equipment'),
    requestedKit: typeof r.requestedKit === 'string' ? r.requestedKit : '',
    confirmed: r.confirmed === true,
    component: typeof r.component === 'string' ? r.component : undefined,
  };
}
export function applyAction(
  desk: Desk,
  request: Request,
  requestId: string,
): { decision?: Decision; receipt?: Receipt; replayed?: boolean } {
  const policy = desk.policy;
  const fingerprint = JSON.stringify(request);
  const existing = desk.receipts.find((r) => r.requestId === requestId);
  if (existing) {
    if (existing.fingerprint !== fingerprint)
      throw new DeskError(
        'This request identifier was already used for a different action.',
        409,
      );
    return { receipt: existing, replayed: true };
  }
  if (
    policy.activeVersion !== policy.version ||
    policy.rehearsedVersion !== policy.version
  )
    throw new DeskError(
      'Rehearse the current policy and open a shift first.',
      409,
    );
  const decision = evaluate(desk, request);
  if (decision.kind !== 'ready') return { decision };
  const kit = desk.kits.find((k) => k.id === request.kit)!,
    borrower = desk.borrowers.find((b) => b.id === request.borrower)!;
  if (request.action === 'checkout') {
    kit.borrower = borrower.id;
    kit.due = new Date(Date.now() + policy.loanDays * 86400000)
      .toISOString()
      .slice(0, 10);
    kit.renewals = 0;
    kit.returned = [];
  }
  if (request.action === 'renew') {
    kit.due = new Date(
      new Date(kit.due + 'T12:00:00Z').valueOf() + policy.loanDays * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    kit.renewals++;
  }
  if (request.action === 'return') {
    kit.returned.push(request.component!);
    if (kit.components.every((c) => kit.returned.includes(c))) {
      kit.borrower = null;
      kit.due = null;
      kit.returned = [];
      kit.renewals = 0;
    }
  }
  const receipt: Receipt = {
    id: 'UD-' + crypto.randomUUID().slice(0, 8).toUpperCase(),
    requestId,
    fingerprint,
    action: request.action,
    borrower: borrower.id,
    borrowerName: borrower.name,
    kit: kit.id,
    kitName: kit.name,
    policyVersion: policy.version,
    at: new Date().toISOString(),
    due: kit.due,
    refs: decision.refs,
    ...(request.action === 'return' ? { component: request.component } : {}),
  };
  desk.receipts.unshift(receipt);
  return { receipt };
}
