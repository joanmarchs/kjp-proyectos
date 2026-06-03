export type TenderItem = {
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  cost: number;
  margin: number;
};

export type TenderSubchapter = {
  id: string;
  name: string;
  items: TenderItem[];
};

export type TenderChapter = {
  id: string;
  name: string;
  subchapters: TenderSubchapter[];
};

export type TenderBudget = {
  id: string;
  title: string;
  status: "Borrador" | "En estudio" | "Enviado" | "Aceptado" | "Descartado";
  createdAt: string;
  updatedAt: string;
  chapters: TenderChapter[];
};

export type TenderState = {
  budgets: TenderBudget[];
};
