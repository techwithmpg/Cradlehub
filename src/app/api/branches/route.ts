import { NextResponse } from "next/server";
import { getAllBranches } from "@/lib/queries/branches";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export async function GET() {
  const branches = (await getAllBranches()) as BranchRow[];
  return NextResponse.json({ branches });
}
