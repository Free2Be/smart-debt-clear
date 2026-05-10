import { createFileRoute } from "@tanstack/react-router";
import { ReportPage } from "@/components/pages/report";

export const Route = createFileRoute("/_app/report")({
  component: ReportPage,
});
