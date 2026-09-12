"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  startRoomCleaning,
  markRoomReady,
  type UtilityActionResult,
} from "@/lib/staff-pwa/utility-turnover";

export async function startRoomCleaningAction(
  taskId: string
): Promise<UtilityActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      error: "Authentication required.",
    };
  }

  const result = await startRoomCleaning({
    taskId,
    actorUserId: user.id,
  });

  if (result.ok) {
    revalidatePath("/staff/utility");
    revalidatePath("/staff/utility/work");
  }

  return result;
}

export async function markRoomReadyAction(
  taskId: string
): Promise<UtilityActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      error: "Authentication required.",
    };
  }

  const result = await markRoomReady({
    taskId,
    actorUserId: user.id,
  });

  if (result.ok) {
    revalidatePath("/staff/utility");
    revalidatePath("/staff/utility/work");
  }

  return result;
}
