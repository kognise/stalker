import { getCalendarState } from './modules/calendar.js'
import { getFspState } from './modules/fsp.js'
import { getLastfmState } from './modules/lastfm.js'
import { getTogglState } from './modules/toggl.js'

export const pollingStateRegistry = {
	fsp: { fetcher: getFspState, cron: '10 */15 * * * *' },
	toggl: { fetcher: getTogglState, cron: '0 */5 * * * *' },
	lastfm: { fetcher: getLastfmState, cron: '*/10 * * * * *' },
	calendar: { fetcher: getCalendarState, cron: '10 */15 * * * *' }
}

export type PollingState = {
	[key in keyof typeof pollingStateRegistry]: Awaited<ReturnType<typeof pollingStateRegistry[key]['fetcher']>>
}
