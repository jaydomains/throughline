// Shared inline load-error banner (SF6 / C-D24). Renders nothing when there is no
// error, so consumers can drop `<LoadError error={x} what="items" />` next to a list
// without a surrounding conditional. Uses the existing `error` class convention.
export function LoadError({ error, what }: { error: Error | null; what: string }) {
  if (!error) return null;
  return (
    <p className="error" role="alert" data-testid={`load-error-${what}`}>
      Couldn’t load {what}: {error.message}
    </p>
  );
}
