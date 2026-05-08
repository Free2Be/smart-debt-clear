import { createFileRoute } from "@tanstack/react-router";
import { IncomePage } from "@/components/pages/income";
export const Route = createFileRoute("/_app/income")({ component: IncomePage });
