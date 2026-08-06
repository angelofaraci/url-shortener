import type { SeriesPoint } from '../../types';

interface ClicksBarChartProps {
  series: SeriesPoint[];
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 160;
const BAR_GAP = 3;

// Hand-rolled SVG bar chart — no charting library (design D5). The
// requirement is exactly one static 30-bucket bar chart with a fixed
// window; a library would be a 60-95kB bundle tax for ~60 lines of
// geometry. `<title>` on each bar gives free, accessible hover text.
export function ClicksBarChart({ series }: ClicksBarChartProps) {
  // Zero-safe scaling: a max of 0 (no clicks in the window) would divide by
  // zero, so the floor is 1 — every bar then renders at height 0, not NaN.
  const maxClicks = Math.max(1, ...series.map((point) => point.clicks));
  const barWidth = series.length > 0 ? (CHART_WIDTH - BAR_GAP * (series.length - 1)) / series.length : 0;

  return (
    <svg
      className="clicks-bar-chart"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="Clicks per day over the last 30 days"
    >
      {series.map((point, index) => {
        const barHeight = (point.clicks / maxClicks) * (CHART_HEIGHT - 4);
        const x = index * (barWidth + BAR_GAP);
        const y = CHART_HEIGHT - barHeight;

        return (
          <rect
            key={point.date}
            className="clicks-bar-chart__bar"
            x={x}
            y={y}
            width={barWidth}
            height={Math.max(barHeight, 1)}
          >
            <title>{`${point.date}: ${point.clicks} click${point.clicks === 1 ? '' : 's'}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
