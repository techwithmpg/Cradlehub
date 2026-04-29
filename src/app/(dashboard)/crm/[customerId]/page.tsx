import { PageHeader } from "@/components/features/dashboard/page-header";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  return <PageHeader title="Customer Profile" description={`Customer ID: ${customerId}`} />;
}
