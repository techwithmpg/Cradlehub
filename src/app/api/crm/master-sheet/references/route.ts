import { NextRequest, NextResponse } from "next/server";
import { loadSheetNativeReferences } from "@/lib/integrations/google-sheets/sheet-native-service";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const result = await loadSheetNativeReferences(date);
  return NextResponse.json(result, {
    status: result.status === "forbidden" ? 403 : 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
