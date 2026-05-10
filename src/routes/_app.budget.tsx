import { createFileRoute } from "@tanstack/react-router";
import { BudgetPage } from "@/components/pages/budget";

export const Route = createFileRoute("/_app/budget")({
  component: BudgetPage,
});
