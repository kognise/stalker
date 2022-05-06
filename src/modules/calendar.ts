import fetch from 'node-fetch'
import env from '../env.js'
import { makeUrl, prisma } from '../util.js'

interface EventItem {
	kind: string
	etag: string
	id: string
	status: string
	htmlLink: string
	created: string
	updated: string
	summary: string
	description: string
	location: string
	creator: {
		email: string
		self: boolean
	}
	organizer: {
		email: string
		self: boolean
	}
	start: {
		dateTime: string
		timeZone: string
	}
	end: {
		dateTime: string
		timeZone: string
	}
	iCalUID: string
	sequence: number
	reminders: {
		useDefault: boolean
	}
	eventType: string
	conferenceData?: {
		entryPoints: {
			entryPointType: string
			uri: string
			label: string
		}[]
		conferenceSolution: {
			name: string
			iconUri: string
		}
	}
}

interface TokenGrant {
	access_token: string
	expires_in: number
	token_type: string
	refresh_token: string
}

const updateAccessToken = async (refreshToken: string): Promise<string> => {
	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			client_id: env.calendarClientId,
			client_secret: env.calendarClientSecret,
			grant_type: 'refresh_token',
			refresh_token: refreshToken
		})
	})
	if (!res.ok) throw new Error(`Status ${res.status} while refreshing calendar token`)

	const grant = (await res.json()) as TokenGrant
	const expiration = new Date(Date.now() + grant.expires_in * 1000 - 1000)
	await prisma.oauthToken.upsert({
		where: { refreshToken },
		update: {
			accessToken: grant.access_token,
			expiration
		},
		create: {
			refreshToken,
			accessToken: grant.access_token,
			expiration
		}
	})
	return grant.access_token
}

const getCalendarEvents = async (
	calendarId: string,
	startTime: Date,
	maxResults: number,
	accessToken: string
): Promise<EventItem[]> => {
	const res = await fetch(
		makeUrl(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
			maxResults,
			orderBy: 'startTime',
			singleEvents: true,
			timeMin: startTime.toISOString()
		}),
		{
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		}
	)
	if (!res.ok) throw new Error(`Status ${res.status} while fetching calendar events`)
	const json = (await res.json()) as { items: EventItem[] }
	return json.items
}

export interface CalendarState {
	eventName: string | null
	isVideoMeeting: boolean
}

export const getCalendarState = async (): Promise<CalendarState> => {
	let events
	try {
		const token = await prisma.oauthToken.findUnique({ where: { refreshToken: env.calendarRefreshToken } })
		if (!token) throw new Error('No calendar access token found')
		events = await getCalendarEvents(env.calendarId, new Date(), 1, token.accessToken)
	} catch (err) {
		const accessToken = await updateAccessToken(env.calendarRefreshToken)
		events = await getCalendarEvents(env.calendarId, new Date(), 1, accessToken)
	}

	if (events[0]?.status !== 'confirmed') return { eventName: null, isVideoMeeting: false }

	const [start, end] = [events[0].start.dateTime, events[0].end.dateTime].map(Date.parse)
	const now = Date.now()
	if (now < start || now > end) return { eventName: null, isVideoMeeting: false }

	return {
		eventName: events[0].summary ?? '(No title)',
		isVideoMeeting:
			events[0].conferenceData?.entryPoints?.some((entry) => entry.entryPointType === 'video') ||
			events[0]?.location?.includes('zoom.us') ||
			false
	}
}
