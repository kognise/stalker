# Stalker 😌

You know that thing on my website that shows what I'm doing? Well, it used to be manually updated, but that got boring.

Now I have a complex system of janky programs that culminate in a bunch of if-then statements that generate that status! It even updates my Slack. I'm unstoppable.

## API

Consumable at <https://api.kognise.dev/> and deployed on the glorious [Fly.io](https://fly.io/).

**Public endpoints:**

- `/` - Get current activity and now playing song
- `/history` - Get full activity history
- `/dash` - Access web dashboard (only I can update statuses)

**Kognise-only endpoints:**

- `/manual` - Manually update status
- `/manual/clear` - Clear manual status
- `/ping/:key` - Signify activity for a device class
- `/list/:key/:sourceDevice` - Update browser tabs or running apps
- `/zoom` - Zoom webhook updates

## Other

Compile StalkerMini (mobile app) to an APK with Gradle, I just used Android Studio.

Stalkerd (desktop daemon) needs a `.password` file to compile, which Rust embeds in the binary. Don't share the binary! I made this technical decision because I'm lazy.

The browser extension is quite cursed. If it doesn't work, you'll have to open the dev console; the error message should explain how to set the password.

Stalkerd is not cross-platform yet, only supports macOS.
