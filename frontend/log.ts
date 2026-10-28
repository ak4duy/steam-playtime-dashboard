export type Session = { appId: number; start: number; end: number; platform: string; launchSource: string };
export type OpenSession = Omit<Session, 'end'> & { heartbeat: number };
export type Data = {
	sessions: Session[];
	open: OpenSession[];
	genres: Record<number, string>;
	limitMinutes: number;
	nudged: Record<string, number[]>;
};
export type State = Omit<Data, 'sessions'>;

export const HEARTBEAT_MS = 60_000;
export const STALE_MS = 3 * HEARTBEAT_MS;
export const STATE_VERSION = 2;

export const emptyData = (): Data => ({ sessions: [], open: [], genres: {}, limitMinutes: 0, nudged: {} });

export function nextMidnight(t: number) {
	const d = new Date(t);
	d.setHours(24, 0, 0, 0);
	return d.getTime();
}

export function splitAtMidnight(s: Session): Session[] {
	const parts: Session[] = [];
	let start = s.start;
	for (let mid = nextMidnight(start); mid < s.end; mid = nextMidnight(mid)) {
		parts.push({ ...s, start, end: mid });
		start = mid;
	}
	parts.push({ ...s, start });
	return parts;
}

export function closeSession(data: Data, appId: number, end: number) {
	const open = data.open.find((o) => o.appId === appId);
	if (!open) return;
	data.open = data.open.filter((o) => o !== open);
	const { heartbeat, ...s } = open;
	if (end > s.start) data.sessions.push(...splitAtMidnight({ ...s, end }));
}

export function closeStale(data: Data, now: number, maxAge = STALE_MS) {
	for (const o of data.open.filter((o) => now - o.heartbeat > maxAge)) closeSession(data, o.appId, o.heartbeat);
}

export function withLive(data: Data, now: number): Session[] {
	return [...data.sessions, ...data.open.flatMap(({ heartbeat, ...s }) => splitAtMidnight({ ...s, end: now }))];
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
const isBase = (x: any) => isObj(x) && isNum(x.appId) && x.appId > 0 && isNum(x.start) && typeof x.platform === 'string' && typeof x.launchSource === 'string';
const isSession = (x: any): x is Session => isBase(x) && isNum(x.end) && x.end > x.start;
const isOpen = (x: any): x is OpenSession => isBase(x) && isNum(x.heartbeat);

// Millennium's FFI hands back JSON-looking strings already parsed.
export const asText = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value));

export const sessionKey =(s: Session) => `${s.appId}:${s.start}`;

export const toLines = (sessions: Session[]) =>
	sessions.map(({ appId, start, end, platform, launchSource }) => JSON.stringify({ appId, start, end, platform, launchSource }) + '\n').join('');

export const stateOf = ({ sessions, ...state }: Data) => ({ v: STATE_VERSION, ...state });

export function parseState(text: string): State {
	const raw = text ? JSON.parse(text) : {};
	if (!isObj(raw)) throw new Error('State file is not an object');
	if (isNum(raw.v) && raw.v > STATE_VERSION) throw new Error(`State file is from a newer plugin version (v${raw.v})`);
	return {
		open: Array.isArray(raw.open) ? raw.open.filter(isOpen) : [],
		genres: Object.fromEntries(Object.entries(isObj(raw.genres) ? raw.genres : {}).filter(([, g]) => typeof g === 'string')),
		limitMinutes: isNum(raw.limitMinutes) && raw.limitMinutes > 0 ? Math.round(raw.limitMinutes) : 0,
		nudged: isObj(raw.nudged) ? raw.nudged : {},
	};
}

export function parseSessions(text: string): Session[] {
	try {
		const whole = JSON.parse(text);
		if (Array.isArray(whole?.sessions)) return whole.sessions.filter(isSession);
	} catch {}
	return text.split('\n').flatMap((line) => {
		try {
			const s = JSON.parse(line);
			return isSession(s) ? [s] : [];
		} catch {
			return [];
		}
	});
}

export function dedupe(sessions: Session[]): Session[] {
	const byKey = new Map<string, Session>();
	for (const s of sessions) {
		const prev = byKey.get(sessionKey(s));
		if (!prev || s.end > prev.end) byKey.set(sessionKey(s), s);
	}
	return [...byKey.values()];
}
