import { HelpCircle } from 'lucide-react';

/** A compact, keyboard reachable explanation using the browser's native tooltip. */
export default function ConceptHint({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="concept-hint"
      aria-label={label}
      title={label}
      onPointerDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <HelpCircle size={13} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
