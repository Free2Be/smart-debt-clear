import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ledger — Bill & Payoff Planner" },
      { name: "description", content: "Plan bills, paydays, and credit card payoff in one clean dashboard." },
      { property: "og:title", content: "Ledger — Bill & Payoff Planner" },
      { name: "twitter:title", content: "Ledger — Bill & Payoff Planner" },
      { property: "og:description", content: "Plan bills, paydays, and credit card payoff in one clean dashboard." },
      { name: "twitter:description", content: "Plan bills, paydays, and credit card payoff in one clean dashboard." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1297991e-0c11-433b-85bb-cb5ea96fc400/id-preview-5623d3e4--73d0d85f-1821-4b09-a2ae-4c70fa3a173a.lovable.app-1778374701182.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1297991e-0c11-433b-85bb-cb5ea96fc400/id-preview-5623d3e4--73d0d85f-1821-4b09-a2ae-4c70fa3a173a.lovable.app-1778374701182.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <Toaster richColors closeButton position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
