/**
 * Host-side parse-validation for LLM-generated hook sources.
 *
 * The sandbox runner ({@link ../compiler/sandbox-runner}) parses user
 * code lazily on first invocation. That's correct for valid sources,
 * but lets a malformed cached hook (or a comment-only response) ride
 * through `parseResponse` without failing until simulate-time, where
 * the parse error surfaces as a kernel crash rather than a clean
 * "regenerate the hook" cache miss.
 *
 * `isParseableArrowSource` does a no-execute parse check so generators
 * can reject those cases up front. Two prior incidents this fix covers:
 *
 *   1. `fallbackSource` strings declared as comments (`'// No-op'`)
 *      were cached when the LLM exhausted retries, then crashed the
 *      sandbox at parse on the next run with `Unexpected token`.
 *   2. `parseResponse` accepted any non-empty string and returned a
 *      closure that wrapped the source for sandbox execution. A
 *      comment-only string passed parser, was written to cache, and
 *      blew up at runtime.
 *
 * The check uses host-realm `new Function(...)` to attempt a parse
 * WITHOUT calling the constructed function, so user-supplied side
 * effects in the source body never execute.
 *
 * @module paracosm/engine/compiler/source-validation
 */

/**
 * Return true if `cleaned` parses as a JavaScript expression that
 * could be wrapped as `const __userFn = (${cleaned});` (the shape the
 * sandbox runner expects). Rejects empty strings, comment-only blocks,
 * markdown prose, and statements that are not legal expressions.
 *
 * The check parses but never invokes the wrapper function, so the
 * inner expression's side effects (if any) do not run. A pathological
 * source like `(() => {}, sideEffect())` would parse here, but the
 * wrapper that calls `sideEffect()` is never invoked by this helper —
 * we only verify the parse succeeds.
 *
 * Does NOT verify the parsed expression evaluates to a function.
 * `42` would pass this check; the smoke test at compile time and the
 * sandbox at runtime catch type mismatches downstream.
 *
 * @param cleaned The pre-trimmed, fence-stripped source text.
 * @returns true when parseable as an expression body, false otherwise.
 */
export function isParseableArrowSource(cleaned: string): boolean {
  const trimmed = cleaned.trim();
  if (!trimmed) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    new Function(`"use strict"; return (${trimmed});`);
    return true;
  } catch {
    return false;
  }
}
