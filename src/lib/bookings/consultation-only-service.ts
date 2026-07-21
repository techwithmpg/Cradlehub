import type { Json } from "@/types/supabase";

const MULTI_PERSON_CATEGORY = "spa party packages";
const MULTI_PERSON_NAME_PATTERNS = [
  /couples?/i,
  /besties?/i,
  /spa\s*party/i,
  /\b(?:10|15|20)[-\s]?(?:person|pax)\b/i,
];

function metadataRequiresConsultation(metadata: Json | null | undefined): boolean {
  return Boolean(
    metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      metadata.requires_consultation === true
  );
}

export function isConsultationOnlyService(input: {
  name: string;
  categoryName?: string | null;
  metadata?: Json | null;
}): boolean {
  return (
    metadataRequiresConsultation(input.metadata) ||
    input.categoryName?.trim().toLowerCase() === MULTI_PERSON_CATEGORY ||
    MULTI_PERSON_NAME_PATTERNS.some((pattern) => pattern.test(input.name))
  );
}

export const CONSULTATION_ONLY_CUSTOMER_MESSAGE =
  "This service needs staff confirmation for participants, timing, and therapists. Please contact Cradle to arrange it.";
