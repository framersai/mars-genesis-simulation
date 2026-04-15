/**
 * Extract JSON from raw LLM output text.
 * Local copy of @framers/agentos extractJson to avoid dist dependency timing.
 *
 * Tries: raw JSON, markdown fences, thinking block stripping, JSONL, brace matching.
 */
export function extractJson(rawText: string): string | null {
  if (!rawText || rawText.trim().length === 0) return null;

  const trimmed = rawText.trim();

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { JSON.parse(trimmed); return trimmed; } catch { /* fall through */ }
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
  if (fencedMatch) {
    const content = fencedMatch[1].trim();
    try { JSON.parse(content); return content; } catch { /* fall through */ }
  }

  if (trimmed.includes('<thinking>')) {
    const stripped = trimmed.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
    if (stripped.length > 0 && stripped !== trimmed) {
      const result = extractJson(stripped);
      if (result) return result;
    }
  }

  const lines = trimmed.split('\n').filter(l => l.trim());
  if (lines.length >= 2) {
    const jsonObjects: unknown[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line.trim());
        if (typeof parsed === 'object' && parsed !== null) jsonObjects.push(parsed);
      } catch { /* skip */ }
    }
    if (jsonObjects.length >= 2) return JSON.stringify(jsonObjects);
  }

  return extractByBraceMatching(trimmed);
}

function extractByBraceMatching(text: string): string | null {
  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');

  let start: number;
  let openChar: string;
  let closeChar: string;

  if (objectStart === -1 && arrayStart === -1) return null;
  if (objectStart === -1) { start = arrayStart; openChar = '['; closeChar = ']'; }
  else if (arrayStart === -1) { start = objectStart; openChar = '{'; closeChar = '}'; }
  else if (objectStart <= arrayStart) { start = objectStart; openChar = '{'; closeChar = '}'; }
  else { start = arrayStart; openChar = '['; closeChar = ']'; }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === openChar) depth++;
    if (ch === closeChar) depth--;

    if (depth === 0) {
      const candidate = text.slice(start, i + 1);
      try { JSON.parse(candidate); return candidate; } catch { return null; }
    }
  }

  return null;
}
