"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { CheckCircle2, Gift, Plus, TicketCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CrmStatusBadge } from "@/components/features/crm/premium/crm-status-badge";
import {
  WorkspaceNotice,
  WorkspaceSection,
} from "@/components/features/crm/shared/crm-workspace-primitives";
import { formatPhp } from "@/lib/public/boutique-catalog";
import type {
  BoutiqueGiftCardOverview,
  CrmBoutiqueBranchRecord,
} from "@/lib/boutique/crm-boutique-model";

type VoucherRow = {
  id: string;
  voucher_code: string;
  option_key: string;
  initial_value: number;
  remaining_balance: number;
  delivery_format: string;
  status: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  issued_at: string;
};

export function BoutiqueGiftCardsTab({
  overview,
  branches = [],
}: {
  overview: BoutiqueGiftCardOverview;
  branches?: readonly CrmBoutiqueBranchRecord[];
}) {
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [issueOpen, setIssueOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);

  const [selectedOptionKey, setSelectedOptionKey] = useState(
    overview.options[0]?.id ?? "gc-500-virtual"
  );
  const [selectedBranchId] = useState(
    branches[0]?.id ?? "c1000000-0000-0000-0000-000000000001"
  );
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentRef, setPaymentRef] = useState("");

  const [redeemCodeInput, setRedeemCodeInput] = useState("");
  const [redeemAmountInput, setRedeemAmountInput] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const loadVouchers = useCallback(async () => {
    const { data } = await supabase
      .from("boutique_gift_vouchers")
      .select("*")
      .order("issued_at", { ascending: false })
      .limit(25);
    if (data) setVouchers(data as VoucherRow[]);
  }, [supabase]);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  const handleIssueVoucher = async () => {
    setBusy(true);
    setStatusMessage(null);
    const { data, error } = await supabase.rpc("crm_issue_gift_voucher", {
      p_option_key: selectedOptionKey,
      p_branch_id: selectedBranchId,
      p_recipient_name: recipientName.trim() || null,
      p_recipient_phone: recipientPhone.trim() || null,
      p_payment_method: paymentMethod,
      p_payment_reference: paymentRef.trim() || null,
    });
    setBusy(false);

    if (error) {
      setStatusMessage(`Error: ${error.message}`);
      return;
    }

    setStatusMessage(`Issued voucher code: ${data?.voucher_code}`);
    setRecipientName("");
    setRecipientPhone("");
    setPaymentRef("");
    await loadVouchers();
    setIssueOpen(false);
  };

  const handleRedeemVoucher = async () => {
    if (!redeemCodeInput.trim()) return;
    setBusy(true);
    setStatusMessage(null);
    const amountNum = redeemAmountInput.trim() ? Number(redeemAmountInput) : null;
    const { data, error } = await supabase.rpc("crm_redeem_gift_voucher", {
      p_voucher_code: redeemCodeInput.trim(),
      p_redeem_amount: amountNum,
    });
    setBusy(false);

    if (error) {
      setStatusMessage(`Redemption failed: ${error.message}`);
      return;
    }

    setStatusMessage(
      `Redeemed ₱${data?.deducted_amount} on ${data?.voucher_code} (Remaining: ₱${data?.remaining_balance})`
    );
    setRedeemCodeInput("");
    setRedeemAmountInput("");
    await loadVouchers();
    setRedeemOpen(false);
  };

  return (
    <div className="space-y-4">

      <WorkspaceSection
        title="Published Gift Certificate Catalogue"
        description={`Approved public denominations from ${overview.minAmountLabel} to ${overview.maxAmountLabel} (virtual digital voucher or printed linen envelope).`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => setIssueOpen(true)}>
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Issue Voucher</span>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setRedeemOpen(true)}>
              <TicketCheck className="size-3.5" aria-hidden="true" />
              <span>Redeem Code</span>
            </Button>
          </div>
        }
      >
        <div className="space-y-4 p-4">
          {overview.parentProduct ? (
            <div className="flex flex-col gap-4 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/60 p-4 sm:flex-row sm:items-center">
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-[var(--cs-border-soft)] bg-white">
                <Image
                  src={overview.parentProduct.image}
                  alt={overview.parentProduct.imageAlt}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Gift className="size-4 text-[var(--cs-sand-dark)]" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-[var(--cs-text)]">
                    {overview.parentProduct.name}
                  </h3>
                  <CrmStatusBadge variant="active" label="Live Serialized Ledger" size="sm" />
                </div>
                <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">
                  {overview.parentProduct.description}
                </p>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-[var(--cs-border-soft)]">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-[11px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
                  <th className="px-4 py-3">Option Key</th>
                  <th className="px-3 py-3">Published Label</th>
                  <th className="px-3 py-3">Denomination</th>
                  <th className="px-3 py-3">Delivery Format</th>
                  <th className="px-4 py-3 text-right">System Issuance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--cs-border-soft)] bg-[var(--cs-surface)]">
                {overview.options.map((option) => (
                  <tr key={option.id}>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--cs-text-muted)]">
                      {option.id}
                    </td>
                    <td className="px-3 py-3 font-semibold text-[var(--cs-text)]">
                      {option.label}
                    </td>
                    <td className="px-3 py-3 font-semibold text-[#1F4E33]">
                      {formatPhp(option.amount)}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--cs-text-secondary)]">
                      {option.format}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOptionKey(option.id);
                          setIssueOpen(true);
                        }}
                      >
                        Issue {formatPhp(option.amount)}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {vouchers.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--cs-border-soft)]">
              <table className="w-full min-w-[600px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-[11px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
                    <th className="px-4 py-2.5">Voucher Code</th>
                    <th className="px-3 py-2.5">Recipient</th>
                    <th className="px-3 py-2.5">Initial</th>
                    <th className="px-3 py-2.5">Balance</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--cs-border-soft)] bg-[var(--cs-surface)]">
                  {vouchers.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-2.5 font-mono font-semibold text-[#1F4E33]">
                        {v.voucher_code}
                      </td>
                      <td className="px-3 py-2.5">
                        {v.recipient_name || "Walk-in Recipient"}{" "}
                        {v.recipient_phone ? `(${v.recipient_phone})` : ""}
                      </td>
                      <td className="px-3 py-2.5">{formatPhp(Number(v.initial_value))}</td>
                      <td className="px-3 py-2.5 font-semibold">
                        {formatPhp(Number(v.remaining_balance))}
                      </td>
                      <td className="px-3 py-2.5">
                        <CrmStatusBadge
                          variant={v.status === "active" ? "active" : "neutral"}
                          label={v.status}
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </WorkspaceSection>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Serialized Gift Voucher</DialogTitle>
            <DialogDescription>
              Generates a unique voucher code in <code>public.boutique_gift_vouchers</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold">Denomination</label>
              <select
                value={selectedOptionKey}
                onChange={(e) => setSelectedOptionKey(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              >
                {overview.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} ({formatPhp(opt.amount)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold">Recipient Name</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Guest full name"
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold">Recipient Phone (Optional)</label>
              <input
                type="text"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="0917..."
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold">Payment Ref</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="OR / Ref #"
                  className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={handleIssueVoucher}>
              {busy ? "Issuing..." : "Generate Voucher Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redeem Gift Voucher Code</DialogTitle>
            <DialogDescription>
              Deducts full or partial balance from an active gift certificate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold">Voucher Code</label>
              <input
                type="text"
                value={redeemCodeInput}
                onChange={(e) => setRedeemCodeInput(e.target.value)}
                placeholder="CWL-GC-..."
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 font-mono text-sm uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold">
                Amount to Redeem (Leave blank for full balance)
              </label>
              <input
                type="number"
                value={redeemAmountInput}
                onChange={(e) => setRedeemAmountInput(e.target.value)}
                placeholder="e.g. 500"
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setRedeemOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={handleRedeemVoucher}>
              {busy ? "Redeeming..." : "Redeem Voucher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
