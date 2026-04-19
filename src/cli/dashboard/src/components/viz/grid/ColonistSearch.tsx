import { useEffect, useRef } from 'react';

interface ColonistSearchProps {
  value: string;
  onChange: (q: string) => void;
  matchCount: number;
}

/**
 * Search input above the leader panels. Types a name fragment → any
 * matching colonists on either side get a bright highlight ring and
 * non-matches dim. Empty string = normal render.
 */
export function ColonistSearch({ value, onChange, matchCount }: ColonistSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: 'var(--bg-deep)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontFamily: 'var(--mono)',
          color: 'var(--text-4)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        Find
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="colonist name… (press / to focus)"
        aria-label="Search colonist by name"
        style={{
          flex: 1,
          minWidth: 0,
          padding: '3px 8px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--text-1)',
          outline: 'none',
        }}
      />
      {value && (
        <>
          <span
            style={{
              fontSize: 9,
              fontFamily: 'var(--mono)',
              color: matchCount > 0 ? 'var(--amber)' : 'var(--rust)',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
            }}
          >
            {matchCount} match{matchCount === 1 ? '' : 'es'}
          </span>
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            style={{
              padding: '2px 6px',
              background: 'var(--bg-card)',
              color: 'var(--text-3)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              cursor: 'pointer',
              fontFamily: 'var(--mono)',
              fontSize: 9,
            }}
          >
            clear
          </button>
        </>
      )}
    </div>
  );
}
