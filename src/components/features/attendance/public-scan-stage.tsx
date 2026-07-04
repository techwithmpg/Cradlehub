import { BadgeCheck, Clock3, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import styles from "./public-scan-processor.module.css";

export type PublicScanStageName = "recognizing" | "processing";

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
};

export function PublicScanStage({ stage }: PublicScanStageProps) {
  const copy = STAGE_COPY[stage];

  return (
    <section className={styles.stagePanel} aria-live="polite" aria-busy="true">
      <BrandLogo mode="mark" size="sm" className={styles.brandMark} />

      <div className={styles.stageVisual} aria-hidden="true">
        {stage === "recognizing" ? (
          <div className={styles.identityRing}>
            <span className={styles.identityPulse} />
            <UserRound className={styles.identityIcon} strokeWidth={1.7} />
            <span className={styles.identityBadge}>
              <BadgeCheck size={18} strokeWidth={2.2} />
            </span>
          </div>
        ) : (
          <div className={styles.processingRing}>
            <span className={styles.processingOrbit} />
            <Clock3 className={styles.processingIcon} strokeWidth={1.7} />
          </div>
        )}
      </div>

      <div className={styles.stageCopy}>
        <p className={styles.eyebrow}>{stage === "recognizing" ? "Secure scan" : "One moment"}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </div>

      <div className={styles.progressDots} aria-hidden="true">
        <span className={styles.progressDotActive} />
        <span className={stage === "processing" ? styles.progressDotActive : styles.progressDot} />
        <span className={styles.progressDot} />
      </div>
    </section>
  );
}
