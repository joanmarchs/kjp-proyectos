import PRLContractorPortal from "@/components/PRLContractorPortal";

export default async function PRLAccessPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PRLContractorPortal token={token} />;
}
