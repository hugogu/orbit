'use client';
import { useEffect, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { registerObservatoryTools } from '@/lib/observatory-tools';
import {
  Orbit,
  Globe2,
  Layers3,
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
  X,
} from 'lucide-react';
import SolarScene from '@/components/solar-scene';
import MoonGuide from '@/components/moon-guide';
import MoonDetails from '@/components/moon-details';
import BodyNavigation from '@/components/body-navigation';
import { bodyFromHash } from '@/lib/body-navigation';
import PhysicalFacts from '@/components/physical-facts';
import CuriosityCard from '@/components/curiosity-card';
import { pickCuriosities } from '@/lib/curiosities';
import AstronomyPanel from '@/components/astronomy-panel';
import { comets, cometPerihelion } from '@/lib/comets';
import { DAY_MS, J2000_MS, utcLabel, validTime } from '@/lib/simulation-time';
import { orbitingMoons } from '@/lib/moon-orbits';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
export default function Home() {
  const [selected, setSelected] = useState<string | null>(null),
    [paused, setPaused] = useState(false),
    [speed, setSpeed] = useState(0),
    [orbits, setOrbits] = useState(true),
    [labels, setLabels] = useState(true),
    [belts, setBelts] = useState(true),
    [scale, setScale] = useState<ScaleMode>('illustrated'),
    [view, setView] = useState(205),
    [reset, setReset] = useState(0),
    [top, setTop] = useState(false),
    [time, setTime] = useState<number | null>(null),
    [epoch, setEpoch] = useState<number | null>(null),
    [astronomy, setAstronomy] = useState(false),
    [tab, setTab] = useState('explore'),
    [cometId, setCometId] = useState('halley'),
    [cometClose, setCometClose] = useState(false),
    [region, setRegion] = useState('inner'),
    [help, setHelp] = useState(false),
    [settings, setSettings] = useState(false),
    [shadows, setShadows] = useState(true),
    [shadowGuides, setShadowGuides] = useState(true),
    [eclipseView, setEclipseView] = useState(false),
    [galaxy, setGalaxy] = useState(true),
    [realSizes, setRealSizes] = useState(false),
    [systemView, setSystemView] = useState(false),
    [textureQuality, setTextureQuality] = useState<TextureQuality>('auto'),
    [curiosityPicks, setCuriosityPicks] = useState<Record<string, number>>({}),
    [details, setDetails] = useState(false),
    [fullscreen, setFullscreen] = useState(false),
    [notice, setNotice] = useState('');
  const selectedMoon = orbitingMoons.find((m) => m.id === selected);
  const body = bodies.find(
    (b) => b.id === (selectedMoon?.parentId ?? selected),
  );
  const activeRegion = regions.find((r) => r.id === region)!;
  const activeComet = comets.find((c) => c.id === cometId)!;
  const isComet = selected === cometId;
  useEffect(() => {
    queueMicrotask(() => {
      const now = Date.now();
      setEpoch(now);
      setTime(now);
      try {
        const saved = localStorage.getItem('orbit-texture-quality');
        if (isTextureQuality(saved)) setTextureQuality(saved);
        setGalaxy(localStorage.getItem('orbit-galaxy') !== 'false');
        setRealSizes(localStorage.getItem('orbit-real-sizes') === 'true');
      } catch {
        /* Storage can be disabled in private contexts. */
      }
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
  function seekTime(ms: number, live = false) {
    setEpoch(ms);
    setTime(ms);
    setPaused(!live);
    if (live) setSpeed(0);
    if (live) setEclipseView(false);
  }
  const select = useCallback((id: string) => {
    if (window.location.hash !== `#${id}`)
      window.history.pushState(null, '', `#${id}`);
    setSystemView(false);
    setEclipseView(false);
    if (comets.some((c) => c.id === id)) {
      setTab('explore');
      setCometId(id);
      setCometClose(true);
      setSelected(id);
      setScale('distance');
      setReset((v) => v + 1);
      return;
    }
    setTab('explore');
    setSelected(id);
    setReset((v) => v + 1);
  }, []);
  const home = useCallback(() => {
    if (window.location.hash)
      window.history.pushState(
        null,
        '',
        window.location.pathname + window.location.search,
      );
    setSystemView(false);
    setEclipseView(false);
    setTab('explore');
    setSelected(null);
    setView(205);
    setReset((v) => v + 1);
    setTop(false);
    setScale('illustrated');
  }, []);
  useEffect(() => {
    const restore = () => {
      const id = bodyFromHash(window.location.hash);
      if (id) select(id);
      else home();
    };
    queueMicrotask(restore);
    window.addEventListener('hashchange', restore);
    window.addEventListener('popstate', restore);
    return () => {
      window.removeEventListener('hashchange', restore);
      window.removeEventListener('popstate', restore);
    };
  }, [select, home]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.matches('input,button,[role="slider"]') ||
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
    setScale('illustrated');
    setBelts(true);
  }
  useEffect(
    () =>
      registerObservatoryTools({
        focus: (id) => flushSync(() => select(id)),
        simulation: (i, p) =>
          flushSync(() => {
            setSpeed(i);
            setPaused(p);
          }),
      }),
    [select],
  );
  const readout = isComet ? (
    <>
      <div className="eyebrow">彗星档案 / {activeComet.en}</div>
      <h2 className="region-heading">{activeComet.name}</h2>
      <p className="description">{activeComet.description}</p>
      <div className="facts">
        <div>
          <span>模型公转周期</span>
          <strong>
            {(activeComet.period / 365.256).toLocaleString('zh-CN', {
              maximumFractionDigits: 1,
            })}{' '}
            <small>年</small>
          </strong>
        </div>
        <div>
          <span>轨道倾角</span>
          <strong>
            {activeComet.inc} <small>°</small>
          </strong>
        </div>
        <div>
          <span>模型近日点</span>
          <strong>
            {(activeComet.au * (1 - activeComet.e)).toFixed(2)}{' '}
            <small>AU</small>
          </strong>
        </div>
        <div>
          <span>模型远日点</span>
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
          {cometClose ? '查看完整轨道' : '跟随彗星观察'}{' '}
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
          跳到模型下一次近日点 <CalendarDays size={15} />
        </button>
      </div>
      <CuriosityCard
        id={activeComet.id}
        index={curiosityPicks[activeComet.id]}
        name={activeComet.name}
      />
      <p className="description">
        靠近太阳时，冰升华产生彗发与彗尾。图中的蓝色离子尾示意指向背离太阳的方向，并会随远离太阳而淡去；真实尘埃尾通常弯曲。
      </p>
      <p className="little-note">
        位置由共享日期与 JPL
        带历元轨道参数计算。固定二体轨道未计入行星摄动和喷气效应，距历元越远误差越大；不是精确回归预报。轨道按
        AU 比例显示，彗核、旋转与彗尾为示意。
      </p>
      <a
        className="source"
        href={`https://science.nasa.gov/solar-system/comets/${activeComet.source}/`}
        target="_blank"
        rel="noreferrer"
      >
        在 NASA 继续探索 <ArrowUpRight size={15} />
      </a>
      <a
        className="source"
        href="https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html"
        target="_blank"
        rel="noreferrer"
      >
        轨道参数：JPL 小天体数据库 <ArrowUpRight size={15} />
      </a>
    </>
  ) : selectedMoon ? (
    <MoonDetails
      moon={selectedMoon}
      curiosityIndex={curiosityPicks[selectedMoon.id]}
      onSelect={select}
    />
  ) : body ? (
    <>
      <div className="eyebrow">天体档案 / {body.en}</div>
      <div className="detail-heading">
        <h2>{body.name}</h2>
        <span className="type-chip">{body.type}</span>
      </div>
      <p className="description">{body.description}</p>
      <div className="facts">
        <div>
          <span>平均半径</span>
          <strong>
            {body.radius.toLocaleString()} <small>km</small>
          </strong>
        </div>
        <div>
          <span>平均日距</span>
          <strong>
            {body.au || '—'} <small>{body.au ? 'AU' : ''}</small>
          </strong>
        </div>
        <div>
          <span>公转周期</span>
          <strong>
            {body.period
              ? body.period > 1000
                ? (body.period / 365.256).toFixed(1)
                : body.period.toFixed(1)
              : '—'}{' '}
            <small>
              {body.period ? (body.period > 1000 ? '年' : '天') : ''}
            </small>
          </strong>
        </div>
        <div>
          <span>自转周期</span>
          <strong>
            {Math.abs(body.day).toFixed(2)} <small>天</small>
          </strong>
        </div>
      </div>
      <CuriosityCard
        id={body.id}
        index={curiosityPicks[body.id]}
        name={body.name}
      />
      <PhysicalFacts body={body} />
      <MoonGuide
        bodyId={body.id}
        onSelect={(id) => {
          select(id);
          setSystemView(true);
        }}
      />
      <a
        className="source"
        href={`https://science.nasa.gov/${body.source}/`}
        target="_blank"
        rel="noreferrer"
      >
        在 NASA 继续探索 <ArrowUpRight size={15} />
      </a>
    </>
  ) : (
    <>
      <div className="eyebrow">我们的宇宙坐标</div>
      <h2 className="overview-title">
        太阳系<span>THE SOLAR SYSTEM</span>
      </h2>
      <p className="description">
        一颗恒星，八颗行星，和无数等待探索的世界。
        <br />
        从这里，认识我们的宇宙家园。
      </p>
      <div className="overview-stats">
        <div>
          <strong>
            46<small> 亿年</small>
          </strong>
          <span>约形成于</span>
        </div>
        <div>
          <strong>
            8<small> 颗</small>
          </strong>
          <span>行星</span>
        </div>
      </div>
      <div className="did-you-know">
        <span>
          <Orbit size={15} /> 引力，让一切相连
        </span>
        <p>
          越靠近太阳，行星公转越快。调快时间，观察水星与海王星截然不同的节奏。
        </p>
      </div>
      <button className="primary-action" onClick={() => select('earth')}>
        从地球出发 <ArrowUpRight size={17} />
      </button>
      <div className="little-note">点击天体或选择名称，即可抵近观察。</div>
    </>
  );
  return (
    <main className="observatory">
      <SolarScene
        state={{
          speed: speeds[speed],
          paused,
          orbits,
          labels,
          belts,
          scale,
          selected,
          view,
          reset,
          top,
          cometId: isComet ? cometId : null,
          cometClose,
          epoch,
          textureQuality,
          shadows,
          shadowGuides,
          eclipseView,
          galaxy,
          realSizes,
          systemView,
        }}
        onSelect={select}
        onTime={setTime}
        onAssetStatus={setNotice}
      />
      <div className="vignette" />
      <header className="topbar">
        <button
          className="brand"
          onClick={home}
          aria-label="ORBIT 返回太阳系总览"
        >
          <Orbit strokeWidth={1.3} />
          <span>
            ORBIT<i>太阳系漫游</i>
          </span>
        </button>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(String(v));
            if (v === 'structure') goRegion(region);
            else home();
          }}
        >
          <TabsList className="view-tabs">
            <TabsTrigger value="explore">
              <Globe2 />
              自由探索
            </TabsTrigger>
            <TabsTrigger value="structure">
              <Layers3 />
              太阳系结构
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="header-actions">
          <button
            className="astronomy-button"
            onClick={() => setAstronomy(true)}
          >
            <CalendarDays size={18} />
            日期与天象
          </button>
          <span className="live">
            <i />
            {paused ? '模拟暂停' : '按日期演算'}
          </span>
          <button
            className="icon-button"
            aria-label="导航帮助"
            onClick={() => setHelp(true)}
          >
            <HelpCircle />
          </button>
          <button
            className="icon-button fullscreen"
            aria-label={fullscreen ? '退出全屏' : '进入全屏'}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
          </button>
        </div>
      </header>
      <div className="scene-caption">
        <span>交互式天文观测台</span>
        <h1>
          {tab === 'structure'
            ? '从恒星，到星际空间。'
            : '在宇宙中，找到我们。'}
        </h1>
      </div>
      <section
        className="catalog glass"
        aria-label={tab === 'explore' ? '选择天体' : '选择太阳系区域'}
      >
        <div className="catalog-title">
          {tab === 'explore' ? '天体导航' : '由内向外'}
          <span>{tab === 'explore' ? '01 — 14' : '01 — 07'}</span>
        </div>
        {tab === 'explore' ? (
          <BodyNavigation selected={selected} onSelect={select} />
        ) : (
          regions.map((r, i) => (
            <button
              key={r.id}
              className={`region-option ${region === r.id ? 'active' : ''}`}
              onClick={() => goRegion(r.id)}
            >
              <span className="body-number">0{i + 1}</span>
              <span>
                {r.name}
                <small>{r.range}</small>
              </span>
              <ChevronRight size={14} />
            </button>
          ))
        )}
        <div className="catalog-footer">
          <span className="tiny-cross">+</span>
          {tab === 'explore'
            ? '点击天体，开启近距离观察'
            : '距离单位 AU ≈ 1.496 亿公里'}
        </div>
      </section>
      <aside className="info-panel glass">
        {tab === 'structure' && !body ? (
          <>
            <div className="eyebrow">结构档案 / {activeRegion.en}</div>
            <h2 className="region-heading">{activeRegion.name}</h2>
            <div className="region-range">{activeRegion.range}</div>
            <p className="description">{activeRegion.text}</p>
            <p className="little-note">
              区域边界为示意，并非硬边界；奥尔特云为推测结构。尘埃粒子数量与密度经过艺术化处理。
            </p>
          </>
        ) : (
          readout
        )}
      </aside>
      <div className="view-tools glass">
        <button
          className="icon-button"
          aria-label="返回总览"
          title="返回总览 · R"
          onClick={home}
        >
          <LocateFixed />
        </button>
        <button
          className={`icon-button ${top ? 'active' : ''}`}
          aria-label="切换俯视角度"
          title="俯视轨道"
          onClick={() => setTop((v) => !v)}
        >
          <Layers3 />
        </button>
        <div />
        <button
          className="icon-button"
          aria-label="显示设置"
          title="显示设置"
          onClick={() => setSettings(true)}
        >
          <SlidersHorizontal />
        </button>
      </div>
      <div className="bottom-area">
        {shadows && shadowGuides && body && (
          <div className="shadow-legend" aria-label="食影图例">
            <span className="umbra-key">本影</span>
            <span className="penumbra-key">半影</span>
            <span className="antumbra-key">伪本影（环食）</span>
            <span>细线：过去 90 分钟影轴轨迹</span>
          </div>
        )}
        <div className="scene-meta">
          <span>
            <i />
            {isComet
              ? `${cometClose ? '正在跟随' : '轨道全景'} · ${activeComet.name}`
              : body
                ? `正在跟随 · ${selectedMoon?.name ?? body.name}`
                : tab === 'structure'
                  ? activeRegion.name
                  : '太阳系全景'}
          </span>
          <span>
            {realSizes
              ? scale === 'distance'
                ? '大小与距离采用同一比例'
                : '天体大小按真实比例 · 距离示意'
              : scale === 'distance'
                ? '距离按比例 · 天体已放大'
                : '演示比例 · 距离与天体大小已调整'}
          </span>
          <button className="mobile-info" onClick={() => setDetails(true)}>
            <Info size={16} />
            天体知识
          </button>
        </div>
        <section className="timeline glass" aria-label="时间控制">
          <div className="playback">
            <button
              className="play-button"
              aria-label={paused ? '开始运行' : '暂停运行'}
              onClick={() => setPaused((v) => !v)}
            >
              {paused ? (
                <Play size={20} fill="currentColor" />
              ) : (
                <Pause size={20} fill="currentColor" />
              )}
            </button>
            <div>
              <span>时间流速</span>
              <strong>{speedLabel(speeds[speed])}</strong>
            </div>
          </div>
          <div className="speed-control">
            <Slider
              aria-label="时间流速"
              min={0}
              max={speeds.length - 1}
              step={1}
              value={[speed]}
              onValueChange={(v) => setSpeed(Array.isArray(v) ? v[0] : v)}
            />
            <div className="speed-markers">
              <span>实时</span>
              <span>1 天 / 秒</span>
              <span>1 年 / 秒</span>
              <span>10 年 / 秒</span>
            </div>
          </div>
          <div className="simulation-clock">
            <span>模拟日期 · UTC</span>
            <strong>{time ? utcLabel(time).slice(0, 10) : '正在同步'}</strong>
            <small>{time ? utcLabel(time).slice(11) : '—'}</small>
          </div>
          <button
            className="now-button"
            aria-label="回到当前时间并实时运行"
            title="回到当前时间并实时运行"
            onClick={() => seekTime(Date.now(), true)}
          >
            <RotateCcw size={16} />
            现在
          </button>
        </section>
        <footer className="footer">
          <div>
            <span>拖动旋转</span>
            <b>·</b>
            <span>滚轮 / 双指缩放</span>
            <b>·</b>
            <span>W A S D 平移</span>
            <b>·</b>
            <span>空格暂停</span>
          </div>
          <button onClick={() => setHelp(true)}>
            模型说明与来源 <ArrowUpRight size={12} />
          </button>
        </footer>
      </div>
      {notice && (
        <output className="notice">
          {notice}
          <button onClick={() => setNotice('')} aria-label="关闭提示">
            <X size={16} />
          </button>
        </output>
      )}
      <AstronomyPanel
        open={astronomy}
        onOpenChange={setAstronomy}
        time={time ?? J2000_MS}
        onSeek={seekTime}
        onEclipse={(ms, kind) => {
          seekTime(ms);
          select(kind === 'solar' ? 'earth' : 'moon-moon');
          setShadows(true);
          setShadowGuides(true);
          setEclipseView(true);
          setSpeed(1);
        }}
      />
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="orbit-dialog">
          <DialogTitle>观测设置</DialogTitle>
          <DialogDescription>调整你的太空观测视图。</DialogDescription>
          <div className="setting-row">
            <label htmlFor="galaxy">银河背景</label>
            <Switch
              id="galaxy"
              checked={galaxy}
              onCheckedChange={(v) => {
                setGalaxy(v);
                try {
                  localStorage.setItem('orbit-galaxy', String(v));
                } catch {
                  /* Optional preference. */
                }
              }}
            />
          </div>
          <p className="model-note">
            低亮度银河全景，保留暗色太空背景，避免掩盖天体。
          </p>
          <div className="setting-row">
            <label htmlFor="real-sizes">天体按真实大小比例</label>
            <Switch
              id="real-sizes"
              checked={realSizes}
              onCheckedChange={(v) => {
                setRealSizes(v);
                try {
                  localStorage.setItem('orbit-real-sizes', String(v));
                } catch {
                  /* Optional preference. */
                }
              }}
            />
          </div>
          <p className="model-note">
            太阳、行星与卫星按平均半径缩放。同时开启真实距离时，卫星间距也使用同一尺度。全景中的小天体可能难以看见，请通过导航靠近。彗核、彗尾和光晕仍为示意。
          </p>
          <div className="setting-row">
            <label htmlFor="shadows">动态食影</label>
            <Switch
              id="shadows"
              checked={shadows}
              onCheckedChange={setShadows}
            />
          </div>
          <div className="setting-row">
            <label htmlFor="shadow-guides">食影轮廓与轨迹</label>
            <Switch
              id="shadow-guides"
              checked={shadowGuides}
              onCheckedChange={setShadowGuides}
              disabled={!shadows}
            />
          </div>
          <p className="model-note">
            按物理距离和半径计算表面食影；蓝色为本影边界，金色为半影，紫色为伪本影。可从“日期与天象”跳到食甚，再以
            1 分钟/秒慢放。没有遮挡时不会出现食影。
          </p>
          <div className="setting-row">
            <span id="texture-quality-label">贴图质量</span>
            <Select
              value={textureQuality}
              onValueChange={(value) => {
                if (!isTextureQuality(value)) return;
                setTextureQuality(value);
                try {
                  localStorage.setItem('orbit-texture-quality', value);
                } catch {
                  /* Optional local preference. */
                }
              }}
            >
              <SelectTrigger aria-labelledby="texture-quality-label">
                <SelectValue>
                  {textureQualityLabels[textureQuality]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(textureQualityLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="model-note">
            高清按需加载到正在跟随的天体和银河背景，切换目标会释放旧高清材质。自动模式在手机或省流量环境使用
            2K。超清更耗显存与流量。
          </p>
          <p className="model-note">
            实际最高：地球、月球、水星、火星和银河
            8K；太阳、木星、土星、金星云层 4K；天王星、海王星
            2K。冥王星及其他卫星暂无此来源贴图，仍为示意材质。
          </p>
          <div className="setting-row">
            <label htmlFor="orbits">公转轨道</label>
            <Switch id="orbits" checked={orbits} onCheckedChange={setOrbits} />
          </div>
          <div className="setting-row">
            <label htmlFor="labels">天体名称</label>
            <Switch id="labels" checked={labels} onCheckedChange={setLabels} />
          </div>
          <div className="setting-row">
            <label htmlFor="belts">小天体与外围结构</label>
            <Switch id="belts" checked={belts} onCheckedChange={setBelts} />
          </div>
          <div className="setting-row">
            <label htmlFor="scale">距离按真实比例</label>
            <Switch
              id="scale"
              checked={scale === 'distance'}
              onCheckedChange={(v) => {
                setScale(v ? 'distance' : 'illustrated');
              }}
            />
          </div>
          <p className="model-note">
            真实距离模式保留行星轨道半长轴的比例；未开启真实大小时，天体和卫星间距仍为教学示意。外围粒子层在此模式下隐藏。
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="orbit-dialog help-dialog">
          <DialogTitle>开始你的太空漫游</DialogTitle>
          <DialogDescription>
            选中一个天体，镜头会靠近并跟随它。
          </DialogDescription>
          <div className="help-grid">
            <div>
              <strong>鼠标</strong>
              <p>
                左键拖动旋转
                <br />
                滚轮缩放
                <br />
                右键拖动平移
              </p>
            </div>
            <div>
              <strong>触屏</strong>
              <p>
                单指拖动旋转
                <br />
                双指捏合缩放
                <br />
                双指拖动平移
              </p>
            </div>
            <div>
              <strong>键盘</strong>
              <p>
                WASD / 方向键平移
                <br />+ / − 缩放 · 空格暂停
                <br />R 返回总览 · Esc 解除跟随
              </p>
            </div>
          </div>
          <div className="model-explainer">
            <h3>理解模型</h3>
            <p>
              太阳、八大行星、冥王星和月球的位置由 Astronomy Engine 按 UTC
              日期计算，以固定 J2000
              黄道坐标显示几何位置，不含光行时。自转轴和本初子午线使用天文模型；地球采用地球定向转换。纹理经度未全部校准，云层纹理不代表实时天气。高速时自转会出现视觉混叠。
            </p>
            <p>
              大小与距离可分别设置；同时开启真实大小和真实距离时，两者采用统一尺度。彗核、彗尾和光晕仍为示意。月球及四颗伽利略卫星使用含摄动的模型，其余
              14 颗卫星用 JPL
              固定平均轨道近似推进，未计入进动与共振，不能作为准确星历。其他卫星的自转朝向为同步示意。未纳入全部卫星和冥王星双星质心运动；外围粒子为示意。彗星采用
              JPL 带历元的二体轨道，远离历元时误差增大。
            </p>
            <p>
              星空采用 Solar System Scope
              的银河全景贴图，位于无限远背景；未按观测地点校准为实时星图。高清源文件中的未测绘区域也可能为示意填充。
            </p>
            <p>
              动态食影按有限大小的太阳与遮挡天体计算，独立于画面中的放大比例；地月及伽利略卫星使用星历，其他卫星沿用近似轨道。轮廓表示当前影区边界，细线记录过去
              90
              分钟影轴在自转表面上的轨迹，偏食未必有中心轨迹。模型采用球形天体、均匀日面，未计入大气折射、太阳临边昏暗和月缘地形；月全食保留微弱亮度作示意，颜色不预测真实红月亮。星环及彗核不参与食影计算。
            </p>
            <p>
              知识来源：
              <a
                href="https://science.nasa.gov/solar-system/planets/"
                target="_blank"
                rel="noreferrer"
              >
                NASA 行星
              </a>{' '}
              ·{' '}
              <a
                href="https://science.nasa.gov/solar-system/kuiper-belt/facts/"
                target="_blank"
                rel="noreferrer"
              >
                柯伊伯带
              </a>{' '}
              ·{' '}
              <a
                href="https://science.nasa.gov/solar-system/oort-cloud/facts/"
                target="_blank"
                rel="noreferrer"
              >
                奥尔特云
              </a>
              。参数参考：
              <a
                href="https://ssd.jpl.nasa.gov/planets/phys_par.html"
                target="_blank"
                rel="noreferrer"
              >
                JPL 行星参数
              </a>
              、
              <a
                href="https://github.com/cosinekitty/astronomy"
                target="_blank"
                rel="noreferrer"
              >
                Astronomy Engine
              </a>
              。纹理：
              <a
                href="https://www.solarsystemscope.com/textures/"
                target="_blank"
                rel="noreferrer"
              >
                Solar System Scope
              </a>
              ，
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
              。纹理含增强色彩及未测绘区域的示意填充。
            </p>
          </div>
        </DialogContent>
      </Dialog>
      <Sheet open={details} onOpenChange={setDetails}>
        <SheetContent side="bottom" className="mobile-details">
          <SheetTitle>
            {isComet
              ? activeComet.name
              : (selectedMoon?.name ?? body?.name ?? '太阳系知识')}
          </SheetTitle>
          <SheetDescription>探索天体的特征与运行规律。</SheetDescription>
          {tab === 'structure' && !body ? (
            <>
              <h2>{activeRegion.name}</h2>
              <p>{activeRegion.text}</p>
              <span>{activeRegion.range}</span>
            </>
          ) : (
            readout
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
