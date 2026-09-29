import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LawnScreenshotPanel } from "./LawnScreenshotPanel";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("LawnScreenshotPanel", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an honest empty state when no screenshot is stored", async () => {
    render(<LawnScreenshotPanel />, { wrapper: wrapper() });
    expect(
      await screen.findByTestId("lawn-screenshot-empty")
    ).toHaveTextContent("No screenshot stored yet");
    expect(screen.queryByTestId("lawn-screenshot-img")).not.toBeInTheDocument();
  });

  it("renders the stored frame with metadata when info exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          fileName: "20260914-120000-probe.png",
          tag: "probe",
          bytes: 12345,
          takenAtUtc: "2026-09-14T12:00:00Z"
        })
      )
    );
    render(<LawnScreenshotPanel />, { wrapper: wrapper() });
    const img = await screen.findByTestId("lawn-screenshot-img");
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("/api/debug/screenshot/latest?ts=")
    );
    expect(screen.getByTestId("lawn-screenshot-meta")).toHaveTextContent("probe");
    expect(screen.queryByTestId("lawn-screenshot-empty")).not.toBeInTheDocument();
  });

  it("triggers a capture through the shared debug mutation", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LawnScreenshotPanel />, { wrapper: wrapper() });
    await user.click(await screen.findByTestId("lawn-screenshot-capture"));
    await waitFor(() => {
      const trigger = fetchMock.mock.calls.find(
        ([url, init]) =>
          typeof url === "string" &&
          url.endsWith("/api/debug/screenshot") &&
          (init as RequestInit)?.method === "POST"
      );
      expect(trigger).toBeDefined();
    });
  });
});
