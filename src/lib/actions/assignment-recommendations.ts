"use server";

import { createClient } from "@/lib/supabase/server";
import { getDevBypassLayoutStaff, isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { logError } from "@/lib/logger";
import { z } from "zod";
import {
  buildRecommendationContext,
  buildDriverRecommendationContext,
} from "@/lib/queries/assignment-recommendations";
import {
  scoreTherapistCandidates,
  scoreDriverCandidates,
  type ScoredStaff,
} from "@/lib/assignments/recommendation-engine";

// ── Validation ─────────────────────────────────────────────────────────────────

const recommendSchema = z.object({
  bookingId: z.string().uuid(),
});

// ── Auth helper ────────────────────────────────────────────────────────────────

type RecCtx =
  | { error: string }
  | { supabase: Awaited<ReturnType<typeof createClient>>; me: { id: string; branch_id: string; system_role: string } };

async function requireRecommendationAccess(): Promise<RecCtx> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      supabase,
      me: {
        id: "00000000-0000-0000-0000-000000000000",
        branch_id: mock.branch_id,
        system_role: mock.system_role,
      },
    };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return { error: "No active staff record" };
  if (!canAccessCrmWorkspace(me.system_role))
    return { error: "Insufficient permissions" };

  return { supabase, me: { id: me.id, branch_id: me.branch_id, system_role: me.system_role } };
}

// ── Return types ───────────────────────────────────────────────────────────────

export type RecommendationResult = {
  therapists: ScoredStaff[];
  drivers: ScoredStaff[];
};

export type RecommendationActionResult =
  | { success: true; data: RecommendationResult }
  | { success: false; error: string };

// ── Main action ────────────────────────────────────────────────────────────────

export async function getAssignmentRecommendationsAction(
  rawInput: unknown
): Promise<RecommendationActionResult> {
  const parsed = recommendSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireRecommendationAccess();
  if ("error" in ctx) return { success: false, error: ctx.error };

  try {
    const { bookingId } = parsed.data;

    // Verify branch scope
    const { data: booking } = await ctx.supabase
      .from("bookings")
      .select("branch_id")
      .eq("id", bookingId)
      .single();

    if (!booking) return { success: false, error: "Booking not found" };

    const isOwner = ctx.me.system_role === "owner";
    if (!isOwner && ctx.me.branch_id !== booking.branch_id) {
      return { success: false, error: "Booking is not in your branch" };
    }

    // Build contexts and score
    const [therapistCtx, driverCtx] = await Promise.all([
      buildRecommendationContext(bookingId),
      buildDriverRecommendationContext(bookingId),
    ]);

    if (!therapistCtx || !driverCtx) {
      return { success: false, error: "Failed to build recommendation context" };
    }

    const therapists = scoreTherapistCandidates(therapistCtx);
    const drivers = scoreDriverCandidates(driverCtx);

    return {
      success: true,
      data: { therapists, drivers },
    };
  } catch (error) {
    logError("Assignment recommendation failed", {
      error: error instanceof Error ? error.message : String(error),
      bookingId: (rawInput as { bookingId?: string })?.bookingId,
    });
    return { success: false, error: "Failed to generate recommendations" };
  }
}

// ── Lightweight action: therapist only ─────────────────────────────────────────

export async function getTherapistRecommendationsAction(
  rawInput: unknown
): Promise<RecommendationActionResult> {
  const parsed = recommendSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireRecommendationAccess();
  if ("error" in ctx) return { success: false, error: ctx.error };

  try {
    const { bookingId } = parsed.data;

    const { data: booking } = await ctx.supabase
      .from("bookings")
      .select("branch_id")
      .eq("id", bookingId)
      .single();

    if (!booking) return { success: false, error: "Booking not found" };

    const isOwner = ctx.me.system_role === "owner";
    if (!isOwner && ctx.me.branch_id !== booking.branch_id) {
      return { success: false, error: "Booking is not in your branch" };
    }

    const therapistCtx = await buildRecommendationContext(bookingId);
    if (!therapistCtx) {
      return { success: false, error: "Failed to build recommendation context" };
    }

    const therapists = scoreTherapistCandidates(therapistCtx);
    return { success: true, data: { therapists, drivers: [] } };
  } catch (error) {
    logError("Therapist recommendation failed", {
      error: error instanceof Error ? error.message : String(error),
      bookingId: (rawInput as { bookingId?: string })?.bookingId,
    });
    return { success: false, error: "Failed to generate therapist recommendations" };
  }
}

// ── Lightweight action: driver only ────────────────────────────────────────────

export async function getDriverRecommendationsAction(
  rawInput: unknown
): Promise<RecommendationActionResult> {
  const parsed = recommendSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireRecommendationAccess();
  if ("error" in ctx) return { success: false, error: ctx.error };

  try {
    const { bookingId } = parsed.data;

    const { data: booking } = await ctx.supabase
      .from("bookings")
      .select("branch_id, delivery_type, type")
      .eq("id", bookingId)
      .single();

    if (!booking) return { success: false, error: "Booking not found" };

    const isHomeService =
      booking.delivery_type === "home_service" || booking.type === "home_service";
    if (!isHomeService) {
      return { success: false, error: "Driver recommendations are only for home-service bookings" };
    }

    const isOwner = ctx.me.system_role === "owner";
    if (!isOwner && ctx.me.branch_id !== booking.branch_id) {
      return { success: false, error: "Booking is not in your branch" };
    }

    const driverCtx = await buildDriverRecommendationContext(bookingId);
    if (!driverCtx) {
      return { success: false, error: "Failed to build recommendation context" };
    }

    const drivers = scoreDriverCandidates(driverCtx);
    return { success: true, data: { therapists: [], drivers } };
  } catch (error) {
    logError("Driver recommendation failed", {
      error: error instanceof Error ? error.message : String(error),
      bookingId: (rawInput as { bookingId?: string })?.bookingId,
    });
    return { success: false, error: "Failed to generate driver recommendations" };
  }
}
