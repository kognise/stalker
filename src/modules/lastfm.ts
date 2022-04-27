import fetch from 'node-fetch'
import env from '../env.js'
import { makeUrl } from '../util.js'

interface LastfmTrack {
	artist: {
		mbid: string
		'#text': string
	}
	streamable: string
	image: {
		size: string
		'#text': string
	}[]
	mbid: string
	album: {
		mbid: string
		'#text': string
	}
	name: string
	'@attr': {
		nowplaying: string
	}
	url: string
}

interface LastfmRecentTracks {
	recenttracks: {
		track: LastfmTrack[]
		'@attr': {
			user: string
			totalPages: string
			page: string
			perPage: string
			total: string
		}
	}
}

const getRecentTracks = async (username: string, apiKey: string, limit: number): Promise<LastfmRecentTracks> => {
	const res = await fetch(
		makeUrl(`https://ws.audioscrobbler.com/2.0/`, {
			user: username,
			api_key: apiKey,
			format: 'json',
			method: 'user.getrecenttracks',
			limit
		})
	)
	if (!res.ok) throw new Error(`Status ${res.status} while fetching recent tracks`)
	return (await res.json()) as LastfmRecentTracks
}

export interface LastfmState {
	nowPlaying: boolean
	track: {
		name: string
		artist: string
		album: string
		images: string[]
		url: string
	}
}

export const getLastfmState = async (): Promise<LastfmState> => {
	const recentTracks = await getRecentTracks(env.lastfmUsername, env.lastfmApiKey, 1)
	const track = recentTracks.recenttracks.track[0]
	if (!track) throw new Error('No Last.fm recent tracks!')
	return {
		nowPlaying: track['@attr'] ? track['@attr'].nowplaying === 'true' : false,
		track: {
			name: track.name,
			artist: track.artist['#text'],
			album: track.album['#text'],
			images: track.image.map((image) => image['#text']),
			url: track.url
		}
	}
}
