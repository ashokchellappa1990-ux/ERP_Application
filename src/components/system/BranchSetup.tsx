"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, Building2, Search, ChevronRight, ChevronDown,
  Move, Power, Star, List, Network, Tag, MapPin, CornerDownRight, X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useScope } from "@/components/scope/ScopeProvider";
import { cn } from "@/lib/cn";
import { BranchEditor } from "./BranchEditor";
import { EntityTypeManager } from "./EntityTypeManager";
import {
  type BranchData, type BranchNode, buildTree, iconFor, maxDepth, ancestorIds, subtreeIds,
} from "./branchShared";

const fInp = "h-8 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none";

export function BranchSetup() {
  const toast = useToast();
  const { lockBranch: viewOnly, version: scopeVersion } = useScope();
  const [data, setData] = useState<BranchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"tree" | "table">("tree");
  const [q, setQ] = useState("");
  const [fType, setFType] = useState(0);
  const [fStatus, setFStatus] = useState<"all" | "active" | "inactive">("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editor, setEditor] = useState<{ branch: BranchNode | null; presetParentId?: number | null } | null>(null);
  const [move, setMove] = useState<BranchNode | null>(null);
  const [showTypes, setShowTypes] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch("/api/system/branches").then((r) => r.json()).catch(() => ({}));
    if (j.ok) {
      setData(j);
      // Expand every node that has children on first load.
      const withKids = new Set<number>(j.branches.filter((b: BranchNode) => b.parentBranchId != null).map((b: BranchNode) => b.parentBranchId as number));
      setExpanded(withKids);
    } else if (j.message) toast.error(j.message);
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load, scopeVersion]);

  const branches = data?.branches ?? [];
  const etById = useMemo(() => new Map((data?.entityTypes ?? []).map((e) => [e.id, e])), [data]);
  const branchById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  // --- filtering: matched nodes + their ancestors stay visible for context ---
  const filterActive = q.trim() !== "" || fType !== 0 || fStatus !== "all";
  const visible = useMemo(() => {
    if (!filterActive) return null; // null = show all
    const needle = q.trim().toLowerCase();
    const matched = branches.filter((b) => {
      const hitQ = !needle || [b.name, b.code, b.city, b.type, b.manager].some((v) => (v ?? "").toLowerCase().includes(needle));
      const hitType = fType === 0 || b.entityTypeId === fType;
      const hitStatus = fStatus === "all" || b.status === fStatus;
      return hitQ && hitType && hitStatus;
    });
    const set = new Set<number>();
    for (const b of matched) { set.add(b.id); ancestorIds(b).forEach((a) => set.add(a)); }
    return set;
  }, [branches, filterActive, q, fType, fStatus]);

  const tree = useMemo(() => buildTree(branches), [branches]);
  const toggle = (id: number) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const expandAll = () => setExpanded(new Set(branches.map((b) => b.id)));
  const collapseAll = () => setExpanded(new Set());

  // --- node actions ---
  async function patch(id: number, body: Record<string, unknown>, okMsg: string) {
    const j = await fetch(`/api/system/branches/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    if (toast.result(j, okMsg)) await load();
  }
  async function del(b: BranchNode) {
    if (!confirm(`Delete branch "${b.name}"? This cannot be undone.`)) return;
    const j = await fetch(`/api/system/branches/${b.id}`, { method: "DELETE" }).then((r) => r.json());
    if (toast.result(j, "Branch deleted.")) await load();
  }

  const stats = {
    total: branches.length,
    active: branches.filter((b) => b.status === "active").length,
    roots: branches.filter((b) => b.hierarchyLevel === 1).length,
    depth: maxDepth(branches),
  };

  // Recursive tree rows.
  function renderNodes(nodes: BranchNode[], depth: number): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    for (const n of nodes) {
      if (visible && !visible.has(n.id)) continue;
      const kids = (n.children ?? []).filter((c) => !visible || visible.has(c.id));
      const hasKids = kids.length > 0;
      const isOpen = expanded.has(n.id) || (filterActive && hasKids);
      const et = n.entityTypeId ? etById.get(n.entityTypeId) : undefined;
      const Icon = iconFor(et?.icon);
      const color = et?.color ?? "#64748b";
      out.push(
        <div key={n.id} className={cn("group flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 hover:border-border hover:bg-surface-2/50", n.status !== "active" && "opacity-60")}
          style={{ marginLeft: depth * 22 }}>
          {hasKids ? (
            <button onClick={() => toggle(n.id)} className="rounded p-0.5 text-muted hover:text-foreground">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : <span className="w-5 shrink-0 text-center text-subtle">{depth > 0 ? <CornerDownRight className="mx-auto h-3.5 w-3.5" /> : "·"}</span>}

          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md" style={{ backgroundColor: color + "22", color }}><Icon className="h-4 w-4" /></span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-foreground">{n.name}</span>
              <span className="font-mono text-2xs text-subtle">{n.code}</span>
              {n.isDefault && <Star className="h-3.5 w-3.5 fill-warning text-warning" />}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted">
              <span style={{ color }}>{et?.name ?? n.type}</span>
              <span className="text-subtle">· L{n.hierarchyLevel}</span>
              {n.city && <span className="text-subtle">· <MapPin className="mr-0.5 inline h-3 w-3" />{n.city}</span>}
              {hasKids && <span className="text-subtle">· {kids.length} child{kids.length > 1 ? "ren" : ""}</span>}
            </div>
          </div>

          <Badge tone={n.status === "active" ? "success" : "neutral"}>{n.status}</Badge>

          {!viewOnly && (
            <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
              {n.allowChild && <IconBtn title="Add child" onClick={() => setEditor({ branch: null, presetParentId: n.id })}><Plus className="h-4 w-4" /></IconBtn>}
              <IconBtn title="Edit" onClick={() => setEditor({ branch: n })}><Pencil className="h-4 w-4" /></IconBtn>
              <IconBtn title="Move" onClick={() => setMove(n)}><Move className="h-4 w-4" /></IconBtn>
              {!n.isDefault && <IconBtn title="Set as default" onClick={() => patch(n.id, { makeDefault: true }, "Default branch set.")}><Star className="h-4 w-4" /></IconBtn>}
              <IconBtn title={n.status === "active" ? "Deactivate" : "Activate"} onClick={() => patch(n.id, { status: n.status === "active" ? "inactive" : "active" }, "Status updated.")}><Power className="h-4 w-4" /></IconBtn>
              {!n.isDefault && <IconBtn title="Delete" danger onClick={() => del(n)}><Trash2 className="h-4 w-4" /></IconBtn>}
            </div>
          )}
        </div>,
      );
      if (isOpen && hasKids) out.push(...renderNodes(kids, depth + 1));
    }
    return out;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><Network className="h-6 w-6" /></span>
            <div>
              <div className="mb-0.5 flex items-center gap-2 text-2xs text-muted"><span>System</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Branch Hierarchy</span></div>
              <h1 className="text-lg font-bold text-foreground">Branch Setup</h1>
              <p className="mt-0.5 text-xs text-muted">{data?.business ? `Organization hierarchy of ${data.business.name}` : "Define your enterprise organization hierarchy."}{viewOnly ? " — view only." : ""}</p>
            </div>
          </div>
          {!viewOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowTypes(true)}><Tag className="h-3.5 w-3.5" /> Entity Types</Button>
              <Button size="sm" onClick={() => setEditor({ branch: null, presetParentId: null })}><Plus className="h-4 w-4" /> Add Main Branch</Button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Total Nodes" value={stats.total} />
          <Stat label="Active" value={stats.active} tone="success" />
          <Stat label="Root Nodes" value={stats.roots} />
          <Stat label="Max Depth" value={stats.depth} />
        </div>

        {/* Toolbar */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search branches…" className={cn(fInp, "w-48 pl-7")} />
          </div>
          <select value={fType} onChange={(e) => setFType(Number(e.target.value))} className={fInp}>
            <option value={0}>All entity types</option>
            {data?.entityTypes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} className={fInp}>
            <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
          {filterActive && <button onClick={() => { setQ(""); setFType(0); setFStatus("all"); }} className="text-2xs font-semibold text-primary hover:underline">Clear</button>}
          <div className="ml-auto flex items-center gap-2">
            {view === "tree" && <><button onClick={expandAll} className="text-2xs font-semibold text-primary hover:underline">Expand all</button><button onClick={collapseAll} className="text-2xs font-semibold text-primary hover:underline">Collapse all</button></>}
            <div className="flex overflow-hidden rounded-md border border-border-strong">
              <button onClick={() => setView("tree")} className={cn("flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold", view === "tree" ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}><Network className="h-3.5 w-3.5" /> Tree</button>
              <button onClick={() => setView("table")} className={cn("flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold", view === "table" ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}><List className="h-3.5 w-3.5" /> List</button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-primary-subtle/30 px-5 py-3 text-sm font-semibold text-foreground"><Building2 className="h-4 w-4 text-primary" /> {view === "tree" ? "Organization Tree" : "All Branches"}</div>
        {loading ? (
          <div className="px-4 py-10"><AppLoader label="Loading branches…" size="sm" /></div>
        ) : branches.length === 0 ? (
          <div className="px-4 py-12 text-center text-muted">No branches yet. Click <span className="font-semibold text-foreground">Add Main Branch</span> to start your hierarchy.</div>
        ) : view === "tree" ? (
          <div className="space-y-0.5 p-3">{renderNodes(tree, 0)}</div>
        ) : (
          <TableView branches={branches} visible={visible} etById={etById} branchById={branchById} viewOnly={viewOnly}
            onEdit={(b) => setEditor({ branch: b })} onMove={(b) => setMove(b)} onDelete={del}
            onToggleStatus={(b) => patch(b.id, { status: b.status === "active" ? "inactive" : "active" }, "Status updated.")}
            onDefault={(b) => patch(b.id, { makeDefault: true }, "Default branch set.")} />
        )}
      </div>

      {editor && data && (
        <BranchEditor data={data} branch={editor.branch} presetParentId={editor.presetParentId} onClose={() => setEditor(null)} onSaved={load} />
      )}
      {move && data && (
        <MoveModal node={move} data={data} onClose={() => setMove(null)}
          onMove={async (parentId) => { await patch(move.id, { parentBranchId: parentId }, "Branch moved."); setMove(null); }} />
      )}
      {showTypes && <EntityTypeManager onClose={() => setShowTypes(false)} onChanged={load} />}
    </div>
  );
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button title={title} onClick={onClick} className={cn("rounded-md p-1.5 text-muted hover:bg-surface-2", danger ? "hover:text-danger" : "hover:text-primary")}>{children}</button>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 px-3 py-2">
      <div className={cn("text-xl font-bold tabular-nums", tone === "success" ? "text-success" : "text-foreground")}>{value}</div>
      <div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</div>
    </div>
  );
}

// --- table (flat, indented by level) ---
function TableView({ branches, visible, etById, branchById, viewOnly, onEdit, onMove, onDelete, onToggleStatus, onDefault }: {
  branches: BranchNode[]; visible: Set<number> | null; etById: Map<number, { name: string; icon: string | null; color: string | null }>;
  branchById: Map<number, BranchNode>; viewOnly: boolean;
  onEdit: (b: BranchNode) => void; onMove: (b: BranchNode) => void; onDelete: (b: BranchNode) => void; onToggleStatus: (b: BranchNode) => void; onDefault: (b: BranchNode) => void;
}) {
  const ordered = useMemo(() => branches.slice().sort((a, z) => (a.hierarchyPath ?? "").localeCompare(z.hierarchyPath ?? "")), [branches]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
          <th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Entity Type</th><th className="px-4 py-2.5">Parent</th><th className="px-4 py-2.5 text-center">Level</th><th className="px-4 py-2.5">City</th><th className="px-4 py-2.5 text-center">Status</th><th className="px-4 py-2.5 text-right">Actions</th>
        </tr></thead>
        <tbody>
          {ordered.filter((b) => !visible || visible.has(b.id)).map((b) => {
            const et = b.entityTypeId ? etById.get(b.entityTypeId) : undefined;
            const Icon = iconFor(et?.icon); const color = et?.color ?? "#64748b";
            const parent = b.parentBranchId ? branchById.get(b.parentBranchId) : null;
            return (
              <tr key={b.id} className={cn("border-b border-border last:border-0 hover:bg-surface-2/50", b.status !== "active" && "opacity-60")}>
                <td className="px-4 py-2.5"><div className="flex items-center gap-2" style={{ paddingLeft: (b.hierarchyLevel - 1) * 14 }}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={{ backgroundColor: color + "22", color }}><Icon className="h-3.5 w-3.5" /></span><span className="font-medium text-foreground">{b.name}</span>{b.isDefault && <Star className="h-3.5 w-3.5 fill-warning text-warning" />}</div></td>
                <td className="px-4 py-2.5 font-mono text-2xs text-muted">{b.code}</td>
                <td className="px-4 py-2.5" style={{ color }}>{et?.name ?? b.type}</td>
                <td className="px-4 py-2.5 text-muted">{parent?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-center text-muted">{b.hierarchyLevel}</td>
                <td className="px-4 py-2.5 text-muted">{b.city ?? "—"}</td>
                <td className="px-4 py-2.5 text-center"><Badge tone={b.status === "active" ? "success" : "neutral"}>{b.status}</Badge></td>
                <td className="px-4 py-2.5">
                  {!viewOnly && (
                    <div className="flex items-center justify-end gap-0.5">
                      <IconBtn title="Edit" onClick={() => onEdit(b)}><Pencil className="h-4 w-4" /></IconBtn>
                      <IconBtn title="Move" onClick={() => onMove(b)}><Move className="h-4 w-4" /></IconBtn>
                      {!b.isDefault && <IconBtn title="Set default" onClick={() => onDefault(b)}><Star className="h-4 w-4" /></IconBtn>}
                      <IconBtn title="Toggle status" onClick={() => onToggleStatus(b)}><Power className="h-4 w-4" /></IconBtn>
                      {!b.isDefault && <IconBtn title="Delete" danger onClick={() => onDelete(b)}><Trash2 className="h-4 w-4" /></IconBtn>}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- move modal (reparent) ---
function MoveModal({ node, data, onClose, onMove }: { node: BranchNode; data: BranchData; onClose: () => void; onMove: (parentId: number | null) => void }) {
  const [parentId, setParentId] = useState<number | null>(node.parentBranchId);
  const excluded = useMemo(() => subtreeIds(data.branches, node.id), [data.branches, node.id]);
  const options = useMemo(() => data.branches.filter((b) => b.allowChild && !excluded.has(b.id)).sort((a, z) => (a.hierarchyPath ?? "").localeCompare(z.hierarchyPath ?? "")), [data.branches, excluded]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-primary-subtle/30 px-5 py-3">
          <div className="flex items-center gap-2"><Move className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold text-foreground">Move — {node.name}</h2></div>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">
          <label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-subtle">New Parent</label>
          <select value={parentId ?? 0} onChange={(e) => setParentId(Number(e.target.value) || null)} className="h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none">
            <option value={0}>— None (make it a Main / Root branch) —</option>
            {options.map((b) => <option key={b.id} value={b.id}>{`${"— ".repeat(Math.max(0, b.hierarchyLevel - 1))}${b.name} (${b.code})`}</option>)}
          </select>
          <p className="mt-2 text-2xs text-muted">Its entire sub-tree moves with it. You can&apos;t move a branch under itself or its own descendants.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => onMove(parentId)} disabled={parentId === node.parentBranchId}><Move className="h-4 w-4" /> Move Here</Button>
        </div>
      </div>
    </div>
  );
}
