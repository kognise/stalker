const getId = async () => {
	const { id } = await chrome.storage.local.get(['id'])
	if (id) return id
	const newId = Date.now().toString(36) + Math.random().toString(36).slice(2)
	await chrome.storage.local.set({ id: newId })
	return newId
}

const update = async () => {
	const { password } = await chrome.storage.sync.get(['password'])
	if (!password) throw new Error("No password set! Try: chrome.storage.sync.set({ password: '...' })")
	const id = await getId()

	const tabs = await chrome.tabs.query({})
	const domains = tabs
		.map((tab) => new URL(tab.url))
		.filter((url) => ['http:', 'https:'].includes(url.protocol))
		.map((url) => url.hostname.toLowerCase())
		.map((hostname) => (hostname.startsWith('www.') ? hostname.slice(4) : hostname))

	await fetch(`https://api.kognise.dev/list/domains/${id}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${password}`
		},
		body: JSON.stringify({ list: domains })
	})
}

chrome.runtime.onInstalled.addListener(() => {
	update()
	chrome.alarms.create({ periodInMinutes: 1 })
})

chrome.tabs.onRemoved.addListener(update)
chrome.alarms.onAlarm.addListener(update)
