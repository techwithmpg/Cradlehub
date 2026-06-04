"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { updateStaffProfilePhotoAction } from "@/app/(dashboard)/staff-portal/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import { getDriverFullName, getDriverInitials } from "./driver-profile-utils";

type DriverProfilePhotoFieldProps = {
  staff: StaffPortalStaff;
};

export function DriverProfilePhotoField({ staff }: DriverProfilePhotoFieldProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(staff.avatar_url ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fullName = getDriverFullName(staff);
  const imageUrl = previewUrl ?? avatarUrl;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile photo must be 2MB or smaller.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await updateStaffProfilePhotoAction(formData);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Profile photo updated.");
      setAvatarUrl(result.avatarUrl);
      clearPreview();
      router.refresh();
    } catch {
      toast.error("Profile photo could not be updated.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200/90 bg-white/95 p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 shrink-0 bg-emerald-950 text-2xl font-black text-white">
          {imageUrl ? <AvatarImage src={imageUrl} alt={`${fullName} profile photo`} /> : null}
          <AvatarFallback className="bg-emerald-950 text-2xl font-black text-white">
            {getDriverInitials(staff)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-stone-950">Profile photo</h3>
          <p className="mt-1 text-sm font-medium text-stone-500">JPG, PNG, or WebP. Max 2MB.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-950 disabled:opacity-60"
            >
              <Camera className="h-4 w-4" />
              Change photo
            </button>
            {previewUrl ? (
              <>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-emerald-800 px-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Save photo
                </button>
                <button
                  type="button"
                  onClick={clearPreview}
                  disabled={isUploading}
                  className="grid min-h-10 min-w-10 place-items-center rounded-2xl border border-stone-200 bg-white text-stone-600 disabled:opacity-60"
                  aria-label="Cancel photo change"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </section>
  );
}
