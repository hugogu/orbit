import { HelpCircle } from 'lucide-react';

/** A compact, keyboard reachable explanation that does not take archive space. */
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
      <span className="concept-tooltip" role="tooltip">
        {label}
      </span>
    </button>
  );
}
