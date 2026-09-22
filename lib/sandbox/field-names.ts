/**
 * The names of the editable fields, on their own.
 *
 * `edits.ts` owns what each field means and what it may be set to, and it
 * needs the scenario types to say so. A scenario in turn has to name the
 * field a recorded change refers to. Keeping the bare names here lets both
 * hold the same vocabulary without importing each other.
 */
export type SandboxField =
  | 'mass'
  | 'speed'
  | 'distance'
  | 'radius'
  | 'spinDays'
  | 'tilt';
