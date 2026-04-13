const CHARS = '▁▂▃▄▅▆▇█';

interface SparkLineProps {
  data: number[];
  label?: string;
  suffix?: string;
}

export function SparkLine({ data, label, suffix = '' }: SparkLineProps) {
  if (!data.length) return <span style={{ color: 'var(--text-muted)' }}>—</span>;

  const max = Math.max(...data) || 1;
  const spark = data.map(v => CHARS[Math.min(7, Math.floor((v / max) * 7.99))]).join('');
  const current = data[data.length - 1];

  return (
    <span className="font-mono text-[10px]" style={{ color: 'var(--text-secondary)' }}>
      {label && <span style={{ color: 'var(--text-muted)' }}>{label} </span>}
      <span style={{ color: 'var(--accent-primary)', letterSpacing: '-0.5px' }}>{spark}</span>
      {' '}{current}{suffix}
    </span>
  );
}
