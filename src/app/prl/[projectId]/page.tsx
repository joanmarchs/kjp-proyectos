import PRLBoard from "@/components/PRLBoard";
import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PRLPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  if (!(await isAuthenticated())) redirect("/login");

  const { projectId } = await params;
  const { name } = await searchParams;
  return <PRLBoard projectId={projectId} projectName={name ? decodeURIComponent(name) : "Proyecto"} />;
}
