"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export function useCrmDrawer() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<React.ReactNode>(null);

  const openDrawer = (newTitle: string, newContent: React.ReactNode) => {
    setTitle(newTitle);
    setContent(newContent);
    setOpen(true);
  };

  const closeDrawer = () => setOpen(false);

  return { open, title, content, openDrawer, closeDrawer, setOpen };
}

export function CrmDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        style={{ width: "min(480px, 92vw)", overflowY: "auto" }}
      >
        <SheetHeader style={{ marginBottom: "1rem" }}>
          <SheetTitle
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--cs-text)",
              fontFamily: "var(--font-display)",
            }}
          >
            {title}
          </SheetTitle>
          {description && (
            <SheetDescription
              style={{
                fontSize: "0.8125rem",
                color: "var(--cs-text-muted)",
                lineHeight: 1.5,
              }}
            >
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
