interface BadgeProps {
  outcome: string;
}

const OUTCOME_STYLES: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  risky_success: { bg: 'rgba(106,173,72,.15)', color: 'var(--color-success)', label: 'RISKY WIN', icon: '✓' },
  risky_failure: { bg: 'rgba(224,101,48,.15)', color: 'var(--color-error)', label: 'RISKY LOSS', icon: '✗' },
  conservative_success: { bg: 'rgba(106,173,72,.1)', color: 'var(--color-success)', label: 'SAFE WIN', icon: '✓' },
  conservative_failure: { bg: 'rgba(224,101,48,.1)', color: 'var(--color-error)', label: 'SAFE LOSS', icon: '✗' },
};

export function Badge({ outcome }: BadgeProps) {
  const style = OUTCOME_STYLES[outcome] || { bg: 'var(--bg-tertiary)', color: 'var(--text-muted)', label: outcome.replace(/_/g, ' ').toUpperCase(), icon: '?' };

  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide shrink-0"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.color}` }}
    >
      {style.icon} {style.label}
    </span>
  );
}
