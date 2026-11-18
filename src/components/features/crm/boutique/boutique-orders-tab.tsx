"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { CheckCircle2, ClipboardList, CreditCard, ExternalLink, MapPin, Plus } from "lucide-react";
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
import type { CrmBoutiqueBranchRecord } from "@/lib/boutique/crm-boutique-model";

type BoutiqueOrderRow = {
  id: string;
  order_number: string;
  branch_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total_amount: number;
  created_at: string;
};

export function BoutiqueOrdersTab({
  branches,
  conciergeStorageKey,
  onOrdersChanged,
}: {
  branches: readonly CrmBoutiqueBranchRecord[];
  conciergeStorageKey: string;
  onOrdersChanged?: () => void;
}) {
  const [orders, setOrders] = useState<BoutiqueOrderRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(
    branches[0]?.id ?? "c1000000-0000-0000-0000-000000000001"
  );
  const [customerName, setCustomerName] = useState("Walk-in Guest");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedSku, setSelectedSku] = useState("ginger-oil");
  const [quantity, setQuantity] = useState("1");
  const [captureNow, setCaptureNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from("boutique_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setOrders(data as BoutiqueOrderRow[]);
  }, [supabase]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleCreateOrder = async () => {
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("crm_create_boutique_order", {
      p_branch_id: selectedBranchId,
      p_items: [{ sku: selectedSku, quantity: Math.max(1, Number(quantity) || 1) }],
      p_customer_name: customerName.trim() || "Walk-in Guest",
      p_customer_phone: customerPhone.trim() || null,
      p_payment_method: paymentMethod,
      p_capture_payment_now: captureNow,
    });
    setBusy(false);

    if (error) {
      setMessage(`Order error: ${error.message}`);
      return;
    }

    setMessage(`Created order ${data?.order_number} (${formatPhp(Number(data?.total_amount ?? 0))})`);
    setCreateOpen(false);
    await loadOrders();
    onOrdersChanged?.();
  };

  const handleCapturePayment = async (orderId: string, totalAmount: number) => {
    await supabase
      .from("boutique_orders")
      .update({
        payment_status: "paid",
        status: "completed",
        amount_paid: totalAmount,
        payment_method: "cash",
        paid_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    await loadOrders();
    onOrdersChanged?.();
  };

  return (
    <div className="space-y-4">

      <WorkspaceSection
        title="Persisted Boutique Orders Queue"
        description="Live retail and kit orders stored in public.boutique_orders."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Create Boutique Order</span>
            </Button>
          </div>
        }
      >
        <div className="p-4">
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)]/60 px-6 py-10 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--cs-surface)] text-[#1F4E33] shadow-[var(--cs-shadow-xs)]">
                <ClipboardList className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-[var(--cs-text)]">
                0 persisted boutique orders in database
              </h3>
              <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-[var(--cs-text-muted)]">
                Click &ldquo;Create Boutique Order&rdquo; above to log a guest retail purchase and deduct
                branch stock.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Create First Boutique Order</span>
                </Button>
                <Link
                  href="/products"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs font-medium text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span>Preview Guest Storefront</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--cs-border-soft)]">
              <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-[11px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
                    <th className="px-4 py-3">Order #</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Total</th>
                    <th className="px-3 py-3">Payment</th>
                    <th className="px-3 py-3">Fulfillment</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--cs-border-soft)] bg-[var(--cs-surface)]">
                  {orders.map((ord) => (
                    <tr key={ord.id}>
                      <td className="px-4 py-3 font-mono font-semibold text-[var(--cs-text)]">
                        {ord.order_number}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-[var(--cs-text)]">
                          {ord.customer_name || "Walk-in Guest"}
                        </div>
                        {ord.customer_phone ? (
                          <div className="text-[11px] text-[var(--cs-text-muted)]">
                            {ord.customer_phone}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 font-semibold text-[#1F4E33]">
                        {formatPhp(Number(ord.total_amount))}
                      </td>
                      <td className="px-3 py-3">
                        <CrmStatusBadge
                          variant={ord.payment_status === "paid" ? "active" : "warning"}
                          label={ord.payment_status}
                          size="sm"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <CrmStatusBadge
                          variant={ord.status === "completed" ? "active" : "info"}
                          label={ord.status}
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {ord.payment_status !== "paid" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleCapturePayment(ord.id, Number(ord.total_amount))}
                          >
                            <CreditCard className="size-3.5" aria-hidden="true" />
                            <span>Capture Payment</span>
                          </Button>
                        ) : (
                          <span className="text-[11px] text-[var(--cs-text-muted)]">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </WorkspaceSection>


      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Boutique Retail Order</DialogTitle>
            <DialogDescription>
              Records order in <code>public.boutique_orders</code> and deducts branch inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold">Pickup Branch</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block font-semibold">Product SKU</label>
                <select
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
                >
                  <option value="ginger-oil">Ginger Oil (₱300)</option>
                  <option value="borneol-oil">Borneol Oil (₱300)</option>
                  <option value="linen-spray">Linen Spray (₱250)</option>
                  <option value="calm-evening-duo">Calm Evening Duo (₱520)</option>
                  <option value="sanctuary-body-trilogy">Sanctuary Ritual Trio (₱790)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold">Qty</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold">Guest Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold">Phone (Optional)</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/60 p-3">
              <label className="font-semibold">Capture Payment Immediately</label>
              <input
                type="checkbox"
                checked={captureNow}
                onChange={(e) => setCaptureNow(e.target.checked)}
              />
            </div>
            {captureNow ? (
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
                </select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={handleCreateOrder}>
              {busy ? "Creating..." : "Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
