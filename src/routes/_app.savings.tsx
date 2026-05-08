import { createFileRoute } from "@tanstack/react-router";
import { SavingsPage } from "@/components/pages/savings";
export const Route = createFileRoute("/_app/savings")({ component: SavingsPage });
