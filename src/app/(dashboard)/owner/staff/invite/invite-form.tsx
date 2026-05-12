"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function InviteForm({
  onboardingUrl,
  accessCode,
  isOwner,
}: {
  onboardingUrl: string;
  accessCode: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  function handleCopyUrl() {
    navigator.clipboard.writeText(onboardingUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(accessCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 12,
        padding: "1.5rem",
      }}
    >
      {/* Onboarding URL */}
      <div style={{ marginBottom: "1.25rem" }}>
        <label
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text-secondary)",
            display: "block",
            marginBottom: "0.375rem",
          }}
        >
          Public Onboarding Link
        </label>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "0.625rem 0.75rem",
              backgroundColor: "var(--cs-surface-warm)",
              borderRadius: 6,
              fontSize: "0.8125rem",
              fontFamily: "monospace",
              wordBreak: "break-all",
              color: "var(--cs-text)",
              border: "1px solid var(--cs-border)",
            }}
          >
            {onboardingUrl}
          </div>
          <Button
            type="button"
            onClick={handleCopyUrl}
            size="sm"
            style={{
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
              border: "none",
              flexShrink: 0,
            }}
          >
            {copiedUrl ? "Copied!" : "Copy Link"}
          </Button>
        </div>
      </div>

      {/* Access code */}
      {accessCode && (
        <div style={{ marginBottom: "1.25rem" }}>
          <label
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--cs-text-secondary)",
              display: "block",
              marginBottom: "0.375rem",
            }}
          >
            Access Code
          </label>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "0.625rem 0.75rem",
                backgroundColor: "var(--cs-surface-warm)",
                borderRadius: 6,
                fontSize: "0.8125rem",
                fontFamily: "monospace",
                letterSpacing: "0.15em",
                color: "var(--cs-text)",
                border: "1px solid var(--cs-border)",
              }}
            >
              {accessCode}
            </div>
            <Button
              type="button"
              onClick={handleCopyCode}
              size="sm"
              variant="outline"
              style={{ flexShrink: 0 }}
            >
              {copiedCode ? "Copied!" : "Copy Code"}
            </Button>
          </div>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--cs-text-muted)",
              margin: "0.375rem 0 0",
            }}
          >
            Applicants must enter this code on the onboarding page.
          </p>
        </div>
      )}

      {/* Instructions */}
      <div
        style={{
          padding: "0.75rem",
          backgroundColor: "var(--cs-surface-warm)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: 8,
          fontSize: "0.8125rem",
          color: "var(--cs-text-muted)",
          marginBottom: "1.25rem",
        }}
      >
        <strong style={{ color: "var(--cs-text)" }}>How it works:</strong>
        <ol style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem", lineHeight: 1.5 }}>
          <li>Copy the onboarding link above</li>
          <li>Share the link and access code with the applicant</li>
          <li>They fill in their details and select their intended role</li>
          <li>They appear in{" "}
            <a
              href={isOwner ? "/owner/staff/onboarding" : "/manager/staff/onboarding"}
              style={{ color: "var(--cs-sand)", textDecoration: "none" }}
            >
              Onboarding Requests
            </a>{" "}
            for you to review
          </li>
          <li>Approve them and assign their final system role, tier, and branch</li>
        </ol>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          style={{ flex: 1 }}
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={() => router.push(isOwner ? "/owner/staff/onboarding" : "/manager/staff/onboarding")}
          style={{
            flex: 1,
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            border: "none",
          }}
        >
          View Onboarding Requests
        </Button>
      </div>
    </div>
  );
}
