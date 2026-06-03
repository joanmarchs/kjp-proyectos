import BudgetEditor from "@/components/BudgetEditor";
import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function BudgetEditorPage({ params }: { params: Promise<{ projectId: string; budgetId: string }> }) {
  if (!(await isAuthenticated())) redirect("/login");
  const { projectId, budgetId } = await params;
  return <BudgetEditor projectId={projectId} budgetId={budgetId} />;
}
