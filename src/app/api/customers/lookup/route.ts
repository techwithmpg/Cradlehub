import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupCustomerByPhone } from "@/lib/queries/customers";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ customer: null });
  }

  const customer = await lookupCustomerByPhone(phone);
  return NextResponse.json({ customer });
}
