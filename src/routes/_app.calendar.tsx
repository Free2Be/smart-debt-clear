import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/components/pages/calendar-view";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});
