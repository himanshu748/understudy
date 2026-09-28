'use client';

import { useId, useState, type RefObject } from 'react';
import {
  ArrowRight,
  Check,
  CornerDownLeft,
  PackageOpen,
  Pencil,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Kit, Workspace } from '@/lib/desk';

type Props = {
  workspace: Workspace;
  kits: Kit[];
  pickerRef: RefObject<HTMLSelectElement | null>;
  selectedId: string;
  onSelect: (id: string) => void;
  onEdit: (kit: Kit) => void;
  onPrepareReturn: (kit: Kit, component: string) => void;
};

export function KitContents({
  workspace,
  kits,
  pickerRef,
  selectedId,
  onSelect,
  onEdit,
  onPrepareReturn,
}: Props) {
  const pickerId = useId();
  const kit =
    kits.find((k) => k.id === selectedId) ||
    kits.find((k) => !k.archived) ||
    kits[0];
  if (!kit) return null;
  return (
    <section className="kit-workbench" aria-label="Kit contents">
      <header className="kit-workbench-header">
        <div>
          <h2>Inside this kit.</h2>
          <p>See what belongs together, and what still needs to come back.</p>
        </div>
        <div className="kit-picker">
          <label htmlFor={pickerId}>Equipment to inspect</label>
          <select
            ref={pickerRef}
            id={pickerId}
            value={kit.id}
            onChange={(e) => onSelect(e.target.value)}
          >
            {kits.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {k.archived ? ' · Archived' : ''}
              </option>
            ))}
          </select>
        </div>
      </header>
      <Contents
        key={kit.id}
        kit={kit}
        workspace={workspace}
        onEdit={onEdit}
        onPrepareReturn={onPrepareReturn}
      />
    </section>
  );
}

function Contents({
  kit,
  workspace,
  onEdit,
  onPrepareReturn,
}: Pick<Props, 'workspace' | 'onEdit' | 'onPrepareReturn'> & { kit: Kit }) {
  const [selected, setSelected] = useState(
    kit.components.find((c) => !kit.returned.includes(c)) || kit.components[0],
  );
  const [expanded, setExpanded] = useState(false);
  const component = kit.components.includes(selected)
    ? selected
    : kit.components[0];
  const returned = kit.returned.includes(component);
  const borrower = workspace.data.borrowers.find((b) => b.id === kit.borrower);
  const status = kit.borrower
    ? returned
      ? 'Return recorded'
      : 'Outstanding'
    : kit.archived
      ? 'Archived kit'
      : kit.maintenance
        ? 'Held for maintenance'
        : 'Available kit';
  const remaining = kit.components.filter(
    (c) => !kit.returned.includes(c),
  ).length;
  return (
    <div className="kit-workbench-body">
      <div className="kit-manifest">
        <div className="kit-manifest-heading">
          <span>
            <PackageOpen size={19} />
            {kit.name}
          </span>
          <span>
            {kit.borrower
              ? `${kit.returned.length} of ${kit.components.length} returned`
              : `${kit.components.length} components`}
          </span>
        </div>
        <fieldset className="kit-part-grid">
          <legend className="sr-only">Recorded components</legend>
          {(expanded ? kit.components : kit.components.slice(0, 6)).map(
            (part, index) => {
              const back = kit.borrower && kit.returned.includes(part);
              return (
                <button
                  key={part}
                  type="button"
                  className={`kit-part ${back ? 'is-returned' : ''}`}
                  aria-pressed={component === part}
                  onClick={() => setSelected(part)}
                >
                  <span className="kit-part-marker" aria-hidden="true">
                    {back ? (
                      <Check size={17} />
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </span>
                  <span className="kit-part-name">{part}</span>
                  <span className="kit-part-state">
                    {kit.borrower
                      ? back
                        ? 'Returned'
                        : 'To return'
                      : 'On the manifest'}
                  </span>
                  <ArrowRight
                    className="kit-part-arrow"
                    size={16}
                    aria-hidden="true"
                  />
                </button>
              );
            },
          )}
        </fieldset>
        {kit.components.length > 6 && (
          <Button
            variant="ghost"
            onClick={() => {
              setExpanded(!expanded);
              if (expanded) setSelected(kit.components[0]);
            }}
          >
            {expanded
              ? 'Show fewer parts'
              : `Show all ${kit.components.length} parts`}
          </Button>
        )}
        <p className="kit-manifest-note">
          This is the saved component list. Select a part to inspect its record.
        </p>
      </div>
      <div className="kit-part-detail" aria-live="polite" aria-atomic="true">
        <div key={`${component}:${status}`} className="kit-detail-state">
          <span
            className={`kit-detail-status ${kit.borrower && !returned ? 'is-outstanding' : ''}`}
          >
            {returned ? (
              <Check size={15} />
            ) : kit.maintenance ? (
              <Wrench size={15} />
            ) : (
              <PackageOpen size={15} />
            )}
            {status}
          </span>
          <h3>{component}</h3>
          {kit.borrower ? (
            <p>
              {returned
                ? 'A return has been recorded for this part.'
                : `This part is still outstanding on ${borrower?.name || 'the borrower'}’s loan.`}{' '}
              {remaining === 1
                ? 'One part remains before the loan closes.'
                : `${remaining} parts remain before the loan closes.`}
            </p>
          ) : (
            <p>
              {kit.archived
                ? 'This kit is archived. Restore its record before lending it again.'
                : kit.maintenance
                  ? 'The kit is held from new loans until its maintenance note is cleared.'
                  : 'This component belongs to a kit with no recorded open loan.'}
            </p>
          )}
          {kit.due && (
            <dl className="kit-detail-facts">
              <div>
                <dt>Due back</dt>
                <dd>{kit.due}</dd>
              </div>
              <div>
                <dt>Borrower</dt>
                <dd>{borrower?.name || kit.borrower}</dd>
              </div>
            </dl>
          )}
          {kit.maintenance && (
            <p className="kit-maintenance-note">
              <Wrench size={16} />
              {kit.maintenance}
            </p>
          )}
        </div>
        <div className="kit-detail-actions">
          {!!kit.borrower && !returned && (
            <>
              <Button
                className="desk-button"
                onClick={() => onPrepareReturn(kit, component)}
              >
                <CornerDownLeft size={17} /> Prepare this return
              </Button>
              <p>
                Review the request in your working shift, then commit it when
                you have observed the return.
              </p>
            </>
          )}
          <Button variant="ghost" onClick={() => onEdit(kit)}>
            <Pencil size={15} /> Edit kit record
          </Button>
        </div>
      </div>
    </div>
  );
}
