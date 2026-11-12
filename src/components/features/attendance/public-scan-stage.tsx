import { BadgeCheck, Check, Clock3, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import styles from "./public-scan-processor.module.css";

export type PublicScanStageName =
  | "recognizing"
  | "qr_recognized"
  | "verifying_location"
  | "processing"
  | "signing_in"
  | "registering_device"
  | "device_registered"
  | "processing_attendance";

type PublicScanStageProps = {
  stage: PublicScanStageName;
};

const STAGE_COPY: Record<PublicScanStageName, { title: string; description: string }> = {
  recognizing: {
    title: "Recognizing your phone...",
    description: "Checking your staff pass for a fast scan.",
  },
  qr_recognized: {
    title: "QR Code Scanned",
    description: "Recording your attendance now...",
  },
  verifying_location: {
    title: "Confirming branch...",
    description: "One moment while we confirm your branch.",
  },
  processing: {
    title: "Updating your shift...",
    description: "Saving your clock-in or clock-out time.",
  },
  signing_in: {
    title: "Signing you in...",
    description: "Connecting your staff account.",
  },
  registering_device: {
    title: "Linking this phone...",
    description: "Saving this phone so future scans are instant.",
  },
  device_registered: {
    title: "Phone linked!",
    description: "Finishing your attendance scan now.",
  },
  processing_attendance: {
    title: "Attendance updated!",
    description: "Saving your shift record.",
  },
};

const EXTENDED_STAGE_ORDER: PublicScanStageName[] = [
  "signing_in",
  "registering_device",
  "device_registered",
  "processing_attendance",
];

function getStageEyebrow(stage: PublicScanStageName): string {
  if (stage === "recognizing") return "Attendance Pass";
  if (stage === "qr_recognized") return "QR Verified";
  if (stage === "verifying_location") return "Branch Check";
  if (stage === "processing") return "Saving Time";
  if (stage === "device_registered") return "Phone Connected";
  if (stage === "processing_attendance") return "Almost Done";
  return "Staff Sign-In";
}

function StageVisual({ stage }: { stage: PublicScanStageName }) {
  if (stage === "recognizing" || stage === "qr_recognized" || stage === "signing_in") {
    return (
      <div className={styles.identityRing}>
        <span className={styles.identityPulse} />
        <UserRound className={styles.identityIcon} strokeWidth={1.7} />
        <span className={styles.identityBadge}>
          <BadgeCheck size={18} strokeWidth={2.2} />
        </span>
      </div>
    );
  }

  if (stage === "registering_device") {
    return (
      <div className={styles.identityRing}>
        <span className={styles.identityPulse} />
        <Smartphone className={styles.identityIcon} strokeWidth={1.7} />
        <span className={styles.identityBadge}>
          <ShieldCheck size={18} strokeWidth={2.2} />
        </span>
      </div>
    );
  }

  if (stage === "device_registered") {
    return (
      <div className={styles.connectedRing}>
        <Check className={styles.connectedIcon} strokeWidth={2.4} />
      </div>
    );
  }

  return (
    <div className={styles.processingRing}>
      <span className={styles.processingOrbit} />
      <Clock3 className={styles.processingIcon} strokeWidth={1.7} />
    </div>
  );
}

function ProgressDots({ stage }: { stage: PublicScanStageName }) {
  const extendedIndex = EXTENDED_STAGE_ORDER.indexOf(stage);
  if (extendedIndex >= 0) {
    return (
      <div className={styles.progressDots} aria-hidden="true">
        {EXTENDED_STAGE_ORDER.map((item, index) => (
          <span
            key={item}
            className={index <= extendedIndex ? styles.progressDotActive : styles.progressDot}
          />
        ))}
      </div>
    );
  }

  // Clean 2-step progress dots (QR Recognized -> Saving Attendance) with no leftover location dot!
  return (
    <div className={styles.progressDots} aria-hidden="true">
      <span className={styles.progressDotActive} />
      <span className={stage === "processing" ? styles.progressDotActive : styles.progressDot} />
    </div>
  );
}

export function PublicScanStage({ stage }: PublicScanStageProps) {
  const copy = STAGE_COPY[stage];

  return (
    <section className={styles.stagePanel} aria-live="polite" aria-busy="true">
      <BrandLogo mode="mark" size="sm" className={styles.brandMark} />

      <div className={styles.stageVisual} aria-hidden="true">
        <StageVisual stage={stage} />
      </div>

      <div className={styles.stageCopy}>
        <p className={styles.eyebrow}>{getStageEyebrow(stage)}</p>
        <h1 className={styles.stageTitle}>{copy.title}</h1>
        <p className={styles.stageDescription}>{copy.description}</p>
      </div>

      <ProgressDots stage={stage} />
    </section>
  );
}
