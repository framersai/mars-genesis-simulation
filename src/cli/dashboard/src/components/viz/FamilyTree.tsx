import type { CellSnapshot } from './viz-types.js';
import { DEPARTMENT_COLORS, DEFAULT_DEPT_COLOR } from './viz-types.js';

interface FamilyTreeProps {
  center: CellSnapshot;
  byId: Map<string, CellSnapshot>;
  onSelect: (agentId: string) => void;
}

function Thumb({ cell, onSelect, relation }: { cell: CellSnapshot; onSelect: (id: string) => void; relation: string }) {
  const color = DEPARTMENT_COLORS[cell.department] ?? DEFAULT_DEPT_COLOR;
  return (
    <button
      type="button"
      onClick={() => onSelect(cell.agentId)}
      aria-label={`${relation}: ${cell.name}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px',
        background: 'var(--bg-card)',
        border: `1px solid var(--border)`,
        borderRadius: 6, cursor: 'pointer',
        fontFamily: 'var(--mono)', fontSize: 'var(--font-2xs)',
        color: cell.alive ? 'var(--text-1)' : 'var(--text-3)',
        textDecoration: cell.alive ? undefined : 'line-through',
      }}
    >
      <span style={{ width: 8, height: 8, background: color, borderRadius: 2 }} />
      <span style={{ fontWeight: 700 }}>{cell.name}</span>
      <span style={{ color: 'var(--text-3)' }}>{relation}</span>
    </button>
  );
}

/**
 * Clickable family thumbnails. Click any thumb to swap the drilldown
 * panel content to that colonist. Missing references (partner or
 * child not in the snapshot) render nothing rather than placeholder.
 */
export function FamilyTree({ center, byId, onSelect }: FamilyTreeProps) {
  const partner = center.partnerId ? byId.get(center.partnerId) : null;
  const children = center.childrenIds.map(id => byId.get(id)).filter((c): c is CellSnapshot => !!c);
  if (!partner && children.length === 0) {
    return <div style={{ fontSize: 'var(--font-2xs)', color: 'var(--text-3)' }}>No listed family.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {partner && <Thumb cell={partner} onSelect={onSelect} relation="partner" />}
      {children.slice(0, 4).map(c => (
        <Thumb key={c.agentId} cell={c} onSelect={onSelect} relation="child" />
      ))}
      {children.length > 4 && (
        <div style={{ fontSize: 'var(--font-2xs)', color: 'var(--text-3)' }}>+{children.length - 4} more children</div>
      )}
    </div>
  );
}
