import { bodies } from './solar';
import { comets } from './comets';
import { orbitingMoons } from './moon-orbits';
export function bodyFromHash(hash: string) {
  const id = hash.replace(/^#/, '');
  return [...bodies, ...comets, ...orbitingMoons].some((b) => b.id === id)
    ? id
    : null;
}
