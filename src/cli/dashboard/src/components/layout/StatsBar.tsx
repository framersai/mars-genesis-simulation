import type { ColonyState, Side } from '../../hooks/useGameState';
import { useScenarioContext } from '../../App';

interface StatsBarProps {
  side: Side;
  colony: ColonyState | null;
  prevColony: ColonyState | null;
  deaths: number;
  tools: number;
  citations: number;
}

function delta(curr: number, prev: number | null | undefined): string {
  if (prev == null || isNaN(curr) || isNaN(prev)) return '';
  const d = Math.round((curr - prev) * 100) / 100;
  if (d === 0) return '';
  return d > 0 ? ` +${d}` : ` ${d}`;
}

function formatValue(value: number, format: string): string {
  if (format === 'percent') return `${Math.round(value * 100)}%`;
  if (format === 'number') return String(Math.round(value * 10) / 10);
  return String(value);
}

export function StatsBar({ side, colony, prevColony, deaths, tools, citations }: StatsBarProps) {
  const scenario = useScenarioContext();
  const sideColor = side === 'a' ? 'var(--side-a)' : 'var(--side-b)';

  if (!colony) {
    return (
      <div className="flex gap-3 px-3 py-1.5 text-[11px] font-mono border-b" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
        Waiting...
      </div>
    );
  }

  // Metric labels come from scenario; no hardcoded names
  const metricLabels: Record<string, string> = Object.fromEntries(
    scenario.ui.headerMetrics.map(m => [m.id, m.id.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()])
  );

  return (
    <div className="flex gap-3 px-3 py-1.5 text-[11px] font-mono border-b flex-wrap" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
      {scenario.ui.headerMetrics.map(metric => {
        const value = colony[metric.id] ?? 0;
        const prev = prevColony?.[metric.id];
        const formatted = formatValue(value, metric.format);
        const d = prev != null ? delta(value, prev) : '';
        const label = metricLabels[metric.id] || metric.id;

        return (
          <span key={metric.id}>
            <span style={{ color: 'var(--text-muted)' }}>{label} </span>
            <span style={{ color: sideColor, fontWeight: 600 }}>{formatted}</span>
            {d && <span style={{ color: d.includes('+') ? 'var(--color-success)' : 'var(--color-error)', fontSize: 9, opacity: 0.8 }}>{d}</span>}
          </span>
        );
      })}
      <span><span style={{ color: 'var(--text-muted)' }}>Deaths </span><span style={{ color: 'var(--color-error)' }}>{deaths}</span></span>
      <span><span style={{ color: 'var(--text-muted)' }}>Tools </span><span style={{ color: 'var(--accent-primary)' }}>{tools}</span></span>
      <span><span style={{ color: 'var(--text-muted)' }}>Cites </span><span style={{ color: 'var(--text-secondary)' }}>{citations}</span></span>
    </div>
  );
}
