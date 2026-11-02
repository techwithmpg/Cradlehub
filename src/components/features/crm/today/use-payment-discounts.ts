"use client";

import { useEffect, useMemo, useState } from "react";
import type { PayableOrderOption } from "@/lib/cash-flow/cash-flow-types";
import type { DiscountQuote, DiscountSelection } from "@/lib/cash-flow/discount-contract";
import { quoteOrderDiscountAction } from "@/lib/cash-flow/discount-actions";
import type { PaymentDiscountType } from "@/lib/cash-flow/payment-discounts";

export function usePaymentDiscounts(selected: PayableOrderOption | undefined, orderKey: string) {
  const [draft, setDraft] = useState<{
    key: string;
    choices: Record<string, PaymentDiscountType>;
  }>();
  const [recipient, setRecipient] = useState<{ key: string; id: string }>();
  const [response, setResponse] = useState<{
    key: string;
    orderKey: string;
    quote?: DiscountQuote;
    error?: string;
  }>();
  const [catalog, setCatalog] = useState<{
    orderKey: string;
    recipients: DiscountQuote["recipients"];
  }>();
  const choices = useMemo(() => (draft?.key === orderKey ? draft.choices : {}), [draft, orderKey]);
  const selectionKey = JSON.stringify(
    Object.entries(choices)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bookingId, category]) => ({ bookingId, category, attested: true }))
  );
  const selections = useMemo<DiscountSelection[]>(() => JSON.parse(selectionKey), [selectionKey]);
  const requestKey = JSON.stringify([orderKey, selections]);
  const orderId = selected?.id;
  const sourceKind = selected?.sourceKind;
  const catalogReady = catalog?.orderKey === orderKey;
  const recipients = catalogReady ? catalog.recipients : [];
  const recipientId = recipient?.key === orderKey ? recipient.id : recipients[0]?.bookingId;
  const selectedDiscount = recipientId ? (choices[recipientId] ?? null) : null;
  const hasSelection = Object.keys(choices).length > 0;
  const quote = response?.key === requestKey ? response.quote : undefined;
  const pending = selected?.sourceKind === "booking_order" && response?.key !== requestKey;
  useEffect(() => {
    if (!orderId || sourceKind !== "booking_order") return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await quoteOrderDiscountAction(orderId, selections);
        if (!cancelled) {
          if (result.ok) setCatalog({ orderKey, recipients: result.data.recipients });
          setResponse(
            result.ok
              ? { key: requestKey, orderKey, quote: result.data }
              : { key: requestKey, orderKey, error: result.error }
          );
        }
      } catch {
        if (!cancelled)
          setResponse({
            key: requestKey,
            orderKey,
            error: "Discount calculation is unavailable. No discount has been applied.",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, sourceKind, orderKey, requestKey, selections]);
  const blocked = hasSelection && (!quote || selections.length === 0 || !catalogReady);
  return {
    selectedDiscount,
    hasSelection,
    blocked,
    pending,
    quote,
    recipients,
    catalogReady,
    recipientId,
    error: response?.key === requestKey ? response.error : undefined,
    selectRecipient: (id: string) => setRecipient({ key: orderKey, id }),
    toggle: (type: PaymentDiscountType) =>
      setDraft(() => {
        if (
          !catalogReady ||
          !recipientId ||
          !recipients.some((row) => row.bookingId === recipientId)
        )
          return draft;
        const next = { ...choices };
        const id = recipientId;
        if (next[id] === type) delete next[id];
        else next[id] = type;
        return { key: orderKey, choices: next };
      }),
    command:
      hasSelection && !blocked && quote ? { quoteVersion: quote.version, selections } : undefined,
  };
}
