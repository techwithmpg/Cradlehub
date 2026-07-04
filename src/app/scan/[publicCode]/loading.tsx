import { PublicScanStage } from "@/components/features/attendance/public-scan-stage";
import { cn } from "@/lib/utils";
import styles from "@/components/features/attendance/public-scan-processor.module.css";

export default function PublicQrScanLoading() {
  return (
    <main className="min-h-svh bg-[#f3f0ea] sm:grid sm:place-items-center sm:p-6">
      <div className={cn(styles.shell, styles.shellNeutral)}>
        <PublicScanStage stage="recognizing" />
      </div>
    </main>
  );
}
