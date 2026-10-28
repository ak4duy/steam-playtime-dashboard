import { expect, test } from 'bun:test';
import { dayTotal, maxPerKey, rhythm, wallTime } from '../frontend/stats';

test('keeps the larger of Steam and logged playtime per game', () => {
	const m = 60_000;
	expect(maxPerKey([['10', 500 * m], ['20', 100 * m]], [['20', 300 * m], ['30', 50 * m]])).toEqual([
		['10', 500 * m],
		['20', 300 * m],
		['30', 50 * m],
	]);
});

test('counts overlapping games once in wall-clock totals', () => {
	const h = 3_600_000;
	const day = new Date(2026, 9, 1).getTime();
	const s = (appId: number, from: number, to: number) => ({ appId, start: day + from * h, end: day + to * h, platform: 'Linux', launchSource: 'Library' });
	const sessions = [s(1, 10, 12), s(2, 11, 13), s(3, 15, 16)];
	expect(wallTime(sessions)).toBe(4 * h);
	expect(dayTotal(sessions, day)).toBe(4 * h);
	expect(rhythm(sessions)[(new Date(day).getDay() + 6) % 7][11]).toBe(h);
});
