import type { CrisisInfo, Side } from '../../hooks/useGameState';

interface CrisisHeaderProps {
  side: Side;
  crisis: CrisisInfo | null;
}

export function CrisisHeader({ side, crisis }: CrisisHeaderProps) {
  const sideColor = side === 'a' ? 'var(--side-a)' : 'var(--side-b)';

  if (!crisis) return null;

  return (
    <div className="px-3 py-2 border-b" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-primary)' }}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold" style={{ color: sideColor }}>
          ⚡ T{crisis.turn}: {crisis.title}
        </span>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}
        >
          {crisis.category}
        </span>
        {crisis.emergent && (
          <span className="text-[9px] font-bold tracking-wider" style={{ color: 'var(--accent-warm)' }}>EMERGENT</span>
        )}
      </div>
      {crisis.turnSummary && (
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{crisis.turnSummary}</div>
      )}
    </div>
  );
}
