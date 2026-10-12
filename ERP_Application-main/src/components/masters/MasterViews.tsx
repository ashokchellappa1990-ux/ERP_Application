"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  ArrowLeft,
  Check,
  CheckCircle2,
  ListTree,
} from "lucide-react";
import { getEntity, type MasterField, type MasterRow } from "@/lib/masters/masterConfig";
import {
  listMaster,
  getMaster,
  createMaster,
  updateMaster,
  removeMaster,
} from "@/lib/masters/mastersStore";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 8;

/* ----------------------------------------------------- unknown guard --- */
function UnknownMaster({ slug }: { slug: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-sm text-muted">Unknown master “{slug}”.</p>
      <Link href="/dashboard" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
        Back to Dashboard
      </Link>
    </div>
  );
}

function Crumb({ entity, trail }: { entity: { plural: string; slug: string }; trail?: string }) {
  return (
    <div className="mb-1 flex items-center gap-2 text-xs text-muted">
      <span>Masters</span>
      <span className="text-subtle">/</span>
      {trail ? (
        <>
          <Link href={`/masters/${entity.slug}`} className="hover:text-foreground">
            {entity.plural}
          </Link>
          <span className="text-subtle">/</span>
          <span className="font-medium text-foreground">{trail}</span>
        </>
      ) : (
        <span className="font-medium text-foreground">{entity.plural}</span>
      )}
    </div>
  );
}

/* ============================================================== list === */

export function MasterList({ slug }: { slug: string }) {
  const entity = getEntity(slug);
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (entity) setRows(listMaster(slug));
  }, [slug, entity]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) => !q || Object.values(r).some((v) => v?.toLowerCase?.().includes(q))
    );
  }, [rows, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (!entity) return <UnknownMaster slug={slug} />;
  const Icon = entity.icon;
  const activeCount = rows.filter((r) => r.status === "Active").length;

  function del(id: string) {
    removeMaster(slug, id);
    setRows(listMaster(slug));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Crumb entity={entity} />
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            <Icon className="h-5 w-5 text-primary" />
            {entity.plural}
          </h1>
          <p className="mt-0.5 text-sm text-muted">{entity.description}</p>
        </div>
        <Link href={`/masters/${slug}/new`}>
          <Button size="md">
            <Plus className="h-4 w-4" />
            Add {entity.singular}
          </Button>
        </Link>
      </div>

      {/* mini stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MiniStat label={`Total ${entity.plural}`} value={String(rows.length)} tone="primary" />
        <MiniStat label="Active" value={String(activeCount)} tone="success" />
        <MiniStat label="Inactive" value={String(rows.length - activeCount)} tone="muted" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={`Search any column — ${entity.plural.toLowerCase()}…`}
              className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-subtle">
                {entity.columns.map((c) => (
                  <th key={c.key} className="px-4 py-2.5 font-medium">{c.label}</th>
                ))}
                <th className="px-4 py-2.5 text-center font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-surface-2">
                  {entity.columns.map((c, i) => (
                    <td key={c.key} className={cn("px-4 py-3", i === 0 ? "font-medium text-foreground" : "text-muted")}>
                      {r[c.key] || "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <Badge tone={r.status === "Active" ? "success" : "neutral"}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/masters/${slug}/${r.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Link>
                      <button onClick={() => del(r.id)} className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={entity.columns.length + 2} className="px-4 py-10 text-center text-sm text-muted">
                    No {entity.plural.toLowerCase()} found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
          label={entity.plural.toLowerCase()}
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "primary" | "success" | "muted" }) {
  const ring = { primary: "text-primary", success: "text-success", muted: "text-muted" }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", ring)}>{value}</p>
    </div>
  );
}

/* ============================================================== form === */

function FieldControl({
  field,
  value,
  options,
  onChange,
}: {
  field: MasterField;
  value: string;
  options?: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const Icon = field.icon;
  if (field.type === "textarea") {
    return (
      <Textarea
        label={field.label}
        info={field.info}
        sample={field.sample}
        rows={2}
        placeholder={field.sample}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "select") {
    const opts = options ?? field.options ?? [];
    const dependsOn = field.optionsFilter?.byField;
    return (
      <Select
        label={field.label}
        info={field.info}
        leadingIcon={Icon ? <Icon className="h-4 w-4" /> : undefined}
        options={opts}
        placeholder={
          dependsOn && opts.length === 0 ? "Select a category first…" : "Select…"
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <Input
      label={field.label}
      info={field.info}
      sample={field.sample}
      placeholder={field.sample}
      leadingIcon={Icon ? <Icon className="h-4 w-4" /> : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function MasterForm({
  slug,
  id,
  onSaved,
}: {
  slug: string;
  id?: string;
  onSaved?: () => void;
}) {
  const entity = getEntity(slug);
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Resolve select options — static, or live from a related master (optionsFrom),
  // optionally filtered by another field's value (e.g. Group filtered by Category).
  function optionsFor(field: MasterField) {
    if (field.options) return field.options;
    if (field.optionsFrom && mounted) {
      let recs = listMaster(field.optionsFrom);
      if (field.optionsFilter) {
        const fv = form[field.optionsFilter.byField];
        recs = recs.filter((r) => !fv || r[field.optionsFilter!.byField] === fv);
      }
      return recs.map((r) => ({
        value: r.name,
        label: r.code ? `${r.name} · ${r.code}` : r.name,
      }));
    }
    return [];
  }

  useEffect(() => {
    if (!entity) return;
    if (id) {
      const rec = getMaster(slug, id);
      if (rec) setForm(rec);
    } else {
      const defaults: Record<string, string> = { status: "Active" };
      entity.fields.forEach((f) => {
        if (f.type === "select" && f.options?.length) defaults[f.name] ??= "";
      });
      setForm(defaults);
    }
  }, [slug, id, entity]);

  if (!entity) return <UnknownMaster slug={slug} />;
  const isEdit = !!id;

  function save() {
    const nameField = entity!.fields[0].name;
    if (!form[nameField]?.trim()) {
      setError(`${entity!.singular} name is required.`);
      return;
    }
    if (isEdit) updateMaster(slug, id!, form);
    else createMaster(slug, form);
    setSaved(true);
    window.setTimeout(() => {
      if (onSaved) onSaved();
      else router.push(`/masters/${slug}`);
    }, 900);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Crumb entity={entity} trail={isEdit ? "Edit" : `New ${entity.singular}`} />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary/[0.07] to-transparent px-5 py-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-white">
            <entity.icon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-base font-bold text-foreground">
              {isEdit ? `Edit ${entity.singular}` : `New ${entity.singular}`}
            </h1>
            <p className="text-2xs text-muted">{entity.description}</p>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {error && (
            <div className="rounded-lg bg-danger-subtle px-3 py-2 text-xs font-medium text-danger">
              {error}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {entity.fields.map((f) => (
              <div key={f.name} className={f.full ? "sm:col-span-2" : ""}>
                <FieldControl
                  field={f}
                  value={form[f.name] ?? ""}
                  options={optionsFor(f)}
                  onChange={(v) => {
                    setError("");
                    setForm((s) => {
                      const next = { ...s, [f.name]: v };
                      // Changing Category invalidates a dependent Group selection.
                      if (f.name === "category") next.group = "";
                      return next;
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Link href={`/masters/${slug}`}>
            <Button variant="ghost" size="md">Cancel</Button>
          </Link>
          <Button size="md" onClick={save}>
            <Check className="h-4 w-4" />
            {isEdit ? "Save Changes" : `Create ${entity.singular}`}
          </Button>
        </div>
      </div>

      {saved && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
          <div className="success-pop mx-4 w-full max-w-xs rounded-2xl bg-card p-6 text-center shadow-xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success">
              <CheckCircle2 className="h-7 w-7 text-white" />
            </div>
            <h2 className="mt-3 text-base font-bold text-foreground">
              {entity.singular} {isEdit ? "Updated" : "Created"}
            </h2>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================ detail === */

export function MasterDetail({ slug, id }: { slug: string; id: string }) {
  const entity = getEntity(slug);
  const [editing, setEditing] = useState(false);
  const [rec, setRec] = useState<MasterRow | null>(null);

  useEffect(() => {
    if (entity) setRec(getMaster(slug, id));
  }, [slug, id, entity, editing]);

  if (!entity) return <UnknownMaster slug={slug} />;
  if (editing) {
    return <MasterForm slug={slug} id={id} onSaved={() => setEditing(false)} />;
  }
  if (!rec) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted">Record not found.</p>
        <Link href={`/masters/${slug}`} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
          Back to {entity.plural}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Crumb entity={entity} trail={rec[entity.fields[0].name] || "View"} />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/[0.07] to-transparent px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white">
              <entity.icon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-foreground">{rec[entity.fields[0].name]}</h1>
              <Badge tone={rec.status === "Active" ? "success" : "neutral"}>{rec.status}</Badge>
            </div>
          </div>
          <Button size="md" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </div>

        <div className="divide-y divide-border">
          {entity.fields.map((f) => (
            <div key={f.name} className="flex items-start gap-4 px-5 py-3">
              <span className="flex w-44 shrink-0 items-center gap-2 text-xs font-medium text-muted">
                {f.icon && <f.icon className="h-3.5 w-3.5" />}
                {f.label.replace(" *", "")}
              </span>
              <span className="flex-1 text-sm font-medium text-foreground">
                {rec[f.name] || "—"}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <Link href={`/masters/${slug}`}>
            <Button variant="ghost" size="md">
              <ArrowLeft className="h-4 w-4" />
              Back to {entity.plural}
            </Button>
          </Link>
          <Link href={`/masters/${slug}/new`}>
            <Button variant="outline" size="md">
              <ListTree className="h-4 w-4" />
              Add another
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
