import { ButtonItem, definePlugin, Navigation, routerHook } from 'millennium';
import { Dashboard } from './Dashboard';
import { exportData, importData, startTracking } from './tracker';

const ROUTE = '/playtime';

const Icon = () => (
	<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
		<circle cx="12" cy="12" r="9" />
		<path d="M12 7v5l3 2" />
	</svg>
);

export default definePlugin(() => {
	startTracking().catch((e) => console.error('Playtime tracking disabled:', e));
	routerHook.addRoute(ROUTE, Dashboard);

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
