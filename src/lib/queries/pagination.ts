export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export function normalizePagination(
  params: PaginationParams,
  defaults?: { defaultPageSize?: number; maxPageSize?: number }
) {
  const defaultPageSize = defaults?.defaultPageSize ?? 25;
  const maxPageSize     = defaults?.maxPageSize     ?? 100;

  const raw   = Number(params.page     ?? 1);
  const rawPs = Number(params.pageSize ?? defaultPageSize);

  const page     = Math.max(1, Number.isFinite(raw)   ? Math.floor(raw)   : 1);
  const pageSize = Math.min(Math.max(1, Number.isFinite(rawPs) ? Math.floor(rawPs) : defaultPageSize), maxPageSize);

  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;

  return { page, pageSize, from, to };
}

export function toPaginatedResult<T>(args: {
  data: T[];
  count: number | null;
  page: number;
  pageSize: number;
}): PaginatedResult<T> {
  const total = args.count ?? 0;
  return {
    data:      args.data,
    page:      args.page,
    pageSize:  args.pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / args.pageSize)),
  };
}
