import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Badge,
  Banner,
  BarChart,
  Button,
  Checkbox,
  ConfirmDialog,
  DivergingBar,
  EmptyState,
  Field,
  HelpText,
  JsonBlock,
  KeyValue,
  KpiStat,
  NumberInput,
  Pager,
  Panel,
  Select,
  Sparkline,
  StatBar,
  StatusDot,
  TabList,
  TextInput,
  TypeIcon
} from "@/ui";
import { DataTable } from "@/ui/DataTable";
import { Page } from "@/layouts/Page";
import { Split } from "@/layouts/Split";
import { cn } from "@/lib/cn";

describe("cn", () => {
  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("ui primitives", () => {
  it("renders Button variants", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button variant="danger" size="sm" onClick={onClick}>
        Go
      </Button>
    );
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("ConfirmDialog confirm cancel and Escape", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        open
        title="Delete?"
        message="Cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-dialog-confirm")).toHaveFocus();

    await user.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(onCancel).toHaveBeenCalled();

    onCancel.mockClear();
    rerender(
      <ConfirmDialog
        open
        title="Delete?"
        message="Cannot be undone."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    await user.click(screen.getByTestId("confirm-dialog-confirm"));
    expect(onConfirm).toHaveBeenCalled();

    onCancel.mockClear();
    rerender(
      <ConfirmDialog
        open
        title="Again?"
        message="Esc closes."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();

    rerender(
      <ConfirmDialog
        open={false}
        title="Hidden"
        message="Nope"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders Banner, Badge, StatusDot, EmptyState, HelpText", () => {
    render(
      <>
        <Banner tone="warn">Heads up</Banner>
        <Badge tone="plant">plant</Badge>
        <StatusDot status="on" label="injector on" />
        <EmptyState title="Empty" hint="Try again" />
        <HelpText>Not SSOT</HelpText>
      </>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Heads up");
    expect(screen.getByText("plant")).toBeInTheDocument();
    expect(screen.getByText("injector on")).toBeInTheDocument();
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.getByText("Not SSOT")).toBeInTheDocument();
  });

  it("renders Panel, KeyValue, KpiStat, StatBar, JsonBlock", () => {
    render(
      <Panel title="Conn" description="desc" actions={<span>act</span>}>
        <KeyValue items={[{ label: "API", value: "local" }]} />
        <KpiStat label="Zombies" value={3} />
        <StatBar label="HP %" value={1.5} max={2} />
        <JsonBlock value={{ a: 1 }} />
      </Panel>
    );
    expect(screen.getByText("Conn")).toBeInTheDocument();
    expect(screen.getByText("API")).toBeInTheDocument();
    expect(screen.getByText("Zombies")).toBeInTheDocument();
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
  });

  it("renders TabList, Pager, BarChart, Sparkline", async () => {
    const user = userEvent.setup();
    const onTab = vi.fn();
    const onNext = vi.fn();
    render(
      <>
        <TabList
          tabs={[
            { id: "a", label: "A" },
            { id: "b", label: "B" }
          ]}
          value="a"
          onChange={onTab}
        />
        <Pager label="1–10" canPrev={false} canNext onPrev={() => undefined} onNext={onNext} />
        <BarChart items={[{ label: "kill", value: 12, tone: "ok" }]} />
        <Sparkline values={[1, -2, 3]} />
      </>
    );
    await user.click(screen.getByRole("tab", { name: "B" }));
    expect(onTab).toHaveBeenCalledWith("b");
    await user.click(screen.getByTestId("pager-next"));
    expect(onNext).toHaveBeenCalled();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart-row")).toHaveTextContent("+12");
    expect(screen.getByTestId("sparkline")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline").querySelector("svg polyline")).toBeTruthy();
  });

  it("BarChart and Sparkline empty states", () => {
    render(
      <>
        <BarChart items={[]} emptyLabel="No bars" />
        <Sparkline values={[]} />
      </>
    );
    expect(screen.getByTestId("bar-chart")).toHaveTextContent("No bars");
    expect(screen.getByTestId("sparkline")).toHaveTextContent("No recent XP");
  });

  it("DivergingBar (T19's fourth chart shape) is zero-anchored and coloured by sign", () => {
    render(
      <>
        <DivergingBar testId="delta-neg" value={-12} scaleMax={20} />
        <DivergingBar testId="delta-pos" value={12} scaleMax={20} />
      </>
    );
    const neg = screen.getByTestId("delta-neg");
    expect(neg).toHaveAttribute("data-sign", "negative");
    expect(neg.querySelector("[class*='bad']")).toBeTruthy();
    // Negative fills left of the zero line — its style targets the right edge, not the left.
    const negFill = neg.querySelector("[class*='bad']") as HTMLElement;
    expect(negFill.style.right).toBe("50%");

    const pos = screen.getByTestId("delta-pos");
    expect(pos).toHaveAttribute("data-sign", "positive");
    const posFill = pos.querySelector("[class*='bg-ok']") as HTMLElement;
    expect(posFill).toBeTruthy();
    expect(posFill.style.left).toBe("50%");
  });

  it("TypeIcon falls back when image fails", async () => {
    render(<TypeIcon side="plant" typeId={0} testId="ti" />);
    const img = screen.getByTestId("ti");
    expect(img.tagName).toBe("IMG");
    fireEvent.error(img);
    expect(await screen.findByText("#0")).toBeInTheDocument();
  });

  it("handles Field, inputs, Select, Checkbox", async () => {
    const user = userEvent.setup();
    const onNum = vi.fn();
    render(
      <>
        <Field label="HP">
          <NumberInput value={1} onChange={onNum} aria-label="hp" />
        </Field>
        <TextInput placeholder="filter" aria-label="filter" />
        <Select aria-label="player" defaultValue="1">
          <option value="1">One</option>
        </Select>
        <Checkbox label="Apply stats" />
      </>
    );
    await user.clear(screen.getByLabelText("hp"));
    await user.type(screen.getByLabelText("hp"), "2");
    expect(onNum).toHaveBeenCalled();
    expect(screen.getByLabelText("Apply stats")).toBeInTheDocument();
  });

  it("renders DataTable with row click and empty state", async () => {
    const user = userEvent.setup();
    const onRow = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={[{ key: "n", header: "Name", cell: (r: { n: string }) => r.n }]}
        rows={[{ n: "Pea" }]}
        rowKey={(r) => r.n}
        onRowClick={onRow}
      />
    );
    await user.click(screen.getByText("Pea"));
    expect(onRow).toHaveBeenCalledWith({ n: "Pea" });

    rerender(
      <DataTable
        columns={[{ key: "n", header: "Name", cell: (r: { n: string }) => r.n }]}
        rows={[{ n: "Overflow" }]}
        rowKey={(r) => r.n}
        rowClassName={() => "text-muted"}
      />
    );
    expect(document.querySelector("tr.text-muted")).toBeTruthy();

    rerender(
      <DataTable
        columns={[{ key: "n", header: "Name", cell: (r: { n: string }) => r.n }]}
        rows={[]}
        rowKey={(r) => r.n}
        empty={<div>No rows</div>}
      />
    );
    expect(screen.getByText("No rows")).toBeInTheDocument();
  });
});

describe("layouts", () => {
  it("renders Page and Split", () => {
    render(
      <Page title="Status" description="health" actions={<button type="button">R</button>}>
        <Split list={<div>List</div>} detail={<div>Detail</div>} />
      </Page>
    );
    expect(screen.getByRole("heading", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByText("List")).toBeInTheDocument();
    expect(screen.getByText("Detail")).toBeInTheDocument();
  });
});
