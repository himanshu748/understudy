import {
  evaluate,
  normalizeRequest,
  DeskError,
  type Desk,
  type Decision,
  type Request,
  type Workspace,
} from './desk.js';

export type Contrast = {
  id: string;
  question: string;
  field: string;
  before: string;
  after: string;
  decision: Decision;
  changedOutcome: boolean;
};
export type Probe = {
  workspaceId: string;
  revision: number;
  policyVersion: number;
  request: Request;
  decision: Decision;
  contrasts: Contrast[];
  checkedAt: string;
};

// Each probe changes one recorded fact or request field on a separate clone.
// It never treats handbook prose as machine-interpreted policy or changes saved data.
export function probeRequest(workspace: Workspace, input: Request): Probe {
  const request = normalizeRequest(input);
  const desk = workspace.data;
  const borrower = desk.borrowers.find((b) => b.id === request.borrower);
  const kit = desk.kits.find((k) => k.id === request.kit);
  if (!borrower || !kit)
    throw new DeskError('Choose equipment and a borrower in this workspace.');
  const decision = evaluate(desk, request);
  const contrasts: Contrast[] = [];
  const add = (
    id: string,
    question: string,
    field: string,
    before: string,
    after: string,
    change: (copy: Desk, next: Request) => void,
  ) => {
    const copy = structuredClone(desk),
      next = { ...request };
    change(copy, next);
    const result = evaluate(copy, next);
    contrasts.push({
      id,
      question,
      field,
      before,
      after,
      decision: result,
      changedOutcome:
        result.kind !== decision.kind || result.title !== decision.title,
    });
  };
  if (request.action !== 'return') {
    add(
      'identity',
      borrower.verified
        ? 'What if identity has not been checked?'
        : 'What if staff verifies identity?',
      'Borrower identity',
      borrower.verified ? 'Verified' : 'Unverified',
      borrower.verified ? 'Unverified' : 'Verified',
      (copy) => {
        copy.borrowers.find((b) => b.id === borrower.id)!.verified =
          !borrower.verified;
      },
    );
    add(
      'eligibility',
      borrower.eligible
        ? 'What if the borrower is ineligible?'
        : 'What if eligibility is confirmed?',
      'Borrower eligibility',
      borrower.eligible ? 'Eligible' : 'Ineligible',
      borrower.eligible ? 'Ineligible' : 'Eligible',
      (copy) => {
        copy.borrowers.find((b) => b.id === borrower.id)!.eligible =
          !borrower.eligible;
      },
    );
    add(
      'maintenance',
      kit.maintenance
        ? 'What if staff clears maintenance?'
        : 'What if the kit needs maintenance?',
      'Maintenance note',
      kit.maintenance || 'None',
      kit.maintenance ? 'None' : 'Inspection required',
      (copy) => {
        copy.kits.find((k) => k.id === kit.id)!.maintenance = kit.maintenance
          ? ''
          : 'Inspection required';
      },
    );
  }
  if (request.action === 'renew') {
    add(
      'hold',
      kit.holds
        ? 'What if nobody is waiting?'
        : 'What if another borrower is waiting?',
      'Waiting borrowers',
      String(kit.holds),
      kit.holds ? '0' : '1',
      (copy) => {
        copy.kits.find((k) => k.id === kit.id)!.holds = kit.holds ? 0 : 1;
      },
    );
  }
  if (request.action === 'checkout') {
    if (request.kit !== request.requestedKit) {
      add(
        'confirmation',
        request.confirmed
          ? 'What if the substitute was not confirmed?'
          : 'What if the borrower confirms the substitute?',
        'Substitution confirmation',
        String(request.confirmed),
        String(!request.confirmed),
        (_copy, next) => {
          next.confirmed = !request.confirmed;
        },
      );
    } else {
      const alternate = desk.kits.find((k) => k.id !== kit.id && !k.archived);
      if (alternate)
        add(
          'substitution',
          'What if the borrower originally asked for something else?',
          'Originally requested equipment',
          kit.name,
          alternate.name,
          (_copy, next) => {
            next.requestedKit = alternate.id;
          },
        );
    }
  }
  if (request.action === 'return' && request.component) {
    const recorded = kit.returned.includes(request.component);
    add(
      'recorded-return',
      recorded
        ? 'What if this part was still outstanding?'
        : 'What if this part was already recorded?',
      'Selected component returned',
      String(recorded),
      String(!recorded),
      (copy) => {
        const target = copy.kits.find((k) => k.id === kit.id)!;
        target.returned = recorded
          ? target.returned.filter((part) => part !== request.component)
          : [...target.returned, request.component!];
      },
    );
  }
  return {
    workspaceId: workspace.id,
    revision: workspace.revision,
    policyVersion: desk.policy.version,
    request,
    decision,
    contrasts,
    checkedAt: new Date().toISOString(),
  };
}
