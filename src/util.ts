import Prisma from '@prisma/client'
import { preHandlerHookHandler } from 'fastify'
import env from './env.js'

export const expiration = 2 * 60 * 1000 // 2 minutes
export const zoomExpiration = 12 * 60 * 60 * 1000 // 12 hours
export const sleepExpiration = 60 * 60 * 1000 // 1 hour
export const sleepExpirationDelay = 6 * 60 * 1000 // 6 minutes

export const makeUrl = (url: string, params: Record<string, string | number | boolean> = {}): string => {
	const newUrl = new URL(url)
	for (const [key, value] of Object.entries(params)) {
		newUrl.searchParams.set(key, value.toString())
	}
	return newUrl.toString()
}

export const pingDiff = async (key: string): Promise<number> => {
	const ping = await prisma.ping.findUnique({ where: { key } })
	return ping ? Date.now() - ping.time.getTime() : Infinity
}

export const getList = async (key: string): Promise<string[]> => {
	const lists = await prisma.list.findMany({
		where: {
			key,
			time: { gte: new Date(Date.now() - expiration) }
		}
	})
	return lists.reduce<string[]>((acc, { list }) => [...acc, ...list], [])
}

export const isSleepingHours = (date: Date): boolean => {
	const hours = date.getUTCHours()
	return hours >= 3 && hours <= 12
}

export const isInZoomMeeting = async (): Promise<boolean> => {
	const zoomUser = await prisma.zoomUser.findUnique({ where: { id: env.zoomUserId.toLowerCase() } })
	if (!zoomUser) return false
	if (Date.now() - zoomUser.lastUpdate.getTime() > zoomExpiration) return false
	return zoomUser.inMeeting
}

export interface Activity {
	emoji: string
	label: string
}

export const prisma = new Prisma.PrismaClient()

export const requirePassword: preHandlerHookHandler = async (req, reply) => {
	const prefix = 'Bearer '
	if (
		!req.headers.authorization ||
		req.headers.authorization.length <= prefix.length ||
		req.headers.authorization.slice(prefix.length) !== env.password
	) {
		reply.status(401)
		throw new Error('Incorrect password')
	}
}
