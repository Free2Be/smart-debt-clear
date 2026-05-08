import { createFileRoute } from "@tanstack/react-router";
import { CardsPage } from "@/components/pages/cards";
export const Route = createFileRoute("/_app/cards")({ component: CardsPage });
