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
  Plus,
  Info,
  X,
  Sparkles as CometIcon,
} from 'lucide-react';
import SolarScene from '@/components/solar-scene';
import MoonGuide from '@/components/moon-guide';
import { comets } from '@/lib/comets';
import { orbitingMoons } from '@/lib/moon-orbits';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
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
    [speed, setSpeed] = useState(3),
    [orbits, setOrbits] = useState(true),
    [labels, setLabels] = useState(true),
    [belts, setBelts] = useState(true),
    [scale, setScale] = useState<ScaleMode>('illustrated'),
    [view, setView] = useState(205),
    [reset, setReset] = useState(0),
    [top, setTop] = useState(false),
    [days, setDays] = useState(0),
    [tab, setTab] = useState('explore'),
    [cometId, setCometId] = useState('halley'),
    [cometClose, setCometClose] = useState(false),
    [cometRestart, setCometRestart] = useState(0),
    [region, setRegion] = useState('inner'),
    [help, setHelp] = useState(false),
    [settings, setSettings] = useState(false),
    [details, setDetails] = useState(false),
    [fullscreen, setFullscreen] = useState(false),
    [notice, setNotice] = useState('');
  const selectedMoon = orbitingMoons.find((m) => m.id === selected);
  const body = bodies.find(
    (b) => b.id === (selectedMoon?.parentId ?? selected),
  );
  const activeRegion = regions.find((r) => r.id === region)!;
  const activeComet = comets.find((c) => c.id === cometId)!;
  const select = useCallback((id: string) => {
    if (comets.some((c) => c.id === id)) {
      setTab('comets');
      setCometId(id);
      setCometClose(true);
      setSelected(null);
      setScale('distance');
      setReset((v) => v + 1);
      return;
    }
    setTab('explore');
    setSelected(id);
    if (orbitingMoons.some((m) => m.id === id || m.parentId === id))
      setSpeed(1);
    setReset((v) => v + 1);
  }, []);
  const home = useCallback(() => {
    setTab('explore');
    setSelected(null);
    setView(205);
    setReset((v) => v + 1);
    setTop(false);
    setScale('illustrated');
  }, []);
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
  function selectComet(id: string) {
    setTab('comets');
    setCometId(id);
    setSelected(null);
    setScale('distance');
    setCometClose(true);
    setSpeed(2);
    setCometRestart((v) => v + 1);
    setReset((v) => v + 1);
    setTop(false);
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
  const readout =
    tab === 'comets' ? (
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
              setCometRestart((v) => v + 1);
              setCometClose(true);
              setSpeed(2);
              setPaused(false);
            }}
          >
            从近日点演示 <RotateCcw size={15} />
          </button>
        </div>
        <div className="did-you-know">
          <span>
            <CometIcon size={15} /> 来自深空的访客
          </span>
          <p>{activeComet.fact}</p>
        </div>
        <p className="description">
          靠近太阳时，冰升华产生彗发与彗尾。图中的蓝色离子尾示意指向背离太阳的方向，并会随远离太阳而淡去；真实尘埃尾通常弯曲。
        </p>
        <p className="little-note">
          选择时从示意近日点开始，使用底部速度控制。轨道按 AU
          比例显示，彗核与彗尾放大；固定轨道参数与方位仅用于教学，并非当前星空或回归预报。
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
        <div className="did-you-know">
          <span>
            <Plus size={14} /> 你知道吗
          </span>
          <p>{body.fact}</p>
        </div>
        {selectedMoon && (
          <div className="did-you-know">
            <span>正在跟随 · {selectedMoon.name}</span>
            <p>
              绕{body.name}公转约 {selectedMoon.period} 天。可调慢时间观察运动。
            </p>
          </div>
        )}
        <MoonGuide bodyId={body.id} selected={selected} onSelect={select} />
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
          cometId: tab === 'comets' ? cometId : null,
          cometClose,
          cometRestart,
        }}
        onSelect={select}
        onTime={setDays}
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
            else if (v === 'comets') selectComet(cometId);
            else home();
          }}
        >
          <TabsList className="view-tabs">
            <TabsTrigger value="explore">
              <Globe2 />
              自由探索
            </TabsTrigger>
            <TabsTrigger value="comets">
              <CometIcon />
              彗星
            </TabsTrigger>
            <TabsTrigger value="structure">
              <Layers3 />
              太阳系结构
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="header-actions">
          <span className="live">
            <i />
            实时演算
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
        aria-label={
          tab === 'comets'
            ? '选择彗星'
            : tab === 'explore'
              ? '选择天体'
              : '选择太阳系区域'
        }
      >
        <div className="catalog-title">
          {tab === 'comets'
            ? '深空访客'
            : tab === 'explore'
              ? '天体导航'
              : '由内向外'}
          <span>
            {tab === 'comets'
              ? '01 — 04'
              : tab === 'explore'
                ? '01 — 10'
                : '01 — 07'}
          </span>
        </div>
        {tab === 'comets'
          ? comets.map((c, i) => (
              <button
                key={c.id}
                className={`body-option ${cometId === c.id ? 'active' : ''}`}
                onClick={() => selectComet(c.id)}
              >
                <span className="body-number">0{i + 1}</span>
                <CometIcon size={18} color={c.color} />
                <span>
                  {c.name}
                  <small>{c.en.split(' / ')[0]}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))
          : tab === 'explore'
            ? bodies.map((b, i) => (
                <button
                  key={b.id}
                  className={`body-option ${body?.id === b.id ? 'active' : ''}`}
                  onClick={() => select(b.id)}
                >
                  <span className="body-number">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className="planet-dot"
                    style={{
                      background: b.color,
                      boxShadow: `0 0 12px ${b.color}25`,
                    }}
                  />
                  <span>
                    {b.name}
                    <small>{b.en}</small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))
            : regions.map((r, i) => (
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
              ))}
        <div className="catalog-footer">
          <span className="tiny-cross">+</span>
          {tab === 'comets'
            ? '选择彗星，比较回归的节奏'
            : tab === 'explore'
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
        <div className="scene-meta">
          <span>
            <i />
            {tab === 'comets'
              ? `${cometClose ? '正在跟随' : '轨道全景'} · ${activeComet.name}`
              : body
                ? `正在跟随 · ${selectedMoon?.name ?? body.name}`
                : tab === 'structure'
                  ? activeRegion.name
                  : '太阳系全景'}
          </span>
          <span>
            {scale === 'distance'
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
              max={7}
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
            <span>模拟已流逝</span>
            <strong>
              {days.toLocaleString('zh-CN', { maximumFractionDigits: 1 })}
              <small> 天</small>
            </strong>
          </div>
          <button
            className="icon-button reset-speed"
            aria-label="恢复默认速度"
            title="恢复默认速度"
            onClick={() => {
              setSpeed(3);
              setPaused(false);
            }}
          >
            <RotateCcw size={18} />
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
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="orbit-dialog">
          <DialogTitle>观测设置</DialogTitle>
          <DialogDescription>调整你的太空观测视图。</DialogDescription>
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
                home();
                setScale(v ? 'distance' : 'illustrated');
              }}
            />
          </div>
          <p className="model-note">
            真实距离模式保留轨道半长轴的比例；为保持可见，天体尺寸仍被放大。外围粒子层在此模式下隐藏。
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
              以开普勒椭圆轨道演示公转，保留近似周期、偏心率与轨道倾角；自转按近似恒星日推进。初始相位是教学布局，不代表当前真实星历。高速时自转可能发生视觉混叠，可调低流速观察。
            </p>
            <p>
              演示模式压缩轨道间距并放大天体。19
              颗代表性卫星按近似周期绕母星运行，轨道平面、间距和表面配色为示意；未纳入全部卫星，也未模拟冥王星与冥卫一相互绕质心的运动。外围结构使用独立示意尺度。它不是航天导航或天象预报工具。
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
                href="https://ssd.jpl.nasa.gov/planets/approx_pos.html"
                target="_blank"
                rel="noreferrer"
              >
                开普勒轨道
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
            {tab === 'comets'
              ? activeComet.name
              : body
                ? body.name
                : '太阳系知识'}
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
