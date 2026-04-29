import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchCustomers } from "@/lib/queries/customers";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .single();

  if (!me || !["crm", "owner", "manager"].includes(me.system_role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const customers = await searchCustomers(q);
  return NextResponse.json({ customers });
}
