import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement, ReactNode } from "react";
import { i18n } from "@/i18n";
import { useGlobalKeys } from "@/shell/useGlobalKeys";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false }
    }
  });
}

function GlobalKeysMount() {
  useGlobalKeys();
  return null;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: {
    route?: string;
    queryClient?: QueryClient;
    /** Mount `useGlobalKeys()` (the AppShell's job in the real app) so Esc/global verbs work in this render. */
    withGlobalKeys?: boolean;
  } & Omit<RenderOptions, "wrapper">
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();
  const route = options?.route ?? "/status";
  const withGlobalKeys = options?.withGlobalKeys ?? false;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            {withGlobalKeys ? <GlobalKeysMount /> : null}
            {children}
          </MemoryRouter>
        </QueryClientProvider>
      </I18nProvider>
    );
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...options })
  };
}
