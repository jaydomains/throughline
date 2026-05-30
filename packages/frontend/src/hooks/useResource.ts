import { useCallback, useEffect, useRef, useState } from 'react';

// useResource / usePolledResource — the canonical data-fetching hook pair (C-D24).
//
// Every fetch-once and polled hook in the frontend repeated the same shape: a
// `{ data, loading, error }` triple, an `alive` unmount guard, and an imperative
// `refresh`. That triple was the surface where SF6-01..12 lived — the `error`
// slot existed but each hook (and its consumers) handled it differently, and most
// dropped it. This pair owns the pattern once so consumers can rely on a single
// `ResourceState<T>` contract and actually render `error`.
//
// Contract: callers pass a memoised `fetcher` (build it with `useMemo`, keyed on
// the inputs it closes over) or `null` to mean "disabled — reset to `initial`".
// An unmemoised fetcher re-fetches every render; that is the one footgun.

export interface ResourceState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  /** Re-run the fetcher. Stable identity; safe to pass to children / deps. */
  refresh: () => void;
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/** Fetch once per `fetcher` identity (and on `refresh()`), with an unmount guard. */
export function useResource<T>(fetcher: (() => Promise<T>) | null, initial: T): ResourceState<T> {
  const initialRef = useRef(initial);
  const [data, setData] = useState<T>(initialRef.current);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!fetcher) {
      setData(initialRef.current);
      setError(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    void fetcher()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(toError(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fetcher, tick]);

  return { data, loading, error, refresh };
}

/**
 * Like {@link useResource} but re-runs on a fixed interval. Subsequent ticks do
 * not toggle `loading` (no flicker); a tick that succeeds clears a prior `error`,
 * a tick that fails sets it — so a transient blip surfaces and then self-heals.
 */
export function usePolledResource<T>(
  fetcher: (() => Promise<T>) | null,
  initial: T,
  intervalMs: number,
): ResourceState<T> {
  const initialRef = useRef(initial);
  const [data, setData] = useState<T>(initialRef.current);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!fetcher) {
      setData(initialRef.current);
      setError(null);
      setLoading(false);
      return;
    }
    let alive = true;
    const run = () => {
      void fetcher()
        .then((d) => {
          if (alive) {
            setData(d);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (alive) setError(toError(e));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    };
    setLoading(true);
    run();
    const id = setInterval(run, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [fetcher, intervalMs, tick]);

  return { data, loading, error, refresh };
}
