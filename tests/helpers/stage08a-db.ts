import { vi } from "vitest";
export type Row = Record<string, unknown>;
type Result = { data: unknown; error: unknown };
export function fakeDatabase(initial: Record<string, Row[]> = {}) {
  const rows = initial;
  const errors: Record<string, unknown> = {};
  const writes: { table: string; values: Row; filters: [string, unknown][]; kind: string }[] = [];
  const reads: { table: string; filters: [string, unknown][]; columns: string }[] = [];
  class Query implements PromiseLike<Result> {
    filters: [string, unknown][] = [];
    columns = "";
    values: Row | null = null;
    kind = "read";
    offset = 0;
    end = Infinity;
    sortKey: string | null = null;
    ascending = true;
    constructor(readonly table: string) {}
    select(columns = "*") {
      this.columns = columns;
      return this;
    }
    eq(key: string, value: unknown) {
      this.filters.push([key, value]);
      return this;
    }
    neq() {
      return this;
    }
    not() {
      return this;
    }
    is(key: string, value: unknown) {
      return this.eq(key, value);
    }
    in(key: string, values: unknown[]) {
      this.filters.push([key, values]);
      return this;
    }
    or() {
      return this;
    }
    order(key: string, options?: { ascending?: boolean }) {
      this.sortKey = key;
      this.ascending = options?.ascending !== false;
      return this;
    }
    limit(count: number) {
      this.end = this.offset + count - 1;
      return this;
    }
    range(start: number, end: number) {
      this.offset = start;
      this.end = end;
      return this;
    }
    update(values: Row) {
      this.values = values;
      this.kind = "update";
      return this;
    }
    insert(values: Row) {
      this.values = values;
      this.kind = "insert";
      return this;
    }
    result(single: boolean): Result {
      const error = errors[this.table + ":" + this.kind] ?? errors[this.table];
      if (error) return { data: null, error };
      const filtered = (rows[this.table] ?? []).filter((row) =>
        this.filters.every(([key, value]) =>
          Array.isArray(value) ? value.includes(row[key]) : row[key] === value
        )
      );
      if (this.values) {
        writes.push({
          table: this.table,
          values: this.values,
          filters: this.filters,
          kind: this.kind,
        });
        return {
          data: this.kind === "insert" ? null : filtered.map((row) => ({ ...row, ...this.values })),
          error: null,
        };
      }
      reads.push({ table: this.table, filters: this.filters, columns: this.columns });
      const ordered = this.sortKey
        ? [...filtered].sort(
            (a, b) =>
              String(a[this.sortKey!] ?? "").localeCompare(String(b[this.sortKey!] ?? "")) *
              (this.ascending ? 1 : -1)
          )
        : filtered;
      const data = ordered.slice(this.offset, this.end + 1);
      return { data: single ? (data[0] ?? null) : data, error: null };
    }
    async maybeSingle() {
      return this.result(true);
    }
    async single() {
      return this.result(true);
    }
    then<T1 = Result, T2 = never>(
      fulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
      rejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
    ): PromiseLike<T1 | T2> {
      return Promise.resolve(this.result(false)).then(fulfilled, rejected);
    }
  }
  const client = {
    from: vi.fn((table: string) => new Query(table)),
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  };
  return { client, rows, errors, writes, reads };
}
