import type { Translate } from './i18n';
import { bodies, speeds } from './solar';
import { comets } from './comets';
import { orbitingMoons } from './moon-orbits';
const catalog = [...bodies, ...orbitingMoons, ...comets];
export interface ObservatoryActions {
  focus: (id: string) => void;
  simulation: (speedIndex: number, paused: boolean) => void;
}
export function observatoryTools(
  actions: ObservatoryActions,
  t: Translate = (key) => key,
) {
  return [
    {
      name: 'focus_solar_body',
      title: t('抵近观察天体'),
      description:
        'Select and follow a solar-system body; show its educational facts.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', enum: catalog.map((b) => b.id) } },
        required: ['id'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = input as { id?: string };
        const body = catalog.find((b) => b.id === value?.id);
        if (!body) throw new Error('Unknown solar-system body');
        actions.focus(body.id);
        return { selected: body.id, name: t(body.name) };
      },
    },
    {
      name: 'set_solar_simulation',
      title: t('调整天体运行时间'),
      description:
        'Set simulation speed and pause or resume motion. Presets run from real time (0), eclipse slow motion at 1 minute per second (1), to 10 years per second (8).',
      inputSchema: {
        type: 'object',
        properties: {
          speedIndex: {
            type: 'integer',
            minimum: 0,
            maximum: speeds.length - 1,
          },
          paused: { type: 'boolean' },
        },
        required: ['speedIndex', 'paused'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const v = input as { speedIndex?: number; paused?: boolean };
        if (
          !v ||
          typeof v.speedIndex !== 'number' ||
          !Number.isInteger(v.speedIndex) ||
          v.speedIndex < 0 ||
          v.speedIndex >= speeds.length ||
          typeof v.paused !== 'boolean'
        )
          throw new Error('Invalid simulation preset');
        actions.simulation(v.speedIndex, v.paused);
        return { daysPerSecond: speeds[v.speedIndex], paused: v.paused };
      },
    },
  ];
}
export function registerObservatoryTools(
  actions: ObservatoryActions,
  t?: Translate,
) {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (
          tool: ReturnType<typeof observatoryTools>[number],
          options: { signal: AbortSignal },
        ) => void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context) return;
  const lifecycle = new AbortController();
  for (const tool of observatoryTools(actions, t)) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Optional browser support must not interrupt exploration. */
    }
  }
  return () => lifecycle.abort();
}
