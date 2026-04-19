import { useMemo } from 'react';
import { useScenarioContext } from '../App.js';

/**
 * Single source of truth for scenario-specific noun variants used in
 * user-facing UI copy. Reads `scenario.labels.populationNoun` and
 * `settlementNoun` (defaults: "colonists" / "colony" for Mars) and
 * derives capitalized + singular + plural variants.
 *
 * Scenario authors override nouns via `labels.populationNoun` (plural,
 * e.g. "crew" / "citizens" / "operators") and `labels.settlementNoun`
 * (singular, e.g. "habitat" / "kingdom" / "station").
 *
 * Why a hook + not a raw string: many UI surfaces need the same noun
 * in 4 variants (one crew, crew members, Crew, crew). Centralizing the
 * capitalization + pluralization here keeps copy consistent and
 * avoids cluttering each consumer with the same boilerplate.
 */
export interface ScenarioLabels {
  /** Plural lower-case population noun (e.g. "colonists", "crew"). */
  people: string;
  /** Singular lower-case population noun (e.g. "colonist", "crew member"). */
  person: string;
  /** Capitalized plural ("Colonists", "Crew"). */
  People: string;
  /** Capitalized singular ("Colonist", "Crew member"). */
  Person: string;
  /** Singular lower-case settlement noun (e.g. "colony", "habitat"). */
  place: string;
  /** Plural lower-case settlement noun (e.g. "colonies", "habitats"). */
  places: string;
  /** Capitalized singular ("Colony"). */
  Place: string;
  /** Capitalized plural ("Colonies"). */
  Places: string;
}

function cap(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pluralize(noun: string): string {
  const n = noun.toLowerCase();
  if (n.endsWith('y') && !'aeiou'.includes(n[n.length - 2])) return n.slice(0, -1) + 'ies';
  if (n.endsWith('s') || n.endsWith('x') || n.endsWith('z') || n.endsWith('sh') || n.endsWith('ch')) return n + 'es';
  return n + 's';
}

function singularize(noun: string): string {
  const n = noun.toLowerCase();
  if (n.endsWith('ies') && n.length > 4) return n.slice(0, -3) + 'y';
  if (n.endsWith('ses') || n.endsWith('xes') || n.endsWith('zes') || n.endsWith('shes') || n.endsWith('ches')) return n.slice(0, -2);
  if (n.endsWith('s') && !n.endsWith('ss')) return n.slice(0, -1);
  return n;
}

export function useScenarioLabels(): ScenarioLabels {
  const scenario = useScenarioContext();
  return useMemo(() => {
    // Paracosm scenarios convention: populationNoun is PLURAL
    // ("colonists"), settlementNoun is SINGULAR ("colony"). Derive
    // opposites so callers can pick either form without checking
    // length/ending.
    const popPlural = (scenario.labels?.populationNoun || 'colonists').toLowerCase();
    const popSingular = singularize(popPlural);
    const placeSingular = (scenario.labels?.settlementNoun || 'colony').toLowerCase();
    const placePlural = pluralize(placeSingular);
    return {
      people: popPlural,
      person: popSingular,
      People: cap(popPlural),
      Person: cap(popSingular),
      place: placeSingular,
      places: placePlural,
      Place: cap(placeSingular),
      Places: cap(placePlural),
    };
  }, [scenario.labels?.populationNoun, scenario.labels?.settlementNoun]);
}
