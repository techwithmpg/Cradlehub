"use client";

import { useState, useRef } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Upload } from "lucide-react";
import { updateStaffProfilePhotoAction } from "@/app/(dashboard)/staff-portal/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type StaffProfilePhotoUploaderProps = {
  staffId: string;
  fullName: string;
  initialAvatarUrl?: string | null;
};

export function StaffProfilePhotoUploader({
  fullName,
  initialAvatarUrl,
}: StaffProfilePhotoUploaderProps) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local validation
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File is too large. Max size is 2MB.");
      return;
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await updateStaffProfilePhotoAction(formData);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Profile photo updated successfully!");
        setAvatarUrl(result.avatarUrl);
        setPreviewUrl(null);
        router.refresh();
      }
    } catch {
      toast.error("Failed to upload photo. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-surface-warm border border-border-soft rounded-lg">
      <div className="relative">
        <UserAvatar
          name={fullName}
          imageUrl={previewUrl || avatarUrl}
          size="lg"
          className="size-32 border-4 border-background shadow-lg"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute bottom-0 right-0 p-2 bg-sand text-white rounded-full shadow-md hover:bg-sand-dark transition-colors disabled:opacity-50"
          title="Change photo"
        >
          <Camera size={20} />
        </button>
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold text-text">Profile Photo</h3>
        <p className="text-sm text-text-muted max-w-xs mt-1">
          Upload a clear photo so managers and customers can recognize you.
          Recommended: square image, JPG/PNG/WebP, max 2MB.
        </p>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />

      {previewUrl ? (
        <div className="flex gap-3">
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="bg-sand hover:bg-sand-dark text-white gap-2"
          >
            {isUploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            Save Photo
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isUploading}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2"
        >
          <Camera size={16} />
          {avatarUrl ? "Change Photo" : "Upload Photo"}
        </Button>
      )}
    </div>
  );
}
