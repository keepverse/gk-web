import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { HubProvider } from "@/lib/bus";
import { useActorSurfaceCatalog } from "@/lib/bus/actorSurface";
import { createMutationFeedbackCache } from "@/lib/bus/mutationFeedback";
import { i18n } from "@/i18n";
import { ErrorBoundary } from "./ErrorBoundary";

/** Loads actor-surface catalogs once and publishes window.__fusionRpgActorSurface for HUD + sheet. */
function ActorSurfaceCatalogBoot({ children }: { children: ReactNode }) {
  useActorSurfaceCatalog();
  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        mutationCache: createMutationFeedbackCache(),
        defaultOptions: {
          queries: {
            staleTime: 5000,
            retry: 1,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return (
    <ErrorBoundary>
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ActorSurfaceCatalogBoot>
            <HubProvider>{children}</HubProvider>
          </ActorSurfaceCatalogBoot>
        </QueryClientProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
