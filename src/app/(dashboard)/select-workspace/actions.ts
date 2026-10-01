"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import {
  getOwnerFrontDeskBranches,
  OWNER_FRONT_DESK_BRANCH_COOKIE,
} from "@/lib/queries/front-desk-branch";

export async function openOwnerFrontDeskBranch(formData: FormData): Promise<void> {
  const context = await getFrontDeskContext();
  if (context.role !== "owner") throw new Error("Only an Owner can select a Front Desk branch.");

  const branchId = formData.get("branchId");
  if (typeof branchId !== "string" || !(await getOwnerFrontDeskBranches()).some((branch) => branch.id === branchId)) {
    throw new Error("Select an active Front Desk branch.");
  }

  (await cookies()).set(OWNER_FRONT_DESK_BRANCH_COOKIE, `${context.userId}:${branchId}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/crm", "layout");
  redirect("/crm/today");
}
