import { createFileRoute } from "@tanstack/react-router";
import { ChartsPage } from "@/components/pages/charts";

export const Route = createFileRoute("/_app/charts")({
  component: ChartsPage,
});
