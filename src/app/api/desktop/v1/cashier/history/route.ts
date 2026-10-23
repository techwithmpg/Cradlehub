import { NextRequest } from "next/server";
import {
  withDesktopCashierContext,
  getDesktopHistory,
  desktopJson,
} from "@/lib/cashier/desktop-cashier-contract";

export async function GET(request: NextRequest) {
  return withDesktopCashierContext(request, async (ctx) => {
    const data = await getDesktopHistory(ctx);
    return desktopJson({
      ok: true,
      data,
    });
  });
}
