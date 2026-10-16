"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { Loader2, UploadCloud } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MARKETING_MEDIA_CONTRACTS } from "@/lib/marketing/media-contracts";
import { resolveServiceImage } from "@/lib/service-images";
import { saveOwnerServiceCatalogAction } from "@/app/(dashboard)/owner/services/actions";
import type { OwnerService, OwnerServiceBranch, OwnerServiceCategory } from "./owner-service-types";
import { extensionPricePreview } from "@/lib/services/owner-service-workspace";

type Props = {
  open: boolean;
  service: OwnerService | null;
  branches: OwnerServiceBranch[];
  categories: OwnerServiceCategory[];
  onClose: () => void;
  onSaved: () => void;
};

const inputClass = "h-10 w-full min-w-0 rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)]";
const labelClass = "mb-1.5 block text-xs font-semibold text-[var(--cs-text)]";
const servicePhoto = MARKETING_MEDIA_CONTRACTS.SERVICE_PHOTO;

function peso(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(value);
}

export function ServiceEditorModal({ open, service, branches, categories, onClose, onSaved }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(service?.name ?? "");
  const [categoryId, setCategoryId] = useState(service?.category_id ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 60));
  const [price, setPrice] = useState(String(service?.price ?? 0));
  const [durationPolicy, setDurationPolicy] = useState<"fixed" | "extendable">(service?.duration_policy === "extendable" ? "extendable" : "fixed");
  const [increment, setIncrement] = useState(String(service?.extension_increment_minutes ?? 30));
  const [extensionPrice, setExtensionPrice] = useState(
    service?.extension_price != null && Number(service.extension_price) > 0
      ? String(service.extension_price)
      : ""
  );
  const [maximumDuration, setMaximumDuration] = useState(String(service?.maximum_duration_minutes ?? 180));
  const [active, setActive] = useState(service?.is_active ?? true);
  const [visible, setVisible] = useState(service?.is_public_visible ?? true);
  const [allBranches, setAllBranches] = useState(!service || (branches.length > 0 && service.offeredBranchIds.length === branches.length));
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(service?.offeredBranchIds ?? []);
  const [imageAlt, setImageAlt] = useState(service?.image_alt ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => { if (localPreview) URL.revokeObjectURL(localPreview); };
  }, [localPreview]);

  const canonicalImage = service ? resolveServiceImage({
    id: service.id, name: service.name, imageUrl: service.image_url, imageAlt: service.image_alt,
  }).imageUrl : null;
  const previewImage = localPreview ?? canonicalImage;
  const baseDuration = Number(duration);
  const basePrice = Number(price);
  const extensionStep = Number(increment);
  const stepPrice = Number(extensionPrice);
  const max = Number(maximumDuration);
  const priceRows = durationPolicy === "extendable" ? extensionPricePreview({ baseDuration, basePrice, increment: extensionStep, extensionPrice: stepPrice, maximumDuration: max }) : [];

  function chooseFile(file: File | null) {
    if (!file) return; // Cancelling the OS picker leaves the current image alone.
    if (!servicePhoto.allowedMimeTypes.includes(file.type) || file.size > servicePhoto.maxBytes) {
      setError("Choose a JPG, PNG, or WebP image under 5 MB.");
      return;
    }
    setError(null);
    setSelectedFile(file);
    setLocalPreview(URL.createObjectURL(file));
  }

  function toggleBranch(branchId: string) {
    setSelectedBranchIds((current) => current.includes(branchId)
      ? current.filter((id) => id !== branchId)
      : [...current, branchId]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    if (durationPolicy === "extendable") {
      const stepPriceNum = Number(extensionPrice);
      if (!extensionPrice.trim() || !Number.isFinite(stepPriceNum) || stepPriceNum <= 0) {
        setError("Extension price must be greater than ₱0.");
        submitting.current = false;
        setPending(false);
        return;
      }
    }
    try {
      const formData = new FormData();
      formData.set("catalog", JSON.stringify({
        ...(service && { serviceId: service.id }),
        categoryId, name: name.trim(), description: description.trim(),
        durationMinutes: baseDuration, price: basePrice,
        isActive: active, isPublicVisible: visible, durationPolicy,
        extensionIncrementMinutes: durationPolicy === "extendable" ? extensionStep : null,
        extensionPrice: durationPolicy === "extendable" ? stepPrice : null,
        maximumDurationMinutes: durationPolicy === "extendable" ? max : null,
        imageAlt: imageAlt.trim(), allBranches, branchIds: selectedBranchIds,
      }));
      if (selectedFile) formData.set("image", selectedFile);
      const result = await saveOwnerServiceCatalogAction(formData);
      if (!result.success) { setError(result.error); return; }
      onSaved();
    } catch {
      setError("The service could not be saved. Your changes are still here; please retry.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent className="flex max-h-[90dvh] w-[min(920px,92vw)] max-w-[92vw] flex-col gap-0 overflow-hidden border border-[var(--cs-border)] bg-[var(--cs-surface)] p-0 shadow-2xl sm:max-w-[min(920px,92vw)]" showCloseButton={!pending}>
        <DialogHeader className="border-b border-[var(--cs-border)] px-5 py-4">
          <DialogTitle className="text-xl font-semibold text-[var(--cs-text)]">{service ? "Edit Service" : "Add New Service"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 overflow-x-hidden overflow-y-auto lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-5 border-b border-[var(--cs-border)] p-5 lg:border-b-0 lg:border-r">
              <section>
                <h3 className="mb-3 text-sm font-semibold text-[var(--cs-text)]">1. Basic Information</h3>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                  <label className={labelClass}>Service Name <span className="text-red-600">*</span>
                    <input className={`${inputClass} mt-1.5`} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} placeholder="e.g. Swedish Massage" />
                  </label>
                  <label className={labelClass}>Category <span className="text-red-600">*</span>
                    <select className={`${inputClass} mt-1.5`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                      <option value="">Select category</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </label>
                </div>
                <label className={`${labelClass} mt-3`}>Description
                  <textarea className={`${inputClass} mt-1.5 h-24 py-2`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Describe the service for customers." />
                </label>
              </section>
              <section>
                <h3 className="mb-3 text-sm font-semibold text-[var(--cs-text)]">2. Duration &amp; Pricing</h3>
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  {(["fixed", "extendable"] as const).map((policy) => (
                    <label key={policy} className={`flex cursor-pointer gap-2 rounded-md border p-3 text-sm ${durationPolicy === policy ? "border-[var(--cs-sand)] bg-[var(--cs-surface-warm)]" : "border-[var(--cs-border)]"}`}>
                      <input type="radio" name="durationPolicy" checked={durationPolicy === policy} onChange={() => setDurationPolicy(policy)} />
                      <span><strong>{policy === "fixed" ? "Fixed duration" : "Extendable"}</strong><span className="block text-xs text-[var(--cs-text-muted)]">{policy === "fixed" ? "Same duration and price each time" : "Longer sessions with step pricing"}</span></span>
                    </label>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>Base Duration <span className="text-red-600">*</span><span className="relative mt-1.5 block"><input className={`${inputClass} pr-16`} type="number" min={15} max={480} step={1} value={duration} onChange={(e) => setDuration(e.target.value)} required /><span className="absolute right-3 top-3 text-xs text-[var(--cs-text-muted)]">minutes</span></span></label>
                  <label className={labelClass}>Base Price <span className="text-red-600">*</span><span className="relative mt-1.5 block"><span className="absolute left-3 top-2.5">₱</span><input className={`${inputClass} pl-8`} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></span></label>
                </div>
                {durationPolicy === "extendable" && <div className="mt-3 rounded-md bg-[var(--cs-surface-warm)] p-3">
                  <h4 className="mb-2 text-xs font-semibold text-[var(--cs-sand)]">Extension Settings</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={labelClass}>Increment (minutes) <span className="text-red-600">*</span><input className={`${inputClass} mt-1.5`} type="number" min={1} step={1} value={increment} onChange={(e) => setIncrement(e.target.value)} required /></label>
                    <label className={labelClass}>Price per increment <span className="text-red-600">*</span><input className={`${inputClass} mt-1.5`} type="number" min={0.01} step="0.01" value={extensionPrice} onChange={(e) => setExtensionPrice(e.target.value)} required /></label>
                    <label className={labelClass}>Maximum Duration <span className="text-red-600">*</span><input className={`${inputClass} mt-1.5`} type="number" min={baseDuration + 1} max={1440} step={1} value={maximumDuration} onChange={(e) => setMaximumDuration(e.target.value)} required /></label>
                  </div>
                  {priceRows.length > 0 && <div className="mt-3 rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 text-xs">
                    <strong>Preview Prices</strong>
                    {priceRows.map((row, i) => <div className="mt-1 flex justify-between" key={row.duration}><span>{row.duration} min {i === 0 ? "(base)" : ""}</span><span>{peso(row.price)}</span></div>)}
                    {(max - baseDuration) / extensionStep + 1 > priceRows.length && <p className="mt-1 text-[var(--cs-text-muted)]">More durations up to {max} min follow the same increment.</p>}
                  </div>}
                </div>}
              </section>
            </div>
            <div className="min-w-0 space-y-5 p-5">
              <section>
                <h3 className="mb-3 text-sm font-semibold text-[var(--cs-text)]">3. Service Image</h3>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose service image" onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} />
                <button type="button" onClick={() => fileInput.current?.click()} className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-[var(--cs-sand-light)] bg-[var(--cs-surface-warm)] text-center">
                  {previewImage ? <Image src={previewImage} alt={imageAlt || name || "Service preview"} fill unoptimized={Boolean(localPreview)} sizes="(max-width: 768px) 100vw, 360px" className="object-cover" /> : <span className="flex flex-col items-center gap-1 text-sm"><UploadCloud className="h-8 w-8" />Upload service image</span>}
                  {previewImage && <span className="absolute bottom-2 rounded bg-black/75 px-3 py-1.5 text-xs text-white">Change Image</span>}
                </button>
                <p className="mt-1 text-center text-xs text-[var(--cs-text-muted)]">JPG, PNG or WebP · Max 5 MB · Recommended 1200 × 900</p>
                <label className={`${labelClass} mt-3`}>Image Alt Text<input className={`${inputClass} mt-1.5`} value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} maxLength={220} placeholder="Describe the service image" /></label>
              </section>
              <section>
                <h3 className="mb-3 text-sm font-semibold text-[var(--cs-text)]">4. Branch Availability</h3>
                <label className="mb-2 flex gap-2 text-sm"><input type="radio" name="branchMode" checked={allBranches} onChange={() => setAllBranches(true)} />All branches</label>
                <label className="mb-2 flex gap-2 text-sm"><input type="radio" name="branchMode" checked={!allBranches} onChange={() => setAllBranches(false)} />Selected branches</label>
                {!allBranches && <div className="space-y-1 rounded-md border border-[var(--cs-border)] p-2">{branches.map((branch) => <label key={branch.id} className="flex gap-2 py-1 text-sm"><input type="checkbox" checked={selectedBranchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} />{branch.name}</label>)}</div>}
              </section>
              <section>
                <h3 className="mb-3 text-sm font-semibold text-[var(--cs-text)]">5. Visibility &amp; Status</h3>
                <div className="mb-3 flex items-start gap-3 text-sm">
                  <Switch id="service-active" checked={active} onCheckedChange={setActive} aria-labelledby="service-active-label" aria-describedby="service-active-help" />
                  <div className="min-w-0"><label id="service-active-label" htmlFor="service-active" className="cursor-pointer font-semibold">Active</label><p id="service-active-help" className="text-xs text-[var(--cs-text-muted)]">Service can be booked operationally.</p></div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <Switch id="service-visible" checked={visible} onCheckedChange={setVisible} aria-labelledby="service-visible-label" aria-describedby="service-visible-help" />
                  <div className="min-w-0"><label id="service-visible-label" htmlFor="service-visible" className="cursor-pointer font-semibold">Visible to customers</label><p id="service-visible-help" className="text-xs text-[var(--cs-text-muted)]">Show on public services and booking where offered.</p></div>
                </div>
              </section>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--cs-border)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="min-w-0 text-xs text-red-700">{error}</p>
            <div className="ml-auto flex shrink-0 gap-2"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending} style={{ backgroundColor: "var(--cs-sand)", color: "#fff" }}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{pending ? (service ? "Saving…" : "Creating…") : (service ? "Save Changes" : "Create Service")}</Button></div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
