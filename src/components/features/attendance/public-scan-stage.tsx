import { BadgeCheck, Check, Clock3, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import styles from "./public-scan-processor.module.css";

export type PublicScanStageName =
  | "recognizing"
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
    title: "Recognizing you...",
    description: "Please wait while we securely verify this device.",
  },
  processing: {
    title: "Processing scan...",
    description: "We are checking your current attendance session.",
  },
  signing_in: {
    title: "Signing in...",
    description: "We are checking your staff account.",
  },
  registering_device: {
    title: "Registering this phone...",
    description: "This phone will be remembered for faster attendance scans.",
  },
  device_registered: {
    title: "Phone connected",
    description: "Continuing your attendance scan.",
  },
  processing_attendance: {
    title: "Clocking you in...",
    description: "We are finishing your attendance update.",
  },
};

const EXTENDED_STAGE_ORDER: PublicScanStageName[] = [
  "signing_in",
  "registering_device",
  "device_registered",
  "processing_attendance",
];

function getStageEyebrow(stage: PublicScanStageName): string {
  if (stage === "recognizing") return "Secure scan";
  if (stage === "processing") return "One moment";
  if (stage === "device_registered") return "Ready";
  if (stage === "processing_attendance") return "Attendance";
  return "Staff sign-in";
}

function StageVisual({ stage }: { stage: PublicScanStageName }) {
  if (stage === "recognizing" || stage === "signing_in") {
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

  return (
    <div className={styles.progressDots} aria-hidden="true">
      <span className={styles.progressDotActive} />
      <span className={stage === "processing" ? styles.progressDotActive : styles.progressDot} />
      <span className={styles.progressDot} />
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
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </div>

      <ProgressDots stage={stage} />
    </section>
  );
}
