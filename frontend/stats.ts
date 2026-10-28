import { Session, nextMidnight } from './log';

export const duration = (s: Session) => s.end - s.start;

export function merge(sessions: Pick<Session, 'start' | 'end'>[]) {
	const merged: Pick<Session, 'start' | 'end'>[] = [];
	for (const { start, end } of [...sessions].sort((a, b) => a.start - b.start)) {
		const last = merged[merged.length - 1];
		if (last && start < last.end) last.end = Math.max(last.end, end);
		else merged.push({ start, end });
	}
	return merged;
}

export const wallTime = (sessions: Session[]) => merge(sessions).reduce((total, s) => total + s.end - s.start, 0);

export const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0);

export const isVisible = (ms: number) => Math.round(ms / 60_000) > 0;

export function fmt(ms: number) {
	const minutes = Math.round(ms / 60_000);
	const h = Math.floor(minutes / 60);
	return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

export function totals(sessions: Session[], key: (s: Session) => string): [string, number][] {
	const sums = new Map<string, number>();
	sessions.forEach((s) => sums.set(key(s), (sums.get(key(s)) ?? 0) + duration(s)));
	return [...sums].filter(([, ms]) => isVisible(ms)).sort((a, b) => b[1] - a[1]);
}

export const dayTotal = (sessions: Session[], day: number) => wallTime(sessions.filter((s) => s.start >= day && s.start < nextMidnight(day)));

export function usualForDay(sessions: Session[], now: number) {
	const firstDay = startOfDay(Math.min(...sessions.map((s) => s.start)));
	const days = [1, 2, 3, 4, 5, 6, 7, 8]
		.map((weeks) => {
			const d = new Date(now);
			d.setDate(d.getDate() - 7 * weeks);
			return d.setHours(0, 0, 0, 0);
		})
		.filter((day) => day >= firstDay);
	return days.length ? days.reduce((total, day) => total + dayTotal(sessions, day), 0) / days.length : 0;
}

export function rhythm(sessions: Session[]) {
	const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
	for (const s of merge(sessions)) {
		for (let t = s.start; t < s.end; ) {
			const d = new Date(t);
			const next = Math.min(new Date(t).setMinutes(60, 0, 0), s.end);
			grid[(d.getDay() + 6) % 7][d.getHours()] += next - t;
			t = next;
		}
	}
	return grid;
}

export function weekStart(t: number) {
	const d = new Date(t);
	d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
	return d.setHours(0, 0, 0, 0);
}

export function daysAgo(now: number, days: number) {
	const d = new Date(now);
	d.setDate(d.getDate() - days);
	return d.setHours(0, 0, 0, 0);
}

export function maxPerKey(...lists: [string, number][][]): [string, number][] {
	const best = new Map<string, number>();
	lists.flat().forEach(([key, ms]) => best.set(key, Math.max(best.get(key) ?? 0, ms)));
	return [...best].filter(([, ms]) => isVisible(ms)).sort((a, b) => b[1] - a[1]);
}
