'use client';
import { track } from '@vercel/analytics';
import { useI18n } from '../../lib/i18n/provider';
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  type CSSProperties,
} from 'react';
import { flushSync } from 'react-dom';
import { registerObservatoryTools } from '@/lib/observatory-tools';
import {
  Orbit,
  Globe2,
  Layers3,
  FlaskConical,
  Maximize,
  Minimize,
  HelpCircle,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ArrowUpRight,
  LocateFixed,
  SlidersHorizontal,
  Info,
  CalendarDays,
  CalendarClock,
  Sparkles,
  Share2,
  X,
} from 'lucide-react';
import LanguagePicker from '../../components/language-picker';
import SolarScene, { type SceneHandle } from '@/components/solar-scene';
import MoonGuide from '@/components/moon-guide';
import MoonDetails from '@/components/moon-details';
import LunarPanel from '@/components/lunar-panel';
import MoonPhaseCard from '@/components/moon-phase-card';
import BodyNavigation from '@/components/body-navigation';
import { bodyFromHash } from '@/lib/body-navigation';
import PhysicalFacts from '@/components/physical-facts';
import SunriseSunset from '@/components/sunrise-sunset';
import CuriosityCard, { CuriositySource } from '@/components/curiosity-card';
import ConceptHint from '@/components/concept-hint';
import { pickCuriosities } from '@/lib/curiosities';
import AstronomyPanel from '@/components/astronomy-panel';
import TimeJump from '@/components/time-jump';
import EclipseProgressPanel from '@/components/eclipse-progress-panel';
import { useEclipseProgress } from '@/components/use-eclipse-progress';
import LayoutSettings from '@/components/layout-settings';
import ShareDialog from '@/components/share-dialog';
import GitHubLink from '@/components/github-link';
import {
  decodeShareView,
  hasShareView,
  withoutShareView,
  type CameraPose,
  type ShareView,
} from '@/lib/share-view';
import { comets, cometModelNote, cometPerihelion } from '@/lib/comets';
import {
  asteroids,
  asteroidModelNote,
  asteroidSurfaceNote,
} from '@/lib/asteroids';
import AsteroidDetails from '@/components/asteroid-details';
import { DAY_MS, J2000_MS, utcLabel, validTime } from '@/lib/simulation-time';
import {
  fallbackSkyLocation,
  type ChosenLocationSource,
  type ObserverLocationSource,
  type SkyLocation,
} from '@/lib/sky-events';
import { orbitingMoons } from '@/lib/moon-orbits';
import { bodyMotion } from '@/lib/body-motion';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  isTextureQuality,
  textureQualityLabels,
  type TextureQuality,
} from '@/lib/texture-quality';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SandboxPanel from '@/components/sandbox-panel';
import { createRun } from '@/lib/sandbox/run';
import { forkScenario, type SandboxScenario } from '@/lib/sandbox/scenario';
import {
  elapsedLabel,
  sandboxSpeeds,
  defaultSandboxSpeed,
} from '@/lib/sandbox/view';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  bodies,
  regions,
  speeds,
  speedLabel,
  type ScaleMode,
} from '@/lib/solar';
import {
  loadPreferences,
  savePreferences,
  type StoredPreferences,
} from '@/lib/preferences';
import { bodyDetailsPath, eventsIndexPath } from '@/lib/seo';
import {
  DEFAULT_ORBIT_LINE_WIDTH,
  MAX_ORBIT_LINE_WIDTH,
  MIN_ORBIT_LINE_WIDTH,
  ORBIT_LINE_WIDTH_STEP,
} from '@/lib/orbit-line-width';
// The slowest preset, one day per second, and the fastest stay labelled at any
// control width. The remaining stops appear only where the track is wide enough
// for them, so the class follows the preset rather than its index. The set is
// read from whichever list is live, because the sandbox offers its own.
function speedMarkerModifier(value: number, presets: readonly number[]) {
  return value === presets[0] || value === 1 || value === presets.at(-1)
    ? ''
    : ' speed-marker--optional';
}
export default function Home() {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string | null>(null),
    [paused, setPaused] = useState(false),
    [speed, setSpeed] = useState(0),
    [sandboxScenario, setSandboxScenario] = useState<SandboxScenario | null>(
      null,
    ),
    [sandboxSpeed, setSandboxSpeed] = useState(
      sandboxSpeeds.indexOf(defaultSandboxSpeed),
    ),
    [sandboxPaused, setSandboxPaused] = useState(false),
    [sandboxBaseline, setSandboxBaseline] = useState(true),
    [sandboxTrails, setSandboxTrails] = useState(true),
    [orbits, setOrbits] = useState(true),
    [orbitLineWidth, setOrbitLineWidth] = useState(DEFAULT_ORBIT_LINE_WIDTH),
    [labels, setLabels] = useState(true),
    [belts, setBelts] = useState(true),
    [scale, setScale] = useState<ScaleMode>('illustrated'),
    [view, setView] = useState(205),
    [reset, setReset] = useState(0),
    [top, setTop] = useState(false),
    [time, setTime] = useState<number | null>(null),
    [epoch, setEpoch] = useState<number | null>(null),
    [astronomy, setAstronomy] = useState(false),
    [lunar, setLunar] = useState(false),
    [timeJump, setTimeJump] = useState(false),
    [tab, setTab] = useState('explore'),
    [cometId, setCometId] = useState('halley'),
    [cometClose, setCometClose] = useState(false),
    [region, setRegion] = useState('inner'),
    [help, setHelp] = useState(false),
    [helpTab, setHelpTab] = useState('operation'),
    [settings, setSettings] = useState(false),
    [shadows, setShadows] = useState(true),
    [shadowGuides, setShadowGuides] = useState(true),
    [eclipseView, setEclipseView] = useState(false),
    [galaxy, setGalaxy] = useState(true),
    [stars, setStars] = useState(true),
    [constellations, setConstellations] = useState(true),
    [solarActivity, setSolarActivity] = useState(true),
    [cometTails, setCometTails] = useState(true),
    [realSizes, setRealSizes] = useState(false),
    [realSurface, setRealSurface] = useState(true),
    [realTerrain, setRealTerrain] = useState(true),
    [systemView, setSystemView] = useState(false),
    [textureQuality, setTextureQuality] = useState<TextureQuality>('auto'),
    [actionLabels, setActionLabels] = useState(true),
    [curiosityPicks, setCuriosityPicks] = useState<Record<string, number>>({}),
    [details, setDetails] = useState(false),
    [share, setShare] = useState(false),
    [shareView, setShareView] = useState<ShareView | null>(null),
    [cameraPose, setCameraPose] = useState<CameraPose | null>(null),
    [fullscreen, setFullscreen] = useState(false),
    [notice, setNotice] = useState(''),
    [preferencesReady, setPreferencesReady] = useState(false),
    [settingsTab, setSettingsTab] = useState('layout'),
    [observerLocation, setObserverLocation] =
      useState<SkyLocation>(fallbackSkyLocation),
    [observerLocationSource, setObserverLocationSource] =
      useState<ObserverLocationSource>('fallback');
  const scene = useRef<SceneHandle | null>(null);
  const capture = useCallback(() => scene.current?.capture() ?? null, []);
  const selectedMoon = orbitingMoons.find((m) => m.id === selected);
  const selectedAsteroid = asteroids.find((item) => item.id === selected);
  const body = bodies.find(
    (b) => b.id === (selectedMoon?.parentId ?? selected),
  );
  const activeRegion = regions.find((r) => r.id === region)!;
  const activeComet = comets.find((c) => c.id === cometId)!;
  const isComet = selected === cometId;
  // The followed body names both the status line and the compact mobile picker.
  const followed = isComet
    ? activeComet
    : (selectedAsteroid ?? selectedMoon ?? body);
  const followLabel = followed ? t(followed.name) : null;
  // Read live from the followed body's own path, so the numbers and the orbit
  // on screen can never disagree. The Sun holds the origin and reports nothing.
  // A run has left the ephemeris behind, so the catalogue's own speed and
  // longitude no longer describe what is on screen.
  const motion =
    followed && time !== null && !sandboxScenario
      ? bodyMotion(followed.id, (time - J2000_MS) / DAY_MS)
      : null;
  const motionReadout = motion
    ? t('{{speed}} km/s · 黄经 {{longitude}}°', {
        speed: motion.speed.toLocaleString(locale, {
          minimumFractionDigits: 1,
          // A slow outer moon or a comet near aphelion earns the second
          // decimal that a planet's tens of km/s would only clutter.
          maximumFractionDigits: motion.speed < 10 ? 2 : 1,
        }),
        longitude: motion.longitude.toLocaleString(locale, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
      })
    : undefined;
  const motionFrame = motion
    ? t('相对{{center}}的轨道速度与黄经，J2000 黄道坐标', {
        center: t(motion.center),
      })
    : undefined;
  // Topic views choose a distance mode without overwriting the user's layout preference.
  // One set of playback controls drives whichever clock is in charge.
  const clockSpeeds = sandboxScenario ? sandboxSpeeds : speeds;
  const clockSpeed = sandboxScenario ? sandboxSpeed : speed;
  const running = sandboxScenario ? !sandboxPaused : !paused;
  const displayScale = sandboxScenario
    ? 'distance'
    : isComet
      ? 'distance'
      : tab === 'structure'
        ? 'illustrated'
        : scale;
  useEffect(() => {
    queueMicrotask(() => {
      const now = Date.now();
      setEpoch(now);
      setTime(now);
      const preferences = loadPreferences();
      if (preferences.orbits !== undefined) setOrbits(preferences.orbits);
      if (preferences.orbitLineWidth !== undefined)
        setOrbitLineWidth(preferences.orbitLineWidth);
      if (preferences.labels !== undefined) setLabels(preferences.labels);
      if (preferences.belts !== undefined) setBelts(preferences.belts);
      if (preferences.scale !== undefined) setScale(preferences.scale);
      if (preferences.shadows !== undefined) setShadows(preferences.shadows);
      if (preferences.shadowGuides !== undefined)
        setShadowGuides(preferences.shadowGuides);
      if (preferences.galaxy !== undefined) setGalaxy(preferences.galaxy);
      if (preferences.stars !== undefined) setStars(preferences.stars);
      if (preferences.constellations !== undefined)
        setConstellations(preferences.constellations);
      if (preferences.solarActivity !== undefined)
        setSolarActivity(preferences.solarActivity);
      if (preferences.cometTails !== undefined)
        setCometTails(preferences.cometTails);
      if (preferences.realSizes !== undefined)
        setRealSizes(preferences.realSizes);
      if (preferences.realSurface !== undefined)
        setRealSurface(preferences.realSurface);
      if (preferences.realTerrain !== undefined)
        setRealTerrain(preferences.realTerrain);
      if (preferences.textureQuality !== undefined)
        setTextureQuality(preferences.textureQuality);
      if (preferences.actionLabels !== undefined)
        setActionLabels(preferences.actionLabels);
      const savedLocation = preferences.observerLocation;
      const savedSource = preferences.observerLocationSource;
      if (savedLocation && savedSource) setObserverLocation(savedLocation);
      else setObserverLocation(fallbackSkyLocation);
      if (savedLocation && savedSource) {
        setObserverLocationSource(savedSource);
      } else {
        setObserverLocationSource('fallback');
      }
      setPreferencesReady(true);
      let previous: unknown;
      try {
        previous = JSON.parse(
          localStorage.getItem('orbit-curiosities-v1') ?? 'null',
        );
      } catch {
        /* Ignore corrupt or unavailable storage. */
      }
      const picks = pickCuriosities(previous);
      setCuriosityPicks(picks);
      try {
        localStorage.setItem('orbit-curiosities-v1', JSON.stringify(picks));
      } catch {
        /* Random facts still work without persistence. */
      }
    });
  }, []);
  useEffect(() => {
    if (!preferencesReady) return;
    const preferences: StoredPreferences = {
      orbits,
      orbitLineWidth,
      labels,
      belts,
      scale,
      shadows,
      shadowGuides,
      galaxy,
      stars,
      constellations,
      solarActivity,
      cometTails,
      realSizes,
      realSurface,
      realTerrain,
      textureQuality,
      actionLabels,
    };
    if (
      observerLocationSource === 'device' ||
      observerLocationSource === 'manual'
    ) {
      preferences.observerLocation = observerLocation;
      preferences.observerLocationSource = observerLocationSource;
    }
    savePreferences(preferences);
  }, [
    preferencesReady,
    orbits,
    orbitLineWidth,
    labels,
    belts,
    scale,
    shadows,
    shadowGuides,
    galaxy,
    stars,
    constellations,
    solarActivity,
    cometTails,
    realSizes,
    realSurface,
    realTerrain,
    textureQuality,
    actionLabels,
    observerLocation,
    observerLocationSource,
  ]);
  function seekTime(ms: number, live = false) {
    setEpoch(ms);
    setTime(ms);
    setPaused(!live);
    if (live) setSpeed(0);
    if (live) setEclipseView(false);
  }
  // The share dialog works from a snapshot, so the running clock cannot move
  // the moment out from under the captured frame and its link.
  function openShare() {
    setShareView({
      time: time ?? Date.now(),
      paused,
      speedIndex: speed,
      selected,
      view,
      top,
      cometClose,
      region: tab === 'structure' && !selected ? region : null,
      camera: scene.current?.pose() ?? null,
    });
    setShare(true);
  }
  function updateObserverLocation(
    next: SkyLocation,
    source: ChosenLocationSource = 'manual',
  ) {
    setObserverLocation(next);
    setObserverLocationSource(source);
  }
  // Rebuilt whenever the scenario changes, which is how an edit or a reset
  // restarts the run: the scene reads this object every frame and advances it.
  const sandboxRun = useMemo(
    () => (sandboxScenario ? createRun(sandboxScenario) : null),
    [sandboxScenario],
  );
  // The scene advances the run on the render clock; the readouts and the
  // elapsed clock sample it a few times a second instead of re-rendering the
  // page on every frame.
  const [, setSandboxTick] = useState(0);
  useEffect(() => {
    if (!sandboxRun) return;
    const timer = setInterval(() => setSandboxTick((v) => v + 1), 250);
    return () => clearInterval(timer);
  }, [sandboxRun]);
  const enterSandbox = useCallback(() => {
    setSandboxScenario(forkScenario(time ?? Date.now()));
    setSandboxPaused(false);
    setSandboxSpeed(sandboxSpeeds.indexOf(defaultSandboxSpeed));
    // A physical run only reads correctly against true distances; the
    // illustrated layout gives every body its own invented distance. The
    // layout change needs a reframe, and a run belongs to the whole system
    // rather than to whichever body happened to be followed.
    setSystemView(false);
    setEclipseView(false);
    setCameraPose(null);
    setSelected(null);
    setView(205);
    setReset((v) => v + 1);
    track('sandbox_enter', {});
  }, [time]);
  const leaveSandbox = useCallback(() => {
    setSandboxScenario(null);
    setSelected(null);
    setReset((v) => v + 1);
    track('sandbox_leave', {});
  }, []);
  const restartSandbox = useCallback(() => {
    setSandboxScenario((current) =>
      current
        ? { ...current, bodies: current.bodies.map((b) => ({ ...b })) }
        : current,
    );
  }, []);
  const select = useCallback((id: string) => {
    if (window.location.hash !== `#${id}`)
      window.history.pushState(
        null,
        '',
        window.location.pathname +
          withoutShareView(window.location.search) +
          `#${id}`,
      );
    setSystemView(false);
    setEclipseView(false);
    setCameraPose(null);
    if (comets.some((c) => c.id === id)) {
      setTab('explore');
      setCometId(id);
      setCometClose(true);
      setSelected(id);
      setReset((v) => v + 1);
      return;
    }
    // A run keeps its own tab: picking a body out of the scene is how the
    // sandbox is steered, and it must not close the panel doing the steering.
    setTab((current) => (current === 'sandbox' ? current : 'explore'));
    setSelected(id);
    setReset((v) => v + 1);
  }, []);
  const home = useCallback(() => {
    if (window.location.hash)
      window.history.pushState(
        null,
        '',
        window.location.pathname + withoutShareView(window.location.search),
      );
    setSystemView(false);
    setEclipseView(false);
    setCameraPose(null);
    setTab('explore');
    setSelected(null);
    setView(205);
    setReset((v) => v + 1);
    setTop(false);
  }, []);
  // A share link arrives with its moment and framing in the query string, and
  // is applied after the hash has selected the body. The query stays in the
  // address bar so the link can still be reloaded, bookmarked or passed on.
  const applyShareView = useCallback((search: string, hash: string) => {
    const params = new URLSearchParams(search);
    if (!hasShareView(params)) return;
    const shared = decodeShareView(params, bodyFromHash(hash));
    setEpoch(shared.time);
    setTime(shared.time);
    setPaused(shared.paused);
    setSpeed(shared.speedIndex);
    setTop(shared.top);
    if (shared.selected) {
      if (comets.some((comet) => comet.id === shared.selected))
        setCometClose(shared.cometClose);
    } else if (shared.region) {
      setTab('structure');
      setRegion(shared.region);
      setView(regions.find((item) => item.id === shared.region)!.view);
    } else {
      setView(shared.view);
    }
    setCameraPose(shared.camera);
    setReset((value) => value + 1);
  }, []);
  useEffect(() => {
    const restore = () => {
      const id = bodyFromHash(window.location.hash);
      if (id) select(id);
      else home();
    };
    queueMicrotask(() => {
      const { search, hash } = window.location;
      restore();
      applyShareView(search, hash);
    });
    window.addEventListener('hashchange', restore);
    window.addEventListener('popstate', restore);
    return () => {
      window.removeEventListener('hashchange', restore);
      window.removeEventListener('popstate', restore);
    };
  }, [select, home, applyShareView]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.matches('input,select,button,[role="slider"]') ||
          e.target.closest('[role="dialog"]'))
      )
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPaused((v) => !v);
      }
      if (e.key.toLowerCase() === 'r') home();
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [home]);
  useEffect(() => {
    const f = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else setNotice('此浏览器不支持网页全屏，可将网站添加到主屏幕。');
    } catch {
      setNotice('暂时无法进入全屏，请在浏览器中重试。');
    }
  }
  function goRegion(id: string) {
    const r = regions.find((r) => r.id === id)!;
    setRegion(id);
    setView(r.view);
    setSelected(null);
    setReset((v) => v + 1);
  }
  useEffect(
    () =>
      registerObservatoryTools(
        {
          focus: (id) => flushSync(() => select(id)),
          simulation: (i, p) => {
            flushSync(() => {
              setSpeed(i);
              setPaused(p);
            });
            track('speed_change', {
              source: 'agent_tool',
              speed_index: i,
              days_per_second: speeds[i],
              paused: p,
            });
          },
        },
        t,
      ),
    [select, t],
  );
  const readout = isComet ? (
    <>
      <div className="eyebrow">
        {t('彗星档案 /')}
        {activeComet.en}
      </div>
      <div className="detail-heading comet-detail-heading">
        <h2>{t(activeComet.name)}</h2>
        <ConceptHint label={t(cometModelNote)} />
      </div>
      <p className="description">{t(activeComet.description)}</p>
      <div className="facts">
        <div>
          <span>{t('模型公转周期')}</span>
          <strong>
            {(activeComet.period / 365.256).toLocaleString(locale, {
              maximumFractionDigits: 1,
            })}{' '}
            <small>{t('年')}</small>
          </strong>
        </div>
        <div>
          <span>{t('轨道倾角')}</span>
          <strong>
            {activeComet.inc} <small>°</small>
          </strong>
        </div>
        <div>
          <span>{t('模型近日点')}</span>
          <strong>
            {(activeComet.au * (1 - activeComet.e)).toFixed(2)}{' '}
            <small>AU</small>
          </strong>
        </div>
        <div>
          <span>{t('模型远日点')}</span>
          <strong>
            {(activeComet.au * (1 + activeComet.e)).toFixed(2)}{' '}
            <small>AU</small>
          </strong>
        </div>
      </div>
      <div className="comet-actions">
        <button
          className="primary-action"
          onClick={() => setCometClose((v) => !v)}
        >
          {cometClose ? t('查看完整轨道') : t('跟随彗星观察')}{' '}
          <LocateFixed size={16} />
        </button>
        <button
          className="secondary-action"
          onClick={() => {
            const peri = cometPerihelion(
              activeComet,
              ((time ?? Date.now()) - J2000_MS) / DAY_MS,
            );
            if (!validTime(peri)) {
              setNotice('下一次模型近日点超出 1700—2200 年范围。');
              return;
            }
            seekTime(peri);
            setCometClose(true);
            setSpeed(3);
          }}
        >
          {t('跳到模型下一次近日点')}
          <CalendarDays size={15} />
        </button>
      </div>
      <CuriosityCard
        id={activeComet.id}
        index={curiosityPicks[activeComet.id]}
        name={t(activeComet.name)}
        showSource={false}
      />
      <p className="description">
        {t(
          '靠近太阳时，冰升华产生彗发与彗尾。蓝色离子尾近乎笔直地背向太阳，尘埃尾较宽、通常弯曲；远离太阳时，活动逐渐减弱。',
        )}
      </p>
      <a className="source" href={bodyDetailsPath(locale, activeComet.id)}>
        {t('阅读{{name}}的完整资料', { name: t(activeComet.name) })}
      </a>
      <a
        className="source"
        href={`https://science.nasa.gov/solar-system/comets/${activeComet.source}/`}
        target="_blank"
        rel="noreferrer"
      >
        {t('在 NASA 继续探索')}
        <ArrowUpRight className="external-arrow" aria-hidden="true" />
      </a>
      <a
        className="source"
        href="https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html"
        target="_blank"
        rel="noreferrer"
      >
        {t('轨道参数：JPL 小天体数据库')}
        <ArrowUpRight className="external-arrow" aria-hidden="true" />
      </a>
    </>
  ) : selectedAsteroid ? (
    <AsteroidDetails
      asteroid={selectedAsteroid}
      curiosityIndex={curiosityPicks[selectedAsteroid.id]}
    />
  ) : selectedMoon ? (
    <MoonDetails
      moon={selectedMoon}
      curiosityIndex={curiosityPicks[selectedMoon.id]}
      onSelect={select}
    />
  ) : body ? (
    <>
      <div className="eyebrow">
        {t('天体档案 /')}
        {body.en}
      </div>
      <div className="detail-heading">
        <h2>{t(body.name)}</h2>
        <span className="type-chip">{t(body.type)}</span>
      </div>
      <p className="description">{t(body.description)}</p>
      <div className="facts">
        <div>
          <span>{t('平均半径')}</span>
          <strong>
            {body.radius.toLocaleString(locale)} <small>km</small>
          </strong>
        </div>
        <div>
          <span>{t('平均日距')}</span>
          <strong>
            {body.au || '—'} <small>{body.au ? 'AU' : ''}</small>
          </strong>
        </div>
        <div>
          <span>{t('公转周期')}</span>
          <strong>
            {body.period
              ? body.period > 1000
                ? (body.period / 365.256).toFixed(1)
                : body.period.toFixed(1)
              : '—'}{' '}
            <small>
              {body.period ? (body.period > 1000 ? t('年') : t('天')) : ''}
            </small>
          </strong>
        </div>
        <div>
          <span>{t('自转周期')}</span>
          <strong>
            {Math.abs(body.day).toFixed(2)} <small>{t('天')}</small>
          </strong>
        </div>
      </div>
      {body.id === 'earth' && (
        <SunriseSunset
          time={time ?? J2000_MS}
          location={observerLocation}
          locationSource={observerLocationSource}
          onLocationChange={updateObserverLocation}
        />
      )}
      <CuriosityCard
        id={body.id}
        index={curiosityPicks[body.id]}
        name={t(body.name)}
        showSource={false}
      />
      <PhysicalFacts body={body} />
      <MoonGuide
        bodyId={body.id}
        onSelect={(id) => {
          select(id);
          setSystemView(true);
          track('planet_focus', { source: 'moon_guide', body_id: id });
        }}
      />
      <CuriositySource
        id={body.id}
        index={curiosityPicks[body.id]}
        omitSource={
          body.id === 'sun' ? 'https://science.nasa.gov/sun/facts/' : undefined
        }
      />
      <a className="source" href={bodyDetailsPath(locale, body.id)}>
        {t('阅读{{name}}的完整资料', { name: t(body.name) })}
      </a>
      <a
        className="source"
        href={`https://science.nasa.gov/${body.source}/`}
        target="_blank"
        rel="noreferrer"
      >
        {t('在 NASA 继续探索')}
        <ArrowUpRight className="external-arrow" aria-hidden="true" />
      </a>
    </>
  ) : (
    <>
      <div className="eyebrow">{t('我们的宇宙坐标')}</div>
      <h2 className="overview-title">
        {t('太阳系')}
        <span>THE SOLAR SYSTEM</span>
      </h2>
      <p className="description">
        {t('一颗恒星，八颗行星，和无数等待探索的世界。')}
        <br />
        {t('从这里，认识我们的宇宙家园。')}
      </p>
      <div className="overview-stats">
        <div>
          <strong>
            4.6<small> {t('十亿年')}</small>
          </strong>
          <span>{t('约形成于')}</span>
        </div>
        <div>
          <strong>
            8<small> {t('颗')}</small>
          </strong>
          <span>{t('行星')}</span>
        </div>
      </div>
      <div className="did-you-know">
        <span>
          <Orbit size={15} /> {t('引力，让一切相连')}
        </span>
        <p>
          {t(
            '越靠近太阳，行星公转越快。调快时间，观察水星与海王星截然不同的节奏。',
          )}
        </p>
      </div>
      <button className="primary-action" onClick={() => select('earth')}>
        {t('从地球出发')}
        <ArrowUpRight size={17} />
      </button>
      <div className="little-note">
        {t('点击天体或选择名称，即可抵近观察。')}
      </div>
    </>
  );
  const eclipse = useEclipseProgress(time);
  // The Moon's own card and the eclipse progress card share the information
  // column, so only one of them is up at a time; an eclipse in progress is the
  // more urgent of the two and already answers where the Moon is.
  const showMoonCard =
    selected === 'moon-moon' && !eclipse.event && time !== null;
  // Hiding a label must not take the name away from a screen reader, so the
  // text stays in the button and only leaves the picture.
  const actionLabel = actionLabels ? undefined : 'sr-only';
  return (
    <main
      className="observatory"
      data-eclipse-active={!!eclipse.event}
      data-moon-card={showMoonCard}
      data-action-labels={actionLabels}
    >
      <SolarScene
        state={{
          locale,
          speed: speeds[speed],
          paused,
          orbits,
          orbitLineWidth,
          labels,
          belts,
          scale: displayScale,
          selected,
          view,
          reset,
          top,
          sandbox: sandboxRun
            ? {
                run: sandboxRun,
                speed: sandboxSpeeds[sandboxSpeed],
                paused: sandboxPaused,
                baseline: sandboxBaseline,
                trails: sandboxTrails,
              }
            : null,
          cometId: isComet ? cometId : null,
          cometClose,
          epoch,
          textureQuality,
          shadows,
          shadowGuides,
          eclipseView,
          activeEclipse: eclipse.event,
          galaxy,
          stars,
          constellations,
          solarActivity,
          cometTails,
          realSizes,
          realSurface,
          realTerrain,
          systemView,
          observerLocation,
          observerLocationReady:
            observerLocationSource !== 'pending' &&
            observerLocationSource !== 'fallback',
          cameraPose,
        }}
        onSelect={select}
        onTime={setTime}
        onAssetStatus={setNotice}
        sceneRef={scene}
      />
      <div className="vignette" />
      {eclipse.event && time !== null && (
        <EclipseProgressPanel
          key={eclipse.event.id}
          event={eclipse.event}
          time={time}
          onSeek={seekTime}
          onObserve={() => {
            select(eclipse.event!.type === 'solar' ? 'earth' : 'moon-moon');
            setShadows(true);
            setShadowGuides(true);
            setEclipseView(true);
          }}
        />
      )}
      {eclipse.error && eclipseView && (
        <button className="eclipse-retry panel" onClick={eclipse.retry}>
          {t('天象进度计算失败，点击重试')}
        </button>
      )}
      <header className="topbar">
        <button
          className="brand"
          onClick={home}
          aria-label={t('ORBIT 返回太阳系总览')}
        >
          <Orbit strokeWidth={1.3} />
          <span className="follow-status">
            ORBIT<i>{t('太阳系漫游')}</i>
          </span>
        </button>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(String(v));
            if (v === 'structure') goRegion(region);
            else if (v === 'explore') home();
          }}
        >
          <TabsList className="view-tabs">
            <TabsTrigger value="explore">
              <Globe2 />
              {t('自由探索')}
            </TabsTrigger>
            <TabsTrigger value="structure">
              <Layers3 />
              {t('太阳系结构')}
            </TabsTrigger>
            <TabsTrigger value="sandbox">
              <FlaskConical />
              {t('沙盘')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="header-actions">
          <span className="live">
            <i />
            {!running
              ? t('模拟暂停')
              : sandboxRun
                ? t('沙盘演算中')
                : t('按日期演算')}
          </span>
          <button
            className="icon-button"
            aria-label={t('分享此刻所见')}
            title={
              sandboxScenario
                ? t('沙盘运行无法分享：链接只能重现真实历表。')
                : t('分享此刻所见')
            }
            disabled={!!sandboxScenario}
            onClick={openShare}
          >
            <Share2 />
          </button>
          <LanguagePicker />
          <button
            className="icon-button"
            aria-label={t('显示设置')}
            title={t('显示设置')}
            onClick={() => setSettings(true)}
          >
            <SlidersHorizontal />
          </button>
          <button
            className="icon-button"
            aria-label={t('导航帮助')}
            title={t('导航帮助')}
            onClick={() => setHelp(true)}
          >
            <HelpCircle />
          </button>
          <button
            className="icon-button fullscreen"
            aria-label={fullscreen ? t('退出全屏') : t('进入全屏')}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
          </button>
        </div>
      </header>
      <div className="scene-caption">
        <h1>{t('3D太阳系模拟器')}</h1>
        <p>
          {tab === 'structure'
            ? t('从恒星，到星际空间。')
            : t('在宇宙中，找到我们。')}
        </p>
      </div>
      <div className="side-rail rail-start">
        <section
          className={`catalog glass ${
            tab === 'explore'
              ? 'catalog-body'
              : tab === 'sandbox'
                ? 'catalog-sandbox'
                : 'catalog-regions'
          }`}
          aria-label={
            tab === 'explore'
              ? t('选择天体')
              : tab === 'sandbox'
                ? t('沙盘模式')
                : t('选择太阳系区域')
          }
        >
          <h2 className="sr-only">
            {tab === 'explore'
              ? t('天体导航')
              : tab === 'sandbox'
                ? t('沙盘模式')
                : t('太阳系结构')}
          </h2>
          <div className="catalog-title">
            {tab === 'explore'
              ? t('天体导航')
              : tab === 'sandbox'
                ? t('沙盘模式')
                : t('由内向外')}
            <span>
              {tab === 'explore'
                ? `01 — ${bodies.length + comets.length + asteroids.length}`
                : tab === 'sandbox'
                  ? t('牛顿引力')
                  : '01 — 07'}
            </span>
          </div>
          {tab === 'sandbox' ? (
            <SandboxPanel
              run={sandboxRun}
              active={!!sandboxRun}
              baseline={sandboxBaseline}
              trails={sandboxTrails}
              onEnter={enterSandbox}
              onLeave={leaveSandbox}
              onRestart={restartSandbox}
              onBaselineChange={setSandboxBaseline}
              onTrailsChange={setSandboxTrails}
            />
          ) : tab === 'explore' ? (
            <BodyNavigation
              selected={selected}
              onSelect={select}
              label={followLabel}
            />
          ) : (
            regions.map((r, i) => (
              <button
                key={r.id}
                className={`region-option ${region === r.id ? 'active' : ''}`}
                onClick={() => goRegion(r.id)}
              >
                <span className="body-number">0{i + 1}</span>
                <span>
                  {t(r.name)}
                  <small>{t(r.range)}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))
          )}
          <div className="catalog-footer">
            <span className="tiny-cross">+</span>
            {tab === 'explore'
              ? t('点击天体，开启近距离观察')
              : tab === 'sandbox'
                ? t('点质量近似 · 自转与倾角不参与受力')
                : t('距离单位 AU ≈ 1.496 亿公里')}
          </div>
        </section>
      </div>
      <div className="astronomy-actions">
        <button
          className="astronomy-button"
          aria-label={t('天象推演')}
          title={t('天象推演')}
          onClick={() => setAstronomy(true)}
        >
          <CalendarDays size={18} />
          <span className={actionLabel}>{t('天象推演')}</span>
        </button>
        <a
          className="astronomy-button"
          href={eventsIndexPath(locale)}
          title={t('天象事件')}
        >
          <Sparkles size={18} />
          <span className={actionLabel}>{t('天象事件')}</span>
        </a>
      </div>
      {showMoonCard && (
        <MoonPhaseCard
          time={time!}
          location={observerLocation}
          onOpen={() => setLunar(true)}
        />
      )}
      <aside className="info-panel glass">
        {tab === 'structure' && !body ? (
          <>
            <div className="eyebrow">
              {t('结构档案 /')}
              {activeRegion.en}
            </div>
            <div className="detail-heading region-detail-heading">
              <h2 className="region-heading">{t(activeRegion.name)}</h2>
              <ConceptHint
                label={t(
                  '区域边界为示意，并非硬边界；奥尔特云为推测结构。尘埃粒子数量与密度经过艺术化处理。',
                )}
              />
            </div>
            <div className="region-range">{t(activeRegion.range)}</div>
            <p className="description">{t(activeRegion.text)}</p>
          </>
        ) : (
          readout
        )}
      </aside>
      <div className="side-rail rail-end">
        <button
          className="mobile-info glass"
          title={t('天体百科')}
          onClick={() => setDetails(true)}
        >
          <Info size={16} />
          <span className={actionLabel}>{t('天体百科')}</span>
        </button>
        <div className="view-tools glass">
          <button
            className="icon-button"
            aria-label={t('返回总览')}
            title={t('返回总览 · R')}
            onClick={home}
          >
            <LocateFixed />
          </button>
          <button
            className={`icon-button ${top ? 'active' : ''}`}
            aria-label={t('切换俯视角度')}
            title={t('俯视轨道')}
            onClick={() => setTop((v) => !v)}
          >
            <Layers3 />
          </button>
        </div>
      </div>
      <div className="bottom-area">
        <div className="scene-meta">
          <span className="follow-status">
            <i />
            <span className="follow-name">
              {isComet
                ? t('{{v0}} · {{v1}}', {
                    v0: t(cometClose ? '正在跟随' : '轨道全景'),
                    v1: followLabel,
                  })
                : followLabel
                  ? t('正在跟随 · {{v0}}', { v0: followLabel })
                  : tab === 'structure'
                    ? t(activeRegion.name)
                    : t('太阳系全景')}
            </span>
            {motion && (
              <span className="follow-motion" title={motionFrame}>
                {motionReadout}
              </span>
            )}
          </span>
          <span className="scale-status">
            {realSizes
              ? displayScale === 'distance'
                ? t('大小与距离采用同一比例')
                : t('天体大小按真实比例 · 距离示意')
              : displayScale === 'distance'
                ? t('距离按比例 · 天体已放大')
                : t('演示比例 · 距离与天体大小已调整')}
          </span>
        </div>
        <section className="timeline glass" aria-label={t('时间控制')}>
          <div className="playback">
            <button
              className="play-button"
              aria-label={running ? t('暂停运行') : t('开始运行')}
              onClick={() =>
                sandboxRun ? setSandboxPaused((v) => !v) : setPaused((v) => !v)
              }
            >
              {running ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" />
              )}
            </button>
            <div>
              <span>{t('时间流速')}</span>
              <strong>{speedLabel(clockSpeeds[clockSpeed], t)}</strong>
            </div>
          </div>
          <div className="speed-control">
            <Slider
              aria-label={t('时间流速')}
              min={0}
              max={clockSpeeds.length - 1}
              step={1}
              value={[clockSpeed]}
              onValueChange={(v) => {
                const next = Array.isArray(v) ? v[0] : v;
                if (sandboxRun) setSandboxSpeed(next);
                else setSpeed(next);
                track('speed_change', {
                  source: 'slider',
                  speed_index: next,
                  days_per_second: clockSpeeds[next],
                });
              }}
            />
            <div className="speed-markers" aria-hidden="true">
              {clockSpeeds.map((value, index) => (
                <span
                  key={`${value}-${index}`}
                  className={`speed-marker${speedMarkerModifier(value, clockSpeeds)}`}
                  data-speed-index={index}
                  style={
                    {
                      '--speed-position': `${
                        (index / (clockSpeeds.length - 1)) * 100
                      }%`,
                    } as CSSProperties
                  }
                >
                  {speedLabel(value, t)}
                </span>
              ))}
            </div>
          </div>
          {sandboxRun ? (
            <>
              <div
                className="simulation-clock"
                aria-label={t('沙盘已运行的模拟时间')}
              >
                <span>{t('已运行')}</span>
                <strong>{elapsedLabel(sandboxRun.elapsedDays, t)}</strong>
                <small>
                  {t('自 {{date}} 分叉', {
                    date: utcLabel(sandboxScenario!.epoch).slice(0, 10),
                  })}
                </small>
              </div>
              <button
                className="now-button"
                aria-label={t('重新开始')}
                title={t('重新开始')}
                onClick={restartSandbox}
              >
                <RotateCcw size={16} />
                <span>{t('重新开始')}</span>
              </button>
            </>
          ) : (
            <>
              <div
                className="simulation-clock"
                aria-label={t('模拟日期，协调世界时 UTC')}
              >
                <span>{t('模拟日期 · UTC')}</span>
                <strong>
                  {time ? utcLabel(time).slice(0, 10) : t('正在同步')}
                </strong>
                <small>{time ? utcLabel(time).slice(11) : '—'}</small>
              </div>
              <button
                className="jump-button"
                aria-label={t('跳到指定时间')}
                title={t('跳到指定时间')}
                onClick={() => setTimeJump(true)}
              >
                <CalendarClock size={16} />
              </button>
              <button
                className="now-button"
                aria-label={t('回到当前时间并实时运行')}
                title={t('回到当前时间并实时运行')}
                onClick={() => {
                  seekTime(Date.now(), true);
                  track('time_jump', { source: 'now_button' });
                }}
              >
                <RotateCcw size={16} />
                <span>{t('现在')}</span>
              </button>
            </>
          )}
        </section>
        <footer className="footer">
          <div className="footer-hints">
            <span>{t('拖动旋转')}</span>
            <b>·</b>
            <span>{t('滚轮 / 双指缩放')}</span>
            <b>·</b>
            <span>{t('W A S D 平移')}</span>
            <b>·</b>
            <span>{t('空格暂停')}</span>
          </div>
          <div className="footer-links">
            <button onClick={() => setHelp(true)}>
              {t('模型说明与来源')}
              <ArrowUpRight size={12} />
            </button>
            <GitHubLink label={t('在 GitHub 查看源代码')} />
          </div>
        </footer>
      </div>
      {notice && (
        <output className="notice">
          {t(notice)}
          <button onClick={() => setNotice('')} aria-label={t('关闭提示')}>
            <X size={16} />
          </button>
        </output>
      )}
      {shareView && (
        <ShareDialog
          open={share}
          onOpenChange={setShare}
          view={shareView}
          capture={capture}
        />
      )}
      <TimeJump
        open={timeJump}
        onOpenChange={setTimeJump}
        time={time ?? J2000_MS}
        onSeek={seekTime}
      />
      <AstronomyPanel
        open={astronomy}
        onOpenChange={setAstronomy}
        time={time ?? J2000_MS}
        location={observerLocation}
        onEclipse={(ms, kind) => {
          seekTime(ms);
          select(kind === 'solar' ? 'earth' : 'moon-moon');
          setShadows(true);
          setShadowGuides(true);
          setEclipseView(true);
          setSpeed(1);
          track('eclipse_select', { kind });
        }}
      />
      <LunarPanel
        open={lunar}
        onOpenChange={setLunar}
        time={time ?? J2000_MS}
        location={observerLocation}
      />
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent
          closeLabel={t('Close')}
          className="orbit-dialog settings-dialog"
        >
          <DialogTitle>{t('观测设置')}</DialogTitle>
          <DialogDescription>{t('调整你的太空观测视图。')}</DialogDescription>
          <Tabs
            value={settingsTab}
            onValueChange={(value) => setSettingsTab(String(value))}
            className="settings-tabs"
          >
            <TabsList className="settings-tabs-list" aria-label={t('设置分类')}>
              <TabsTrigger value="layout">{t('布局')}</TabsTrigger>
              <TabsTrigger value="environment">{t('环境')}</TabsTrigger>
              <TabsTrigger value="phenomena">{t('天象')}</TabsTrigger>
              <TabsTrigger value="textures">{t('材质')}</TabsTrigger>
              <TabsTrigger value="layers">{t('图层')}</TabsTrigger>
            </TabsList>
            <TabsContent
              value="layout"
              className="settings-tab-panel layout-tab-panel"
            >
              <LayoutSettings
                realSizes={realSizes}
                scale={displayScale}
                distanceLocked={isComet || tab === 'structure'}
                actionLabels={actionLabels}
                onRealSizesChange={setRealSizes}
                onScaleChange={setScale}
                onActionLabelsChange={setActionLabels}
              />
            </TabsContent>
            <TabsContent value="environment" className="settings-tab-panel">
              <div className="setting-row">
                <label htmlFor="galaxy">{t('银河背景')}</label>
                <Switch
                  id="galaxy"
                  checked={galaxy}
                  onCheckedChange={setGalaxy}
                />
              </div>
              <p className="model-note">
                {t(
                  '低亮度银河全景，按银道坐标对齐到真实天区，保留暗色太空背景，避免掩盖天体。',
                )}
              </p>
              <div className="setting-row">
                <label htmlFor="stars">{t('真实星空')}</label>
                <Switch id="stars" checked={stars} onCheckedChange={setStars} />
              </div>
              <div className="setting-row">
                <label htmlFor="constellations">{t('星座连线')}</label>
                <Switch
                  id="constellations"
                  checked={constellations}
                  onCheckedChange={setConstellations}
                  disabled={!stars}
                />
              </div>
              <p className="model-note">
                {t(
                  '《耶鲁亮星星表》9,096 颗肉眼可见恒星，按 J2000 赤道坐标定位，亮度与颜色来自实测星等与 B−V 色指数，并按自行推算到当前模拟年份。星座连线为国际天文学联合会 88 星座的传统连线；打开「标签」后显示星座名称。',
                )}
              </p>
              <div className="setting-row">
                <label htmlFor="solar-activity">{t('太阳活动效果')}</label>
                <Switch
                  id="solar-activity"
                  checked={solarActivity}
                  onCheckedChange={setSolarActivity}
                />
              </div>
              <p className="model-note">
                {t(
                  '日冕、日珥与黑子跟随模拟时间；暂停时冻结。实时变化缓慢，调至「1 天 / 秒」可观察生长、消散和自转。按典型时间尺度生成的科普示意，不代表该日期实测活动。',
                )}
              </p>
            </TabsContent>
            <TabsContent value="phenomena" className="settings-tab-panel">
              <div className="setting-row">
                <label htmlFor="comet-tails">{t('彗发与彗尾')}</label>
                <Switch
                  id="comet-tails"
                  checked={cometTails}
                  onCheckedChange={setCometTails}
                />
              </div>
              <p className="model-note">
                {t(
                  '柔和彗发、蓝色离子尾与弯曲尘埃尾，随模拟时间和日距变化。形态与大小为科普示意；关闭可减少绘制开销。',
                )}
              </p>
              <div className="setting-row">
                <label htmlFor="shadows">{t('动态食影')}</label>
                <Switch
                  id="shadows"
                  checked={shadows}
                  onCheckedChange={setShadows}
                />
              </div>
              <div className="setting-row">
                <label htmlFor="shadow-guides">{t('食影轮廓与轨迹')}</label>
                <Switch
                  id="shadow-guides"
                  checked={shadowGuides}
                  onCheckedChange={setShadowGuides}
                  disabled={!shadows}
                />
              </div>
              <p className="model-note">
                {t(
                  '按物理距离和半径计算表面食影；蓝色为本影边界，金色为半影，紫色为伪本影。可从“天象推演”跳到食甚，再以 1 分钟/秒慢放。没有遮挡时不会出现食影。',
                )}
              </p>
              <div className="shadow-legend" aria-label={t('食影图例')}>
                <span className="umbra-key">{t('本影')}</span>
                <span className="penumbra-key">{t('半影')}</span>
                <span className="antumbra-key">{t('伪本影（环食）')}</span>
                <span>
                  {t('日食：完整食带与中心线；其他食影：过去 90 分钟轨迹')}
                </span>
              </div>
            </TabsContent>
            <TabsContent value="textures" className="settings-tab-panel">
              <div className="setting-row">
                <span id="texture-quality-label">{t('贴图质量')}</span>
                <Select
                  value={textureQuality}
                  onValueChange={(value) => {
                    if (isTextureQuality(value)) setTextureQuality(value);
                  }}
                >
                  <SelectTrigger aria-labelledby="texture-quality-label">
                    <SelectValue>
                      {t(textureQualityLabels[textureQuality])}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(textureQualityLabels).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {t(label)}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="setting-row">
                <label htmlFor="real-surface">{t('真实地形光照')}</label>
                <Switch
                  id="real-surface"
                  checked={realSurface}
                  onCheckedChange={setRealSurface}
                />
              </div>
              <p className="model-note">
                {t(
                  '依据真实高程呈现山脊与坑洼的精细明暗，单独开启不改变轮廓，也不计算山体投影。与几何开关可独立使用；仅为正在跟随的类地行星或月球加载。',
                )}
              </p>
              <div className="setting-row">
                <label htmlFor="real-terrain">{t('真实地形几何')}</label>
                <Switch
                  id="real-terrain"
                  checked={realTerrain}
                  onCheckedChange={setRealTerrain}
                />
              </div>
              <p className="model-note">
                {t(
                  '根据真实高程改变地表和轮廓，起伏做 6 倍视觉增强，近看更明显。仅为正在跟随的水星、金星、地球、火星或月球加载，增加内存与渲染开销。',
                )}
              </p>
              <p className="model-note">
                {t(
                  '高清按需加载到正在跟随的天体和银河背景，切换目标会释放旧高清材质。自动模式在手机或省流量环境使用 2K。超清更耗显存与流量。',
                )}
              </p>
              <p className="model-note">
                {t(
                  '地球海平面以下按海面显示；金星启用任一地形选项后显示去云地形，底色为示意。巨行星采用观测扁率和大气外观，没有固体地形。',
                )}
              </p>
              <p className="model-note">
                {t(
                  '实际最高：地球、月球、水星、火星和银河 8K；太阳、木星、土星、金星云层 4K；天王星 4K、海王星 2K；冥王星使用 2K 的 NASA/JPL 科普示意图。卫星贴图按需加载，缺少完整全球测绘的土卫二、海卫二和彗核使用明确标注的示意表面。',
                )}
              </p>
            </TabsContent>
            <TabsContent value="layers" className="settings-tab-panel">
              <div className="setting-row">
                <label htmlFor="orbits">{t('公转轨道')}</label>
                <Switch
                  id="orbits"
                  checked={orbits}
                  onCheckedChange={setOrbits}
                />
              </div>
              <div className="setting-row orbit-line-width-setting">
                <span id="orbit-line-width-label">{t('轨道线粗细')}</span>
                <Slider
                  aria-labelledby="orbit-line-width-label"
                  aria-valuetext={t('{{width}} 像素', {
                    width: orbitLineWidth,
                  })}
                  className="orbit-line-width-slider"
                  max={MAX_ORBIT_LINE_WIDTH}
                  min={MIN_ORBIT_LINE_WIDTH}
                  onValueChange={(value) =>
                    setOrbitLineWidth(
                      typeof value === 'number'
                        ? value
                        : (value[0] ?? DEFAULT_ORBIT_LINE_WIDTH),
                    )
                  }
                  step={ORBIT_LINE_WIDTH_STEP}
                  value={[orbitLineWidth]}
                />
                <output>
                  {t('{{width}} 像素', { width: orbitLineWidth })}
                </output>
              </div>
              <div className="setting-row">
                <label htmlFor="labels">{t('天体名称')}</label>
                <Switch
                  id="labels"
                  checked={labels}
                  onCheckedChange={setLabels}
                />
              </div>
              <div className="setting-row">
                <label htmlFor="belts">{t('小天体与外围结构')}</label>
                <Switch id="belts" checked={belts} onCheckedChange={setBelts} />
              </div>
            </TabsContent>
          </Tabs>
          <p className="settings-persistence">
            <span aria-hidden="true">✓</span> {t('设置会保存在此设备')}
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent
          closeLabel={t('Close')}
          className="orbit-dialog help-dialog"
        >
          <DialogTitle>{t('开始你的太空漫游')}</DialogTitle>
          <DialogDescription>
            {t('选中一个天体，镜头会靠近并跟随它。')}
          </DialogDescription>
          <Tabs
            value={helpTab}
            onValueChange={(value) => setHelpTab(String(value))}
            className="help-tabs"
          >
            <TabsList className="help-tabs-list" aria-label={t('帮助分类')}>
              <TabsTrigger value="operation">{t('操作')}</TabsTrigger>
              <TabsTrigger value="model">{t('模型')}</TabsTrigger>
              <TabsTrigger value="sources">{t('来源')}</TabsTrigger>
            </TabsList>
            <TabsContent value="operation" className="help-tab-panel">
              <div className="help-grid">
                <div>
                  <strong>{t('鼠标')}</strong>
                  <p>
                    {t('左键拖动旋转')}
                    <br />
                    {t('滚轮缩放')}
                    <br />
                    {t('右键拖动平移')}
                  </p>
                </div>
                <div>
                  <strong>{t('触屏')}</strong>
                  <p>
                    {t('单指拖动旋转')}
                    <br />
                    {t('双指捏合缩放')}
                    <br />
                    {t('双指拖动平移')}
                  </p>
                </div>
                <div>
                  <strong>{t('键盘')}</strong>
                  <p>
                    {t('WASD / 方向键平移')}
                    <br />
                    {t('+ / − 缩放 · 空格暂停')}
                    <br />
                    {t('R 返回总览 · Esc 解除跟随')}
                  </p>
                </div>
              </div>
              <div className="help-callouts">
                <p>
                  <strong>{t('天体导航')}</strong>
                  {t(
                    '在天体导航中展开卫星目录，可以单独跟随每颗卫星并阅读其介绍。使用底部控件调速或暂停。',
                  )}
                </p>
                <p>
                  <strong>{t('观测地点')}</strong>
                  {t(
                    '观测地点在地球的天体信息中设置，用于日出日落与日月食的当地可见性。',
                  )}
                </p>
              </div>
            </TabsContent>
            <TabsContent value="model" className="help-tab-panel">
              <div className="model-explainer">
                <h3>{t('理解模型')}</h3>
                <p>{t(asteroidModelNote)}</p>
                <p>{t(asteroidSurfaceNote)}</p>
                <p>
                  {t(
                    '太阳、八大行星、冥王星和月球的位置由 Astronomy Engine 按 UTC 日期计算，以固定 J2000 黄道坐标显示几何位置，不含光行时。自转轴和本初子午线使用天文模型；地球采用地球定向转换。纹理经度未全部校准，云层纹理不代表实时天气。高速时自转会出现视觉混叠。',
                  )}
                </p>
                <p>
                  {t(
                    '大小与距离可分别设置；同时开启真实大小和真实距离时，太阳、行星与卫星会使用同一物理尺度。彗核形状使用公开模型或观测约束的明确近似；彗核表面、彗尾和光晕仍为示意。月球及四颗伽利略卫星使用含摄动的模型，其余 14 颗卫星用 JPL 固定平均轨道近似推进，未计入进动与共振，不能作为准确星历。其他卫星的自转朝向为同步示意。未纳入全部卫星和冥王星双星质心运动；外围粒子为示意。彗星采用 JPL 带历元的二体轨道，远离历元时误差增大。',
                  )}
                </p>
                <p>
                  {t('按太阳上缘和标准大气折射计算')}。{' '}
                  {t(
                    '经纬度采用 WGS84（不是国内地图的偏移坐标），只在本页计算使用。时差需包含当日夏令时；当地可见性不考虑地形、建筑和实际天气。',
                  )}
                </p>
                <p>
                  {t('太阳没有固体表面，温度随层次变化，自转随纬度变化。')}{' '}
                  {t(
                    '引力数据为赤道参考值；巨行星没有可站立的固体表面。自转方向相对于太阳系通常的公转方向。轨道参数为科普近似值。',
                  )}
                </p>
                <p>
                  {t(
                    '太阳活动使用可重现的科普模型：日珥约一天形成，维持约 14–86 天后消散；黑子约 1–2 天长成，持续约 6–64 天。活动区随纬度以约 25–36 天的周期自转，内部等离子流以小时为尺度演化。所有活动与 UTC 模拟时钟同步，暂停和跳转日期同样生效。这些活动区并非历史观测或未来预报，未模拟真实太阳活动周期。 依据：',
                  )}
                  <a
                    href="https://www.nasa.gov/image-article/what-solar-prominence/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('NASA 日珥')}
                  </a>
                  、
                  <a
                    href="https://science.nasa.gov/sun/sunspots/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('NASA 黑子')}
                  </a>
                  、
                  <a
                    href="https://www.nasa.gov/image-article/solar-rotation-varies-by-latitude/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('太阳自转')}
                  </a>
                  。
                </p>
                <p>
                  {t(
                    '星空采用 Solar System Scope 的银河全景贴图，位于无限远背景；未按观测地点校准为实时星图。高清源文件中的未测绘区域也可能为示意填充。',
                  )}{' '}
                  {t(
                    '动态食影按有限大小的太阳与遮挡天体计算，独立于画面中的放大比例；地月及伽利略卫星使用星历，其他卫星沿用近似轨道。轮廓表示当前影区边界，日食显示完整食带与中心线，纯偏食显示覆盖区；其他食影保留过去 90 分钟的影轴轨迹。模型采用球形天体、均匀日面，未计入大气折射、太阳临边昏暗和月缘地形；月全食保留微弱亮度作示意，颜色不预测真实红月亮。星环及彗核不参与食影计算。',
                  )}
                </p>
              </div>
            </TabsContent>
            <TabsContent value="sources" className="help-tab-panel">
              <div className="model-explainer source-list">
                <h3>{t('知识来源：')}</h3>
                <p>
                  <a
                    href="https://science.nasa.gov/solar-system/planets/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('NASA 行星')}
                  </a>
                  {' · '}
                  <a
                    href="https://science.nasa.gov/solar-system/kuiper-belt/facts/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('柯伊伯带')}
                  </a>
                  {' · '}
                  <a
                    href="https://science.nasa.gov/solar-system/oort-cloud/facts/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('奥尔特云')}
                  </a>
                </p>
                <h3>{t('参数参考：')}</h3>
                <p>
                  <a
                    href="https://ssd.jpl.nasa.gov/planets/phys_par.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('JPL 行星参数')}
                  </a>
                  、{' '}
                  <a
                    href="https://github.com/cosinekitty/astronomy"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Astronomy Engine
                  </a>
                </p>
                <h3>{t('纹理：')}</h3>
                <p>
                  <a
                    href="https://www.solarsystemscope.com/textures/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Solar System Scope
                  </a>
                  ，{' '}
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CC BY 4.0
                  </a>
                  。{t('纹理含增强色彩及未测绘区域的示意填充。')}
                </p>
                <h3>{t('真实地形：')}</h3>
                <p>
                  <a
                    href="https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('USGS MESSENGER 水星 DEM')}
                  </a>
                  {' · '}
                  <a
                    href="https://planetarymaps.usgs.gov/mosaic/Venus_Magellan_Topography_Global_4641m_v02.tif"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('USGS Magellan 金星地形')}
                  </a>
                  {' · '}
                  <a
                    href="https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2/ETOPO2v2-2006/ETOPO2v2g/raw_binary/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('NOAA ETOPO2 全球地形')}
                  </a>
                  {' · '}
                  <a
                    href="https://pds-geosciences.wustl.edu/missions/mgs/megdr.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('NASA PDS MOLA 火星地形')}
                  </a>
                  {' · '}
                  <a
                    href="https://pgda.gsfc.nasa.gov/products/95"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('NASA Goddard LOLA 月球地形')}
                  </a>
                  。
                  {t('本地高程图仅在开启几何开关并跟随支持地形的天体时加载。')}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <Sheet open={details} onOpenChange={setDetails}>
        <SheetContent
          closeLabel={t('Close')}
          side="bottom"
          className="mobile-details"
        >
          <SheetTitle>
            {isComet
              ? t(activeComet.name)
              : t(
                  selectedAsteroid?.name ??
                    selectedMoon?.name ??
                    body?.name ??
                    '太阳系知识',
                )}
          </SheetTitle>
          <SheetDescription>{t('探索天体的特征与运行规律。')}</SheetDescription>
          {tab === 'structure' && !body ? (
            <>
              <h2>{t(activeRegion.name)}</h2>
              <p>{t(activeRegion.text)}</p>
              <span>{t(activeRegion.range)}</span>
            </>
          ) : (
            readout
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
