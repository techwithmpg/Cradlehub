"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AdminDialog,
  AdminOverlayBody,
  ConfirmUnsavedChangesDialog,
} from "@/components/shared/overlays";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  QuickBookingForm,
  type QuickBookingCustomerOption,
  type QuickBookingMode,
  type QuickBookingResourceOption,
  type QuickBookingServiceOption,
  type QuickBookingStaffOption,
} from "@/components/features/bookings/quick-booking-form";
import { getAdministrativeBookingCustomerPrefillAction } from "@/lib/actions/administrative-booking";
import type { BranchBookingRules } from "@/lib/validations/booking-rules";
import { cn } from "@/lib/utils";

export type AdministrativeBookingMode =
  | "standard"
  | "standard_future"
  | "walk_in"
  | "walkin"
  | "phone"
  | "home_service";

export type AdministrativeBookingModalRequest = {
  mode?: AdministrativeBookingMode;
  customerId?: string;
  branchId?: string;
  serviceId?: string;
  staffId?: string;
  date?: string;
  time?: string;
  name?: string;
  phone?: string;
};

type AdministrativeBookingModalContextValue = {
  openBookingModal: (request?: AdministrativeBookingModalRequest) => void;
  closeBookingModal: () => void;
  branchId: string;
  branchName: string;
  services: QuickBookingServiceOption[];
  staff: QuickBookingStaffOption[];
  resources: QuickBookingResourceOption[];
};

type AdministrativeBookingModalProviderProps = {
  children: ReactNode;
  branchId: string;
  branchName: string;
  bookingRules: Pick<
    BranchBookingRules,
    | "inSpaStartTime"
    | "inSpaEndTime"
    | "homeServiceEnabled"
    | "homeServiceStartTime"
    | "homeServiceEndTime"
    | "maxAdvanceBookingDays"
  >;
  services: QuickBookingServiceOption[];
  staff: QuickBookingStaffOption[];
  resources: QuickBookingResourceOption[];
};

const AdministrativeBookingModalContext =
  createContext<AdministrativeBookingModalContextValue | null>(null);

function toQuickBookingMode(mode: AdministrativeBookingMode | undefined): QuickBookingMode {
  if (mode === "phone") return "phone";
  if (mode === "home_service") return "home_service";
  if (mode === "standard" || mode === "standard_future") return "standard_future";
  return "walkin";
}

export function AdministrativeBookingModalProvider({
  children,
  branchId,
  branchName,
  bookingRules,
  services,
  staff,
  resources,
}: AdministrativeBookingModalProviderProps) {
  const router = useRouter();
  const [request, setRequest] = useState<AdministrativeBookingModalRequest | null>(null);
  const [modalKey, setModalKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [customerPrefill, setCustomerPrefill] = useState<QuickBookingCustomerOption | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  const openBookingModal = useCallback((nextRequest: AdministrativeBookingModalRequest = {}) => {
    setRequest(nextRequest);
    setModalKey((current) => current + 1);
    setDirty(false);
    setConfirmOpen(false);
    setCustomerPrefill(null);
    setCustomerError(null);
    setLoadingCustomer(Boolean(nextRequest.customerId));
  }, []);

  const closeBookingModal = useCallback(() => {
    setRequest(null);
    setDirty(false);
    setConfirmOpen(false);
    setCustomerPrefill(null);
    setCustomerError(null);
    setLoadingCustomer(false);
  }, []);

  const requestClose = useCallback(() => {
    if (dirty) {
      setConfirmOpen(true);
      return;
    }
    closeBookingModal();
  }, [closeBookingModal, dirty]);

  const value = useMemo(
    () => ({
      openBookingModal,
      closeBookingModal: requestClose,
      branchId,
      branchName,
      services,
      staff,
      resources,
    }),
    [branchId, branchName, openBookingModal, requestClose, resources, services, staff]
  );

  useEffect(() => {
    if (!request?.customerId) {
      return;
    }

    let active = true;
    void getAdministrativeBookingCustomerPrefillAction({ customerId: request.customerId })
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setCustomerPrefill(result.customer);
          if (!result.customer) setCustomerError("Customer could not be found.");
        } else {
          setCustomerError(result.message);
        }
      })
      .catch(() => {
        if (active) setCustomerError("Customer could not be loaded.");
      })
      .finally(() => {
        if (active) setLoadingCustomer(false);
      });

    return () => {
      active = false;
    };
  }, [modalKey, request?.customerId]);

  const modalOpen = request !== null;
  const quickMode = toQuickBookingMode(request?.mode);

  return (
    <AdministrativeBookingModalContext.Provider value={value}>
      {children}

      <AdminDialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (open) return;
          requestClose();
        }}
        size="xl"
        placement="center"
        className="h-[100dvh] max-h-[100dvh] rounded-none border-0 bg-[var(--cs-surface)] sm:h-auto sm:max-h-[min(92vh,900px)] sm:rounded-2xl sm:border sm:max-w-[900px]"
      >
        <AdminOverlayBody padded={false} className="bg-[var(--cs-bg)]">
          {loadingCustomer ? (
            <div className="flex min-h-[360px] items-center justify-center gap-2 text-sm font-semibold text-[var(--cs-text-muted)]">
              <Loader2 className="size-4 animate-spin" />
              Loading customer...
            </div>
          ) : (
            <QuickBookingForm
              key={modalKey}
              branchId={branchId}
              branchName={branchName}
              bookingRules={bookingRules}
              initialMode={quickMode}
              initialCustomer={customerPrefill}
              initialName={request?.name ?? ""}
              initialPhone={request?.phone ?? ""}
              initialServiceId={request?.serviceId}
              initialStaffId={request?.staffId}
              initialDate={request?.date}
              initialTime={request?.time}
              services={services}
              staff={staff}
              resources={resources}
              successBehavior="stay"
              onDirtyChange={setDirty}
              onCancel={requestClose}
              onSuccess={(result) => {
                closeBookingModal();
                router.refresh();
                toast.success("Booking created", {
                  description: result.isHomeService
                    ? "Home service surfaces will refresh shortly."
                    : "Schedule and booking queues will refresh shortly.",
                });
              }}
            />
          )}

          {customerError ? (
            <div className="mx-4 mb-4 rounded-xl border border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] px-4 py-3 text-sm font-medium text-[var(--cs-error-text)] sm:mx-5">
              {customerError}
            </div>
          ) : null}
        </AdminOverlayBody>
      </AdminDialog>

      <ConfirmUnsavedChangesDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={closeBookingModal}
        title="Discard this unfinished booking?"
        description="You have unsaved booking details. Discard them or keep editing?"
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
      />
    </AdministrativeBookingModalContext.Provider>
  );
}

export function useAdministrativeBookingModal() {
  const context = useContext(AdministrativeBookingModalContext);
  if (!context) {
    throw new Error("useAdministrativeBookingModal must be used inside AdministrativeBookingModalProvider.");
  }
  return context;
}

type OpenAdministrativeBookingButtonProps = Omit<
  ButtonProps,
  "type" | "onClick"
> &
  AdministrativeBookingModalRequest & {
    label?: string;
    showIcon?: boolean;
    onClick?: ComponentPropsWithoutRef<"button">["onClick"];
  };

export function OpenAdministrativeBookingButton({
  mode,
  customerId,
  branchId,
  serviceId,
  staffId,
  date,
  time,
  name,
  phone,
  label = "New Booking",
  showIcon = true,
  children,
  className,
  onClick,
  ...buttonProps
}: OpenAdministrativeBookingButtonProps) {
  const { openBookingModal } = useAdministrativeBookingModal();

  return (
    <Button
      type="button"
      className={cn("gap-2", className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        openBookingModal({ mode, customerId, branchId, serviceId, staffId, date, time, name, phone });
      }}
      {...buttonProps}
    >
      {children ?? (
        <>
          {showIcon ? <CalendarPlus className="size-4" /> : null}
          {label}
        </>
      )}
    </Button>
  );
}
