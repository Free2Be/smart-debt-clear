import { createFileRoute } from "@tanstack/react-router";
import { PayoffPage } from "@/components/pages/payoff";
export const Route = createFileRoute("/_app/payoff")({ component: PayoffPage });
