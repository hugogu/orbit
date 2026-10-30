import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import ts from 'typescript';
import {
  defaultLocale,
  detectLocale,
  languageUrl,
  languages,
  localePath,
  resolveLocale,
  resolveLocalePath,
  translator,
  type Locale,
} from '../lib/i18n';
import { I18nProvider } from '../lib/i18n/provider';
import { bodies, regions, speedLabel } from '../lib/solar';
import { comets, cometModelNote } from '../lib/comets';
import {
  asteroids,
  asteroidFacts,
  asteroidModelNote,
  asteroidSurfaceNote,
} from '../lib/asteroids';
import { moonSystems } from '../lib/moons';
import { constellationNames } from '../lib/constellations';
import { profileContent } from '../lib/profile-content';
import { curiosities } from '../lib/curiosities';
import { eventCategories, eventTopics } from '../lib/event-guide';
import {
  compassPoints,
  observingNotes,
  phaseNames,
  quarterNames,
} from '../lib/lunar-phase';
import CuriosityCard from '../components/curiosity-card';
import MoonDetails from '../components/moon-details';
import BodyNavigation from '../components/body-navigation';
import { starLoadFailureNotice } from '../components/star-field';
import LunarPanel from '../components/lunar-panel';
import GroundControls from '../components/ground-controls';
import ObserverLocation from '../components/observer-location';
import { orbitingMoons } from '../lib/moon-orbits';

const codes = Object.keys(languages) as Locale[];
const placeholders = (text: string) =>
  [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();
void test('observer readout identifies coordinate order and hemispheres', () => {
  const key =
    '观测点：纬度 {{latitude}}° {{northSouth}} · 经度 {{longitude}}° {{eastWest}} · UTC{{offset}}';
  const cases = [
    {
      latitude: 19.076,
      longitude: 72.8777,
      latitudeText: '19.0760° N',
      longitudeText: '72.8777° E',
    },
    {
      latitude: -33.8688,
      longitude: -151.2093,
      latitudeText: '33.8688° S',
      longitudeText: '151.2093° W',
    },
    {
      latitude: 0,
      longitude: 0,
      latitudeText: '0.0000° N',
      longitudeText: '0.0000° E',
    },
  ];
  for (const locale of codes) {
    for (const { latitude, longitude, latitudeText, longitudeText } of cases) {
      const html = renderToStaticMarkup(
        createElement(
          I18nProvider,
          { initialLocale: locale },
          createElement(ObserverLocation, {
            time: Date.UTC(2026, 9, 23),
            location: { latitude, longitude, height: 0, utcOffset: 0 },
            source: 'manual',
            onChange: () => {},
          }),
        ),
      );
      const expected = translator(locale)(key, {
        latitude: latitudeText.slice(0, -3),
        northSouth: latitudeText.slice(-1),
        longitude: longitudeText.slice(0, -3),
        eastWest: longitudeText.slice(-1),
        offset: '+00:00',
      });
      assert.ok(html.includes(expected), `${locale}: ${expected}`);
      assert.ok(html.includes(latitudeText), locale);
      assert.ok(html.includes(longitudeText), locale);
    }
  }
});
void test('Korean time and eclipse controls name their actual actions and categories', () => {
  const t = translator('ko');
  assert.match(t('请手动复制链接'), /링크.*복사/);
  assert.match(t('跳到指定时间'), /날짜.*시간.*이동/);
  assert.doesNotMatch(t('跳到指定时间'), /일식|월식/);
  assert.match(
    t('所有天体共享此时间；切换目标保留模拟进度。'),
    /천체.*시간.*대상/,
  );
  assert.match(
    t('支持 1700—2200 年。用播放条上的“现在”可随时回到实时运行。'),
    /1700.*2200.*현재.*실시간/,
  );
  assert.match(t('天象分类'), /천문 현상.*분류/);
  assert.equal(t('日食'), '일식');
  assert.equal(t('月食'), '월식');
  assert.match(t('正在计算未来天象…'), /천문 현상.*계산/);
  assert.match(
    t('正在从当前模拟时间查找接下来的食象。'),
    /시뮬레이션 시간.*일식.*월식/,
  );
  assert.match(t('本地可见'), /이 위치.*볼 수/);
  assert.match(t('全球食甚'), /전 지구.*식심/);
});
void test('Spanish body profiles keep physical property labels beside their values', () => {
  const t = translator('es');
  assert.equal(t('平均半径'), 'Radio medio');
  assert.equal(t('平均日距'), 'Distancia media al Sol');
  assert.equal(t('公转周期'), 'Período orbital');
  assert.equal(t('恒星公转周期'), 'Período orbital sidéreo');
  assert.equal(t('天'), 'd');
  assert.equal(t('恒星自转周期'), 'Período de rotación sideral');
  assert.equal(t('自转周期'), 'Período de rotación');
});
void test('Spanish body navigation names the celestial body directory', () => {
  const label = translator('es')('天体导航');
  assert.equal(label, 'Cuerpos celestes');
  const html = renderToStaticMarkup(
    createElement(
      I18nProvider,
      { initialLocale: 'es' },
      createElement(BodyNavigation, { selected: null, onSelect() {} }),
    ),
  );
  assert.match(html, /aria-label="Cuerpos celestes"/);
  assert.match(html, />Cuerpos celestes<\/span>/);
  assert.doesNotMatch(html, /Brillo solar/);
});
void test('Italian and Russian comet labels and nearby actions match their meaning', () => {
  const expected = {
    it: {
      模型公转周期: 'Periodo orbitale del modello',
      轨道倾角: 'Inclinazione orbitale',
      模型近日点: 'Distanza al perielio del modello',
      模型远日点: "Distanza all'afelio del modello",
      查看完整轨道: "Visualizza l'orbita completa",
      跟随彗星观察: 'Segui la cometa',
    },
    ru: {
      模型公转周期: 'Орбитальный период модели',
      轨道倾角: 'Орбитальное наклонение',
      模型近日点: 'Перигелийное расстояние модели',
      模型远日点: 'Афелийное расстояние модели',
      查看完整轨道: 'Посмотреть полную орбиту',
      跟随彗星观察: 'Следовать за кометой',
    },
  } as const;
  for (const locale of ['it', 'ru'] as const) {
    const t = translator(locale);
    for (const [key, value] of Object.entries(expected[locale]))
      assert.equal(t(key), value, `${locale}: ${key}`);
    assert.match(t('下一次模型近日点超出 1700—2200 年范围。'), /1700.*2200/);
    assert.match(t('跳到模型下一次近日点'), /perielio|перигелию/i);
    assert.match(
      t(
        '靠近太阳时，冰升华产生彗发与彗尾。蓝色离子尾近乎笔直地背向太阳，尘埃尾较宽、通常弯曲；远离太阳时，活动逐渐减弱。',
      ),
      /chioma|кому/i,
    );
    assert.match(
      t(
        '位置由共享日期与 JPL 带历元轨道参数计算。固定二体轨道未计入行星摄动和喷气效应，距历元越远误差越大；不是精确回归预报。哈雷和 67P 使用公开观测形状模型，恩克和海尔—波普使用观测尺寸约束的独立近似；彗核表面、旋转与彗尾仍为示意。',
      ),
      /JPL.*67P/,
    );
    assert.match(
      t(
        '彗核形状使用公开观测模型，或在缺少完整全球模型时使用观测尺寸约束的独立近似；没有可用的全球彗核反照率图，因此材质、彗发和彗尾为示意，不代表实时观测。',
      ),
      /albedo|альбедо/i,
    );
    assert.match(t('在 NASA 继续探索'), /NASA/);
    assert.match(t('轨道参数：JPL 小天体数据库'), /JPL/);
  }
});
void test('Earth seasons stay separate from the sidereal-day explanation', () => {
  const seasons = profileContent.earth.sections[1].text;
  assert.match(seasons, /地轴.*南北半球/);
  assert.match(seasons, /一月初.*北半球.*冬季/);
  assert.doesNotMatch(seasons, /恒星日|太阳日/);

  const siderealTerms: Record<Locale, RegExp> = {
    'zh-CN': /恒星日|太阳日/,
    en: /sidereal day|solar day/i,
    ja: /恒星日|太陽日/,
    ko: /항성일|태양일/,
    de: /siderisch|Sonnentag/i,
    es: /sideral|solar day|día solar/i,
    fr: /sidéral|jour solaire/i,
    it: /siderale|giorno solare/i,
    nl: /siderisch|zonnedag/i,
    pt: /sideral|dia solar/i,
    ru: /сидерическ|солнечн.*сут/i,
    tr: /yıldızıl gün|güneş günü/i,
  };
  for (const locale of codes) {
    const t = translator(locale);
    assert.doesNotMatch(t(seasons), siderealTerms[locale], locale);
    assert.notEqual(
      t('恒星日以远方恒星为参照；太阳日以太阳再次经过同一子午线为参照。'),
      '',
      locale,
    );
  }
});
void test('ground sky explains the geometric horizon and local obstructions in every language', () => {
  const note =
    '画面使用理想几何地平线，不考虑当地地形和建筑遮挡；地平线上方也不保证现场可见。星空保留教学显示，不模拟天气、光污染和大气折射。';
  for (const locale of codes) {
    const translated = translator(locale)(note);
    const html = renderToStaticMarkup(
      createElement(
        I18nProvider,
        { initialLocale: locale },
        createElement(GroundControls, {
          time: Date.UTC(2026, 9, 16),
          location: {
            latitude: 39.9,
            longitude: 116.4,
            height: 43,
            utcOffset: 8,
          },
          source: 'fallback',
          onChange: () => {},
          sensor: {
            enabled: false,
            status: '拖动查看天空',
          } as React.ComponentProps<typeof GroundControls>['sensor'],
          live: false,
        }),
      ),
    );
    assert.ok(html.includes(translated), locale);
    if (locale !== defaultLocale) assert.notEqual(translated, note, locale);
  }
  assert.match(translator('en')(note), /geometric horizon/);
  assert.match(translator('en')(note), /terrain and buildings/);
  assert.match(translator('en')(note), /does not guarantee visibility/);
});
void test('planner action names distinguish events and local times in every language', () => {
  for (const locale of codes) {
    const t = translator(locale);
    const names = [
      t('查看{{event}}，{{time}}', {
        event: t('日全食'),
        time: '2030-01-01 12:00',
      }),
      t('查看{{event}}，{{time}}', {
        event: t('{{name}}凌日', { name: t('水星') }),
        time: '2032-11-13 14:24',
      }),
    ];
    assert.notEqual(names[0], names[1], locale);
    assert.ok(names[0].includes(t('日全食')), locale);
    assert.ok(names[1].includes(t('水星')), locale);
    assert.ok(names[1].includes('2032-11-13 14:24'), locale);
    assert.notEqual(names[0], t('查看'), locale);
  }
});
void test('locale selection uses URL, saved preference, browser languages, then the default', () => {
  assert.equal(detectLocale('ja-JP', 'en', ['zh-CN']), 'ja');
  assert.equal(detectLocale('unknown', 'en-GB', ['ja-JP']), 'en');
  assert.equal(detectLocale(null, 'broken', ['zz-ZZ', 'ja-JP']), 'ja');
  assert.equal(detectLocale(null, null, ['zh-TW']), 'zh-CN');
  assert.equal(detectLocale(null, null, ['zz']), defaultLocale);
  assert.equal(resolveLocale('EN_us'), 'en');
  assert.equal(resolveLocale({}), undefined);
  assert.equal(resolveLocalePath('en-US'), 'en');
  assert.equal(resolveLocalePath('en'), undefined);
  assert.equal(localePath('ja'), 'ja-JP');
  assert.equal(
    languageUrl('https://example.test/?v=build&lang=en#moon-titan', 'ja'),
    '/?v=build&lang=ja#moon-titan',
  );
  assert.equal(
    languageUrl('https://example.test/zh-CN/bodies/sun?ref=nav#facts', 'en'),
    '/en-US/bodies/sun?ref=nav#facts',
  );
});
void test('catalogs cover all source keys and interpolation parameters, allowing language-specific plurals', () => {
  const source = languages[defaultLocale].messages;
  const pluralSuffix = /_(zero|one|two|few|many|other)$/;
  const required = Object.keys(source).filter((key) => !pluralSuffix.test(key));
  for (const locale of codes) {
    const catalog = languages[locale].messages;
    for (const key of required)
      assert.ok(Object.hasOwn(catalog, key), `${locale}: missing ${key}`);
    for (const [key, value] of Object.entries(catalog)) {
      const sourceKey = Object.hasOwn(source, key)
        ? key
        : key.replace(pluralSuffix, '');
      assert.ok(Object.hasOwn(source, sourceKey), `${locale}: unknown ${key}`);
      assert.ok(value.trim().length > 0, `${locale}: ${key}`);
      assert.deepEqual(
        placeholders(value),
        placeholders(source[sourceKey as keyof typeof source]),
        `${locale}: ${key}`,
      );
      if (locale === 'en') assert.doesNotMatch(value, /\p{Script=Han}/u, key);
    }
  }
  assert.equal(translator('en')('未登记的文案'), '未登记的文案');
  assert.equal(speedLabel(1, translator('en')), '1 day / s');
  assert.equal(speedLabel(10, translator('en')), '10 days / s');
  assert.equal(speedLabel(1, translator('ja')), '1日 / 秒');
  assert.equal(speedLabel(365, translator('en')), '1 year / s');
  assert.equal(speedLabel(3650, translator('en')), '10 years / s');
  assert.equal(speedLabel(3650, translator('ja')), '10年 / 秒');
  assert.equal(speedLabel(100, translator('en')), '100 days / s');
});
void test('all educational data and literal translation keys have catalog entries', () => {
  const source: Record<string, string> = languages[defaultLocale].messages;
  const check = (value: unknown) => {
    if (typeof value === 'string' && /\p{Script=Han}/u.test(value))
      assert.ok(Object.hasOwn(source, value), value);
    else if (Array.isArray(value)) value.forEach(check);
    else if (value && typeof value === 'object')
      Object.values(value).forEach(check);
  };
  [
    bodies,
    regions,
    comets,
    asteroids,
    // Fact labels are computed, so no data scan or literal `t()` reaches them.
    asteroids.map(asteroidFacts),
    asteroidModelNote,
    asteroidSurfaceNote,
    moonSystems,
    curiosities,
    profileContent,
    eventCategories,
    eventTopics,
    phaseNames,
    quarterNames,
    compassPoints,
    observingNotes,
    constellationNames,
  ].forEach(check);
  const scan = (directory: string) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (item.name === 'i18n' || item.name === 'ui') continue;
      const path = `${directory}/${item.name}`;
      if (item.isDirectory()) {
        scan(path);
        continue;
      }
      if (!/\.tsx?$/.test(path)) continue;
      const tree = ts.createSourceFile(
        path,
        fs.readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(tree) === 't'
        ) {
          const key = node.arguments[0];
          if (
            key &&
            ts.isStringLiteralLike(key) &&
            /\p{Script=Han}/u.test(key.text)
          )
            check(key.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
  };
  ['app', 'components'].forEach(scan);
});
void test('comet model notes and load notices are translated in every locale', () => {
  const keys = [
    cometModelNote,
    '部分彗星模型加载失败，暂用近似形状。',
    starLoadFailureNotice,
  ];
  for (const locale of codes) {
    const t = translator(locale);
    for (const key of keys) {
      const translated = t(key);
      assert.ok(translated.trim().length > 0, `${locale}: ${key}`);
      if (locale !== defaultLocale) assert.notEqual(translated, key);
      if (locale === 'en') assert.doesNotMatch(translated, /\p{Script=Han}/u);
    }
  }
});
void test('every body retains its complete sourced fact pool in each language, including numeric comparisons', () => {
  for (const locale of codes) {
    for (const [id, pool] of Object.entries(curiosities)) {
      assert.equal(
        pool.length,
        asteroids.some((item) => item.id === id) ? 6 : 30,
      );
      for (let index = 0; index < pool.length; index++) {
        const html = renderToStaticMarkup(
          createElement(
            I18nProvider,
            { initialLocale: locale },
            createElement(CuriosityCard, { id, index, name: '太阳' }),
          ),
        );
        assert.ok(html.includes(pool[index].source));
        assert.ok(html.includes(`${index + 1}/${pool.length}`));
        assert.doesNotMatch(html, /{{|undefined|NaN|Infinity/);
        if (locale === 'en')
          assert.doesNotMatch(html, /\p{Script=Han}/u, `${id}/${index}`);
      }
    }
  }
});
void test('moon profiles and their navigation use localized names and keep stable body links', () => {
  for (const locale of codes) {
    const t = translator(locale);
    const moon = orbitingMoons.find((m) => m.en === 'Titan')!;
    const markup = renderToStaticMarkup(
      createElement(
        I18nProvider,
        { initialLocale: locale },
        createElement(MoonDetails, { key: 'details', moon, onSelect() {} }),
        createElement(BodyNavigation, {
          key: 'nav',
          selected: moon.id,
          onSelect() {},
        }),
      ),
    );
    assert.ok(markup.includes(t(moon.name)));
    assert.ok(markup.includes(`href="#${moon.id}"`));
    assert.ok(
      markup.includes(
        renderToStaticMarkup(
          createElement('p', null, t(moon.description)),
        ).slice(3, -4),
      ),
    );
    if (locale === 'en') assert.doesNotMatch(markup, /\p{Script=Han}/u);
  }
});

void test('the Moon phase panel is fully translated, including its computed labels', () => {
  // Every phase name, compass point and unit in the panel comes from the
  // calculation rather than from a literal, so the rendered markup is what
  // proves they are all translated. The panel seeds itself in an effect, so the
  // markup a static render produces is the shell plus its own notes.
  for (const locale of codes) {
    const markup = renderToStaticMarkup(
      createElement(
        I18nProvider,
        { initialLocale: locale },
        createElement(LunarPanel, {
          open: true,
          onOpenChange() {},
          time: Date.parse('2026-09-20T12:00:00Z'),
          location: {
            latitude: 39.9042,
            longitude: 116.4074,
            height: 43,
            utcOffset: 8,
          },
        }),
      ),
    );
    assert.doesNotMatch(markup, /{{|undefined|NaN|Infinity/, locale);
    if (locale === 'en') assert.doesNotMatch(markup, /\p{Script=Han}/u);
  }
  // The computed vocabularies are what a literal scan cannot see, so each one
  // is checked against every catalog directly.
  for (const locale of codes) {
    const t = translator(locale);
    for (const key of [
      ...phaseNames,
      ...quarterNames,
      ...compassPoints,
      ...Object.values(observingNotes),
      '当前月相',
      '四相时刻',
      '每日月历',
      '月相与观月',
      '今晚观月窗口',
    ]) {
      // Japanese shares kanji terms with the source language, so a value equal
      // to its key is a real translation there; English is what proves the
      // vocabulary was actually carried over.
      const translated = t(key);
      assert.ok(translated.trim().length > 0, `${locale}: ${key}`);
      if (locale === 'en') {
        assert.notEqual(translated, key, key);
        assert.doesNotMatch(translated, /\p{Script=Han}/u, key);
      }
    }
  }
});

void test('the lunar calendar age heading states its unit in every locale', () => {
  const panel = fs.readFileSync(
    new URL('../components/lunar-panel.tsx', import.meta.url),
    'utf8',
  );
  assert.match(panel, /<th scope="col">\{t\('月龄（天）'\)\}<\/th>/);

  const headings: Record<Locale, string> = {
    'zh-CN': '月龄（天）',
    en: 'Age (days)',
    ja: '月齢（日）',
    nl: 'Leeftijd (dagen)',
    pt: 'Idade (dias)',
    de: 'Mondalter (Tage)',
    ko: '월령(일)',
    es: 'Edad (días)',
    fr: 'Âge (jours)',
    it: 'Età (giorni)',
    ru: 'Возраст (дни)',
    tr: 'Ay yaşı (gün)',
  };
  for (const locale of codes)
    assert.equal(translator(locale)('月龄（天）'), headings[locale], locale);
});

void test('language metadata and client components do not bundle static dictionary imports', async () => {
  const languagesSrc = fs.readFileSync(
    new URL('../lib/i18n/languages.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(languagesSrc, /\.json/);

  const profileShareSrc = fs.readFileSync(
    new URL('../components/profile-share.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(profileShareSrc, /from ['"].*\/lib\/i18n['"]/);
  assert.doesNotMatch(profileShareSrc, /translator/);

  const solarSceneSrc = fs.readFileSync(
    new URL('../components/solar-scene.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(solarSceneSrc, /from ['"].*\/lib\/i18n['"]/);
  assert.doesNotMatch(solarSceneSrc, /translator\(/);

  const { loadLocaleCatalog } = await import('../lib/i18n/loader');
  const enCatalog = await loadLocaleCatalog('en');
  assert.ok(enCatalog['太阳系']);
  const zhCatalog = await loadLocaleCatalog('zh-CN');
  assert.ok(zhCatalog['太阳系']);
});
