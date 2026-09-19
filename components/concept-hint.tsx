'use client';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

/**
 * A compact, keyboard reachable explanation. It opens on tap as well as on
 * hover, because a native title tooltip never appears on a touch screen.
 */
export default function ConceptHint({ label }: { label: string }) {
  return (
    <Popover>
      <PopoverTrigger
        className="concept-hint"
        aria-label={label}
        openOnHover
        delay={120}
      >
        <HelpCircle size={13} strokeWidth={1.8} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="concept-hint-popup w-auto">
        {label}
      </PopoverContent>
    </Popover>
  );
}
