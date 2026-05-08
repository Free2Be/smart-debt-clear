import { createFileRoute } from "@tanstack/react-router";
import { BillsPage } from "@/components/pages/bills";
export const Route = createFileRoute("/_app/bills")({ component: BillsPage });
