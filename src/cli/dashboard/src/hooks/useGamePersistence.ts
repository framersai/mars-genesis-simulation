import { useCallback } from 'react';
import type { SimEvent } from './useSSE';
import { migrateLegacyEventShape } from './migrateLegacyEventShape';

function storageKey(scenarioShortName: string, key: string) {
  return `${scenarioShortName}-${key}`;
}

/**
 * Scenario identity stamp written into saved files so consumers can
 * detect mismatch between the file's origin and the dashboard's active
 * scenario. Added as part of F9's save shape; older files lack this
 * field and fall through to heuristic inference in the load preview.
 */
export interface SavedScenarioStamp {
  id: string;
  version: string;
  shortName: string;
}

interface GameData {
  config: Record<string, unknown> | null;
  events: SimEvent[];
  results: unknown[];
  /** End-of-sim LLM verdict — was being silently dropped from saves before. */
  verdict?: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
  /** Schema version so future loads can migrate older payloads. */
  schemaVersion?: number;
  /** Scenario this run was recorded under. Added in F9; older saves omit it. */
  scenario?: SavedScenarioStamp;
}

export function useGamePersistence(
  scenarioShortName: string,
  scenarioStamp?: SavedScenarioStamp,
) {
  const save = useCallback((events: SimEvent[], results: unknown[], verdict?: Record<string, unknown> | null) => {
    const data: GameData = {
      config: null,
      events,
      results,
      verdict: verdict ?? null,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      schemaVersion: 2,
      ...(scenarioStamp ? { scenario: scenarioStamp } : {}),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${scenarioShortName}-${events.length}events.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [scenarioShortName, scenarioStamp]);

  /**
   * Open the native file picker and resolve to the picked File, or
   * `null` if the user cancelled. Exposed separately from `parseFile`
   * so the two-stage preview flow can insert a modal between pick and
   * apply.
   */
  const pickFile = useCallback((): Promise<File | null> => {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = () => {
        const file = input.files?.[0];
        resolve(file ?? null);
      };
      input.click();
    });
  }, []);

  /**
   * Parse a picked File into a migration-complete {@link GameData}.
   * Returns `null` for files that aren't valid save payloads (parse
   * failure, missing events, empty events). Legacy (pre-0.5.0) files
   * are migrated via {@link migrateLegacyEventShape}.
   */
  const parseFile = useCallback((file: File): Promise<GameData | null> => {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (!data.events?.length) { resolve(null); return; }
          const migrated = migrateLegacyEventShape(data.events, data.results);
          resolve({
            ...data,
            events: migrated.events as SimEvent[],
            results: migrated.results ?? data.results ?? [],
          });
        } catch { resolve(null); }
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
  }, []);

  /**
   * Back-compat composed load: pick + parse. Retained so pre-F9 callers
   * that want the fire-and-forget shape keep working. New callers that
   * need a preview step should use `pickFile` + `parseFile` directly
   * via {@link useLoadPreview}.
   */
  const load = useCallback(async (): Promise<GameData | null> => {
    const file = await pickFile();
    if (!file) return null;
    return parseFile(file);
  }, [pickFile, parseFile]);

  const cacheEvents = useCallback((events: SimEvent[], results: unknown[]) => {
    try {
      localStorage.setItem(storageKey(scenarioShortName, 'game-data'), JSON.stringify({
        events, results, startedAt: new Date().toISOString(),
      }));
    } catch {}
  }, [scenarioShortName]);

  const restoreFromCache = useCallback((): GameData | null => {
    try {
      if (localStorage.getItem(storageKey(scenarioShortName, 'cleared'))) return null;
      const cached = localStorage.getItem(storageKey(scenarioShortName, 'game-data'));
      if (!cached) return null;
      const data = JSON.parse(cached);
      if (!data.events?.length) return null;
      // Same legacy-shape migration as load() so browser caches
      // written by pre-0.5.0 builds render correctly after upgrade.
      const migrated = migrateLegacyEventShape(data.events, data.results);
      return {
        ...data,
        events: migrated.events as SimEvent[],
        results: migrated.results ?? data.results ?? [],
      };
    } catch {
      return null;
    }
  }, [scenarioShortName]);

  const clearCache = useCallback(() => {
    localStorage.removeItem(storageKey(scenarioShortName, 'game-data'));
    localStorage.setItem(storageKey(scenarioShortName, 'cleared'), Date.now().toString());
    fetch('/clear', { method: 'POST' }).catch(() => {});
  }, [scenarioShortName]);

  return { save, load, pickFile, parseFile, cacheEvents, restoreFromCache, clearCache };
}
