import { beforePatch, ButtonItem, definePlugin, findModuleByExport, Navigation, routerHook } from 'millennium';
import { Dashboard } from './Dashboard';
import { exportData, importData, startTracking } from './tracker';

const ROUTE = '/playtime';

function addProfileMenuItem() {
	const menuModule = findModuleByExport((e) => e?.toString?.().includes('bSuperNavBehavior'));
	const MenuItems = Object.values(menuModule ?? {}).find((e: any) => {
		const src = e?.toString?.() ?? '';
		return src.includes('disabledItemClass') && src.includes('menuItems') && src.includes('.map(') && !src.includes('bSuperNavBehavior');
	});
	if (!MenuItems) return console.error('Playtime: profile menu not found');

	const factory = (window as any).SP_JSX_FACTORY;
	const patch = () =>
		beforePatch(factory, 'jsx', (args: any[]) => {
			if (args[0] !== MenuItems) return;
			const items: any[] = args[1]?.menuItems ?? [];
			if (!items.some((item) => item?.name === '#Menu_Profile') || items.some((item) => item?.name === 'SeparatorPlaytime')) return;
			args[1] = { ...args[1], menuItems: [...items, { name: 'SeparatorPlaytime' }, { name: 'Dashboard', route: ROUTE }] };
		});
	const isApplied = () => {
		for (let fn = factory.jsx; fn; fn = fn.__millenniumPatch?.original) if (fn === current.patchedFunction) return true;
		return false;
	};
	(window as any).playtimeMenuCleanup?.();
	let current = patch();
	const timer = setInterval(() => isApplied() || (current = patch()), 1000);
	(window as any).playtimeMenuCleanup = () => {
		clearInterval(timer);
		if (isApplied()) current.unpatch();
	};
}

const Icon = () => (
	<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
		<circle cx="12" cy="12" r="9" />
		<path d="M12 7v5l3 2" />
	</svg>
);

export default definePlugin(() => {
	startTracking().catch((e) => console.error('Playtime tracking disabled:', e));
	routerHook.addRoute(ROUTE, Dashboard);
	try {
		addProfileMenuItem();
	} catch (e) {
		console.error('Playtime menu item disabled:', e);
	}

	return {
		title: 'Playtime Dashboard',
		icon: <Icon />,
		content: (
			<>
				<ButtonItem
					description="See your playtime stats and charts on a full page"
					onClick={() => {
						Navigation.Navigate(ROUTE);
						Navigation.CloseSideMenus();
					}}
				>
					Open dashboard
				</ButtonItem>
				<ButtonItem description="Save your session log as a .jsonl file" onClick={exportData}>
					Export data
				</ButtonItem>
				<ButtonItem description="Merge sessions from an export or an old playtime.json." onClick={importData}>
					Import data
				</ButtonItem>
			</>
		),
	};
});
