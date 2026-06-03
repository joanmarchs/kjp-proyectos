import BudgetEditor from "@/components/BudgetEditor";

export default async function BudgetEditorPage({ params }: { params: Promise<{ projectId: string; budgetId: string }> }) {
  const { projectId, budgetId } = await params;
  return <BudgetEditor projectId={projectId} budgetId={budgetId} />;
}
