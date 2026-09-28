'use client';
import { useState, type SyntheticEvent } from 'react';
import {
  ArrowRight,
  Check,
  Download,
  FileUp,
  LoaderCircle,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { handoff, readiness } from '@/lib/operations';
import type { Kit, Workspace } from '@/lib/desk';
import type { Mutation as Mutate } from '@/lib/api-types';
type Props = {
  workspace: Workspace;
  mutate: Mutate;
  busy: string;
  announce: (message: string) => void;
};
export function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const when = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function DeskOverview({
  workspace,
  navigate,
}: {
  workspace: Workspace;
  navigate: (v: string) => void;
}) {
  const d = workspace.data,
    checks = readiness(d),
    today = new Date().toISOString().slice(0, 10);
  const loans = d.kits
    .filter((k) => k.borrower)
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''));
  const maintenance = d.kits.filter((k) => k.maintenance && !k.archived);
  return (
    <div className="overview-layout">
      <section className="daily-desk">
        <div className="section-heading">
          <h2>Before the next shift.</h2>
          <span className="status-pill">
            {d.policy.activeVersion === d.policy.version
              ? 'Shift open'
              : 'Shift closed'}
          </span>
        </div>
        <p className="section-description">
          A live view of your saved desk. Follow up on the loans below, then
          leave the next operator a precise record.
        </p>
        <div className="desk-totals">
          <span>
            <strong>{loans.length}</strong> on loan
          </span>
          <span>
            <strong>
              {
                d.kits.filter(
                  (k) => !k.borrower && !k.archived && !k.maintenance,
                ).length
              }
            </strong>{' '}
            available
          </span>
          <span>
            <strong>{maintenance.length}</strong> in maintenance
          </span>
        </div>
        <div className="section-heading loan-heading">
          <h3>Open loans</h3>
          <Button variant="ghost" onClick={() => navigate('rehearse')}>
            Open the desk <ArrowRight />
          </Button>
        </div>
        {loans.length ? (
          <div className="loan-list">
            {loans.map((k) => (
              <div className="loan-row" key={k.id}>
                <div>
                  <strong>{k.name}</strong>
                  <p>
                    {d.borrowers.find((b) => b.id === k.borrower)?.name} ·{' '}
                    {k.components.length - k.returned.length} components
                    outstanding
                  </p>
                </div>
                <span
                  className={
                    'status-pill ' + (k.due && k.due < today ? 'attention' : '')
                  }
                >
                  {k.due && k.due < today ? 'Overdue · ' : 'Due '}
                  {k.due}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="quiet-empty">
            <Check />
            <p>Everything is accounted for.</p>
            <span>Open loans appear here when a checkout is committed.</span>
          </div>
        )}
        {maintenance.length > 0 && (
          <section className="maintenance-list">
            <h3>
              <Wrench /> Follow up on maintenance
            </h3>
            {maintenance.map((k) => (
              <p key={k.id}>
                <strong>{k.name}</strong> — {k.maintenance}
              </p>
            ))}
          </section>
        )}
        <div className="handoff-strip">
          <div>
            <h3>Leave a useful handoff.</h3>
            <p>
              Open loans, instructions, follow-up and recent receipts in one
              editable document.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              download(
                'understudy-handoff.md',
                handoff(workspace),
                'text/markdown',
              )
            }
          >
            <Download /> Download handoff
          </Button>
        </div>
      </section>
      <aside className="readiness-sheet">
        <ShieldCheck />
        <h2>Ready to delegate?</h2>
        <p>
          These checks describe the desk’s setup. The server checks each request
          again before committing it.
        </p>
        <ol>
          {checks.map((check) => (
            <li key={check.label}>
              <span
                className={
                  check.done ? 'readiness-check done' : 'readiness-check'
                }
              >
                {check.done ? <Check /> : <span />}
              </span>
              <div>
                <strong>{check.label}</strong>
                {!check.done && (
                  <>
                    <p>{check.detail}</p>
                    <button onClick={() => navigate(check.view)}>
                      Complete this step <ArrowRight />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
        <span className="readiness-footer">
          {checks.filter((c) => c.done).length} of {checks.length} setup checks
          complete
        </span>
      </aside>
    </div>
  );
}

export function ImportPanel({ workspace, mutate, busy, announce }: Props) {
  const [csv, setCsv] = useState(''),
    [rows, setRows] = useState<
      Pick<Kit, 'name' | 'category' | 'components'>[] | null
    >(null),
    [error, setError] = useState('');
  async function inspect(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    try {
      const r = await mutate('previewImport', { csv });
      setRows(r.rows || []);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function commit() {
    setError('');
    try {
      const r = await mutate('importEquipment', { csv });
      announce(`Imported ${r.imported} equipment records.`);
      setRows(null);
      setCsv('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="import-workbench">
      <div className="import-copy">
        <FileUp />
        <h2>Bring your existing inventory.</h2>
        <p>
          Paste a CSV or choose a file. Review every row before anything is
          saved to {workspace.name}.
        </p>
        <Button
          variant="outline"
          onClick={() =>
            download(
              'equipment-template.csv',
              'name,category,components\nProjector 01,AV,"Projector, Power lead"\n',
              'text/csv',
            )
          }
        >
          <Download /> Get the CSV template
        </Button>
        <p className="helper">
          One row per physical item. Use the column names{' '}
          <code>name,category,components</code>. Wrap component lists in quotes.
          Up to 100 rows per import.
        </p>
      </div>
      <form className="import-form" onSubmit={inspect}>
        <label className="field">
          Choose a CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={!!busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 120000) {
                setError('Choose a CSV smaller than 120 KB.');
                return;
              }
              setCsv(await file.text());
              setRows(null);
              setError('');
            }}
          />
        </label>
        <label className="field">
          CSV contents
          <Textarea
            required
            value={csv}
            maxLength={40000}
            rows={9}
            placeholder={
              'name,category,components\nProjector 01,AV,"Projector, Power lead"'
            }
            onChange={(e) => {
              setCsv(e.target.value);
              setRows(null);
            }}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!!busy || !csv.trim()}>
          {busy === 'previewImport' ? (
            <LoaderCircle className="spin" />
          ) : (
            <FileUp />
          )}{' '}
          Review import
        </Button>
      </form>
      {rows && (
        <section className="import-review">
          <div className="section-heading">
            <h3>
              {rows.length} {rows.length === 1 ? 'item' : 'items'} ready for
              review
            </h3>
            <Button disabled={!!busy} onClick={commit}>
              {busy === 'importEquipment' ? (
                <LoaderCircle className="spin" />
              ) : (
                <Check />
              )}{' '}
              Import these records
            </Button>
          </div>
          <div className="import-rows">
            {rows.map((r, i) => (
              <div key={i}>
                <strong>{r.name}</strong>
                <span>{r.category}</span>
                <p>{r.components.join(' · ')}</p>
              </div>
            ))}
          </div>
          <p className="helper">
            All rows save together. Duplicate names or invalid records stop the
            entire import.
          </p>
        </section>
      )}
    </section>
  );
}

export function EquipmentEditor({
  kit,
  close,
  mutate,
  busy,
  announce,
}: {
  kit: Kit;
  close: () => void;
  mutate: Mutate;
  busy: string;
  announce: Props['announce'];
}) {
  const [name, setName] = useState(kit.name),
    [category, setCategory] = useState(kit.category),
    [components, setComponents] = useState(kit.components.join(', ')),
    [maintenance, setMaintenance] = useState(kit.maintenance || ''),
    [error, setError] = useState('');
  async function save(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await mutate('editEquipment', {
        kit: kit.id,
        name,
        category,
        components,
        maintenance,
      });
      announce('Equipment updated.');
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function archive() {
    try {
      await mutate('archiveEquipment', {
        kit: kit.id,
        archived: !kit.archived,
      });
      announce(kit.archived ? 'Equipment restored.' : 'Equipment archived.');
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent className="desk-dialog">
        <DialogTitle>Edit equipment</DialogTitle>
        <DialogDescription>
          Keep the record current. Past receipts retain the original equipment
          name.
        </DialogDescription>
        <form className="record-form" onSubmit={save}>
          <label className="field">
            Equipment name
            <Input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            Category
            <Input
              required
              maxLength={60}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>
          <label className="field">
            Components
            <Textarea
              required
              value={components}
              onChange={(e) => setComponents(e.target.value)}
              disabled={!!kit.borrower}
              maxLength={1000}
            />
          </label>
          {kit.borrower && (
            <p className="helper">
              The manifest is locked until this loan is returned.
            </p>
          )}
          <label className="field">
            Maintenance note
            <Textarea
              value={maintenance}
              onChange={(e) => setMaintenance(e.target.value)}
              maxLength={500}
              placeholder="Leave blank when this equipment is ready to lend."
            />
          </label>
          <p className="helper">
            A maintenance note blocks new loans and renewals. Returns remain
            available.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={!!busy} type="submit">
            {busy ? <LoaderCircle className="spin" /> : <Check />} Save
            equipment
          </Button>
          <Button
            variant="outline"
            disabled={!!busy || !!kit.borrower || !!kit.holds}
            type="button"
            onClick={archive}
          >
            {kit.archived ? 'Restore equipment' : 'Archive equipment'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RehearsalArchive({ workspace }: { workspace: Workspace }) {
  return (
    <section className="saved-rehearsals">
      <h2>Practice, with a paper trail.</h2>
      <p className="section-description">
        Each saved rehearsal records the policy, request and contrasting
        outcome. It never changes inventory.
      </p>
      {!!workspace.data.archivedCounts?.rehearsals && (
        <p className="section-description">
          {workspace.data.archivedCounts.rehearsals} earlier rehearsals are
          retained in the full workspace export.
        </p>
      )}
      {workspace.data.rehearsals?.length ? (
        workspace.data.rehearsals.map((r) => (
          <details key={r.id} className="rehearsal-detail">
            <summary>
              <span>
                <strong>{r.decision.title}</strong>
                <small>
                  {r.request.action} · Policy v{r.policyVersion}
                  {r.policyVersion !== workspace.data.policy.version
                    ? ' · Previous instructions'
                    : ''}
                </small>
              </span>
              <time>{when(r.at)}</time>
            </summary>
            <div className="rehearsal-pair">
              <section>
                <h3>Recorded request</h3>
                <p>{r.decision.explanation}</p>
                <small>
                  {r.decision.kind} ·{' '}
                  {r.decision.refs.join(', ') || 'Record selection'}
                </small>
              </section>
              <section>
                <h3>
                  {r.request.confirmed ? 'Without' : 'With'} borrower
                  confirmation
                </h3>
                <p>{r.contrast.explanation}</p>
                <small>
                  {r.contrast.kind} ·{' '}
                  {r.contrast.refs.join(', ') || 'Record selection'}
                </small>
              </section>
            </div>
          </details>
        ))
      ) : (
        <p className="quiet-empty">
          Save a rehearsal in the rehearsal room to start this record.
        </p>
      )}
    </section>
  );
}

export function WorkspaceSettings({
  workspace,
  mutate,
  busy,
  announce,
}: Props) {
  const [name, setName] = useState(workspace.name),
    [confirm, setConfirm] = useState(''),
    [error, setError] = useState('');
  return (
    <div className="settings-layout">
      <section>
        <h2>Your workspace, your records.</h2>
        <form
          className="record-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await mutate('rename', { name });
              announce('Workspace renamed.');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label className="field">
            Workspace name
            <Input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button
            type="submit"
            disabled={!!busy || name.trim() === workspace.name}
          >
            Save name
          </Button>
        </form>
        <section className="integration-status">
          <h3>Connected services</h3>
          <div>
            <span>Private storage</span>
            <strong>Connected</strong>
          </div>
          <div>
            <span>Configured rule evaluation</span>
            <strong>Available</strong>
          </div>
          <div>
            <span>Alexa+ / Amazon Bedrock</span>
            <span>Not connected</span>
          </div>
          <p>
            Handbook text is stored for your review. Current decisions use the
            lending rules you explicitly approve.
          </p>
        </section>
      </section>
      <section className="data-controls">
        <h3>Keep a copy.</h3>
        <p>
          Export your policy history, receipts, rehearsal runs and records
          before removing a workspace.
        </p>
        <Button
          variant="outline"
          disabled={!!busy}
          onClick={async () => {
            try {
              const r = await mutate('export');
              download(
                'understudy-workspace.json',
                JSON.stringify(r, null, 2),
                'application/json',
              );
              announce('Workspace exported.');
            } catch {}
          }}
        >
          <Download /> Export all records
        </Button>
        <div className="delete-workspace">
          <h3>Delete this workspace</h3>
          <p>
            This permanently removes its stored records. Complete all open loans
            first. Type <strong>{workspace.name}</strong> to confirm.
          </p>
          <label className="field">
            Confirm workspace name
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
            />
          </label>
          <Button
            variant="outline"
            disabled={
              !!busy ||
              confirm !== workspace.name ||
              workspace.data.kits.some((k) => k.borrower)
            }
            onClick={async () => {
              try {
                await mutate('deleteWorkspace', { confirmName: confirm });
                announce('Workspace deleted.');
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <X /> Permanently delete workspace
          </Button>
        </div>
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
