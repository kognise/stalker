import dotenv from 'dotenv'
dotenv.config()

const getVarOrPanic = (key: string): string => {
	if (!process.env[key]) {
		throw new Error(`Missing environment variable '${key}'`)
	}
	return process.env[key]!
}

const env = {
	password: getVarOrPanic('PASSWORD'),
	slackToken: getVarOrPanic('SLACK_TOKEN'),
	fspUsername: getVarOrPanic('FSP_USERNAME'),
	fspPassword: getVarOrPanic('FSP_PASSWORD'),
	fspOperatorId: parseInt(getVarOrPanic('FSP_OPERATOR_ID')),
	togglApiKey: getVarOrPanic('TOGGL_API_KEY'),
	lastfmUsername: getVarOrPanic('LASTFM_USERNAME'),
	lastfmApiKey: getVarOrPanic('LASTFM_API_KEY'),
	calendarId: getVarOrPanic('CALENDAR_ID'),
	calendarRefreshToken: getVarOrPanic('CALENDAR_REFRESH_TOKEN'),
	calendarClientId: getVarOrPanic('CALENDAR_CLIENT_ID'),
	calendarClientSecret: getVarOrPanic('CALENDAR_CLIENT_SECRET'),
	zoomUserId: getVarOrPanic('ZOOM_USER_ID'),
	zoomVerificationToken: getVarOrPanic('ZOOM_VERIFICATION_TOKEN')
}
export default env
