import type { ProcessedEvent, Side } from '../../hooks/useGameState';
import { useScenarioContext } from '../../App';
import { Badge } from '../shared/Badge';

interface EventCardProps {
  event: ProcessedEvent;
  side: Side;
}

function esc(s: unknown): string {
  if (!s) return '';
  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function EventCard({ event, side }: EventCardProps) {
  const scenario = useScenarioContext();
  const sideColor = side === 'a' ? 'var(--side-a)' : 'var(--side-b)';
  const dd = event.data;

  switch (event.type) {
    case 'turn_start':
      return null; // Handled by CrisisHeader and StatsBar

    case 'promotion': {
      const name = String(dd.colonistId || '').replace('col-', '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      return (
        <div className="px-3 py-1.5 text-xs flex items-baseline gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span className="font-semibold" style={{ color: 'var(--accent-warm)' }}>{String(dd.role || '')}</span>
          <span className="text-[10px] italic flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{String(dd.reason || '').slice(0, 80)}</span>
        </div>
      );
    }

    case 'dept_start': {
      const icon = scenario.ui.departmentIcons[String(dd.department)] || '📋';
      const dept = String(dd.department || '');
      return (
        <div className="px-3 py-1 text-[11px] flex items-center gap-1.5 animate-pulse" style={{ color: 'var(--text-muted)' }}>
          <span>{icon}</span> {dept.charAt(0).toUpperCase() + dept.slice(1)} analyzing...
        </div>
      );
    }

    case 'commander_deciding':
      return (
        <div className="px-3 py-1 text-[11px] flex items-center gap-1.5 animate-pulse" style={{ color: 'var(--text-muted)' }}>
          <span>⚡</span> Commander deciding...
        </div>
      );

    case 'dept_done': {
      const dept = String(dd.department || '');
      const icon = scenario.ui.departmentIcons[dept] || '📋';
      const tools = (dd._filteredTools as Array<Record<string, unknown>>) || [];
      const risks = Array.isArray(dd.risks) ? dd.risks : [];
      const severity = risks.some((r: any) => r.severity === 'critical') ? 'critical' : risks.some((r: any) => r.severity === 'high') ? 'high' : '';

      return (
        <div>
          {/* Department pill */}
          <div className="px-3 py-1.5 flex flex-wrap gap-1.5">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
              style={{
                background: severity === 'critical' ? 'rgba(224,101,48,.2)' : severity === 'high' ? 'rgba(232,180,74,.15)' : 'var(--bg-elevated)',
                color: severity === 'critical' ? 'var(--color-error)' : severity === 'high' ? 'var(--color-warning)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {icon} {dept.charAt(0).toUpperCase() + dept.slice(1)} · {dd.citations || 0}c {tools.length}t
              {severity && <span className="uppercase text-[9px] font-bold"> · {severity}</span>}
            </span>
          </div>

          {/* Tool forge cards */}
          {tools.map((t: any, i: number) => (
            <div key={i} className="mx-3 mb-1.5 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[9px] font-extrabold tracking-wider uppercase" style={{ color: 'var(--color-success)' }}>FORGED</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {String(t.description || t.name || '').slice(0, 80)}
                </span>
                <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--color-success)' }}>
                  ✓ {(t.confidence || 0.85).toFixed(2)}
                </span>
              </div>
              {t.output && (
                <details className="mt-1">
                  <summary className="text-[11px] cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                    {t.name} · {t.mode || 'sandbox'}
                  </summary>
                  <div className="mt-1 font-mono text-[10px] p-2 rounded max-h-16 overflow-auto break-all" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                    {String(t.output).slice(0, 400)}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      );
    }

    case 'outcome': {
      const outcome = String(dd.outcome || '');
      const decision = String(dd._decision || '');
      const rationale = String(dd._rationale || '');
      const policies = (dd._policies as string[]) || [];
      const colonyDeltas = dd.colonyDeltas as Record<string, number> | undefined;

      return (
        <div className="mx-3 my-1.5 rounded-lg p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: sideColor }}>
                ⚡ DECISION
              </span>
              <div className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {decision.length > 150 ? decision.slice(0, 150) + '...' : decision}
              </div>
            </div>
            <Badge outcome={outcome} />
          </div>
          {colonyDeltas && Object.keys(colonyDeltas).length > 0 && (
            <div className="mt-2 text-[11px] font-mono flex flex-wrap gap-2">
              {Object.entries(colonyDeltas).map(([k, v]) => (
                <span key={k} style={{ color: v > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                  {k} {v > 0 ? '+' : ''}{v}
                </span>
              ))}
            </div>
          )}
          {(rationale || policies.length > 0) && (
            <details className="mt-2">
              <summary className="text-[11px] font-semibold cursor-pointer" style={{ color: sideColor }}>
                Full reasoning & policies
              </summary>
              <div className="mt-2 p-2 rounded text-xs leading-relaxed" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                {decision}
                {rationale && (
                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--accent-warm)' }}>Rationale:</span>
                    <div className="mt-1">{rationale}</div>
                  </div>
                )}
                {policies.length > 0 && (
                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--accent-warm)' }}>Policies:</span>
                    {policies.map((p, i) => <div key={i} style={{ color: 'var(--accent-warm)' }}>→ {p}</div>)}
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }

    case 'drift': {
      const entries = Object.values(dd.colonists as Record<string, any> || {});
      if (!entries.length) return null;
      return (
        <div className="px-3 py-1 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
          <span className="font-bold">DRIFT: </span>
          {entries.slice(0, 3).map((c: any, i: number) => (
            <span key={i}>
              <span style={{ color: sideColor }}>{c.name?.split(' ')[0]}</span>
              {' '}O{c.hexaco?.O ?? '?'} C{c.hexaco?.C ?? '?'}
              {i < Math.min(entries.length, 3) - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      );
    }

    case 'colonist_reactions': {
      const reactions = (dd.reactions as Array<Record<string, any>>) || [];
      const total = (dd.totalReactions as number) || reactions.length;
      if (!reactions.length) return null;

      const moodCounts: Record<string, number> = {};
      for (const r of reactions) moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1;
      const moodColors: Record<string, string> = {
        positive: 'var(--color-success)', negative: 'var(--color-error)', anxious: 'var(--color-warning)',
        defiant: 'var(--color-error)', hopeful: 'var(--color-success)', resigned: 'var(--text-muted)', neutral: 'var(--text-secondary)',
      };
      const moodBgColors: Record<string, string> = {
        positive: '#6aad48', negative: '#e06530', anxious: '#e8b44a',
        defiant: '#e06530', hopeful: '#6aad48', resigned: '#a89878', neutral: '#a89878',
      };
      const segments = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]).map(([mood, count]) => ({
        mood, count, pct: Math.round((count / reactions.length) * 100), bg: moodBgColors[mood] || '#a89878',
      }));

      return (
        <div className="mx-3 my-1.5 rounded-lg p-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="text-[10px] font-extrabold tracking-wider uppercase" style={{ color: sideColor }}>
              🗣 {total} voices
            </span>
            <div className="flex-1 flex h-3.5 rounded overflow-hidden gap-px">
              {segments.map(m => <div key={m.mood} style={{ flex: m.pct, background: m.bg }} title={`${m.pct}% ${m.mood}`} />)}
            </div>
          </div>
          <div className="flex gap-3 text-[11px] mb-1">
            {segments.slice(0, 3).map(m => (
              <span key={m.mood} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: m.bg }} />
                {m.pct}% {m.mood}
              </span>
            ))}
          </div>
          <details open>
            <summary className="text-[11px] font-semibold cursor-pointer" style={{ color: sideColor }}>Individual quotes</summary>
            <div className="mt-1">
              {reactions.slice(0, 6).map((r, i) => (
                <div key={i} className="py-1 flex gap-2 items-baseline text-xs" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="font-semibold min-w-[90px] shrink-0" style={{ color: sideColor }}>{r.name}</span>
                  <span className="italic flex-1" style={{ color: 'var(--text-primary)' }}>
                    "{String(r.quote || '').slice(0, 90)}{String(r.quote || '').length > 90 ? '...' : ''}"
                  </span>
                  <span className="text-[10px] font-bold shrink-0" style={{ color: moodColors[r.mood] || 'var(--text-muted)' }}>
                    {String(r.mood || '').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>
      );
    }

    case 'bulletin': {
      const posts = (dd.posts as Array<Record<string, any>>) || [];
      if (!posts.length) return null;

      return (
        <div className="mx-3 my-1.5">
          <div className="text-[10px] font-extrabold tracking-wider uppercase mb-1" style={{ color: sideColor }}>
            📢 {scenario.labels.settlementNoun.charAt(0).toUpperCase() + scenario.labels.settlementNoun.slice(1)} Bulletin — Year {dd.year || ''}
          </div>
          {posts.map((p, i) => (
            <div key={i} className="py-1.5 text-xs" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <span className="font-semibold" style={{ color: sideColor }}>{p.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>{p.role} · {p.department}</span>
              </div>
              <div className="mt-0.5" style={{ color: 'var(--text-primary)' }}>{p.post}</div>
              <div className="flex gap-3 mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: moodColors[p.mood] || 'var(--text-muted)' }}>{String(p.mood || '').toUpperCase()}</span>
                <span>♡ {p.likes || 0}</span>
                <span>↩ {p.replies || 0}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    case 'turn_done':
      return (
        <div className="text-center text-[10px] py-1.5 font-mono tracking-wider uppercase" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
          Turn {dd.turn} complete
        </div>
      );

    default:
      return null;
  }
}
