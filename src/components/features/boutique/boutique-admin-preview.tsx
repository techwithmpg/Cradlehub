"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Boxes, ClipboardList, Gift, Package, Search, ShieldCheck, Store, Tag,
} from "lucide-react";
import {
  BOUTIQUE_PREVIEW_PRODUCTS,
  formatBoutiquePreviewPeso,
} from "@/lib/boutique/catalogue-preview";

const TABS = ["Overview", "Products", "Inventory", "Orders", "Gift Certificates"] as const;
type Tab = (typeof TABS)[number];

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[#DCCEB4] bg-white/70 px-5 py-12 text-center">
      <Package className="mb-3 h-7 w-7 text-[#A98E60]" aria-hidden="true" />
      <h3 className="font-semibold text-[#183F2D]">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#657969]">{description}</p>
    </div>
  );
}

function PreviewTile({ label, note }: { label: string; note: string }) {
  return (
    <div className="rounded-2xl border border-[#E8E2D7] bg-white p-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-[#8F805F]">{label}</p>
      <p className="mt-3 text-xl text-[#31533D]">—</p>
      <p className="mt-2 text-xs text-[#748176]">{note}</p>
    </div>
  );
}

export function BoutiqueAdminPreview({ workspace, branchLabel }: {
  workspace: "owner" | "crm";
  branchLabel: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [query, setQuery] = useState("");
  const filtered = BOUTIQUE_PREVIEW_PRODUCTS.filter((product) =>
    product.name.toLowerCase().includes(query.trim().toLowerCase()) ||
    product.category.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="min-h-full bg-[#FAF8F3] px-4 pb-12 pt-6 text-[#163A2B] sm:px-7 lg:px-10" data-testid="boutique-admin-b1-preview">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-[#AF915B]">
              <Store className="h-4 w-4" /> Cradle Wellness Boutique
            </div>
            <h1 className="text-3xl sm:text-4xl" style={{ fontFamily: "var(--cs-font-display), Georgia, serif" }}>
              Boutique Management
            </h1>
            <p className="mt-2 text-sm text-[#718375]">
              {workspace === "owner" ? "Owner preview · No live branch data" : "Front Desk preview · Assigned branch only"} · {branchLabel}
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#163A2B]/20 bg-white px-5 text-xs font-semibold hover:border-[#163A2B]"
          >
            View storefront preview <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#DDC89E] bg-[#F6EDD9] px-4 py-3 text-sm leading-6 text-[#6E5B37]">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <strong>B1 read-only preview.</strong> No production catalogue, stock, customer, order,
            gift certificate, or payment data is loaded. All management actions are unavailable.
            Product examples are non-authoritative LOCAL/TEST presentation fixtures.
          </div>
        </div>

        <nav aria-label="Boutique management sections" className="mb-7 flex gap-2 overflow-x-auto border-b border-[#DCD8CB] pb-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "min-h-10 shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                activeTab === tab
                  ? "border-[#163A2B] bg-[#163A2B] text-white"
                  : "border-[#D6DBD5] bg-white text-[#46614C] hover:border-[#163A2B]",
              ].join(" ")}
            >
              {tab}
            </button>
          ))}
        </nav>

        {activeTab === "Overview" && (
          <section aria-label="Boutique overview preview" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PreviewTile label="Boutique sales" note="Financial records not connected" />
              <PreviewTile label="Gift certificates" note="Issuance not connected" />
              <PreviewTile label="Orders" note="Order processing not connected" />
              <PreviewTile label="Low-stock alerts" note="Branch inventory not connected" />
            </div>
            <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
              <div className="rounded-2xl border border-[#E8E2D7] bg-white p-6">
                <div className="mb-5 flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-[#B08C50]" />
                  <h2 className="font-semibold">Recent Boutique Activity</h2>
                </div>
                <EmptyState
                  title="No activity data connected"
                  description="Orders, redemptions and product sales will appear here only after their separate backend stages pass review."
                />
              </div>
              <div className="rounded-2xl border border-[#E8E2D7] bg-white p-6">
                <h2 className="mb-4 font-semibold">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-2">
                  {["Record Product Sale", "Sell Gift Certificate", "Adjust Inventory", "Redeem Gift Certificate"].map((action) => (
                    <button
                      key={action}
                      type="button"
                      disabled
                      title="Unavailable in B1 read-only preview"
                      className="min-h-16 cursor-not-allowed rounded-xl border border-[#E8E2D7] bg-[#F9F7F1] p-3 text-left text-xs font-semibold text-[#8A978A]"
                    >
                      {action} <span className="mt-1 block font-normal">Coming in later stage</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "Products" && (
          <section aria-label="Boutique products preview" className="rounded-2xl border border-[#E8E2D7] bg-white p-5 sm:p-7">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Tag className="h-5 w-5 text-[#B08C50]" /><h2 className="font-semibold">Products · Example catalogue</h2></div>
              <button type="button" disabled className="cursor-not-allowed rounded-full bg-[#D6DFD6] px-5 py-2.5 text-xs font-semibold text-[#718475]">Add Product (not available)</button>
            </div>
            <label className="mb-5 flex min-h-10 max-w-sm items-center gap-2 rounded-full border border-[#D8DDD5] px-4">
              <Search className="h-4 w-4 text-[#9AA99B]" />
              <span className="sr-only">Search preview products</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search example products"
                className="w-full min-w-0 bg-transparent text-sm outline-none"
              />
            </label>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead><tr className="border-b border-[#E9E8E2] text-[11px] uppercase tracking-wider text-[#7B8A7D]"><th scope="col" className="py-3">Example product</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Status</th></tr></thead>
                <tbody>
                  {filtered.map((product) => (
                    <tr key={product.id} className="border-b border-[#E9E8E2] last:border-0">
                      <td className="py-4 font-semibold">{product.name}</td>
                      <td>{product.category}</td>
                      <td>{formatBoutiquePreviewPeso(product.pricePhp)}</td>
                      <td><span className="rounded-full bg-[#EEE9DC] px-3 py-1 text-xs text-[#7B725C]">Fixture only</span></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-[#77887A]">No preview products match.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-[#7F8A7F]">No publish, edit, upload or deletion controls are enabled in B1.</p>
          </section>
        )}

        {activeTab === "Inventory" && (
          <section aria-label="Boutique inventory preview">
            <div className="mb-4 flex items-center gap-2"><Boxes className="h-5 w-5 text-[#B08C50]" /><h2 className="font-semibold">Branch Inventory</h2></div>
            <EmptyState title="Inventory is not yet connected" description="Branch stock counts, holds, adjustments, low-stock warnings and transfers will be added with audited, atomic inventory operations in a separately authorized stage." />
          </section>
        )}

        {activeTab === "Orders" && (
          <section aria-label="Boutique orders preview">
            <div className="mb-4 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-[#B08C50]" /><h2 className="font-semibold">Boutique Orders</h2></div>
            <EmptyState title="No order processing in B1" description="Today's Visit, Upcoming Visit and Just Shopping will be connected to authorized ordering and payment workflows only after database and transaction review." />
          </section>
        )}

        {activeTab === "Gift Certificates" && (
          <section aria-label="Gift certificate management preview">
            <div className="mb-4 flex items-center gap-2"><Gift className="h-5 w-5 text-[#B08C50]" /><h2 className="font-semibold">Gift Certificates</h2></div>
            <EmptyState title="Certificates cannot be issued yet" description="Digital, physical, manual sale, verified redemption, partial balance and printing all require later policy and transaction authorization. No codes or balances exist in this preview." />
          </section>
        )}
      </div>
    </div>
  );
}
