import fastify from 'fastify'
import { CronJob } from 'cron'
import cors from '@fastify/cors'
import fs from 'fs'

import { PollingState, pollingStateRegistry } from './polling.js'
import {
	Activity,
	expiration,
	getList,
	isInZoomMeeting,
	isSleepingHours,
	pingDiff,
	prisma,
	requirePassword,
	sleepExpiration,
	sleepExpirationDelay
} from './util.js'
import { LastfmState } from './modules/lastfm.js'
import env from './env.js'

const server = fastify({
	logger: {
		prettyPrint:
			process.env.NODE_ENV === 'production'
				? false
				: {
						translateTime: 'sys:HH:MM:ss',
						ignore: 'pid,hostname'
				  },
		level: process.env.LOG_LEVEL ?? 'info'
	}
})
server.register(cors)

const runDecisionTree = async (pollingState: PollingState): Promise<Activity> => {
	const manualActivity = await prisma.manualActivity.findFirst({ where: {} })
	const [desktopDiff, mobileDiff] = await Promise.all([pingDiff('desktop'), pingDiff('mobile')])
	const minDiff = Math.min(desktopDiff, mobileDiff)

	if (manualActivity) {
		// Requirements to disable sleep mode:
		// - Activity set to sleeping
		// - Last event within 1 hour
		// - Sleep button pressed more than 6 minutes before last event
		const sleepEnded =
			manualActivity &&
			manualActivity.emoji === '💤' &&
			minDiff < sleepExpiration &&
			Date.now() - manualActivity.time.getTime() - minDiff > sleepExpirationDelay
		if (sleepEnded) {
			await prisma.manualActivity.deleteMany({ where: {} })
		} else {
			return { emoji: manualActivity.emoji, label: manualActivity.label }
		}
	}

	// FSP reservation:
	if (pollingState.fsp.inReservation) return { emoji: '🛩️', label: 'flying a plane' }

	// Music apps:
	const apps = await getList('apps')
	if (['ableton', 'musescore', 'max'].some((app) => apps.includes(app))) return { emoji: '🎵', label: 'making music' }

	// Music calendar search:
	if (['cello', 'rehearsal', 'recital'].some((key) => pollingState.calendar.eventName?.toLowerCase()?.includes(key)))
		return { emoji: '🎵', label: 'making music' }

	// Toggl tracking:
	if (pollingState.toggl.tracking) return { emoji: '💼', label: 'working' }

	// Class calendar search:
	if (['lesson', 'class'].some((key) => pollingState.calendar.eventName?.toLowerCase()?.includes(key)))
		return { emoji: '📚', label: 'in class' }

	// Call websites:
	const domains = desktopDiff < expiration ? await getList('domains') : []
	if (['meet.google.com', 'voice.google.com'].some((domain) => domains.includes(domain)))
		return { emoji: '📞', label: 'on a call' }

	// Call calendar regex:
	if (pollingState.calendar.eventName) {
		const callRegex =
			/^(?:[A-Z][a-z]+ )*[A-Z][a-z]+ (\+|<>|\/) (?:[A-Z][a-z]+ )*[A-Z][a-z]+(?: \1 (?:[A-Z][a-z]+ )*[A-Z][a-z]+)*$/
		if (callRegex.test(pollingState.calendar.eventName.trim())) return { emoji: '📞', label: 'on a call' }
	}

	// Call calendar check:
	if (pollingState.calendar.isVideoMeeting) return { emoji: '📞', label: 'on a call' }

	// Zoom call:
	if (apps.includes('zoom') && (await isInZoomMeeting())) return { emoji: '📞', label: 'on a call' }

	// Programming apps:
	if (['vscode', 'terminal', 'android-studio'].some((app) => apps.includes(app)))
		return { emoji: '👩‍💻', label: 'programming' }

	// Programming websites:
	if (['github.com', 'replit.com', 'github.dev', 'vscode.dev'].some((domain) => domains.includes(domain)))
		return { emoji: '👩‍💻', label: 'programming' }

	// Figma:
	if (apps.includes('figma') || domains.includes('figma.com')) return { emoji: '🎨', label: 'doing visual design' }

	// Writing websites:
	if (['docs.google.com', 'app.grammarly.com'].some((domain) => domains.includes(domain)))
		return { emoji: '📝', label: 'writing something' }

	// Gaming:
	if (['minecraft', 'rimworld', 'celeste', 'factorio'].some((app) => apps.includes(app)))
		return { emoji: '🎮', label: 'gaming' }

	// Listening to music:
	if (pollingState.lastfm.nowPlaying) return { emoji: '🎧', label: 'listening to music' }

	// Meal calendar search:
	if (['dinner', 'lunch', 'breakfast'].some((key) => pollingState.calendar.eventName?.toLowerCase()?.includes(key)))
		return { emoji: '✨', label: 'doing something irl' }

	// Sleeping heuristic for when I forget to manually update:
	if (minDiff > sleepExpiration && isSleepingHours(new Date())) {
		const created = await prisma.manualActivity.create({
			data: { emoji: '💤', label: 'sleeping', time: new Date() }
		})
		return { emoji: created.emoji, label: created.label }
	}

	// Fallback:
	if (mobileDiff < expiration) return { emoji: '📱', label: 'doing stuff on my phone' }
	if (desktopDiff < expiration) return { emoji: '💻', label: 'doing stuff on my computer' }
	return { emoji: '✨', label: 'doing something irl' }
}

const updateDecisionTree = async (pollingState: PollingState): Promise<Activity> => {
	const activity = await runDecisionTree(pollingState)
	const curActivity = await prisma.activity.findFirst({ orderBy: { time: 'desc' } })
	if (activity.emoji !== curActivity?.emoji) {
		await prisma.activity.create({ data: activity })
		await fetch('https://slack.com/api/users.profile.set', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.slackToken}`
			},
			body: JSON.stringify({
				profile: {
					status_text: activity.label[0].toUpperCase() + activity.label.slice(1),
					status_emoji: activity.emoji,
					status_expiration: 0
				}
			})
		})
	}
	return activity
}

const start = async () => {
	const pollingState: PollingState = {} as PollingState

	server.log.info('Fetching initial polling state...')
	await Promise.all(
		Object.keys(pollingStateRegistry)
			.map((key) => key as keyof typeof pollingStateRegistry)
			.map(async (key) => {
				// I hate it, I hate it, I hate it!
				pollingState[key] = (await pollingStateRegistry[key].fetcher()) as any
				new CronJob(
					pollingStateRegistry[key].cron,
					async () => {
						server.log.debug(`Polling '${key}' and running decision tree`)
						try {
							pollingState[key] = (await pollingStateRegistry[key].fetcher()) as any
							await updateDecisionTree(pollingState)
							server.log.debug(pollingState)
						} catch (err) {
							server.log.error((err as Error).message)
						}
					},
					null,
					true,
					process.env.TZ ?? 'America/New_York'
				)
			})
	)
	server.log.debug(pollingState)

	server.get<{
		Reply: { activity: Activity; lastfm: LastfmState }
	}>('/', async () => {
		const activity = (await prisma.activity.findFirst({ orderBy: { time: 'desc' } }))!
		return { activity, lastfm: pollingState.lastfm }
	})

	server.get('/dash', async (req, reply) => {
		reply.type('html')
		return fs.createReadStream('dash.html')
	})

	server.get<{
		Reply: { history: Activity[] }
	}>('/history', async () => {
		const history = await prisma.activity.findMany({ orderBy: { time: 'desc' } })
		return { history }
	})

	server.get('/check-auth', { preHandler: [requirePassword] }, async () => ({}))

	server.post<{
		Body: { emoji: string; label: string }
	}>(
		'/manual',
		{
			preHandler: [requirePassword],
			schema: {
				body: {
					type: 'object',
					properties: {
						emoji: { type: 'string' },
						label: { type: 'string' }
					},
					required: ['emoji', 'label']
				}
			}
		},
		async (req) => {
			const { emoji, label } = req.body
			const current = await prisma.manualActivity.findFirst({ where: {} })
			const data = { emoji, label, time: new Date() }

			if (current) {
				await prisma.manualActivity.update({ where: { id: current.id }, data })
			} else {
				await prisma.manualActivity.create({ data })
			}

			await updateDecisionTree(pollingState)
			return {}
		}
	)

	server.post('/manual/clear', { preHandler: [requirePassword] }, async () => {
		await prisma.manualActivity.deleteMany({ where: {} })
		await updateDecisionTree(pollingState)
		return {}
	})

	server.post<{
		Params: { key: string }
	}>('/ping/:key', { preHandler: [requirePassword] }, async (req, reply) => {
		if (['desktop', 'mobile'].includes(req.params.key)) {
			await prisma.ping.upsert({
				where: { key: req.params.key },
				update: { time: new Date() },
				create: { key: req.params.key, time: new Date() }
			})
			await updateDecisionTree(pollingState)
			return {}
		} else {
			reply.status(400)
			throw new Error('Invalid ping key')
		}
	})

	server.post<{
		Params: { key: string; sourceDevice: string }
		Body: { list: string[] }
	}>(
		'/list/:key/:sourceDevice',
		{
			preHandler: [requirePassword],
			schema: {
				body: {
					type: 'object',
					properties: {
						list: { type: 'array', items: { type: 'string' } }
					},
					required: ['list']
				}
			}
		},
		async (req, reply) => {
			if (['apps', 'domains'].includes(req.params.key)) {
				await prisma.list.upsert({
					where: {
						key_sourceDevice: {
							key: req.params.key,
							sourceDevice: req.params.sourceDevice
						}
					},
					update: { list: req.body.list, time: new Date() },
					create: { key: req.params.key, sourceDevice: req.params.sourceDevice, list: req.body.list, time: new Date() }
				})
				await updateDecisionTree(pollingState)
				return {}
			} else {
				reply.status(400)
				throw new Error('Invalid list key')
			}
		}
	)

	server.post<{
		Body: {
			event: string
			event_ts: string
			payload: {
				account_id: string
				object: object
			}
		}
	}>(
		'/zoom',
		{
			schema: {
				body: {
					type: 'object',
					properties: {
						event: { type: 'string' },
						event_ts: { type: 'string' },
						payload: {
							type: 'object',
							properties: {
								account_id: { type: 'string' },
								object: { type: 'object' }
							},
							required: ['account_id', 'object']
						}
					},
					required: ['event', 'event_ts', 'payload']
				}
			}
		},
		async (req, reply) => {
			if (req.headers.authorization !== env.zoomVerificationToken) {
				reply.status(401)
				throw new Error('Invalid verification token')
			}
			if (req.body.event === 'user.presence_status_updated') {
				const { id, presence_status } = req.body.payload.object as { id: string; presence_status: string }
				req.log.info(`zoom presence: ${presence_status}`)
				const inMeeting = ['In_Meeting', 'Presenting', 'On_Phone_Call'].includes(presence_status)
				await prisma.zoomUser.upsert({
					where: { id },
					update: { inMeeting, lastUpdate: new Date() },
					create: { id, inMeeting, lastUpdate: new Date() }
				})
				await updateDecisionTree(pollingState)
			}
			return {}
		}
	)

	await updateDecisionTree(pollingState)
	await server.listen(3000, '0.0.0.0')
}

start().catch(async (error) => {
	await prisma.$disconnect()
	server.log.error(error.message)
	process.exit(1)
})
