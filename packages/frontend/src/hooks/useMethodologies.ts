import { useEffect, useState } from 'react';
import { api, type MethodologySummary } from '../api.js';

export function useMethodologies() {
  const [bundles, setBundles] = useState<MethodologySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listMethodologies()
      .then((r) => {
        if (alive) setBundles(r.methodologies);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { bundles, loading, error };
}

export function findBundle(
  bundles: MethodologySummary[],
  bundleId: string | undefined,
): MethodologySummary | undefined {
  if (!bundleId) return undefined;
  return bundles.find((b) => b.bundle_id === bundleId);
}
