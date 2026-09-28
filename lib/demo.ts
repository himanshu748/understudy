import { emptyDesk, type Workspace } from './desk.js';

// Fresh, fictional data only. This module must never import the account store.
export function demoWorkspace(instruction = false): Workspace {
  const data = emptyDesk(true);
  data.kits.forEach((kit) => {
    if (kit.due) kit.due = '2026-10-12';
  });
  // Lead with the available camera so the first rehearsal shows a valid baseline.
  data.kits.reverse();
  if (instruction) {
    data.policy.substitution = 'confirm';
    data.policy.version = 2;
  }
  return {
    id: 'fictional-demo',
    name: 'Sample media desk',
    revision: instruction ? 2 : 1,
    data,
  };
}
