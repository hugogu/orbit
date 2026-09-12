'use client';
import { useI18n } from '../lib/i18n/provider';
import { Plus, ArrowUpRight } from 'lucide-react';
import { curiosities } from '../lib/curiosities';

export function CuriositySource({
  id,
  index = 0,
  omitSource,
}: {
  id: string;
  index?: number;
  omitSource?: string;
}) {
  const { t } = useI18n();
  const pool = curiosities[id];
  const fact = pool?.[index] ?? pool?.[0];
  if (!fact || fact.source === omitSource) return null;
  return (
    <a
      className="source curiosity-source"
      href={fact.source}
      target="_blank"
      rel="noreferrer"
    >
      {fact.related ? t('延伸知识') : t('资料与计算依据')} · {index + 1}/
      {pool.length} <ArrowUpRight size={13} />
    </a>
  );
}

export default function CuriosityCard({
  id,
  index = 0,
  name,
  showSource = true,
}: {
  id: string;
  index?: number;
  name: string;
  showSource?: boolean;
}) {
  const { t } = useI18n();
  const pool = curiosities[id];
  const fact = pool?.[index] ?? pool?.[0];
  if (!fact) return null;
  return (
    <div className="did-you-know" data-curiosity={id}>
      <span>
        <Plus size={14} /> {t('你知道吗 · {{name}}', { name: t(name) })}
      </span>
      <p>
        {t(
          fact.text,
          Object.fromEntries(
            Object.entries(fact.values ?? {}).map(([key, value]) => [
              key,
              typeof value === 'string' ? t(value) : value,
            ]),
          ),
        )}
      </p>
      {showSource && <CuriositySource id={id} index={index} />}
    </div>
  );
}
