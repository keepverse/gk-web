import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Cell } from "recharts";

/** recharts leftover meter — budget − spent. Empty leftover is legal. */
export function LeftoverBar({
  budget,
  spent,
  testId = "actor-leftover-bar"
}: {
  budget: number;
  spent: number;
  testId?: string;
}) {
  const leftover = budget - spent;
  const overspend = leftover < 0;
  const data = [{ name: "leftover", value: Math.abs(leftover), budget }];

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3" data-testid={testId}>
      <div className="h-8 w-40 min-w-[8rem] flex-none" data-testid={`${testId}-chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis type="number" hide domain={[0, Math.max(budget, Math.abs(leftover), 1)]} />
            <YAxis type="category" dataKey="name" hide />
            <Bar dataKey="value" radius={2} isAnimationActive={false}>
              <Cell fill={overspend ? "var(--color-bad-solid)" : "var(--color-lawn-hot)"} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted" data-testid={`${testId}-label`}>
        {overspend ? (
          <>
            Over by <span className="text-bad">{Math.abs(leftover)}</span> · {spent} / {budget}
          </>
        ) : (
          <>
            Leftover <span className="text-text">{leftover}</span> · {spent} / {budget}
          </>
        )}
      </p>
    </div>
  );
}
