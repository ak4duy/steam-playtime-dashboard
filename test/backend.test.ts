import { expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.skipIf(!Bun.which('luajit'))('backend store reads, writes, appends, exports and retires the legacy file', () => {
	const root = mkdtempSync(join(tmpdir(), 'ptd-backend-'));
	const run = Bun.spawnSync(['luajit', join(import.meta.dir, 'backend.lua'), join(import.meta.dir, '../backend/rpc_functions.lua'), root]);
	expect(run.stderr.toString()).toBe('');
	expect(run.stdout.toString()).toContain('BACKEND OK');
});
