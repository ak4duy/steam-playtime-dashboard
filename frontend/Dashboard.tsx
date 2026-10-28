import {
  FocusEvent,
  Fragment,
  KeyboardEvent,
  ReactNode,
  MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Session, withLive } from "./log";
import {
  daysAgo,
  dayTotal,
  fmt,
  isVisible,
  maxPerKey,
  rhythm,
  startOfDay,
  totals,
  usualForDay,
  wallTime,
  weekStart,
} from "./stats";
import { data, save, screenshot, subscribe } from "./tracker";

const CSS = `
.ptd { --bg: #1b2838; --deep: #171a21; --panel: #16202d; --well: #0e141b; --line: #2a3f55; --text: #c7d5e0; --muted: #8f98a0; --accent: #66c0f4; --white: #fff; --limit: #e8a33d;
  position: relative; box-sizing: border-box; height: 100%; overflow-y: auto; padding: 40px 40px 64px; color: var(--text); font-family: inherit;
  background: linear-gradient(180deg, var(--bg) 0, var(--deep) 640px); }
.ptd *, .ptd *::before { box-sizing: border-box; }
.ptd-shot { position: absolute; top: 32px; right: 40px; display: flex; padding: 8px; color: var(--muted); background: var(--well); border: 1px solid var(--line); border-radius: 3px; cursor: pointer; }
.ptd-shot:hover, .ptd-shot:focus { color: var(--white); border-color: var(--accent); outline: none; }
.ptd-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin: 0 0 8px; }
.ptd-headline { font-size: 24px; font-weight: 300; line-height: 1.4; color: var(--text); margin: 0 0 24px; max-width: 900px; }
.ptd-headline b { font-weight: 700; color: var(--white); }
.ptd-headline .ptd-time { color: var(--accent); }
.ptd-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 0 0 16px; }
.ptd-select { position: relative; display: flex; flex-direction: column; gap: 4px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); min-width: 0; }
.ptd-select button { width: 100%; padding: 8px 28px 8px 10px; font: inherit; font-size: 14px; letter-spacing: 0; text-transform: none; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); border: 1px solid var(--line); border-radius: 3px; cursor: pointer;
  background: var(--well) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238f98a0' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 10px center; }
.ptd-select button:hover, .ptd-select button:focus, .ptd-select button[aria-expanded="true"] { border-color: var(--accent); outline: none; }
.ptd-select ul { position: absolute; z-index: 3; top: 100%; left: 0; right: 0; margin: 4px 0 0; padding: 4px 0; max-height: 320px; overflow-y: auto; list-style: none; font-size: 14px; letter-spacing: 0; text-transform: none; color: var(--text); background: var(--panel); border: 1px solid var(--line); border-radius: 3px; box-shadow: 0 8px 24px rgba(0, 0, 0, .45); }
.ptd-select li { padding: 6px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
.ptd-select li.ptd-active { color: var(--white); background: var(--line); }
.ptd-select li[aria-selected="true"] { color: var(--accent); }
.ptd-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin: 0 0 16px; background: var(--panel); border-top: 2px solid var(--accent); border-radius: 0 0 4px 4px; }
.ptd-stat { padding: 16px 20px; min-width: 0; border-left: 1px solid var(--line); }
.ptd-stat:first-child { border-left: 0; }
.ptd-stat dt { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.ptd-stat dd { margin: 0; font-size: 20px; font-weight: 700; color: var(--white); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ptd-stat small { display: block; font-size: 13px; color: var(--muted); margin-top: 2px; }
.ptd-grid { display: grid; align-items: stretch; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; margin-bottom: 16px; }
.ptd-pies { display: grid; align-items: stretch; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 960px) { .ptd { padding: 24px 16px 48px; } .ptd-shot { top: 16px; right: 16px; } .ptd-grid, .ptd-pies { grid-template-columns: minmax(0, 1fr); } }
.ptd-panel { position: relative; background: var(--panel); border-radius: 4px; padding: 24px; min-width: 0; }
.ptd-tip { position: absolute; z-index: 2; pointer-events: none; padding: 10px 12px; font-size: 13px; white-space: nowrap; color: var(--text); background: rgba(14, 20, 27, .94); border: 1px solid var(--line); border-radius: 4px; box-shadow: 0 8px 24px rgba(0, 0, 0, .45); }
.ptd-tip h4 { margin: 0 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--line); font-size: 13px; font-weight: 700; color: var(--white); }
.ptd-tip ul { display: grid; gap: 6px; list-style: none; margin: 0; padding: 0; }
.ptd-tip li { display: flex; align-items: center; gap: 8px; }
.ptd-tip i { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.ptd-tip em { margin-left: auto; padding-left: 20px; font-style: normal; color: var(--white); font-variant-numeric: tabular-nums; }
.ptd-tip footer { display: flex; justify-content: space-between; gap: 20px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line); color: var(--muted); }
.ptd-tip footer b { color: var(--white); font-variant-numeric: tabular-nums; }
.ptd > .ptd-panel { margin-bottom: 16px; }
.ptd-panel h3 { font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--white); margin: 0 0 2px; }
.ptd-panel p { font-size: 13px; color: var(--muted); margin: 0 0 18px; }
.ptd-bars { display: grid; grid-template-columns: minmax(0, 200px) 1fr auto; gap: 10px 12px; align-items: center; font-size: 14px; }
.ptd-game { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--text); }
.ptd-game img { width: 20px; height: 20px; border-radius: 2px; flex: none; }
.ptd-game span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ptd-track { height: 10px; background: var(--well); border-radius: 0 4px 4px 0; }
.ptd-fill { height: 100%; min-width: 2px; background: var(--accent); border-radius: 0 4px 4px 0; }
.ptd-bars:hover .ptd-fill { opacity: .55; }
.ptd-bars .ptd-row:hover .ptd-fill { opacity: 1; }
.ptd-row { display: contents; }
.ptd-value { color: var(--muted); font-variant-numeric: tabular-nums; text-align: right; }
.ptd-empty { color: var(--muted); font-size: 14px; }
.ptd-gauge { display: block; width: 100%; max-width: 300px; margin: 0 auto; overflow: visible; }
.ptd-gauge-pct { font-size: 34px; font-weight: 700; fill: var(--white); }
.ptd-gauge-sub { font-size: 12px; fill: var(--muted); }
.ptd-gauge-legend { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px 24px; font-size: 13px; color: var(--muted); margin-top: 8px; }
.ptd-gauge-legend b { color: var(--white); font-weight: 600; }
.ptd-limit { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; font-size: 13px; color: var(--muted); }
.ptd-limit i { width: 10px; height: 3px; background: var(--limit); }
.ptd-limit input { width: 72px; padding: 6px 8px; font: inherit; font-size: 14px; color: var(--white); background: var(--well); border: 1px solid var(--line); border-radius: 3px; }
.ptd-limit input:focus { border-color: var(--accent); outline: none; }
.ptd-heat { display: grid; grid-template-columns: 40px repeat(24, minmax(0, 1fr)); gap: 3px; max-width: 980px; margin: 0 auto; font-size: 11px; color: var(--muted); }
.ptd-heat span { grid-column: span 3; }
.ptd-heat b { font-weight: 400; align-self: center; }
.ptd-cell { aspect-ratio: 1; border-radius: 2px; background: var(--well); }
.ptd-cell:hover, .ptd-cell:focus { outline: 1px solid var(--white); }
.ptd-chart g:focus, .ptd-donut circle:focus { outline: none; }
.ptd-chart g:focus > rect:first-child { stroke: var(--accent); }
.ptd-donut circle:focus { stroke-width: 26; }
.ptd-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; list-style: none; padding: 0; margin: 14px 0 0; font-size: 12px; color: var(--text); }
.ptd-legend li { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ptd-legend i { width: 10px; height: 10px; border-radius: 2px; flex: none; }
.ptd-legend em { font-style: normal; color: var(--muted); }
.ptd-heat + .ptd-legend { max-width: 980px; margin-inline: auto; }
.ptd-chart { display: block; width: 100%; height: 240px; }
.ptd-chart text { font-size: 11px; fill: var(--muted); }
.ptd-donut { display: block; width: 160px; margin: 0 auto; }
.ptd-donut circle:hover { stroke-width: 26; }
`;

const SERIES = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
];
const OTHER = "#5b6672";
const LATE_NIGHT = [0, 1, 2, 3, 4];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];
const RANGES: Record<string, [string, number]> = {
  today: ["Today", 0],
  "7d": ["Last 7 days", 6],
  "2w": ["Last 2 weeks", 13],
  "30d": ["Last 30 days", 29],
  tracked: ["All time (tracked)", Infinity],
  all: ["All time (Steam)", Infinity],
};

type Dimension = "game" | "genre" | "platform" | "launchSource";
type Filters = { range: string } & Record<Dimension, string>;
const DEFAULT_FILTERS: Filters = {
  range: "2w",
  game: "",
  genre: "",
  platform: "",
  launchSource: "",
};

const overview = (appId: number) =>
  window.appStore?.GetAppOverviewByAppID(appId);
const gameName = (s: Pick<Session, "appId">) =>
  overview(s.appId)?.display_name ?? `App ${s.appId}`;
const gameIcon = (appId: number) => {
  const app = overview(appId);
  return app ? window.appStore.GetIconURLForApp(app as any) : undefined;
};
const KEYS: Record<Dimension, (s: Session) => string> = {
  game: (s) => String(s.appId),
  genre: (s) => data.genres[s.appId] ?? "Unknown",
  platform: (s) => s.platform,
  launchSource: (s) => s.launchSource,
};
const label = (dim: Dimension, key: string) =>
  dim === "game" ? gameName({ appId: Number(key) }) : key;

function useLiveData() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const refresh = () => rerender((n) => n + 1);
    const unsubscribe = subscribe(refresh);
    const timer = setInterval(refresh, 30_000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);
  return withLive(data, Date.now());
}

function useTip() {
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    flip: boolean;
    body: ReactNode;
  } | null>(null);
  const show = (e: MouseEvent | FocusEvent, body: ReactNode) => {
    const target = e.currentTarget as Element;
    const box = target.closest(".ptd-panel")!.getBoundingClientRect();
    const own = target.getBoundingClientRect();
    const [cx, cy] =
      "clientX" in e
        ? [e.clientX, e.clientY]
        : [own.left + own.width / 2, own.top + own.height / 2];
    const x = cx - box.left;
    setTip({ x, y: cy - box.top, flip: x > box.width / 2, body });
  };
  const el = tip && (
    <div
      className="ptd-tip"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(${tip.flip ? "calc(-100% - 16px)" : "16px"}, -50%)`,
      }}
    >
      {tip.body}
    </div>
  );
  return [el, show, () => setTip(null)] as const;
}

const tipRow = (key: string, name: string, color: string, ms: number) => (
  <li key={key}>
    <i style={{ background: color }} />
    {name}
    <em>{fmt(ms)}</em>
  </li>
);

function weekLabel(w: number) {
  const start = new Date(w);
  const end = new Date(daysAgo(w, -6));
  const from = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const to = end.toLocaleDateString(
    undefined,
    start.getMonth() === end.getMonth()
      ? { day: "numeric" }
      : { month: "short", day: "numeric" },
  );
  return `${from} – ${to}`;
}

function colorsFor(all: Session[], dim: Dimension) {
  const ranked = totals(all, KEYS[dim]).map(([key]) => key);
  return (key: string) => SERIES[ranked.indexOf(key)] ?? OTHER;
}

function Headline({ today }: { today: Session[] }) {
  const games = totals(today, gameName).map(([name]) => name);
  if (!games.length)
    return <h1 className="ptd-headline">Nothing played yet today.</h1>;
  const others = games.length - 2;
  return (
    <h1 className="ptd-headline">
      Today you played <b className="ptd-time">{fmt(wallTime(today))}</b> across{" "}
      {games.slice(0, 2).map((g, i) => (
        <Fragment key={g}>
          {i > 0 && ", "}
          <b>{g}</b>
        </Fragment>
      ))}
      {others > 0 && ` (& ${others} other game${others > 1 ? "s" : ""})`} on{" "}
      <b>{totals(today, (s) => s.platform)[0]?.[0] ?? "Steam"}</b>
    </h1>
  );
}

function Dropdown({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const current = Math.max(0, options.findIndex(([key]) => key === value));
  const toggle = () => (setOpen(!open), setActive(current));
  const pick = (i: number) => (onChange(options[i][0]), setOpen(false));
  const onKeyDown = (e: KeyboardEvent) => {
    const step = ({ ArrowDown: 1, ArrowUp: -1 } as Record<string, number>)[e.key];
    if (step) {
      e.preventDefault();
      const next = Math.min(options.length - 1, Math.max(0, (open ? active : current) + step));
      open ? setActive(next) : onChange(options[next][0]);
    } else if (open && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") setOpen(false);
  };
  return (
    <div className="ptd-select">
      {title}
      <button
        type="button"
        aria-label={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      >
        {options[current]?.[1]}
      </button>
      {open && (
        <ul role="listbox">
          {options.map(([key, text], i) => (
            <li
              key={key}
              role="option"
              aria-selected={i === current}
              className={i === active ? "ptd-active" : undefined}
              ref={i === active ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterBar({
  all,
  filters,
  onChange,
}: {
  all: Session[];
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const select = (dim: Dimension, title: string) => (
    <Dropdown
      title={title}
      value={filters[dim]}
      options={[
        ["", "All"],
        ...totals(all, KEYS[dim]).map(([key]): [string, string] => [key, label(dim, key)]),
      ]}
      onChange={(v) => onChange({ ...filters, [dim]: v })}
    />
  );
  return (
    <div className="ptd-filters">
      <Dropdown
        title="Date range"
        value={filters.range}
        options={Object.entries(RANGES).map(([key, [title]]) => [key, title])}
        onChange={(v) => onChange({ ...filters, range: v })}
      />
      {select("game", "Game")}
      {select("genre", "Genre")}
      {select("platform", "Platform")}
      {select("launchSource", "Launch source")}
    </div>
  );
}

function Stat({
  label,
  value,
  top,
}: {
  label: string;
  value?: string;
  top?: [string, number];
}) {
  return (
    <div className="ptd-stat">
      <dt>{label}</dt>
      <dd title={top?.[0]}>{value ?? top?.[0] ?? "—"}</dd>
      {top && <small>{fmt(top[1])}</small>}
    </div>
  );
}

const steamLifetime = (): [string, number][] =>
  ((window.appStore as any)?.allApps ?? [])
    .filter((app: any) => app.minutes_playtime_forever > 0)
    .map((app: any): [string, number] => [
      String(app.appid),
      app.minutes_playtime_forever * 60_000,
    ])
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);

function GameDurations({
  rows,
  caption,
}: {
  rows: [string, number][];
  caption: string;
}) {
  const max = rows[0]?.[1] ?? 0;
  return (
    <section className="ptd-panel">
      <h3>Game durations</h3>
      <p>{caption}</p>
      {!rows.length && <div className="ptd-empty">No playtime on record.</div>}
      <div className="ptd-bars">
        {rows.map(([id, ms]) => {
          const name = gameName({ appId: Number(id) });
          const icon = gameIcon(Number(id));
          return (
            <div className="ptd-row" key={id} title={`${name}: ${fmt(ms)}`}>
              <div className="ptd-game">
                {icon && <img src={icon} alt="" />}
                <span>{name}</span>
              </div>
              <div className="ptd-track">
                <div
                  className="ptd-fill"
                  style={{ width: `${(ms / max) * 100}%` }}
                />
              </div>
              <div className="ptd-value">{fmt(ms)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const arcPoint = (fraction: number, r: number) => {
  const theta = Math.PI * (1 - Math.min(fraction, 1));
  return [100 + r * Math.cos(theta), 100 - r * Math.sin(theta)];
};

function TodayVsUsual({ sessions }: { sessions: Session[] }) {
  const now = Date.now();
  const today = dayTotal(sessions, startOfDay(now));
  const usual = usualForDay(sessions, now);
  const limit = data.limitMinutes * 60_000;
  const scale = usual ? 2 * usual : 2 * limit;
  const weekday = WEEKDAYS[new Date(now).getDay()];
  const length = Math.PI * 80;
  const filled = scale ? Math.min(today / scale, 1) : 0;
  const [x1, y1] = arcPoint(limit / scale, 64);
  const [x2, y2] = arcPoint(limit / scale, 96);
  return (
    <section className="ptd-panel">
      <h3>Today vs usual</h3>
      <p>Compared with your last eight {weekday}</p>
      <svg
        className="ptd-gauge"
        viewBox="0 0 200 120"
        role="img"
        aria-label={`Today ${fmt(today)}, usual ${fmt(usual)}`}
      >
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--well)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {filled > 0 && (
          <path
            d="M20 100 A80 80 0 0 1 180 100"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${filled * length} ${length}`}
          />
        )}
        {usual > 0 && (
          <line
            x1="100"
            y1="10"
            x2="100"
            y2="30"
            stroke="var(--white)"
            strokeWidth="2"
          />
        )}
        {limit > 0 && (
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--limit)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        <text className="ptd-gauge-pct" x="100" y="88" textAnchor="middle">
          {usual ? `${Math.round((today / usual) * 100)}%` : "—"}
        </text>
        <text className="ptd-gauge-sub" x="100" y="108" textAnchor="middle">
          {usual ? "of your usual" : `No past ${weekday} yet`}
        </text>
      </svg>
      <div className="ptd-gauge-legend">
        <span>
          Today <b>{fmt(today)}</b>
        </span>
        <span>
          Usual <b>{fmt(usual)}</b>
        </span>
        {limit > 0 && (
          <span>
            Limit <b>{fmt(limit)}</b>
          </span>
        )}
      </div>
      <label className="ptd-limit">
        <i />
        Daily limit
        <input
          type="number"
          min={0}
          step={15}
          placeholder="off"
          value={data.limitMinutes || ""}
          onChange={(e) => {
            data.limitMinutes = Math.max(
              0,
              Math.round(Number(e.currentTarget.value) || 0),
            );
            save();
          }}
        />
        min
      </label>
    </section>
  );
}

function PlayRhythm({ sessions }: { sessions: Session[] }) {
  const grid = rhythm(sessions);
  const max = Math.max(...grid.flat());
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [tip, showTip, hideTip] = useTip();
  const cell = (ms: number, hour: number) => {
    if (!isVisible(ms)) return undefined;
    const [r, g, b] = LATE_NIGHT.includes(hour)
      ? [144, 133, 233]
      : [102, 192, 244];
    return `rgba(${r}, ${g}, ${b}, ${0.2 + 0.8 * (ms / max)})`;
  };
  const cellTip = (day: number, hour: number, ms: number) => (
    <ul>
      {tipRow(
        "cell",
        `${DAYS[day]} ${String(hour).padStart(2, "0")}:00`,
        cell(ms, hour)!,
        ms,
      )}
    </ul>
  );
  return (
    <section className="ptd-panel">
      <h3>Play rhythm</h3>
      <p>When you play, in your local time ({zone})</p>
      <div className="ptd-heat" onMouseLeave={hideTip}>
        <b />
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
          <span key={h}>{`${h % 12 || 12}${h < 12 ? "am" : "pm"}`}</span>
        ))}
        {grid.map((hours, day) => (
          <Fragment key={day}>
            <b>{DAYS[day]}</b>
            {hours.map((ms, hour) => (
              <div
                className="ptd-cell"
                key={hour}
                style={{ background: cell(ms, hour) }}
                tabIndex={isVisible(ms) ? 0 : undefined}
                onMouseMove={(e) =>
                  isVisible(ms) ? showTip(e, cellTip(day, hour, ms)) : hideTip()
                }
                onFocus={(e) => showTip(e, cellTip(day, hour, ms))}
                onBlur={hideTip}
              />
            ))}
          </Fragment>
        ))}
      </div>
      {tip}
      <ul className="ptd-legend">
        <li>
          <i style={{ background: "rgba(102, 192, 244, .25)" }} />
          <i style={{ background: "rgba(102, 192, 244, .6)" }} />
          <i style={{ background: "rgb(102, 192, 244)" }} />
          Less → more
        </li>
        <li>
          <i style={{ background: "rgb(144, 133, 233)" }} />
          Late night (12am–5am)
        </li>
      </ul>
    </section>
  );
}

function GameTimeline({
  sessions,
  color,
}: {
  sessions: Session[];
  color: (key: string) => string;
}) {
  const now = Date.now();
  const first = sessions.length
    ? weekStart(Math.min(...sessions.map((s) => s.start)))
    : weekStart(now);
  const weeks: number[] = [];
  for (let w = weekStart(now); w >= first; w = daysAgo(w, 7)) weeks.unshift(w);
  const labelEvery = Math.ceil(weeks.length / 12);
  const games = totals(sessions, KEYS.game).map(([key]) => key);
  const shown = games.filter((key) => color(key) !== OTHER);
  const keyOf = (s: Session) =>
    shown.includes(String(s.appId)) ? String(s.appId) : "other";
  const stacks = weeks.map((w) => {
    const inWeek = sessions.filter(
      (s) => s.start >= w && s.start < daysAgo(w, -7),
    );
    return totals(inWeek, keyOf).sort((a, b) =>
      a[0] === "other"
        ? 1
        : b[0] === "other"
          ? -1
          : shown.indexOf(a[0]) - shown.indexOf(b[0]),
    );
  });
  const maxHours = Math.max(
    1,
    Math.ceil(Math.max(0, ...stacks.map((st) => sum2(st))) / 3_600_000),
  );
  const [width, setWidth] = useState(800);
  const chart = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = chart.current;
    if (!el) return undefined;
    const Observer =
      (el.ownerDocument.defaultView as (Window & typeof globalThis) | null)
        ?.ResizeObserver ?? ResizeObserver;
    const observer = new Observer(() => setWidth(el.clientWidth || 800));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [W, H, left, bottom] = [width, 240, 36, 22];
  const plotH = H - bottom - 8;
  const step = (W - left) / weeks.length;
  const y = (ms: number) => (ms / (maxHours * 3_600_000)) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(
    (f) => Math.round(f * maxHours * 10) / 10,
  );
  const [tip, showTip, hideTip] = useTip();
  const [active, setActive] = useState(-1);
  return (
    <section className="ptd-panel">
      <h3>Game timeline</h3>
      <p>Weekly playtime, stacked by game</p>
      <svg
        className="ptd-chart"
        ref={chart}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Weekly playtime by game"
        onMouseLeave={() => (hideTip(), setActive(-1))}
      >
        {ticks.map((h) => (
          <g key={h}>
            <line
              x1={left}
              x2={W}
              y1={8 + plotH - y(h * 3_600_000)}
              y2={8 + plotH - y(h * 3_600_000)}
              stroke="var(--line)"
              strokeWidth="1"
            />
            <text
              x={left - 6}
              y={12 + plotH - y(h * 3_600_000)}
              textAnchor="end"
            >{`${h}h`}</text>
          </g>
        ))}
        {stacks.map((stack, i) => {
          let base = 8 + plotH;
          const x = left + i * step + step * 0.2;
          const reveal = (e: MouseEvent | FocusEvent) => {
            setActive(i);
            if (!stack.length) return hideTip();
            showTip(
              e,
              <>
                <h4>{weekLabel(weeks[i])}</h4>
                <ul>
                  {[...stack]
                    .reverse()
                    .map(([key, ms]) =>
                      tipRow(
                        key,
                        key === "other"
                          ? "Other games"
                          : gameName({ appId: Number(key) }),
                        key === "other" ? OTHER : color(key),
                        ms,
                      ),
                    )}
                </ul>
                <footer>
                  Total <b>{fmt(sum2(stack))}</b>
                </footer>
              </>,
            );
          };
          return (
            <g
              key={weeks[i]}
              tabIndex={stack.length ? 0 : undefined}
              onMouseMove={reveal}
              onFocus={reveal}
              onBlur={() => (hideTip(), setActive(-1))}
            >
              <rect
                x={left + i * step}
                y={8}
                width={step}
                height={plotH}
                fill={active === i ? "rgba(255, 255, 255, .05)" : "transparent"}
              />
              {stack.map(([key, ms]) => {
                const h = y(ms);
                base -= h;
                return (
                  <rect
                    key={key}
                    x={x}
                    y={base}
                    width={step * 0.6}
                    height={Math.max(h - 2, 1)}
                    rx="2"
                    fill={key === "other" ? OTHER : color(key)}
                  />
                );
              })}
              {(weeks.length - 1 - i) % labelEvery === 0 && (
                <text x={x + step * 0.3} y={H - 4} textAnchor="middle">
                  {new Date(weeks[i]).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {tip}
      <ul className="ptd-legend">
        {shown.map((key) => (
          <li key={key}>
            <i style={{ background: color(key) }} />
            {gameName({ appId: Number(key) })}
          </li>
        ))}
        {games.length > shown.length && (
          <li>
            <i style={{ background: OTHER }} />
            Other games
          </li>
        )}
      </ul>
    </section>
  );
}

const sum2 = (rows: [string, number][]) =>
  rows.reduce((total, [, ms]) => total + ms, 0);

function Donut({
  title,
  rows,
  color,
}: {
  title: string;
  rows: [string, number][];
  color: (key: string) => string;
}) {
  const total = sum2(rows);
  const r = 60;
  const length = 2 * Math.PI * r;
  let offset = 0;
  const [tip, showTip, hideTip] = useTip();
  return (
    <section className="ptd-panel">
      <h3>{title}</h3>
      <p>Share of playtime</p>
      {!total && <div className="ptd-empty">No sessions in this range.</div>}
      {total > 0 && (
        <svg
          className="ptd-donut"
          viewBox="0 0 160 160"
          role="img"
          aria-label={title}
          onMouseLeave={hideTip}
        >
          <g transform="rotate(-90 80 80)">
            {rows.map(([key, ms]) => {
              const dash = (ms / total) * length;
              const gap = rows.length > 1 ? Math.min(2, dash / 2) : 0;
              const el = (
                <circle
                  key={key}
                  cx="80"
                  cy="80"
                  r={r}
                  fill="none"
                  stroke={color(key)}
                  strokeWidth="22"
                  strokeDasharray={`${dash - gap} ${length}`}
                  strokeDashoffset={-offset}
                  tabIndex={0}
                  onMouseMove={(e) =>
                    showTip(e, <ul>{tipRow(key, key, color(key), ms)}</ul>)
                  }
                  onFocus={(e) =>
                    showTip(e, <ul>{tipRow(key, key, color(key), ms)}</ul>)
                  }
                  onBlur={hideTip}
                />
              );
              offset += dash;
              return el;
            })}
          </g>
        </svg>
      )}
      {tip}
      <ul className="ptd-legend">
        {rows.map(([key, ms]) => (
          <li key={key}>
            <i style={{ background: color(key) }} />
            {key} <em>{Math.round((ms / total) * 100)}%</em>
          </li>
        ))}
      </ul>
    </section>
  );
}

function foldOther(
  rows: [string, number][],
  color: (key: string) => string,
): [string, number][] {
  const kept = rows.filter(([key]) => color(key) !== OTHER);
  const rest = sum2(rows) - sum2(kept);
  return rest > 0 ? [...kept, ["All others", rest]] : kept;
}

export function Dashboard() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const all = useLiveData();
  const now = Date.now();
  const today = all.filter((s) => s.start >= startOfDay(now));
  const days = RANGES[filters.range][1];
  const from = days === Infinity ? 0 : daysAgo(now, days);
  const dims = Object.keys(KEYS) as Dimension[];
  const range = all.filter(
    (s) =>
      s.start >= from &&
      dims.every((dim) => !filters[dim] || KEYS[dim](s) === filters[dim]),
  );
  const useSteamTotals =
    filters.range === "all" && !filters.platform && !filters.launchSource;
  const logged = totals(range, KEYS.game);
  const steamRows = useSteamTotals
    ? steamLifetime().filter(([id]) =>
        (["game", "genre"] as const).every(
          (dim) =>
            !filters[dim] ||
            KEYS[dim]({ appId: Number(id) } as Session) === filters[dim],
        ),
      )
    : [];
  const gameRows = maxPerKey(steamRows, logged);
  const topGame = gameRows[0];
  const colors = Object.fromEntries(
    dims.map((dim) => [dim, colorsFor(all, dim)]),
  ) as Record<Dimension, (key: string) => string>;
  const page = useRef<HTMLDivElement>(null);

  return (
    <div className="ptd" ref={page}>
      <style>{CSS}</style>
      <button
        className="ptd-shot"
        title="Save screenshot"
        aria-label="Save screenshot"
        data-screenshot-skip
        onClick={() => page.current && screenshot(page.current)}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      </button>
      <div className="ptd-eyebrow">Playtime · {RANGES[filters.range][0]}</div>
      <Headline today={today} />
      <FilterBar all={all} filters={filters} onChange={setFilters} />
      <dl className="ptd-stats">
        <Stat
          label="Total time"
          value={fmt(useSteamTotals ? sum2(gameRows) : wallTime(range))}
        />
        <Stat
          label="Top game"
          top={topGame && [gameName({ appId: Number(topGame[0]) }), topGame[1]]}
        />
        <Stat label="Top genre" top={totals(range, KEYS.genre)[0]} />
        <Stat label="Top platform" top={totals(range, KEYS.platform)[0]} />
        <Stat
          label="Top launch source"
          top={totals(range, KEYS.launchSource)[0]}
        />
      </dl>
      <div className="ptd-grid">
        <GameDurations
          rows={gameRows.slice(0, 10)}
          caption={
            useSteamTotals
              ? "Top games by Steam playtime, including time before the plugin was installed"
              : "Top games in the filtered range"
          }
        />
        <TodayVsUsual sessions={all} />
      </div>
      <PlayRhythm sessions={range} />
      <GameTimeline sessions={range} color={colors.game} />
      <div className="ptd-pies">
        <Donut
          title="Genres"
          rows={foldOther(totals(range, KEYS.genre), colors.genre)}
          color={colors.genre}
        />
        <Donut
          title="Launch source"
          rows={foldOther(
            totals(range, KEYS.launchSource),
            colors.launchSource,
          )}
          color={colors.launchSource}
        />
        <Donut
          title="Platform"
          rows={foldOther(totals(range, KEYS.platform), colors.platform)}
          color={colors.platform}
        />
      </div>
    </div>
  );
}
