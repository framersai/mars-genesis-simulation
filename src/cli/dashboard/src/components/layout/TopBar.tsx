import { useTheme } from '../../theme/ThemeProvider';
import type { ScenarioClientPayload } from '../../hooks/useScenario';
import type { GameState } from '../../hooks/useGameState';

interface TopBarProps {
  scenario: ScenarioClientPayload;
  sse: { status: string; events: Array<unknown>; isComplete: boolean };
  gameState: GameState;
}

export function TopBar({ scenario, sse, gameState }: TopBarProps) {
  const { resolved, setTheme } = useTheme();

  const statusColor = sse.isComplete
    ? 'var(--accent-warm)'
    : sse.status === 'connected'
    ? 'var(--color-success)'
    : 'var(--text-muted)';

  const statusText = sse.isComplete
    ? 'Complete'
    : sse.status === 'connected'
    ? 'Connected'
    : sse.status === 'error'
    ? 'Reconnecting...'
    : 'Connecting...';

  return (
    <div
      className="flex items-center justify-between px-4 py-2 gap-4 border-b shrink-0"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
    >
      {/* Left: Logo + name */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
          {scenario.labels.name.toUpperCase()}
        </span>
        <span className="text-[9px] font-bold tracking-widest font-mono" style={{ color: 'var(--accent-primary)' }}>
          PARACOSM
        </span>
      </div>

      {/* Center: Tagline */}
      <div className="text-xs hidden md:block truncate" style={{ color: 'var(--text-muted)' }}>
        Same {scenario.labels.settlementNoun}, two different leaders. Watch emergent civilizations diverge.
      </div>

      {/* Right: Turn info + status + theme toggle */}
      <div className="flex items-center gap-3 shrink-0">
        {gameState.turn > 0 && (
          <div className="flex items-center gap-2 text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
            <span>T<strong>{gameState.turn}</strong>/{gameState.maxTurns}</span>
            <span>Y<strong>{gameState.year}</strong></span>
            <span>S<strong>{gameState.seed}</strong></span>
            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.round((gameState.turn / gameState.maxTurns) * 100)}%`, background: 'var(--accent-primary)' }}
              />
            </div>
          </div>
        )}
        <span className="text-xs font-mono" style={{ color: statusColor }}>
          ● {statusText}
        </span>
        <button
          onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
          className="text-sm px-2 py-1 rounded transition-colors cursor-pointer"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
          title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
        >
          {resolved === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  );
}
