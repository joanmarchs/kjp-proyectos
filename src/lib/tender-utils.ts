import type { TenderState } from "./tender-types";

type LegacyItem = {
  cost?: number;
  margin?: number;
  price?: number;
};

export function normalizeTenderState(state: TenderState): TenderState {
  return {
    budgets: state.budgets.map((budget) => ({
      ...budget,
      chapters: budget.chapters.map((chapter) => ({
        ...chapter,
        subchapters: chapter.subchapters.map((subchapter) => ({
          ...subchapter,
          items: subchapter.items.map((item) => {
            const legacy = item as typeof item & LegacyItem;
            return {
              ...item,
              cost: legacy.cost ?? legacy.price ?? 0,
              margin: legacy.margin ?? 30
            };
          })
        }))
      }))
    }))
  };
}
