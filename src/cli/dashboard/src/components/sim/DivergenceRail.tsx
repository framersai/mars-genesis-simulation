import type { GameState } from '../../hooks/useGameState';

interface DivergenceRailProps {
  state: GameState;
}

export function DivergenceRail({ state }: DivergenceRailProps) {
  const { a, b } = state;
  if (!a.crisis || !b.crisis) return null;
  if (a.crisis.turn !== b.crisis.turn) return null;
  if (!a.outcome || !b.outcome) return null;
  if (a.crisis.title === b.crisis.title && a.outcome === b.outcome) return null;

  const sameCrisis = a.crisis.title === b.crisis.title;
  const fmtOutcome = (o: string) => o.replace(/_/g, ' ').toUpperCase();

  return (
    <div className="mx-4 my-2 rounded-lg p-3" style={{ background: 'var(--bg-card)', border: '2px solid var(--color-error)' }}>
      <div className="text-[10px] font-extrabold tracking-wider uppercase mb-2" style={{ color: 'var(--color-error)' }}>
        ⚡ TURN {a.crisis.turn} DIVERGENCE {sameCrisis ? '(same crisis, different outcome)' : '(different crises)'}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="font-semibold text-xs" style={{ color: 'var(--side-a)' }}>{a.crisis.title}</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {(a.events.find(e => e.type === 'outcome' && e.turn === a.crisis?.turn)?.data?._decision as string || '').slice(0, 100)}
          </div>
          <span
            className="text-xs font-extrabold font-mono mt-1 inline-block"
            style={{ color: a.outcome.includes('success') ? 'var(--color-success)' : 'var(--color-error)' }}
          >
            {fmtOutcome(a.outcome)}
          </span>
        </div>
        <div>
          <div className="font-semibold text-xs" style={{ color: 'var(--side-b)' }}>{b.crisis.title}</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {(b.events.find(e => e.type === 'outcome' && e.turn === b.crisis?.turn)?.data?._decision as string || '').slice(0, 100)}
          </div>
          <span
            className="text-xs font-extrabold font-mono mt-1 inline-block"
            style={{ color: b.outcome.includes('success') ? 'var(--color-success)' : 'var(--color-error)' }}
          >
            {fmtOutcome(b.outcome)}
          </span>
        </div>
      </div>
    </div>
  );
}
