import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer
} from "recharts";
import { STANDING_RADAR_FALLBACK_PAINT } from "@/theme/chartPaint";

export type StandingRadarAxis = {
  id: string;
  label: string;
  value: number;
  fillPct: number;
  paint: string;
};

/** Lazy chunk — recharts RadarChart for standing-radar (Q4). */
export default function StandingRadarChart({
  axes,
  revision
}: {
  axes: StandingRadarAxis[];
  revision: number;
}) {
  const data = axes.map((axis) => ({
    axis: axis.label,
    value: Math.max(0, Math.min(100, axis.fillPct)),
    paint: axis.paint
  }));
  const stroke = axes[0]?.paint ?? STANDING_RADAR_FALLBACK_PAINT;

  return (
    <div
      className="standing-radar-chart"
      data-testid="standing-radar-chart"
      data-revision={revision}
      style={{ width: 200, height: 200 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          data={data}
          cx="50%"
          cy="50%"
          outerRadius="55%"
          margin={{ top: 20, right: 28, bottom: 20, left: 28 }}
          key={revision}
        >
          <PolarGrid stroke="var(--color-border-control)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "var(--color-muted)", fontSize: 10 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Standing"
            dataKey="value"
            stroke={stroke}
            fill={stroke}
            fillOpacity={0.28}
            isAnimationActive
            dot={(props) => {
              const { cx, cy, index } = props as {
                cx?: number;
                cy?: number;
                index?: number;
              };
              if (cx == null || cy == null || index == null) return null;
              const paint = data[index]?.paint ?? stroke;
              return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={paint} />;
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
