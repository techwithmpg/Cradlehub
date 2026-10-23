import { NextRequest } from "next/server";
import {
  withDesktopCashierContext,
  getDesktopLedger,
  desktopJson,
} from "@/lib/cashier/desktop-cashier-contract";

export async function GET(request: NextRequest) {
  return withDesktopCashierContext(request, async (ctx) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const method = searchParams.get("method") || undefined;
    const status = searchParams.get("status") || undefined;
    const pageStr = searchParams.get("page");
    const pageSizeStr = searchParams.get("pageSize");
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : undefined;

    const data = await getDesktopLedger(ctx, {
      search,
      category,
      method,
      status,
      page,
      pageSize,
    });

    return desktopJson({
      ok: true,
      data,
    });
  });
}
