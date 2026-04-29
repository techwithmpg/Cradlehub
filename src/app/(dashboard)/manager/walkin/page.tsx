import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { WalkinForm } from "@/components/features/dashboard/walkin-form";

export default function WalkinPage() {
  return (
    <div>
      <PageHeader
        title="New Booking"
        description="Walk-in, home service, or phone booking"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/manager">← Back to Schedule</Link>
          </Button>
        }
      />
      <WalkinForm />
    </div>
  );
}
