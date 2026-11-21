'use client';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n/provider';
import { moonRadii } from '@/lib/eclipse-shadows';
import { asteroidFacts } from '@/lib/asteroids';
import { portraitPath } from '@/lib/profile-images';
import type { CatalogEntry } from '@/lib/seo';
import BodySummaryCard from './body-summary-card';

const BodyImage =
  (Image as unknown as { default?: typeof Image }).default ?? Image;

type Fact = readonly [label: string, value: number, unit: string];

function orbitalPeriod(days: number): Fact {
  return days > 1000
    ? ['公转周期', days / 365.256, '年']
    : ['公转周期', days, '天'];
}

function previewFacts(entry: CatalogEntry): { type: string; facts: Fact[] } {
  switch (entry.kind) {
    case 'body': {
      const { type, radius, period, day } = entry.data;
      return {
        type,
        facts: [
          ['平均半径', radius, 'km'],
          period ? orbitalPeriod(period) : ['自转周期', Math.abs(day), '天'],
        ],
      };
    }
    case 'moon':
      return {
        type: '天然卫星',
        facts: [
          ['平均半径', moonRadii[entry.data.en], 'km'],
          orbitalPeriod(entry.data.period),
        ],
      };
    case 'asteroid': {
      const [diameter, , period] = asteroidFacts(entry.data);
      return { type: entry.data.type, facts: [diameter, period] };
    }
    case 'comet': {
      const { period, au, e } = entry.data;
      return {
        type: '彗星',
        facts: [
          ['模型公转周期', period / 365.256, '年'],
          ['模型近日点', au * (1 - e), 'AU'],
        ],
      };
    }
  }
}

export default function BodyPreviewCard({
  entry,
  onOpen,
}: {
  entry: CatalogEntry;
  onOpen: () => void;
}) {
  const { t, locale } = useI18n();
  const { type, facts } = previewFacts(entry);
  return (
    <BodySummaryCard
      name={t(entry.data.name)}
      image={
        <BodyImage
          className="body-portrait"
          src={portraitPath(entry.data.id)}
          alt=""
          width={36}
          height={36}
          unoptimized
        />
      }
      onOpen={onOpen}
    >
      <small>{t(type)}</small>
      {facts.map(([label, value, unit]) => (
        <small key={label}>
          {t(label)}{' '}
          {value.toLocaleString(locale, { maximumFractionDigits: 3 })}{' '}
          {unit === 'km' || unit === 'AU' ? unit : t(unit)}
        </small>
      ))}
    </BodySummaryCard>
  );
}
