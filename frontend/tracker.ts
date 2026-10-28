import { Router, toaster } from 'millennium';
import { Data, HEARTBEAT_MS, Session, asText, closeSession, closeStale, dedupe, emptyData, parseSessions, parseState, sessionKey, stateOf, toLines, withLive } from './log';
import { dayTotal, fmt, startOfDay } from './stats';

export let data: Data = emptyData();

const listeners = new Set<() => void>();
export function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

const SOURCES: Record<number, string> = { 105: 'Remote Play', 106: 'Mini mode', 200: 'Big Picture', 500: 'Tray', 804: 'Already running' };
const SOURCE_GROUPS: Record<number, string> = { 1: 'Library', 3: 'Command line', 4: 'Steam URL', 6: 'Library', 8: 'Game', 9: 'Party invite', 10: 'Library' };
const sourceName = (n: number) => SOURCES[n] ?? SOURCE_GROUPS[Math.floor(n / 100)] ?? 'Other';

const os = /win/i.test(navigator.platform) ? 'Windows' : /mac/i.test(navigator.platform) ? 'macOS' : 'Linux';
const platformOf = (appId: number) => (window.appDetailsStore?.GetAppDetails(appId)?.strCompatToolName ? 'Proton' : os);

const pendingSource = new Map<number, string>();
const running = new Map<number, Pick<Session, 'platform' | 'launchSource'>>();

let loaded = false;
let saved = 0;
let needsNewline = false;
let failing = false;
let chain = Promise.resolve(true);

const logError = (message: string) => backend.log_error(message).catch(() => {});

async function persist() {
	try {
		const end = data.sessions.length;
		if (end > saved) {
			if (!(await backend.append_log((needsNewline ? '\n' : '') + toLines(data.sessions.slice(saved, end))))) throw new Error('append failed');
			saved = end;
			needsNewline = false;
		}
		if (!(await backend.write_store('state', JSON.stringify(stateOf(data))))) throw new Error('state write failed');
		failing = false;
		return true;
	} catch (e) {
		console.error('Playtime save failed:', e);
		logError('Playtime save failed: ' + e);
		if (!failing) toaster.toast({ title: 'Playtime Dashboard', body: 'Could not save play data. Check the Millennium logs.' });
		failing = true;
		return false;
	}
}

export function save() {
	listeners.forEach((l) => l());
	if (!loaded) return Promise.resolve(false);
	return (chain = chain.then(persist));
}

function tick() {
	const now = Date.now();
	closeStale(data, now);
	for (const [appId, meta] of running) {
		if (!data.open.some((o) => o.appId === appId)) data.open.push({ appId, start: now, heartbeat: now, ...meta });
	}
	data.open.forEach((o) => (o.heartbeat = now));
	nudge(now);
	if (data.open.length || data.sessions.length > saved) save();
}

function nudge(now: number) {
	const limit = data.limitMinutes * 60_000;
	if (!limit) return;
	const day = new Date(now).toDateString();
	const sent = data.nudged[day] ?? [];
	const played = dayTotal(withLive(data, now), startOfDay(now));
	for (const pct of [80, 100]) {
		if (played < (limit * pct) / 100 || sent.includes(pct)) continue;
		sent.push(pct);
		toaster.toast({
			title: pct === 100 ? 'Daily play limit reached' : 'Nearing your daily play limit',
			body: `${fmt(played)} played today of your ${fmt(limit)} limit.`,
		});
	}
	data.nudged = { [day]: sent };
}

let filling = false;
async function fillGenres() {
	if (filling) return;
	filling = true;
	const tried = new Set<number>();
	try {
		for (;;) {
			const appId = [...data.open, ...data.sessions].find((s) => !data.genres[s.appId] && !tried.has(s.appId))?.appId;
			if (!appId) return;
			tried.add(appId);
			const genre = await backend.fetch_genre(appId).catch(() => '');
			if (genre) {
				data.genres[appId] = genre;
				save();
			}
			// shortcut: fixed pause to stay under the store API rate limit, add backoff if 429s show up in logs
			await new Promise((resolve) => setTimeout(resolve, 1500));
		}
	} finally {
		filling = false;
	}
}

function start(appId: number, launchSource: string) {
	running.set(appId, { platform: platformOf(appId), launchSource });
	tick();
	fillGenres();
}

function stop(appId: number) {
	const now = Date.now();
	running.delete(appId);
	closeStale(data, now);
	closeSession(data, appId, now);
	save();
}

async function retry<T>(call: () => Promise<T>) {
	for (let attempt = 1; ; attempt++) {
		try {
			return await call();
		} catch (e) {
			if (attempt === 30) throw e;
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}
}

async function migrateLegacy(legacy: string): Promise<Data> {
	const migrated = { ...parseState(legacy), sessions: dedupe(parseSessions(legacy)) };
	if (!(await backend.write_store('state', JSON.stringify(stateOf(migrated))))) throw new Error('migration: state write failed');
	if (!(await backend.write_store('log', toLines(migrated.sessions)))) throw new Error('migration: log write failed');
	if (!(await backend.retire_legacy())) throw new Error('migration: could not rename playtime.json');
	return migrated;
}

const readStore = (name: string) => backend.read_store(name).then(asText);

async function load(): Promise<Data> {
	const state = await retry(() => readStore('state'));
	const log = await readStore('log');
	if (!log) {
		const legacy = await readStore('legacy');
		if (legacy) return migrateLegacy(legacy);
	}
	needsNewline = log.length > 0 && !log.endsWith('\n');
	return { ...parseState(state), sessions: dedupe(parseSessions(log)) };
}

export async function startTracking() {
	try {
		data = await load();
	} catch (e) {
		toaster.toast({ title: 'Playtime tracking disabled', body: String(e) });
		logError('Playtime tracking disabled: ' + e);
		throw e;
	}
	saved = data.sessions.length;
	closeStale(data, Date.now(), 0);
	loaded = true;
	(Router.RunningApps ?? []).forEach((app) => start(Number(app.appid), 'Already running'));

	SteamClient.Apps.RegisterForGameActionStart((_id, appId, _action, source) => pendingSource.set(Number(appId), sourceName(source)));
	SteamClient.GameSessions.RegisterForAppLifetimeNotifications(({ unAppID, bRunning }) => {
		if (!unAppID) return;
		if (!bRunning) return stop(unAppID);
		start(unAppID, pendingSource.get(unAppID) ?? 'Other');
		pendingSource.delete(unAppID);
	});
	setInterval(tick, HEARTBEAT_MS);
	tick();
	fillGenres();
}

const pick = (prefs: Parameters<typeof SteamClient.System.OpenFileDialog>[0]) =>
	SteamClient.System.OpenFileDialog(prefs).then(
		(path) => (typeof path === 'string' ? path : ''),
		() => '',
	);

export async function exportData() {
	const dir = await pick({ bChooseDirectory: true, strTitle: 'Export playtime to folder' });
	if (!dir) return;
	await save();
	const path = await backend.export_log(dir, `playtime-${new Date().toISOString().slice(0, 10)}.jsonl`).catch(() => '');
	toaster.toast({ title: path ? 'Playtime exported' : 'Export failed', body: path || 'Check the Millennium logs.' });
}

const toDataUrl = (blob: Blob) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});

async function renderPng(el: HTMLElement) {
	const doc = el.ownerDocument;
	const [width, height] = [el.clientWidth, el.scrollHeight];
	const clone = el.cloneNode(true) as HTMLElement;
	clone.querySelectorAll('[data-screenshot-skip]').forEach((n) => n.remove());
	const fields = el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select');
	clone.querySelectorAll('input, select').forEach((field, i) => {
		const live = fields[i];
		if (live.tagName === 'SELECT') (field as HTMLSelectElement).options[(live as HTMLSelectElement).selectedIndex]?.setAttribute('selected', '');
		else field.setAttribute('value', live.value);
	});
	await Promise.all(
		[...clone.querySelectorAll('img')].map((img) =>
			fetch(img.src)
				.then((r) => r.blob())
				.then(toDataUrl)
				.then(
					(url) => (img.src = url),
					() => img.remove(),
				),
		),
	);
	Object.assign(clone.style, { width: `${width}px`, height: `${height}px`, overflow: 'visible', fontFamily: getComputedStyle(el).fontFamily });

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`;
	const img = doc.createElement('img');
	img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
	await img.decode();
	const scale = doc.defaultView?.devicePixelRatio ?? 1;
	const canvas = doc.createElement('canvas');
	canvas.width = width * scale;
	canvas.height = height * scale;
	const ctx = canvas.getContext('2d')!;
	ctx.scale(scale, scale);
	ctx.drawImage(img, 0, 0);
	return canvas.toDataURL('image/png').split(',')[1];
}

export async function screenshot(el: HTMLElement) {
	const dir = await pick({ bChooseDirectory: true, strTitle: 'Save dashboard screenshot to folder' });
	if (!dir) return;
	try {
		const name = `playtime-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
		const path = await backend.save_image(dir, name, await renderPng(el));
		toaster.toast({ title: path ? 'Screenshot saved' : 'Screenshot failed', body: path || 'Check the Millennium logs.' });
	} catch (e) {
		toaster.toast({ title: 'Screenshot failed', body: String(e) });
	}
}

export async function importData() {
	if (!loaded) {
		toaster.toast({ title: 'Import failed', body: 'Play data has not loaded yet.' });
		return;
	}
	const file = await pick({ strTitle: 'Import playtime', rgFilters: [{ strFileTypeName: 'Playtime export', rFilePatterns: ['*.jsonl', '*.json'], bUseAsDefault: true }] });
	if (!file) return;
	try {
		const known = new Set(data.sessions.map(sessionKey));
		const fresh = dedupe(parseSessions(asText(await backend.read_import(file)))).filter((s) => !known.has(sessionKey(s)));
		data.sessions.push(...fresh);
		const ok = await save();
		toaster.toast({ title: ok ? 'Playtime imported' : 'Import failed', body: ok ? `${fresh.length} new session${fresh.length === 1 ? '' : 's'} added.` : 'Check the Millennium logs.' });
		fillGenres();
	} catch (e) {
		toaster.toast({ title: 'Import failed', body: String(e) });
	}
}
