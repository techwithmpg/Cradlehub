"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceEditorModal } from "@/components/features/services/service-editor-modal";
import type { OwnerServiceBranch, OwnerServiceCategory } from "@/components/features/services/owner-service-types";

export function OwnerAddServiceAction({
  branches,
  categories,
}: {
  branches: OwnerServiceBranch[];
  categories: OwnerServiceCategory[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="bg-[var(--cs-success-text)] text-white hover:opacity-90">
        <Plus className="mr-2 size-4" />Add Service
      </Button>
      <ServiceEditorModal
        key={open ? "new" : "closed"}
        open={open}
        service={null}
        branches={branches}
        categories={categories}
        onClose={() => setOpen(false)}
        onSaved={() => setOpen(false)}
      />
    </>
  );
}
