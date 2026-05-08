import { createFileRoute, redirect } from "@tanstack/react-router";
import { Dashboard } from "@/components/pages/dashboard";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});
