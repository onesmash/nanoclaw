---
name: add-zoom
description: Add Zoom Team Chat as a channel. Uses WebSocket event subscription (no public URL needed). Bot responds when @mentioned in registered channels.
---

# Add Zoom Team Chat Channel

This skill adds Zoom Team Chat support to NanoClaw using WebSocket long-connection mode. A General App in Zoom Marketplace is required — no public URL or HTTPS certificate needed.

## Phase 1: Pre-flight

### Check if already applied

Read `.nanoclaw/state.yaml`. If `zoom` is in `applied_skills`, skip to Phase 3 (Setup). The code changes are already in place.

### Ask the user — then stop

Ask this exact question and wait for their answer before doing anything else:

> Do you already have a Zoom General App with Client ID and Client Secret?
> - **Yes** → I'll ask for the credentials in Phase 3 (skip app creation)
> - **No** → I'll walk you through creating one

**Do not proceed past this point until the user answers.**

- If **yes**: proceed to Phase 2, then skip to "Configure environment" in Phase 3.
- If **no**: proceed to Phase 2, then do the full Phase 3 including app creation.

## Phase 2: Apply Code Changes

Run the skills engine to apply this skill's code package.

### Initialize skills system (if needed)

If `.nanoclaw/` directory doesn't exist yet:

```bash
npx tsx scripts/apply-skill.ts --init
```

### Apply the skill

```bash
npx tsx scripts/apply-skill.ts .claude/skills/add-zoom
```

This deterministically:
- Adds `src/channels/zoom.ts` (ZoomChannel class with self-registration via `registerChannel`)
- Adds `src/channels/zoom.test.ts` (unit tests)
- Appends `import './zoom.js'` to `src/channels/index.ts`
- Installs `ws` and `@types/ws` npm dependencies
- Records the application in `.nanoclaw/state.yaml`

Channel registration uses the standard `setup/register` step (Phase 4).

If the apply reports merge conflicts, read the intent file:
- `modify/src/channels/index.ts.intent.md` — what changed and invariants

### Validate code changes

```bash
npm test
npm run build
```

All tests must pass and the build must be clean before proceeding.

## Phase 3: Setup

### If user does NOT have a Zoom app yet — create one

#### Step 3a: Choose a name and generate the manifest

Ask this question and wait for the answer:

> What would you like to name your Zoom app? (default: `ZoomClaw`)

**Wait for their answer.** Then generate the manifest using the chosen name (or `ZoomClaw` if they said default/nothing):

```bash
sed 's/__FILL_APP_NAME__/CHOSEN_NAME/g' .claude/skills/add-zoom/references/app-manifest.json > zoom-app-manifest.json
```

Tell the user:
> Your manifest file is ready at `zoom-app-manifest.json`. A bot icon is also available at `.claude/skills/add-zoom/assets/zoomclaw-icon.png` — you can use it as the app's profile picture in the Zoom Marketplace settings.
>
> Now follow these steps to create the app:
>
> **Dev environment** (recommended for testing):
> 1. Open Zoom Dev Marketplace: `https://devmp.zoomdev.us/develop/create`
> 2. Choose **General App** → **Create**
> 3. On **App Credentials**, copy the **Client ID** and **Client Secret**
> 4. Go to **Basic Information** → **Manage Manifest** → **Update new manifest** → upload `zoom-app-manifest.json`
> 5. Go to **Features** → **Access** → **Event Subscription**, copy the **WebSocket URL** (`wss://...`)
> 6. Go to **Add your app** → **Local test** → **Add app now** to install it to your account
>
> **For Production** (`marketplace.zoom.us`): same steps.
>
> Once done, please share: **Client ID**, **Client Secret**, **WebSocket URL**, and whether this is **Dev** or **Production**.

**Wait for the user to complete those steps and provide all four values before continuing.**

### If user already has a Zoom app — collect credentials

Ask for and wait to receive:
- Client ID
- Client Secret
- WebSocket URL (`wss://...`)
- Environment: **Dev** (`zoomdev.us`) or **Production** (`zoom.us`)?

**Do not continue until you have all four.**

### Configure environment

Add to `.env`:

```bash
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
ZOOM_WEBSOCKET_URL=wss://your-websocket-endpoint/ws

# Dev environment:
ZOOM_OAUTH_BASE_URL=https://zoomdev.us
ZOOM_API_BASE_URL=https://zoomdev.us

# Production environment:
# ZOOM_OAUTH_BASE_URL=https://zoom.us
# ZOOM_API_BASE_URL=https://api.zoom.us
```

> ⚠️ `api.zoomdev.us` does not exist. Dev environment OAuth and API both use `https://zoomdev.us`.

Channels auto-enable when their credentials are present — no extra configuration needed.

### Build and restart

```bash
npm run build
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

## Phase 4: Registration

### Get the JID

NanoClaw needs to see one message from you to capture the JID. Present both options and recommend DM first:

> **Option A (recommended): Direct Message**
>
> 1. In Zoom Team Chat, search for the bot by name (e.g. "ZoomClaw")
> 2. Open the DM window with the bot
> 3. Send any message (e.g. "hi")
>
> This is the simplest path — no need to add the bot to a channel first.
>
> ---
>
> **Option B: Channel**
>
> 1. Open a Zoom Team Chat channel
> 2. Add the bot/app to that channel if not already there
> 3. Send a message and @mention the bot (e.g. `@ZoomClaw hello`)
>
> The bot won't respond yet (channel not registered), but NanoClaw will log the event.

**Stop here and wait for the user to confirm they sent the message before continuing.**

**If the user chose DM**, find the JID from logs:

```bash
tail -20 logs/nanoclaw.log | grep "unregistered user"
```

The JID appears as `zoom:dm:<userId>`. If nothing shows up, query the database:

```bash
sqlite3 store/messages.db "SELECT jid FROM chats WHERE jid LIKE 'zoom:dm:%' ORDER BY last_message_time DESC LIMIT 5;"
```

**If the user chose a channel**, find the JID from logs:

```bash
tail -20 logs/nanoclaw.log | grep "unregistered channel"
```

The JID appears as `zoom:<channel_id>`. If nothing shows up, query the database:

```bash
sqlite3 store/messages.db "SELECT jid FROM chats WHERE jid LIKE 'zoom:%' AND jid NOT LIKE 'zoom:dm:%' ORDER BY last_message_time DESC LIMIT 5;"
```

**Alternative for channel JID:** Decode the Zoom channel URL. When opening a channel in Zoom Team Chat (web), the URL may contain a base64 payload. Decode it: `echo '<base64>' | base64 -d` — the result has `{"sid":"<channel_id>@conference.xmppdev.zoom.us"}`; use the part before `@` as channel_id.

### Register the channel

**DM** (recommended — `bot_notification` events, no @mention needed):

DM JIDs take the form `zoom:dm:<userId>` where `userId` comes from `payload.userId` in the `bot_notification` event.

```typescript
registerGroup("zoom:dm:<userId>", {
  name: "<person-name>",
  folder: "main",  // isMain groups always share the main folder
  trigger: `@${ASSISTANT_NAME}`,
  added_at: new Date().toISOString(),
  requiresTrigger: false,
  isMain: true,
});
```

**Channel** (requires @bot mention to trigger):

```typescript
registerGroup("zoom:<channel_id>", {
  name: "<channel-name>",
  folder: "zoom_<channel-name>",
  trigger: `@${ASSISTANT_NAME}`,
  added_at: new Date().toISOString(),
  requiresTrigger: true,
});
```

**Channel as main group** (no trigger required — elevated privileges):

```typescript
registerGroup("zoom:<channel_id>", {
  name: "<channel-name>",
  folder: "main",  // isMain groups always share the main folder
  trigger: `@${ASSISTANT_NAME}`,
  added_at: new Date().toISOString(),
  requiresTrigger: false,
  isMain: true,
});
```

Restart NanoClaw to pick up the new group:

```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

## Phase 5: Verify

### Test the connection

**Channel:**

> In your registered Zoom Team Chat channel, `@YourBotName` with a message like "hello".
>
> The bot should respond within a few seconds.

**DM:**

> Send a direct message to the bot (search for its name in Zoom Team Chat and open a DM).
>
> The bot should respond within a few seconds — no @mention needed.

### Check logs if needed

```bash
tail -f logs/nanoclaw.log
```

## Troubleshooting

### Bot not responding

1. Check all five env vars are set in `.env` AND synced to `data/env/env`
2. Check channel is registered: `sqlite3 store/messages.db "SELECT * FROM registered_groups WHERE jid LIKE 'zoom:%'"`
3. Verify the bot is installed to the correct channel (step: **Add your app** → **Local test** → **Add app now**)
4. Service is running: `launchctl list | grep nanoclaw`

### WebSocket won't connect

1. Check `ZOOM_WEBSOCKET_URL` is correct — copy from **Features** → **Event Subscription** in the Marketplace app settings
2. Verify `ZOOM_OAUTH_BASE_URL` matches your environment (dev: `https://zoomdev.us`, prod: `https://zoom.us`)
3. Check token: `curl -s -X POST "${ZOOM_OAUTH_BASE_URL}/oauth/token?grant_type=client_credentials" -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)" | jq .`

### 401 errors

1. Check `ZOOM_CLIENT_ID` and `ZOOM_CLIENT_SECRET` match the App Credentials page
2. Verify the app scope includes `team_chat:read:user_message` and `imchat:userapp`
3. Verify the app is installed to your account (**Add your app** → **Local test**)

### Bot connected but no events received

1. Check the App Manifest has `event_subscription.events[0].communicate_type = "WEB_SOCKET"`
2. Verify the subscription event types include `team_chat.app_mention` (channels) and `bot_notification` (DMs)
3. Confirm the app is installed to the specific channel (not just the account)

## After Setup

The Zoom channel supports:
- **@mention events** — bot responds when @mentioned in registered channels (`team_chat.app_mention`)
- **Direct messages** — bot responds to DMs via `bot_notification` events; JID format is `zoom:dm:<userId>`
- **Thread replies** — bot replies are threaded to the triggering message via `reply_to`
- **Typing indicator** — ⏳ emoji reaction added while the agent processes; removed when done (requires emoji reaction API permission)
- **Multi-channel** — can run alongside other channels (auto-enabled by credentials)
- **Long message splitting** — replies over 4000 UTF-8 bytes are split into multiple messages

## Known Limitations

- **Only @mention events** — Zoom only pushes `team_chat.app_mention` events. `requiresTrigger: false` channels still only receive @mention events (cannot receive all channel messages). This is a Zoom API constraint.
- **No file/image handling** — only text content is processed
- **Typing emoji requires permissions** — if the app lacks emoji reaction scope, `setTyping` silently no-ops
- **Message splitting is naive** — split at fixed 4000-byte boundary, may break mid-word in edge cases
