import { canActAsBookingServiceProvider } from "@/lib/staff/service-providers";
import { isOperationalStaff } from "@/lib/staff/operational-staff";
import { isCrmFrontDeskScheduleStaff } from "@/lib/schedule/shift-eligibility";
import type { SheetResolution } from "./sheet-ingestion-types";
import { normalizeSheetText } from "./sheet-source-identity";
import {
  normalizeContactPhone,
  type SheetContextIndexes,
  type SheetCustomer,
  type SheetService,
  type SheetStaff,
} from "./sheet-resolution-context";

function result<T>(
  candidates: T[],
  method: SheetResolution<T>["method"],
  reason: string
): SheetResolution<T> {
  return {
    status: candidates.length === 1 ? "resolved" : candidates.length ? "ambiguous" : "missing",
    value: candidates.length === 1 ? candidates[0]! : null,
    candidates,
    method,
    reason,
  };
}
function aliasIds(
  indexes: SheetContextIndexes,
  type: "staff" | "service" | "customer",
  value: string
) {
  return [
    ...new Set(
      indexes.context.aliases
        .filter(
          (alias) =>
            alias.targetType === type &&
            alias.status === "active" &&
            alias.approvedBy &&
            !Number.isNaN(Date.parse(alias.approvedAt)) &&
            (!alias.branchId || alias.branchId === indexes.context.branch?.id) &&
            normalizeSheetText(alias.rawAlias) === normalizeSheetText(value)
        )
        .map((alias) => alias.targetId)
    ),
  ];
}
export function resolveSheetService(
  value: string | null,
  indexes: SheetContextIndexes
): SheetResolution<SheetService> {
  if (indexes.context.status !== "available")
    return result([], "unavailable", "Canonical service context was not loaded.");
  const candidates = indexes.serviceNames.get(normalizeSheetText(value)) ?? [];
  const exact = candidates.filter((s) => s.name === value?.trim());
  if (exact.length) return result(exact, "exact_name", "Exact canonical service name.");
  if (candidates.length)
    return result(
      candidates,
      "normalized_name",
      "Normalized exact service name; no fuzzy matching."
    );
  const aliases = aliasIds(indexes, "service", value ?? "").flatMap(
    (id) => indexes.serviceById.get(id) ?? []
  );
  return result(
    aliases,
    aliases.length ? "approved_alias" : "none",
    aliases.length
      ? "Approved service mapping."
      : "Choose a canonical service or approve a mapping."
  );
}
export function staffCanServe(
  staff: SheetStaff,
  serviceId: string,
  indexes: SheetContextIndexes
): boolean {
  return (
    indexes.capabilities.has(`${staff.id}:${serviceId}`) &&
    canActAsBookingServiceProvider(staff, true)
  );
}
export function resolveSheetStaff(
  value: string | null,
  service: SheetResolution<SheetService>,
  duty: boolean,
  indexes: SheetContextIndexes
): SheetResolution<SheetStaff> {
  if (indexes.context.status !== "available")
    return result([], "unavailable", "Canonical staff context was not loaded.");
  let candidates = indexes.staffNames.get(normalizeSheetText(value)) ?? [];
  let method: SheetResolution<SheetStaff>["method"] = "normalized_name";
  const exact = candidates.filter((s) => s.full_name === value?.trim());
  if (exact.length) {
    candidates = exact;
    method = "exact_name";
  }
  if (!candidates.length) {
    candidates = indexes.staffNicknames.get(normalizeSheetText(value)) ?? [];
    method = "nickname";
  }
  if (!candidates.length) {
    candidates = aliasIds(indexes, "staff", value ?? "").flatMap(
      (id) => indexes.staffById.get(id) ?? []
    );
    method = "approved_alias";
  }
  const rejected: { id: string; reason: string }[] = [];
  const eligible = candidates.filter((s) => {
    const reason =
      s.branch_id !== indexes.context.branch?.id
        ? "wrong_branch"
        : !isOperationalStaff(s)
          ? "not_operational"
          : duty
            ? !isCrmFrontDeskScheduleStaff(s)
              ? "duty_role_unconfirmed"
              : null
            : service.value && !staffCanServe(s, service.value.id, indexes)
              ? "service_incompatible"
              : null;
    if (reason) rejected.push({ id: s.id, reason });
    return !reason;
  });
  // Preserve a clear identity even when eligibility fails. Validation reports the conflict.
  if (candidates.length === 1)
    return {
      ...result(candidates, method, "Unique identity; eligibility validated separately."),
      rejected,
    };
  if (eligible.length === 1 && (duty || service.status === "resolved"))
    return {
      ...result(
        eligible,
        "service_capability_disambiguation",
        "Unique eligible identity after branch, operational role and service filtering."
      ),
      rejected,
    };
  return {
    ...result(
      eligible.length ? eligible : candidates,
      method,
      candidates.length
        ? "Multiple or ineligible identities require confirmation."
        : "Choose a canonical staff member."
    ),
    rejected,
  };
}
export type SheetCustomerResolution = SheetResolution<SheetCustomer> & {
  classification: "uniquely_resolved" | "ambiguous" | "new_candidate" | "insufficient_identity";
};
export function resolveSheetCustomer(
  value: string | null,
  indexes: SheetContextIndexes
): SheetCustomerResolution {
  const finish = (
    resolution: SheetResolution<SheetCustomer>,
    classification: SheetCustomerResolution["classification"]
  ): SheetCustomerResolution => ({ ...resolution, classification });
  if (indexes.context.status !== "available")
    return finish(
      result([], "unavailable", "Canonical customer context was not loaded."),
      "insufficient_identity"
    );
  const aliases = aliasIds(indexes, "customer", value ?? "").flatMap(
    (id) => indexes.customerById.get(id) ?? []
  );
  if (aliases.length)
    return finish(
      result(aliases, "approved_alias", "Approved customer identity mapping."),
      aliases.length === 1 ? "uniquely_resolved" : "ambiguous"
    );
  const names = indexes.customerNames.get(normalizeSheetText(value)) ?? [];
  const contacts = indexes.contactNames.get(normalizeSheetText(value)) ?? [];
  if (contacts.length > 1)
    return finish(
      {
        ...result(
          names,
          "none",
          "Duplicate Contacts names require selection; never choose the first."
        ),
        status: "ambiguous",
        value: null,
      },
      "ambiguous"
    );
  const contact = contacts[0];
  if (contact?.source) {
    const phone = normalizeContactPhone(contact.phone),
      email = normalizeSheetText(contact.email);
    const byPhone = phone ? (indexes.customerPhones.get(phone) ?? []) : [];
    const byEmail = email ? (indexes.customerEmails.get(email) ?? []) : [];
    const matched = [
      ...new Map([...byPhone, ...byEmail].map((customer) => [customer.id, customer])).values(),
    ];
    if (matched.length)
      return finish(
        result(
          matched,
          "contact_identity",
          "Unique Contact identity signals; conflicting phone/email matches remain ambiguous."
        ),
        matched.length === 1 ? "uniquely_resolved" : "ambiguous"
      );
    if ((phone || email) && !names.length)
      return finish(
        result([], "contact_identity", "New customer candidate only; no customer is created."),
        "new_candidate"
      );
  }
  return finish(
    {
      ...result(names, "none", "Name evidence requires a contact identity or approved mapping."),
      status: names.length > 1 ? "ambiguous" : "missing",
      value: null,
    },
    names.length > 1 ? "ambiguous" : "insufficient_identity"
  );
}
