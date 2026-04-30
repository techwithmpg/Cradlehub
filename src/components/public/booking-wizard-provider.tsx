"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BookingModal } from "@/components/public/booking-modal";

type BookingOpenOptions = {
  serviceId?: string;
};

type BookingWizardContextValue = {
  openWizard: (options?: BookingOpenOptions) => void;
};

const BookingWizardContext = createContext<BookingWizardContextValue | null>(null);

export function BookingWizardProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [initialServiceId, setInitialServiceId] = useState<string | undefined>(undefined);

  const openWizard = useCallback((options?: BookingOpenOptions) => {
    setInitialServiceId(options?.serviceId);
    setModalKey((current) => current + 1);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openWizard }), [openWizard]);

  return (
    <BookingWizardContext.Provider value={value}>
      {children}
      <BookingModal
        key={modalKey}
        open={open}
        onOpenChange={setOpen}
        initialServiceId={initialServiceId}
      />
    </BookingWizardContext.Provider>
  );
}

export function useBookingWizard() {
  const context = useContext(BookingWizardContext);
  if (!context) {
    throw new Error("useBookingWizard must be used within BookingWizardProvider");
  }
  return context;
}

