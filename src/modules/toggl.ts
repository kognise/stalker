import fetch from 'node-fetch'
import env from '../env.js'

interface TogglEntry {
	id: number
	wid: number
	billable: boolean
	start: string
	duration: number
	duronly: boolean
	at: string
	uid: number
}

interface TogglCurrentEntry {
	data: TogglEntry | null
}

export interface TogglState {
	tracking: boolean
}

export const getTogglState = async (): Promise<TogglState> => {
	const res = await fetch('https://api.track.toggl.com/api/v8/time_entries/current', {
		headers: {
			Authorization: `Basic ${Buffer.from(`${env.togglApiKey}:api_token`).toString('base64')}`
		}
	})
	if (!res.ok) throw new Error(`Status ${res.status} while fetching Toggl current entry`)
	const json = (await res.json()) as TogglCurrentEntry
	return {
		tracking: json.data !== null
	}
}
