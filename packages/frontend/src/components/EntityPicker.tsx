// M-3 — a small reusable picker over a project's sessions/items: a dropdown that surfaces
// human-readable labels (session name / item title) while its value is the entity UUID, so
// callers drive the same downstream API calls as the former raw-UUID text inputs without the
// user ever typing a UUID. (SPEC §7.18 is silent on the selection mechanism — UX only.)

export interface EntityOption {
  id: string;
  label: string;
}

export function EntityPicker({
  value,
  onChange,
  options,
  placeholder,
  testId,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  options: EntityOption[];
  placeholder: string;
  testId: string;
  disabled?: boolean;
}) {
  return (
    <select
      data-testid={testId}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
