export type CostTuple = [name: string, amount: number];

export type ProjectStatus = "fase_estudio" | "pendiente_adjudicar" | "desestimado";

export type ProjectCost = {
  id: string;
  name: string;
  startDate: string | null;
  status: ProjectStatus;
  cost: number;
  sales: number;
  profit: number;
  suppliers: CostTuple[];
  categories: CostTuple[];
  syncedAt?: string;
};
