'use client';
import Link from 'next/link';
import { KitContents } from './kit-contents';
import { AgentRehearsal } from './agent-rehearsal';
import {
  workspaceResult,
  type ApiResult,
  type Mutation,
} from '@/lib/api-types';
import {
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
  type ReactNode,
} from 'react';
import {
  DeskOverview,
  ImportPanel,
  EquipmentEditor,
  RehearsalArchive,
  WorkspaceSettings,
} from './operations';
import {
  Home,
  Workflow,
  Settings2,
  FileUp,
  Pencil,
  Archive,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Download,
  FlaskConical,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  evaluate,
  type Workspace,
  type Request,
  type Decision,
  type Receipt,
  type Borrower,
  type Kit,
} from '@/lib/desk';

type Summary = { id: string; name: string; revision: number };
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
async function api(payload?: Record<string, unknown>, id?: string) {
  const response = await fetch(
    '/api/desk' + (id ? '?id=' + encodeURIComponent(id) : ''),
    payload
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        }
      : { cache: 'no-store', signal: AbortSignal.timeout(20000) },
  ).catch((error: Error) => {
    throw new Error(
      error.name === 'TimeoutError'
        ? 'The server took too long to respond. Refresh to check whether your action saved before trying again.'
        : 'The connection was interrupted. Reconnect and refresh to check your saved records.',
    );
  });
  const data = (await response.json()) as ApiResult;
  if (!response.ok)
    throw new Error(data.error || 'This action could not be completed.');
  return data;
}
function Choice({
  label,
  value,
  onChange,
  items,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <Select
        value={value || null}
        onValueChange={(v) => onChange(String(v ?? ''))}
        items={items}
        disabled={disabled}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function Tick({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="check-field">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <span>{label}</span>
    </label>
  );
}
function Submit({
  busy,
  children,
  disabled = false,
}: {
  busy: boolean;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button type="submit" disabled={busy || disabled} className="desk-button">
      {busy ? <LoaderCircle className="spin" /> : null}
      {children}
      {!busy && <ArrowRight />}
    </Button>
  );
}
function Verdict({ decision }: { decision: Decision }) {
  return (
    <div
      className={'verdict ' + decision.kind}
      key={decision.kind + decision.title}
    >
      <div>
        {decision.kind === 'ready' ? <CheckCircle2 /> : <CircleAlert />}
        <h3>{decision.title}</h3>
      </div>
      <p>{decision.explanation}</p>
      <div className="rule-refs">
        {decision.refs.map((ref) => (
          <span key={ref}>{ref}</span>
        ))}
      </div>
    </div>
  );
}
function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-surface">
      {icon}
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

export default function DeskApp({
  displayName,
  signOutPath,
}: {
  displayName: string;
  signOutPath: string;
}) {
  const [list, setList] = useState<Summary[]>([]),
    [workspace, setWorkspace] = useState<Workspace | null>(null),
    [loading, setLoading] = useState(true),
    [view, setView] = useState('overview'),
    [busy, setBusy] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [dialog, setDialog] = useState<
      'workspace' | 'equipment' | 'borrower' | null
    >(null),
    [borrower, setBorrower] = useState<Borrower | null>(null),
    [filter, setFilter] = useState(''),
    [equipment, setEquipment] = useState<Kit | null>(null),
    [showArchived, setShowArchived] = useState(false),
    [online, setOnline] = useState(true),
    [inspectedKitId, setInspectedKitId] = useState(''),
    [requestSeed, setRequestSeed] = useState<{
      request: Request;
      sequence: number;
      workspaceId: string;
    } | null>(null);
  const kitPickerRef = useRef<HTMLSelectElement>(null);
  const visibleKits = (workspace?.data.kits || []).filter(
    (kit) =>
      (showArchived || !kit.archived) &&
      (kit.name + ' ' + kit.category)
        .toLowerCase()
        .includes(filter.toLowerCase()),
  );
  function prepareReturn(kit: Kit, component: string) {
    if (!workspace || !kit.borrower || kit.returned.includes(component)) return;
    setRequestSeed((old) => ({
      sequence: (old?.sequence || 0) + 1,
      workspaceId: workspace.id,
      request: {
        action: 'return',
        kit: kit.id,
        requestedKit: kit.id,
        borrower: kit.borrower!,
        component,
        confirmed: false,
      },
    }));
    setView('rehearse');
  }
  const lock = useRef(false),
    loadSequence = useRef(0),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function announce(text: string) {
    setMessage(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(''), 5000);
  }
  async function load(id?: string) {
    const seq = ++loadSequence.current;
    setLoading(true);
    setError('');
    try {
      const response = id ? await api(undefined, id) : await api();
      if (seq !== loadSequence.current) return;
      if (id) setWorkspace(workspaceResult(response));
      else {
        setList(response.workspaces || []);
        if (response.workspaces?.length) {
          const current = await api(undefined, response.workspaces[0].id);
          if (seq === loadSequence.current)
            setWorkspace(workspaceResult(current));
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (seq === loadSequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();
    const start = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      window.clearTimeout(start);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);
  const mutate: Mutation = async (operation, payload = {}) => {
    if (lock.current)
      throw new Error('A save is already in progress. Wait for it to finish.');
    lock.current = true;
    setBusy(operation);
    setError('');
    try {
      const response = await api({
        operation,
        ...(workspace
          ? { id: workspace.id, revision: workspace.revision }
          : {}),
        ...payload,
      });
      if (response.workspace) {
        const saved = response.workspace;
        setWorkspace(saved);
        setList((prev) =>
          prev.map((w) =>
            w.id === saved.id
              ? { ...w, name: saved.name, revision: saved.revision }
              : w,
          ),
        );
      }
      if (response.deleted) {
        setWorkspace(null);
        setList((prev) => prev.filter((w) => w.id !== response.deleted));
        setView('overview');
      }
      if (operation === 'create') {
        const created = workspaceResult(response);
        setWorkspace(created);
        setList((prev) => [
          { id: created.id, name: created.name, revision: 1 },
          ...prev,
        ]);
        setView(created.data.sample ? 'agent' : 'equipment');
      }
      return response;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      lock.current = false;
      setBusy('');
    }
  };
  async function safe(
    operation: string,
    payload: Record<string, unknown> = {},
    notice = 'Saved.',
  ) {
    try {
      await mutate(operation, payload);
      announce(notice);
    } catch {}
  }
  async function exportDesk() {
    try {
      const data = await mutate('export');
      const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        }),
        url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = 'understudy-workspace.json';
      link.click();
      URL.revokeObjectURL(url);
      announce('Workspace exported.');
    } catch {}
  }
  const navigation = [
    { id: 'overview', label: 'Today’s desk', icon: Home },
    { id: 'agent', label: 'Agent rehearsal', icon: Workflow },
    { id: 'rehearse', label: 'Rehearsal room', icon: FlaskConical },
    { id: 'equipment', label: 'Equipment', icon: Boxes },
    { id: 'borrowers', label: 'Borrowers', icon: Users },
    { id: 'policy', label: 'Desk handbook', icon: BookOpen },
    { id: 'receipts', label: 'Decision log', icon: ClipboardList },
    { id: 'import', label: 'Import inventory', icon: FileUp },
    { id: 'settings', label: 'Workspace settings', icon: Settings2 },
  ];
  const title = navigation.find((n) => n.id === view)?.label;
  return (
    <SidebarProvider>
      <a className="skip" href="#workspace-main">
        Skip to workspace
      </a>
      <Sidebar className="studio-sidebar">
        <SidebarHeader>
          <Link href="/" className="brand">
            Understudy<span>.</span>
          </Link>
          <div className="desk-picker">
            <span className="rail-label">WORKSPACE</span>
            {list.length > 0 ? (
              <Choice
                label="Current workspace"
                value={workspace?.id || ''}
                onChange={(id) => {
                  if (!busy) {
                    setFilter('');
                    void load(id);
                  }
                }}
                items={list.map((w) => ({ value: w.id, label: w.name }))}
                disabled={!!busy}
              />
            ) : (
              <p>Your private desks</p>
            )}
            <Button
              variant="ghost"
              onClick={() => setDialog('workspace')}
              className="new-workspace"
              disabled={loading || !!busy}
            >
              <Plus /> New workspace
            </Button>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <WorkspaceNavigation
            items={navigation}
            view={view}
            count={
              (workspace?.data.receipts.length || 0) +
              (workspace?.data.archivedCounts?.receipts || 0)
            }
            navigate={(id) => {
              setView(id);
              setFilter('');
            }}
          />
        </SidebarContent>
        <SidebarFooter>
          <div className="account">
            <span className="account-avatar">
              {displayName.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong title={displayName}>{displayName}</strong>
              <small>
                <LockKeyhole /> Private account
              </small>
            </div>
          </div>
          <a href={signOutPath} target="_top">
            Sign out
          </a>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="studio">
        <header className="studio-topbar">
          <div>
            <SidebarTrigger />
            <span>
              Workspace <ChevronRight /> {title}
            </span>
          </div>
          <span className="save-status">
            {loading ? (
              <>
                <LoaderCircle className="spin" /> Loading desk…
              </>
            ) : busy ? (
              <>
                <LoaderCircle className="spin" /> Saving…
              </>
            ) : !online ? (
              <>
                <CircleAlert /> Offline
              </>
            ) : error ? (
              <>
                <CircleAlert /> Check workspace status
              </>
            ) : workspace ? (
              <>
                <Check /> Workspace saved
              </>
            ) : (
              <>
                <LockKeyhole /> Private workspace
              </>
            )}
          </span>
        </header>
        <main id="workspace-main">
          <div className="feedback-zone">
            {!online && (
              <output className="desk-error">
                <CircleAlert />
                <span>
                  You are offline. Keep your edits here and reconnect before
                  saving.
                </span>
              </output>
            )}
            {error && (
              <div className="desk-error" role="alert">
                <CircleAlert />
                <span>{error}</span>
                <Button variant="ghost" onClick={() => load(workspace?.id)}>
                  <RefreshCw /> Refresh
                </Button>
                <Button
                  variant="ghost"
                  aria-label="Dismiss error"
                  onClick={() => setError('')}
                >
                  <X />
                </Button>
              </div>
            )}
          </div>
          {loading ? (
            <div className="workspace-loading" aria-label="Loading workspace">
              <Skeleton className="h-12 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : !workspace ? (
            <div className="welcome">
              <h1>
                Start with
                <br />
                your own desk.
              </h1>
              <p>
                Add your equipment and borrower references, then decide how
                lending should work. Your records stay in your private
                workspace.
              </p>
              <div className="welcome-actions">
                <Button
                  className="desk-button"
                  onClick={() => setDialog('workspace')}
                >
                  <Plus /> Create a workspace
                </Button>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    safe(
                      'create',
                      { name: 'Sample media desk', sample: true },
                      'Your sample workspace is ready.',
                    )
                  }
                >
                  {busy ? <LoaderCircle className="spin" /> : <FlaskConical />}{' '}
                  Try the sample desk
                </Button>
              </div>
              <div className="welcome-notes">
                <span>
                  <LockKeyhole /> Private to your account
                </span>
                <span>
                  <CheckCircle2 /> Saved across sessions
                </span>
              </div>
            </div>
          ) : (
            <div className="view-content" key={view}>
              <div className="studio-intro">
                <div>
                  <p className="workspace-context">
                    {workspace.name}
                    {workspace.data.sample ? ' / SAMPLE RECORDS' : ''}
                  </p>
                  <h1>
                    {view === 'agent'
                      ? 'What did you forget to teach it?'
                      : view === 'overview'
                        ? 'Today at your desk.'
                        : view === 'import'
                          ? 'Your inventory belongs here.'
                          : view === 'settings'
                            ? 'Make this desk your own.'
                            : view === 'rehearse'
                              ? 'A little practice. Better judgment.'
                              : view === 'equipment'
                                ? 'Everything on the desk.'
                                : view === 'borrowers'
                                  ? 'Know who’s borrowing.'
                                  : view === 'policy'
                                    ? 'The instructions you stand behind.'
                                    : 'Every action leaves a trace.'}
                  </h1>
                </div>
                <span className="policy-version">
                  Policy v{workspace.data.policy.version}
                </span>
              </div>
              {view === 'agent' && (
                <AgentRehearsal
                  key={workspace.id}
                  workspace={workspace}
                  onPolicy={() => setView('policy')}
                  onPrepare={(request) => {
                    setRequestSeed((old) => ({
                      request,
                      workspaceId: workspace.id,
                      sequence: (old?.sequence || 0) + 1,
                    }));
                    setView('rehearse');
                  }}
                />
              )}
              {view === 'overview' && (
                <DeskOverview workspace={workspace} navigate={setView} />
              )}
              {view === 'import' && (
                <ImportPanel
                  workspace={workspace}
                  mutate={mutate}
                  busy={busy}
                  announce={announce}
                />
              )}
              {view === 'settings' && (
                <WorkspaceSettings
                  key={workspace.id}
                  workspace={workspace}
                  mutate={mutate}
                  busy={busy}
                  announce={announce}
                />
              )}
              {view === 'rehearse' && (
                <RequestPanel
                  key={`${workspace.id}:${requestSeed?.workspaceId === workspace.id ? requestSeed.sequence : 0}`}
                  initialRequest={
                    requestSeed?.workspaceId === workspace.id
                      ? requestSeed.request
                      : undefined
                  }
                  workspace={workspace}
                  mutate={mutate}
                  busy={busy}
                  announce={announce}
                  navigate={setView}
                />
              )}
              {view === 'equipment' && (
                <>
                  <div className="collection-toolbar">
                    <div className="search-field">
                      <Search />
                      <Input
                        aria-label="Search equipment"
                        placeholder="Find equipment…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      />
                    </div>
                    <Button
                      className="desk-button"
                      onClick={() => setDialog('equipment')}
                    >
                      <Plus /> Add equipment
                    </Button>
                  </div>
                  <div className="inventory-filters">
                    <Tick
                      checked={showArchived}
                      onChange={setShowArchived}
                      label="Include archived records"
                    />
                    <Button variant="ghost" onClick={() => setView('import')}>
                      <FileUp /> Import a CSV
                    </Button>
                  </div>
                  <KitContents
                    key={workspace.id}
                    workspace={workspace}
                    kits={visibleKits}
                    pickerRef={kitPickerRef}
                    selectedId={inspectedKitId}
                    onSelect={setInspectedKitId}
                    onEdit={setEquipment}
                    onPrepareReturn={prepareReturn}
                  />
                  {!visibleKits.length ? (
                    <Empty
                      icon={<Boxes />}
                      title={
                        workspace.data.kits.length
                          ? 'No equipment matches this view.'
                          : 'Ready for your equipment.'
                      }
                      action={
                        <Button
                          variant="outline"
                          onClick={() => setDialog('equipment')}
                        >
                          Add the first item <ArrowRight />
                        </Button>
                      }
                    >
                      Each item has a component list, availability and its own
                      lending history.
                    </Empty>
                  ) : (
                    <div className="record-table">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Equipment</TableHead>
                            <TableHead>Availability</TableHead>
                            <TableHead>Borrower</TableHead>
                            <TableHead>Waiting</TableHead>
                            <TableHead>
                              <span className="sr-only">Manage equipment</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleKits.map((k) => (
                            <TableRow key={k.id}>
                              <TableCell>
                                <button
                                  className="record-inspect"
                                  onClick={() => {
                                    setInspectedKitId(k.id);
                                    requestAnimationFrame(() =>
                                      kitPickerRef.current?.focus({
                                        preventScroll: true,
                                      }),
                                    );
                                    document
                                      .querySelector('.kit-workbench')
                                      ?.scrollIntoView({
                                        block: 'start',
                                        behavior: window.matchMedia(
                                          '(prefers-reduced-motion: reduce)',
                                        ).matches
                                          ? 'instant'
                                          : 'smooth',
                                      });
                                  }}
                                  aria-label={'Inspect contents of ' + k.name}
                                >
                                  <strong>{k.name}</strong>
                                </button>
                                <small>
                                  {k.category} · {k.components.length}{' '}
                                  components
                                  {k.returned.length
                                    ? ` · ${k.returned.length} returned`
                                    : ''}
                                </small>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={
                                    'status-pill ' +
                                    (k.maintenance
                                      ? 'attention'
                                      : !k.borrower && !k.archived
                                        ? 'available'
                                        : '')
                                  }
                                >
                                  {k.archived
                                    ? 'Archived'
                                    : k.borrower
                                      ? 'On loan'
                                      : k.maintenance
                                        ? 'Maintenance'
                                        : 'Available'}
                                </span>
                                {k.due && <small>Due {k.due}</small>}
                              </TableCell>
                              <TableCell>
                                {workspace.data.borrowers.find(
                                  (b) => b.id === k.borrower,
                                )?.name || '—'}
                              </TableCell>
                              <TableCell>
                                <div className="stepper">
                                  <Button
                                    variant="ghost"
                                    aria-label={'Remove hold for ' + k.name}
                                    disabled={!!busy || k.holds === 0}
                                    onClick={() =>
                                      safe(
                                        'holds',
                                        { kit: k.id, holds: k.holds - 1 },
                                        'Hold count updated.',
                                      )
                                    }
                                  >
                                    −
                                  </Button>
                                  <span>{k.holds}</span>
                                  <Button
                                    variant="ghost"
                                    aria-label={'Add hold for ' + k.name}
                                    disabled={
                                      !!busy || k.holds >= 100 || k.archived
                                    }
                                    onClick={() =>
                                      safe(
                                        'holds',
                                        { kit: k.id, holds: k.holds + 1 },
                                        'Hold count updated.',
                                      )
                                    }
                                  >
                                    +
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  aria-label={'Edit ' + k.name}
                                  onClick={() => setEquipment(k)}
                                >
                                  <Pencil />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
              {view === 'borrowers' && (
                <>
                  <div className="collection-toolbar">
                    <div className="search-field">
                      <Search />
                      <Input
                        aria-label="Search borrowers"
                        placeholder="Find a borrower…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      />
                    </div>
                    <Button
                      className="desk-button"
                      onClick={() => {
                        setBorrower(null);
                        setDialog('borrower');
                      }}
                    >
                      <Plus /> Add borrower
                    </Button>
                  </div>
                  <div className="inventory-filters">
                    <Tick
                      checked={showArchived}
                      onChange={setShowArchived}
                      label="Include archived records"
                    />
                  </div>
                  {!workspace.data.borrowers.filter(
                    (b) =>
                      (showArchived || !b.archived) &&
                      b.name.toLowerCase().includes(filter.toLowerCase()),
                  ).length ? (
                    <Empty
                      icon={<Users />}
                      title={
                        workspace.data.borrowers.length
                          ? 'No borrowers match this view.'
                          : 'Your first borrower belongs here.'
                      }
                      action={
                        <Button
                          variant="outline"
                          onClick={() => {
                            setBorrower(null);
                            setDialog('borrower');
                          }}
                        >
                          Add a borrower <ArrowRight />
                        </Button>
                      }
                    >
                      Use a name or internal reference. Record whether you have
                      verified their eligibility and identification.
                    </Empty>
                  ) : (
                    <div className="record-table">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Borrower</TableHead>
                            <TableHead>Identification</TableHead>
                            <TableHead>Eligibility</TableHead>
                            <TableHead>
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {workspace.data.borrowers
                            .filter((b) => showArchived || !b.archived)
                            .filter((b) =>
                              b.name
                                .toLowerCase()
                                .includes(filter.toLowerCase()),
                            )
                            .map((b) => (
                              <TableRow key={b.id}>
                                <TableCell>
                                  <strong>{b.name}</strong>
                                  <small>
                                    {
                                      workspace.data.kits.filter(
                                        (k) => k.borrower === b.id,
                                      ).length
                                    }{' '}
                                    active loans
                                  </small>
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={
                                      'status-pill ' +
                                      (b.verified ? 'available' : 'attention')
                                    }
                                  >
                                    {b.verified
                                      ? 'Verified'
                                      : 'Needs verification'}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {b.eligible ? 'Eligible' : 'Not eligible'}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    onClick={() => {
                                      setBorrower(b);
                                      setDialog('borrower');
                                    }}
                                  >
                                    Edit <ArrowUpRight />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    aria-label={
                                      (b.archived ? 'Restore ' : 'Archive ') +
                                      b.name
                                    }
                                    disabled={
                                      !!busy ||
                                      workspace.data.kits.some(
                                        (k) => k.borrower === b.id,
                                      )
                                    }
                                    onClick={() =>
                                      safe(
                                        'archiveBorrower',
                                        {
                                          borrower: b.id,
                                          archived: !b.archived,
                                        },
                                        b.archived
                                          ? 'Borrower restored.'
                                          : 'Borrower archived.',
                                      )
                                    }
                                  >
                                    <Archive />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
              {view === 'policy' && (
                <PolicyForm
                  key={workspace.id + '-' + workspace.data.policy.version}
                  workspace={workspace}
                  mutate={mutate}
                  busy={busy}
                  announce={announce}
                />
              )}
              {view === 'receipts' && (
                <>
                  <div className="collection-toolbar">
                    <p className="muted">
                      {workspace.data.receipts.length +
                        (workspace.data.archivedCounts?.receipts || 0)}{' '}
                      committed actions ·{' '}
                      {workspace.data.history.length +
                        (workspace.data.archivedCounts?.history || 0)}{' '}
                      policy revisions
                    </p>
                    <Button
                      variant="outline"
                      onClick={exportDesk}
                      disabled={!!busy}
                    >
                      <Download /> Export workspace
                    </Button>
                  </div>
                  {Object.values(workspace.data.archivedCounts || {}).some(
                    Boolean,
                  ) && (
                    <p className="section-description">
                      Recent records appear here. Export the workspace for its
                      complete receipt, rehearsal, policy and activity history.
                    </p>
                  )}
                  <Tabs defaultValue="actions">
                    <TabsList variant="line">
                      <TabsTrigger value="actions">
                        Inventory receipts
                      </TabsTrigger>
                      <TabsTrigger value="policies">Policy history</TabsTrigger>
                      <TabsTrigger value="rehearsals">
                        Saved rehearsals
                      </TabsTrigger>
                      <TabsTrigger value="activity">Desk activity</TabsTrigger>
                    </TabsList>
                    <TabsContent value="actions">
                      {workspace.data.receipts.length ? (
                        workspace.data.receipts.map((r) => (
                          <div className="history-row" key={r.id}>
                            <span className="history-icon">
                              <Check />
                            </span>
                            <div>
                              <h3>
                                {r.action === 'checkout'
                                  ? 'Checked out'
                                  : r.action === 'renew'
                                    ? 'Renewed'
                                    : 'Returned component'}{' '}
                                · {r.kitName}
                              </h3>
                              <p>
                                {r.borrowerName}
                                {r.component ? ' · ' + r.component : ''}
                              </p>
                              <small>
                                {r.id} · Policy v{r.policyVersion}
                              </small>
                            </div>
                            <time>{date(r.at)}</time>
                          </div>
                        ))
                      ) : (
                        <Empty
                          icon={<ClipboardList />}
                          title="No committed actions yet."
                        >
                          Rehearsals leave inventory untouched. Receipts appear
                          when a shift changes a loan.
                        </Empty>
                      )}
                    </TabsContent>
                    <TabsContent value="rehearsals">
                      <RehearsalArchive workspace={workspace} />
                    </TabsContent>
                    <TabsContent value="activity">
                      {workspace.data.audit?.length ? (
                        workspace.data.audit.map((a) => (
                          <div className="history-row" key={a.id}>
                            <span className="history-icon">
                              <Check />
                            </span>
                            <div>
                              <h3>{a.description}</h3>
                              <small>{a.action}</small>
                            </div>
                            <time>{date(a.at)}</time>
                          </div>
                        ))
                      ) : (
                        <p className="quiet-empty">
                          Record changes and shift activity appear here as you
                          work.
                        </p>
                      )}
                    </TabsContent>
                    <TabsContent value="policies">
                      {workspace.data.history.length ? (
                        workspace.data.history.map((h) => (
                          <div className="history-row" key={h.version}>
                            <span className="policy-version">v{h.version}</span>
                            <div>
                              <h3>Desk instructions approved</h3>
                              <p>{h.description}</p>
                              {h.policy && (
                                <details className="policy-snapshot">
                                  <summary>Read the approved handbook</summary>
                                  <p>
                                    {h.policy.handbook ||
                                      'No handbook text was provided.'}
                                  </p>
                                  {h.policy.sourceUrl && (
                                    <a
                                      href={h.policy.sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Open recorded source
                                    </a>
                                  )}
                                </details>
                              )}
                            </div>
                            <time>{date(h.at)}</time>
                          </div>
                        ))
                      ) : (
                        <Empty
                          icon={<BookOpen />}
                          title="Your first decision is still ahead."
                        >
                          Save your desk instructions to begin a versioned
                          policy history.
                        </Empty>
                      )}
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          )}
        </main>
        <footer className="studio-footer">
          <span>
            <LockKeyhole /> Workspace records are private to your account.
          </span>
          <span>Configured rules · AI interpretation is not connected.</span>
        </footer>
      </SidebarInset>
      <output className="toast-area" aria-live="polite">
        {message && (
          <div className="desk-toast" key={message}>
            <CheckCircle2 />
            {message}
            <button
              onClick={() => setMessage('')}
              aria-label="Dismiss notification"
            >
              <X />
            </button>
          </div>
        )}
      </output>
      {equipment && (
        <EquipmentEditor
          key={workspace?.id + equipment.id}
          kit={equipment}
          close={() => setEquipment(null)}
          mutate={mutate}
          busy={busy}
          announce={announce}
        />
      )}
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null);
        }}
      >
        <DialogContent className="desk-dialog">
          <DialogTitle>
            {dialog === 'workspace'
              ? 'A workspace of your own.'
              : dialog === 'equipment'
                ? 'Add equipment.'
                : borrower
                  ? 'Update the borrower.'
                  : 'Add a borrower.'}
          </DialogTitle>
          <DialogDescription>
            {dialog === 'workspace'
              ? 'Start empty, or use a separate sample desk to explore.'
              : dialog === 'equipment'
                ? 'Give this item a clear name and list everything that must come back.'
                : 'A name or internal reference is enough. Verify evidence outside the app before marking it complete.'}
          </DialogDescription>
          {dialog && (
            <RecordForm
              key={dialog + (borrower?.id || '')}
              kind={dialog}
              borrower={borrower}
              busy={!!busy}
              submit={async (payload) => {
                await mutate(
                  dialog === 'workspace' ? 'create' : dialog,
                  payload,
                );
                setDialog(null);
                announce(
                  dialog === 'workspace'
                    ? 'Workspace created.'
                    : 'Record saved.',
                );
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

function RecordForm({
  kind,
  borrower,
  busy,
  submit,
}: {
  kind: 'workspace' | 'equipment' | 'borrower';
  borrower: Borrower | null;
  busy: boolean;
  submit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [formError, setFormError] = useState('');
  const [name, setName] = useState(
      kind === 'borrower' ? borrower?.name || '' : '',
    ),
    [category, setCategory] = useState('Camera'),
    [components, setComponents] = useState('Body, Battery, Charger'),
    [sample, setSample] = useState(false),
    [verified, setVerified] = useState(borrower?.verified ?? false),
    [eligible, setEligible] = useState(borrower?.eligible ?? false);
  async function save(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    try {
      await submit({
        name,
        category,
        components,
        sample,
        verified,
        eligible,
        ...(kind === 'borrower' && borrower ? { borrowerId: borrower.id } : {}),
      });
    } catch (error) {
      setFormError((error as Error).message);
    }
  }
  return (
    <form onSubmit={save} className="record-form">
      {formError && (
        <p className="desk-error" role="alert">
          {formError}
        </p>
      )}
      <label className="field">
        {kind === 'workspace'
          ? 'Workspace name'
          : kind === 'equipment'
            ? 'Equipment name'
            : 'Name or reference'}
        <Input
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            kind === 'workspace'
              ? 'e.g. Studio equipment desk'
              : kind === 'equipment'
                ? 'e.g. Sony camera kit 03'
                : 'e.g. Member 1042'
          }
        />
      </label>
      {kind === 'equipment' && (
        <>
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
            Components, separated by commas
            <Textarea
              required
              maxLength={1000}
              value={components}
              onChange={(e) => setComponents(e.target.value)}
            />
          </label>
        </>
      )}
      {kind === 'workspace' && (
        <Tick
          checked={sample}
          onChange={setSample}
          label="Start with fictional sample records"
        />
      )}
      {kind === 'borrower' && (
        <>
          <Tick
            checked={verified}
            onChange={setVerified}
            label="Identification has been verified"
          />
          <Tick
            checked={eligible}
            onChange={setEligible}
            label="Eligible under this desk’s requirements"
          />
        </>
      )}
      <Submit busy={busy}>
        {kind === 'workspace' ? 'Create workspace' : 'Save record'}
      </Submit>
    </form>
  );
}

function RequestPanel({
  initialRequest,
  workspace,
  mutate,
  busy,
  announce,
  navigate,
}: {
  workspace: Workspace;
  mutate: Mutation;
  busy: string;
  announce: (s: string) => void;
  navigate: (s: string) => void;
  initialRequest?: Request;
}) {
  const desk = workspace.data,
    policy = desk.policy;
  const [request, setRequest] = useState<Request>({
      action: 'checkout',
      borrower: desk.borrowers[0]?.id || '',
      kit: desk.kits.find((k) => !k.borrower)?.id || desk.kits[0]?.id || '',
      requestedKit: desk.kits[0]?.id || '',
      confirmed: false,
      component: desk.kits[0]?.components[0] || '',
      ...initialRequest,
    }),
    [rehearsal, setRehearsal] = useState<{
      decision: Decision;
      contrast: Decision;
      contrastLabel: string;
    } | null>(null),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [lastRequest, setLastRequest] = useState<{
      request: Request;
      requestId: string;
    } | null>(null),
    [mode, setMode] = useState(
      initialRequest?.action === 'return' ? 'shift' : 'rehearse',
    );
  const pendingSubmission = useRef<{
    request: Request;
    requestId: string;
  } | null>(null);
  const decision = evaluate(desk, request),
    active = policy.activeVersion === policy.version;
  function update(key: keyof Request, value: string | boolean) {
    setRequest((old) => ({ ...old, [key]: value }));
    setRehearsal(null);
    if (key === 'kit')
      setRequest((old) => ({
        ...old,
        component: desk.kits.find((k) => k.id === value)?.components[0] || '',
      }));
  }
  async function rehearse() {
    try {
      const response = await mutate('rehearse', { request });
      if (response) {
        if (!response.decision || !response.contrast || !response.contrastLabel)
          throw new Error('The rehearsal result is incomplete. Try again.');
        setRehearsal({
          decision: response.decision,
          contrast: response.contrast,
          contrastLabel: response.contrastLabel,
        });
        announce('Rehearsal saved. Inventory stayed unchanged.');
      }
    } catch {}
  }
  async function activate() {
    if (!desk.history.length) {
      navigate('policy');
      return;
    }
    try {
      await mutate('activate');
      setMode('shift');
      announce('Shift opened under the current policy.');
    } catch {}
  }
  async function execute(retry = false) {
    const payload =
      retry && lastRequest
        ? lastRequest
        : pendingSubmission.current &&
            JSON.stringify(pendingSubmission.current.request) ===
              JSON.stringify(request)
          ? pendingSubmission.current
          : { request, requestId: crypto.randomUUID() };
    if (!retry) pendingSubmission.current = payload;
    try {
      const response = await mutate('execute', payload);
      if (response?.receipt) {
        setLastRequest(payload);
        if (!retry) pendingSubmission.current = null;
        setReceipt(response.receipt);
        announce(
          response.replayed
            ? 'Original receipt returned. No duplicate action.'
            : 'Loan record and receipt saved together.',
        );
      } else if (response?.decision) {
        if (!retry) pendingSubmission.current = null;
        announce(response.decision.title);
      }
    } catch {}
  }
  if (!desk.kits.length || !desk.borrowers.length)
    return (
      <Empty
        icon={<FlaskConical />}
        title="Give the rehearsal something to work with."
        action={
          <div className="welcome-actions">
            <Button
              className="desk-button"
              onClick={() =>
                navigate(!desk.kits.length ? 'equipment' : 'borrowers')
              }
            >
              Add {!desk.kits.length ? 'equipment' : 'a borrower'}{' '}
              <ArrowRight />
            </Button>
            <Button variant="outline" onClick={() => navigate('policy')}>
              Review desk instructions
            </Button>
          </div>
        }
      >
        Add at least one equipment record and borrower, then use a request from
        your desk to test the policy.
      </Empty>
    );
  const kit = desk.kits.find((k) => k.id === request.kit);
  return (
    <>
      <div className="rehearsal-progress">
        <span className="complete">
          <Check /> Choose a request
        </span>
        <ChevronRight />
        <span
          className={
            policy.rehearsedVersion === policy.version ? 'complete' : ''
          }
        >
          {policy.rehearsedVersion === policy.version ? (
            <Check />
          ) : (
            <span className="step-circle">2</span>
          )}{' '}
          Rehearse v{policy.version}
        </span>
        <ChevronRight />
        <span className={active ? 'complete' : ''}>
          {active ? <Check /> : <span className="step-circle">3</span>} Open a
          shift
        </span>
      </div>
      <Tabs value={mode} onValueChange={(v) => setMode(String(v))}>
        <TabsList variant="line">
          <TabsTrigger value="rehearse">
            <FlaskConical /> Rehearse
          </TabsTrigger>
          <TabsTrigger value="shift">
            <Boxes /> Working shift {active && <span className="active-dot" />}
          </TabsTrigger>
        </TabsList>
        <div className="rehearsal-grid">
          <section className="request-sheet">
            <div className="request-heading">
              <span className="eyebrow">
                {mode === 'rehearse' ? 'THE REQUEST' : 'AT THE DESK'}
              </span>
              <span className="status-pill">
                {mode === 'rehearse'
                  ? 'Inventory unchanged'
                  : active
                    ? 'Shift open'
                    : 'Shift closed'}
              </span>
            </div>
            <h2>
              {mode === 'rehearse'
                ? 'Put the instruction to the test.'
                : 'Make the next desk action.'}
            </h2>
            <div className="request-fields">
              <Choice
                label="Action"
                value={request.action}
                onChange={(v) => update('action', v)}
                items={[
                  { value: 'checkout', label: 'Check out equipment' },
                  { value: 'renew', label: 'Renew a loan' },
                  { value: 'return', label: 'Return a component' },
                ]}
              />
              <Choice
                label="Borrower"
                value={request.borrower}
                onChange={(v) => update('borrower', v)}
                items={desk.borrowers.map((b) => ({
                  value: b.id,
                  label: b.name,
                }))}
              />
              {request.action === 'checkout' && (
                <Choice
                  label="Originally requested"
                  value={request.requestedKit}
                  onChange={(v) => update('requestedKit', v)}
                  items={desk.kits.map((k) => ({ value: k.id, label: k.name }))}
                />
              )}
              <Choice
                label={
                  request.action === 'checkout'
                    ? 'Equipment to lend'
                    : 'Equipment'
                }
                value={request.kit}
                onChange={(v) => update('kit', v)}
                items={desk.kits.map((k) => ({ value: k.id, label: k.name }))}
              />
              {request.action === 'return' && (
                <Choice
                  label="Returned component"
                  value={request.component || ''}
                  onChange={(v) => update('component', v)}
                  items={(kit?.components || []).map((c) => ({
                    value: c,
                    label: c,
                  }))}
                />
              )}
            </div>
            {request.action === 'checkout' &&
              request.requestedKit !== request.kit && (
                <Tick
                  checked={request.confirmed}
                  onChange={(v) => update('confirmed', v)}
                  label="The borrower explicitly confirmed the different equipment."
                />
              )}
            <div className="live-verdict" aria-live="polite">
              <div className="live-label">
                <span />{' '}
                {mode === 'rehearse' ? 'Live rule check' : 'Preflight check'}
                <small>Updates as you change the request</small>
              </div>
              <Verdict decision={decision} />
            </div>
            {decision.kind === 'gap' && (
              <Button variant="link" onClick={() => navigate('policy')}>
                Resolve this in the desk handbook <ArrowUpRight />
              </Button>
            )}
            <TabsContent value="rehearse">
              <div className="request-actions">
                <Button
                  className="desk-button"
                  disabled={!!busy}
                  onClick={rehearse}
                >
                  {busy === 'rehearse' ? (
                    <LoaderCircle className="spin" />
                  ) : (
                    <FlaskConical />
                  )}
                  Save this rehearsal
                </Button>
                {policy.rehearsedVersion === policy.version && (
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={activate}
                  >
                    Open a shift <ArrowRight />
                  </Button>
                )}
              </div>
              {rehearsal && (
                <div className="contrast-result">
                  <h3>Change one fact.</h3>
                  <p>{rehearsal.contrastLabel}</p>
                  <Verdict decision={rehearsal.contrast} />
                </div>
              )}
            </TabsContent>
            <TabsContent value="shift">
              <div className="request-actions">
                {active ? (
                  <>
                    <Button
                      className="desk-button"
                      disabled={!!busy || decision.kind !== 'ready'}
                      onClick={() => execute()}
                    >
                      {busy === 'execute' ? (
                        <LoaderCircle className="spin" />
                      ) : (
                        <CheckCircle2 />
                      )}
                      Apply desk request
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!!busy}
                      onClick={async () => {
                        try {
                          await mutate('revoke');
                          announce(
                            'Shift closed. New lending actions are blocked.',
                          );
                        } catch {}
                      }}
                    >
                      Close shift
                    </Button>
                  </>
                ) : (
                  <Button
                    className="desk-button"
                    disabled={
                      !!busy || policy.rehearsedVersion !== policy.version
                    }
                    onClick={activate}
                  >
                    Open shift <ArrowRight />
                  </Button>
                )}
              </div>
              {!active && policy.rehearsedVersion !== policy.version && (
                <p className="helper">
                  Save a rehearsal under the current policy before opening a
                  shift.
                </p>
              )}
            </TabsContent>
          </section>
          <aside className="context-column">
            {receipt ? (
              <div className="receipt-sheet">
                <div className="receipt-seal">
                  <CheckCircle2 /> Action committed
                </div>
                <h2>
                  {receipt.action === 'checkout'
                    ? 'Checked out.'
                    : receipt.action === 'renew'
                      ? 'Loan extended.'
                      : 'Return recorded.'}
                </h2>
                <p className="receipt-number">{receipt.id}</p>
                <dl>
                  <div>
                    <dt>Equipment</dt>
                    <dd>{receipt.kitName}</dd>
                  </div>
                  <div>
                    <dt>Borrower</dt>
                    <dd>{receipt.borrowerName}</dd>
                  </div>
                  <div>
                    <dt>Policy</dt>
                    <dd>Version {receipt.policyVersion}</dd>
                  </div>
                  <div>
                    <dt>Recorded</dt>
                    <dd>{date(receipt.at)}</dd>
                  </div>
                  <div>
                    <dt>Due</dt>
                    <dd>{receipt.due || 'Loan complete'}</dd>
                  </div>
                </dl>
                <p>Inventory and receipt were saved together.</p>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => execute(true)}
                >
                  <RefreshCw /> Retry the same request
                </Button>
              </div>
            ) : (
              <div className="handbook-summary">
                <div className="handbook-title">
                  <BookOpen />
                  <h2>Desk instructions</h2>
                </div>
                <p>
                  Version {policy.version} ·{' '}
                  {desk.history.length
                    ? 'approved settings'
                    : 'default settings'}
                </p>
                {[
                  [
                    'R1',
                    'Verify the borrower',
                    'Identification and eligibility must both be recorded.',
                  ],
                  [
                    'R2',
                    'Check availability',
                    `${policy.maxLoans} concurrent loan${policy.maxLoans === 1 ? '' : 's'} per borrower. ${policy.loanDays}-day lending period.`,
                  ],
                  [
                    'R3',
                    'Check the waiting list',
                    'One extension, only when no hold exists.',
                  ],
                  [
                    'R4',
                    'Check every component',
                    'The loan closes when the full kit is returned.',
                  ],
                  [
                    'D1',
                    'Handle substitutions',
                    policy.substitution === 'confirm'
                      ? 'Explicit borrower confirmation required.'
                      : policy.substitution === 'staff'
                        ? 'Refer substitute requests to staff.'
                        : 'No instruction approved yet.',
                  ],
                ].map(([ref, title, description]) => (
                  <div className="handbook-rule" key={ref}>
                    <h3>
                      <span>{ref}</span>
                      {title}
                    </h3>
                    <p>{description}</p>
                  </div>
                ))}
                <Button variant="link" onClick={() => navigate('policy')}>
                  Review the handbook <ArrowUpRight />
                </Button>
              </div>
            )}
            <p className="context-note">
              <ShieldCheck /> All desk actions are checked again on the server
              before saving.
            </p>
          </aside>
        </div>
      </Tabs>
    </>
  );
}

function PolicyForm({
  workspace,
  mutate,
  busy,
  announce,
}: {
  workspace: Workspace;
  mutate: Mutation;
  busy: string;
  announce: (s: string) => void;
}) {
  const original = workspace.data.policy,
    [form, setForm] = useState({ ...original }),
    [dirty, setDirty] = useState(!workspace.data.history.length);
  function change(key: string, value: string | number) {
    setForm((old) => ({ ...old, [key]: value }));
    setDirty(true);
  }
  async function save(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await mutate('policy', form);
      announce('New policy saved. Rehearse it before opening another shift.');
    } catch {}
  }
  return (
    <form onSubmit={save} className="policy-form">
      <div className="policy-form-main">
        <div className="section-label">
          <span className="eyebrow">YOUR SOURCE MATERIAL</span>
          {dirty && <span className="unsaved-dot">Unsaved changes</span>}
        </div>
        <h2>Start with the handbook.</h2>
        <p>
          Keep the instructions your desk works from here. The settings below
          control lending actions; handbook prose is retained for your review.
        </p>
        <label className="field">
          Handbook or operating notes
          <Textarea
            className="handbook-input"
            rows={9}
            maxLength={30000}
            value={form.handbook}
            onChange={(e) => change('handbook', e.target.value)}
            placeholder="Paste the relevant instructions from your equipment desk…"
          />
        </label>
        <label className="field">
          Source URL <span className="optional">Optional</span>
          <Input
            type="url"
            maxLength={2000}
            value={form.sourceUrl}
            onChange={(e) => change('sourceUrl', e.target.value)}
            placeholder="https://…"
          />
        </label>
        <div className="settings-divider" />
        <span className="eyebrow">EXPLICIT LENDING RULES</span>
        <h2>Decide what the desk can do.</h2>
        <div className="request-fields">
          <label className="field">
            Loan length in days
            <Input
              type="number"
              min={1}
              max={365}
              required
              value={form.loanDays}
              onChange={(e) => change('loanDays', Number(e.target.value))}
            />
          </label>
          <label className="field">
            Concurrent loans per borrower
            <Input
              type="number"
              min={1}
              max={20}
              required
              value={form.maxLoans}
              onChange={(e) => change('maxLoans', Number(e.target.value))}
            />
          </label>
        </div>
        <Choice
          label="When the requested equipment is unavailable"
          value={form.substitution || 'unspecified'}
          onChange={(v) => change('substitution', v === 'unspecified' ? '' : v)}
          items={[
            { value: 'unspecified', label: 'Leave substitution unspecified' },
            {
              value: 'confirm',
              label: 'Offer an alternative after explicit confirmation',
            },
            { value: 'staff', label: 'Refer substitutions to a staff member' },
          ]}
        />
        <p className="helper">
          Saving creates a new policy version and closes any active shift.
          Existing loan records and receipts remain intact.
        </p>
        <Submit busy={busy === 'policy'} disabled={!dirty}>
          Approve these instructions
        </Submit>
      </div>
      <aside className="policy-boundaries">
        <ShieldCheck />
        <h2>Rules that stay in force.</h2>
        <p>
          Every checkout requires verified identification, recorded eligibility
          and available equipment.
        </p>
        <p>
          A loan can be renewed once, provided nobody is waiting. Every listed
          component must be returned before a loan closes.
        </p>
        <div className="policy-boundary-note">
          <CircleAlert />
          <p>
            Arbitrary handbook text is not automatically interpreted. This
            release evaluates the explicit settings you approve here.
          </p>
        </div>
      </aside>
    </form>
  );
}

function WorkspaceNavigation({
  items,
  view,
  count,
  navigate,
}: {
  items: { id: string; label: string; icon: typeof BookOpen }[];
  view: string;
  count: number;
  navigate: (id: string) => void;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {items.map(({ id, label, icon: Icon }) => (
        <SidebarMenuItem
          key={id}
          className={
            id === 'equipment' || id === 'import'
              ? 'rail-section-start'
              : undefined
          }
        >
          <SidebarMenuButton
            isActive={view === id}
            aria-current={view === id ? 'page' : undefined}
            onClick={() => {
              navigate(id);
              setOpenMobile(false);
            }}
          >
            <Icon />
            <span>{label}</span>
            {id === 'receipts' && count > 0 ? (
              <span className="rail-count">{count}</span>
            ) : null}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
