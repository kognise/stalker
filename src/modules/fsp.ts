// https://www.flightschedulepro.com/
// A lot of the interfaces are incomplete but they're fine for our purposes.

import fetch from 'node-fetch'
import cookie from 'cookie'
import env from '../env.js'
import { makeUrl } from '../util.js'

interface FspApp {
	token: string
	operatorId: number
}

interface FspReservationResults {
	total: number
	pageIndex: number
	pageSize: number
	results: {
		id: string
		start: string
		foreground: string
		background: string
	}[]
}

interface FspReservation {
	reservationId: string
	reservationNumber: number
	start: string
	end: string
	foreground: string
	background: string
	estimatedFlightHours: number
	instructorPostFlightMinutes: number
	instructorPreFlightMinutes: number
	flightRoute: string
	locationName: string
}

const login = async (operatorId: number, username: string, password: string): Promise<FspApp> => {
	const formData = new URLSearchParams()
	formData.set('username', username)
	formData.set('password', password)
	formData.set('uv_login', '0')
	formData.set('uv_ssl', '0')

	const res = await fetch(`https://app.flightschedulepro.com/Account/Login/${operatorId}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: formData,
		redirect: 'manual'
	})
	const parsed = cookie.parse(res.headers.get('set-cookie') ?? '')
	if (!parsed.FspApp) throw new Error(`FSP login failed: no FspApp cookie (status ${res.status})`)
	return JSON.parse(parsed.FspApp)
}

const getReservationResults = async (
	app: FspApp,
	pageIndex: number,
	pageSize: number
): Promise<FspReservationResults> => {
	const url = makeUrl(
		`https://api.flightschedulepro.com/api/V1/operator/${app.operatorId}/dashboard/upcomingreservations`,
		{
			pageIndex,
			pageSize
		}
	)
	const res = await fetch(url, {
		headers: {
			Authorization: `Basic ${app.token}`
		}
	})
	if (!res.ok) throw new Error(`Status ${res.status} while fetching FSP reservation results`)
	return (await res.json()) as FspReservationResults
}

const getReservation = async (app: FspApp, id: string): Promise<FspReservation> => {
	const url = makeUrl(`https://api.flightschedulepro.com/api/V2/Reservation/${id}`, { operatorId: app.operatorId })
	const res = await fetch(url, {
		headers: {
			Authorization: `Bearer ${app.token}`
		}
	})
	if (!res.ok) throw new Error(`Status ${res.status} while fetching FSP reservation`)
	return (await res.json()) as FspReservation
}

export interface FspState {
	inReservation: boolean
}

export const getFspState = async (): Promise<FspState> => {
	const app = await login(env.fspOperatorId, env.fspUsername, env.fspPassword)
	const reservations = await getReservationResults(app, 1, 1)
	if (!reservations.results[0]) return { inReservation: false }

	const reservation = await getReservation(app, reservations.results[0].id)
	const [start, end] = [reservation.start, reservation.end].map((timestamp) => timestamp + '-05:00').map(Date.parse)
	const now = Date.now()

	return {
		inReservation: now >= start && now <= end
	}
}
