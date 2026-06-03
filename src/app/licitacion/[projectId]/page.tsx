import TenderBoard from "@/components/TenderBoard";

export default async function TenderPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <TenderBoard projectId={projectId} />;
}
