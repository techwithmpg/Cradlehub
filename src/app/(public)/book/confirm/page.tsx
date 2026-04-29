import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingProgress } from "@/components/features/booking/booking-progress";
import { BookingForm } from "@/components/features/booking/booking-form";
import { getBranchById } from "@/lib/queries/branches";
import { getServiceById } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTimeValue(value: string): boolean {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value);
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    branchId?: string | string[];
    serviceId?: string | string[];
    staffId?: string | string[];
    date?: string | string[];
    time?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const branchId = firstQueryValue(resolvedSearchParams.branchId);
  const serviceId = firstQueryValue(resolvedSearchParams.serviceId);
  const staffId = firstQueryValue(resolvedSearchParams.staffId);
  const date = firstQueryValue(resolvedSearchParams.date);
  const time = firstQueryValue(resolvedSearchParams.time);

  if (!branchId || !serviceId || !date || !time || !isIsoDate(date) || !isTimeValue(time)) {
    notFound();
  }

  let branch: BranchRow | null = null;
  let service: ServiceRow | null = null;

  try {
    const [branchResult, serviceResult] = await Promise.all([
      getBranchById(branchId),
      getServiceById(serviceId),
    ]);
    branch = branchResult as BranchRow;
    service = serviceResult as ServiceRow;
  } catch {
    notFound();
  }

  if (!branch || !service || !branch.is_active || !service.is_active) {
    notFound();
  }

  const displayPrice = Number(service.price);

  return (
    <div>
      <BookingProgress currentStep={4} />

      <div style={{ marginBottom: "0.375rem" }}>
        <Link
          href={`/book/${branchId}/${serviceId}`}
          style={{
            fontSize: "0.8125rem",
            color: "var(--ch-text-muted)",
            textDecoration: "none",
          }}
        >
          ← Back
        </Link>
      </div>

      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          color: "var(--ch-text)",
          marginBottom: "0.375rem",
        }}
      >
        Almost done
      </h2>
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--ch-text-muted)",
          marginBottom: "1.5rem",
        }}
      >
        Enter your details to confirm your appointment
      </p>

      <BookingForm
        branchId={branchId}
        serviceId={serviceId}
        staffId={staffId ?? ""}
        date={date}
        time={time}
        serviceName={service.name}
        servicePrice={displayPrice}
        durationMins={service.duration_minutes}
      />
    </div>
  );
}
