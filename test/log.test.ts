import { expect, test } from 'bun:test';
import { STATE_VERSION, asText, closeStale, dedupe, emptyData, parseSessions, parseState, splitAtMidnight, toLines } from '../frontend/log';

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();
const base = { appId: 10, platform: 'Linux', launchSource: 'Library' };

test('splits a session across each local midnight', () => {
	const parts = splitAtMidnight({ ...base, start: at(1, 22), end: at(3, 1, 30) });
	expect(parts.map((p) => [p.start, p.end])).toEqual([
		[at(1, 22), at(2, 0)],
		[at(2, 0), at(3, 0)],
		[at(3, 0), at(3, 1, 30)],
	]);
});

test('closes a stale open session at its last heartbeat, split at midnight', () => {
	const data = emptyData();
	data.open.push({ ...base, start: at(1, 23), heartbeat: at(2, 0, 40) });
	data.open.push({ ...base, appId: 20, start: at(2, 9), heartbeat: at(2, 9, 59) });
	closeStale(data, at(2, 10));
	expect(data.open.map((o) => o.appId)).toEqual([20]);
	expect(data.sessions.map((s) => [s.start, s.end])).toEqual([
		[at(1, 23), at(2, 0)],
		[at(2, 0), at(2, 0, 40)],
	]);
});

test('round-trips sessions through JSONL and skips corrupt lines', () => {
	const a = { ...base, start: at(1, 10), end: at(1, 11) };
	const b = { ...base, appId: 20, start: at(1, 12), end: at(1, 13) };
	const text = toLines([a]) + '{"appId":10,"sta' + '\n' + toLines([b]) + '{"appId":30,"start":5,"end":1}\n';
	expect(parseSessions(text)).toEqual([a, b]);
});

test('reads sessions from a legacy playtime.json', () => {
	const s = { ...base, start: at(1, 10), end: at(1, 11) };
	expect(parseSessions(JSON.stringify({ sessions: [s, { appId: 'x' }], open: [] }))).toEqual([s]);
});

test('dedupes by app and start, keeping the longer copy', () => {
	const short = { ...base, start: at(1, 10), end: at(1, 11) };
	const long = { ...short, end: at(1, 12) };
	expect(dedupe([short, long, short])).toEqual([long]);
});

test('parses state defensively and refuses newer versions', () => {
	expect(parseState('')).toEqual({ open: [], genres: {}, limitMinutes: 0, nudged: {} });
	expect(parseState(JSON.stringify({ open: [{ appId: 1 }], genres: { 10: 'Action', 20: 5 }, limitMinutes: -3 }))).toEqual({
		open: [],
		genres: { 10: 'Action' },
		limitMinutes: 0,
		nudged: {},
	});
	expect(() => parseState(JSON.stringify({ v: STATE_VERSION + 1 }))).toThrow();
});

test('reads FFI results that arrive already parsed', () => {
	const s = { ...base, start: at(1, 10), end: at(1, 11) };
	expect(parseState(asText({ limitMinutes: 30 })).limitMinutes).toBe(30);
	expect(parseSessions(asText(s))).toEqual([s]);
	expect(parseSessions(asText({ sessions: [s] }))).toEqual([s]);
	expect(asText(null)).toBe('');
});
