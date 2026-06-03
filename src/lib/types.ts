export type CostTuple = [name: string, amount: number];

export type ProjectCost = {
  id: string;
  name: string;
  startDate: string | null;
  cost: number;
  sales: number;
  profit: number;
  suppliers: CostTuple[];
  categories: CostTuple[];
  syncedAt?: string;
};
