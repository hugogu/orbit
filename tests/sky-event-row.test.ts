import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SkyEventRow from '../components/sky-event-row';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { languages, translator, type Locale } from '../lib/i18n';

void test('vertical event categories expose the same orientation to keyboard and screen reader users', () => {
  const html = renderToStaticMarkup(
    createElement(
      Tabs,
      { orientation: 'vertical', defaultValue: 'solar' },
      createElement(
        TabsList,
        { 'aria-label': 'Event categories' },
        createElement(TabsTrigger, { value: 'solar' }, 'Solar eclipses'),
        createElement(TabsTrigger, { value: 'lunar' }, 'Lunar eclipses'),
      ),
    ),
  );
  assert.match(
    html,
    /role="tablist"[^>]*aria-orientation="vertical"|aria-orientation="vertical"[^>]*role="tablist"/,
  );
});

void test('event summaries keep the date and independent jump action outside folded circumstances', () => {
  const peak = Date.UTC(2027, 1, 21, 7, 12);
  const html = renderToStaticMarkup(
    createElement(
      SkyEventRow,
      {
        kind: 'lunar',
        title: 'Penumbral lunar eclipse',
        peak,
        timeLabel: 'Feb 21, 2027 at 07:12',
        viewLabel: 'View penumbral lunar eclipse on Feb 21, 2027',
        onView: () => {},
      },
      createElement('p', null, 'The Moon is below the horizon.'),
    ),
  );
  assert.match(html, /<details>/);
  assert.doesNotMatch(html, /<details open/);
  const summary = html.slice(
    html.indexOf('<summary'),
    html.indexOf('</summary>'),
  );
  assert.ok(summary.includes('Penumbral lunar eclipse'));
  assert.match(summary, /dateTime="2027-02-21T07:12:00.000Z"/);
  assert.ok(summary.includes('Feb 21, 2027 at 07:12'));
  assert.doesNotMatch(summary, /<button/);
  assert.match(
    html,
    /<\/details><button[^>]*aria-label="View penumbral lunar eclipse/,
  );
  assert.ok(html.includes('The Moon is below the horizon.'));
  assert.doesNotMatch(html, /sky-event-tag/);
});

void test('all categories retain localized event names and local visibility in compact rows', () => {
  for (const locale of Object.keys(languages) as Locale[]) {
    const t = translator(locale);
    for (const [kind, label] of [
      ['solar', '日全食'],
      ['lunar', '月偏食'],
      ['opposition', '行星冲日'],
      ['transit', '行星凌日'],
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(SkyEventRow, {
          kind,
          title: t(label),
          peak: 0,
          timeLabel: '1970-01-01',
          viewLabel: t('查看'),
          visibleLabel: t('本地可见'),
          onView: () => {},
        }),
      );
      assert.ok(html.includes(`sky-event-icon-${kind}`));
      assert.ok(html.includes(t(label)));
      assert.ok(html.includes(t('本地可见')));
    }
  }
});
