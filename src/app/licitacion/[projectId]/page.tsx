import TenderBoard from "@/components/TenderBoard";
import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TenderPage({ params }: { params: Promise<{ projectId: string }> }) {
  if (!(await isAuthenticated())) redirect("/login");
  const { projectId } = await params;
  return <TenderBoard projectId={projectId} />;
}
