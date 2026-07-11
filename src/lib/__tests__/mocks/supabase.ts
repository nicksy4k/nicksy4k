import { vi } from "vitest";

type Row = Record<string, unknown>;

export interface SupabaseMock {
  inserts: Record<string, Row[]>;
  updates: Array<{ table: string; patch: Row; match: Row }>;
  deletes: Array<{ table: string; match: Row }>;
  seed: (table: string, rows: Row[]) => void;
  client: {
    auth: { getUser: ReturnType<typeof vi.fn> };
    from: (table: string) => QueryBuilder;
  };
}

interface QueryBuilder {
  select: (..._args: unknown[]) => QueryBuilder;
  insert: (rows: Row | Row[]) => QueryBuilder;
  update: (patch: Row) => QueryBuilder;
  delete: () => QueryBuilder;
  eq: (col: string, val: unknown) => QueryBuilder;
  in: (col: string, vals: unknown[]) => QueryBuilder;
  lte: (col: string, val: unknown) => QueryBuilder;
  then: <T>(resolve: (r: { data: unknown; error: null }) => T) => Promise<T>;
}

export function createSupabaseMock(userId = "user-1"): SupabaseMock {
  const inserts: Record<string, Row[]> = {};
  const updates: SupabaseMock["updates"] = [];
  const deletes: SupabaseMock["deletes"] = [];
  const tables: Record<string, Row[]> = {};

  const seed = (table: string, rows: Row[]) => {
    tables[table] = (tables[table] ?? []).concat(rows);
  };

  function makeBuilder(table: string): QueryBuilder {
    let mode: "select" | "insert" | "update" | "delete" = "select";
    let pendingInsert: Row[] = [];
    let pendingUpdate: Row = {};
    const match: Row = {};

    const settle = (): { data: unknown; error: null } => {
      if (mode === "insert") {
        inserts[table] = (inserts[table] ?? []).concat(pendingInsert);
        return { data: pendingInsert.map((r, i) => ({ ...r, id: `${table}-${i}` })), error: null };
      }
      if (mode === "update") {
        updates.push({ table, patch: pendingUpdate, match: { ...match } });
        return { data: null, error: null };
      }
      if (mode === "delete") {
        deletes.push({ table, match: { ...match } });
        return { data: null, error: null };
      }
      const rows = (tables[table] ?? []).filter((r) =>
        Object.entries(match).every(([k, v]) => r[k] === v),
      );
      return { data: rows, error: null };
    };

    const builder: QueryBuilder = {
      select: () => builder,
      insert: (rows) => {
        mode = "insert";
        pendingInsert = Array.isArray(rows) ? rows : [rows];
        return builder;
      },
      update: (patch) => {
        mode = "update";
        pendingUpdate = patch;
        return builder;
      },
      delete: () => {
        mode = "delete";
        return builder;
      },
      eq: (col, val) => {
        match[col] = val;
        return builder;
      },
      in: (col, vals) => {
        match[col] = vals;
        return builder;
      },
      lte: () => builder,
      then: (resolve) => Promise.resolve(resolve(settle())),
    };
    return builder;
  }

  return {
    inserts,
    updates,
    deletes,
    seed,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
      },
      from: (table: string) => makeBuilder(table),
    },
  };
}
