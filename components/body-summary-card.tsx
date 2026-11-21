import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export default function BodySummaryCard({
  className,
  name,
  image,
  children,
  onOpen,
}: {
  className?: string;
  name: string;
  image: ReactNode;
  children: ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={`body-summary-card panel ${className ?? ''}`}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      {image}
      <span className="body-summary-text">
        <strong>{name}</strong>
        {children}
      </span>
      <ChevronRight className="body-summary-chevron" aria-hidden="true" />
    </button>
  );
}
