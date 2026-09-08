import { Plus, ArrowUpRight } from 'lucide-react';
import { curiosities } from '../lib/curiosities';

export default function CuriosityCard({
  id,
  index = 0,
  name,
}: {
  id: string;
  index?: number;
  name: string;
}) {
  const pool = curiosities[id];
  const fact = pool?.[index] ?? pool?.[0];
  if (!fact) return null;
  return (
    <div className="did-you-know" data-curiosity={id}>
      <span>
        <Plus size={14} /> 你知道吗 · {name}
      </span>
      <p>{fact.text}</p>
      <a className="source" href={fact.source} target="_blank" rel="noreferrer">
        {fact.related ? '延伸知识' : '资料与计算依据'} · {index + 1}/
        {pool.length} <ArrowUpRight size={13} />
      </a>
    </div>
  );
}
