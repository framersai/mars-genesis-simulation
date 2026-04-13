import type { LeaderInfo } from '../../hooks/useGameState';
import type { Side } from '../../hooks/useGameState';
import { SparkLine } from '../shared/SparkLine';

interface LeaderBarProps {
  side: Side;
  leader: LeaderInfo | null;
  popHistory: number[];
  moraleHistory: number[];
}

function hexacoBar(val: number) {
  const filled = Math.round(val * 5);
  return '█'.repeat(filled) + '░'.repeat(5 - filled);
}

export function LeaderBar({ side, leader, popHistory, moraleHistory }: LeaderBarProps) {
  const sideColor = side === 'a' ? 'var(--side-a)' : 'var(--side-b)';
  const name = leader?.name || (side === 'a' ? 'Leader A' : 'Leader B');
  const archetype = leader?.archetype || '';
  const colony = leader?.colony || '';
  const h = leader?.hexaco || {};

  return (
    <div className="p-3 border-b" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-extrabold" style={{ color: sideColor }}>{name}</span>
        {archetype && (
          <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
            {archetype.replace(/^The\s+/i, '')}
          </span>
        )}
        {colony && (
          <span className="text-[10px] ml-auto" style={{ color: 'var(--text-placeholder)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 6 }}>
            {colony}
          </span>
        )}
      </div>
      {leader?.hexaco && (
        <div className="font-mono text-[9px] flex gap-1 flex-wrap" style={{ color: 'var(--text-muted)' }}>
          {(['O', 'C', 'E', 'A', 'Em', 'HH'] as const).map((trait, i) => {
            const keys = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'emotionality', 'honestyHumility'];
            const val = h[keys[i]] ?? 0;
            return (
              <span key={trait}>
                <span style={{ color: sideColor }}>{trait}</span>
                <span style={{ color: sideColor, opacity: 0.6 }}>{hexacoBar(val)}</span>
                <span style={{ color: sideColor }}>{val.toFixed(2)}</span>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex gap-4 mt-1">
        <SparkLine data={popHistory} label="Pop" />
        <SparkLine data={moraleHistory} label="Morale" suffix="%" />
      </div>
    </div>
  );
}
