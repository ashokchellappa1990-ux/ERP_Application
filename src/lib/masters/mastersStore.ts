import { MASTERS, type MasterRow } from "./masterConfig";

/**
 * Client-side master-data store backed by localStorage so created records
 * persist across reloads. Seeds from masterConfig on first access.
 * (Swap these functions for `/api/masters/:slug` calls when the backend lands.)
 */

const storageKey = (slug: string) => `oasys.master.${slug}`;

function read(slug: string): MasterRow[] {
  const entity = MASTERS[slug];
  if (!entity) return [];
  if (typeof window === "undefined") return entity.seed;
  const raw = localStorage.getItem(storageKey(slug));
  if (raw) {
    try {
      return JSON.parse(raw) as MasterRow[];
    } catch {
      /* fall through to seed */
    }
  }
  localStorage.setItem(storageKey(slug), JSON.stringify(entity.seed));
  return entity.seed;
}

function write(slug: string, rows: MasterRow[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey(slug), JSON.stringify(rows));
  }
}

export function listMaster(slug: string): MasterRow[] {
  return read(slug);
}

export function getMaster(slug: string, id: string): MasterRow | null {
  return read(slug).find((r) => r.id === id) ?? null;
}

export function createMaster(slug: string, data: Record<string, string>): MasterRow {
  const rows = read(slug);
  const row: MasterRow = {
    ...data,
    id: `${slug}-${Date.now().toString(36)}`,
    status: data.status || "Active",
  };
  write(slug, [row, ...rows]);
  return row;
}

export function updateMaster(slug: string, id: string, data: Record<string, string>) {
  const rows = read(slug).map((r) => (r.id === id ? { ...r, ...data, id } : r));
  write(slug, rows);
}

export function removeMaster(slug: string, id: string) {
  write(slug, read(slug).filter((r) => r.id !== id));
}
