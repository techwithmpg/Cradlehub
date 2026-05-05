"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  name: string;
  imageUrl?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function UserAvatar({ name, imageUrl, className, size = "md" }: UserAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sizeClasses = {
    sm: "size-6 text-[10px]",
    md: "size-10 text-sm",
    lg: "size-20 text-xl",
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {imageUrl && (
        <AvatarImage
          src={imageUrl}
          alt={name}
          className="object-cover"
        />
      )}
      <AvatarFallback className="font-bold bg-muted text-muted-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
