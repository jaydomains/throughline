import { useModalRegistration } from '../keyboard/modalStack.js';
import { useKeyboardRegistry } from '../keyboard/registry.js';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  const { bindings } = useKeyboardRegistry();
  useModalRegistration('help', open, onClose);
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-label="Keyboard reference"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <h2 style={{ marginTop: 0 }}>Keyboard reference</h2>
        <ul className="help-list">
          {bindings.map((b) => (
            <li key={b.id}>
              <span className="kbd">{b.combo}</span>
              <span className="desc">{b.description}</span>
            </li>
          ))}
        </ul>
        <p style={{ color: 'var(--fg-dim)', marginTop: 16, marginBottom: 0 }}>
          Esc to close.
        </p>
      </div>
    </div>
  );
}
