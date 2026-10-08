# ManageBac homework reminder bot (Telegram)

A Telegram bot that watches your ManageBac calendar and messages you when homework is due.

## How it connects to ManageBac

ManageBac's public API needs a token issued by a school **administrator**, so students can't use it. Instead the bot uses the **calendar subscription link** that every student can copy from ManageBac (the same link you'd give Google Calendar). The bot downloads that iCal feed every 15 minutes.

- No ManageBac password is ever given to the bot.
- The link is a secret: anyone who has it can read your calendar. The bot deletes the message you paste it in, only fetches `managebac.com` / `managebac.cn` hosts, avoids logging it, and stores it in a `chmod 600` SQLite file. If it leaks, regenerate it in ManageBac.

## What it does

| Command | |
|---|---|
| `/connect <link>` | link your ManageBac calendar |
| `/homework [days]` | list what's due (default 14 days) |
| `/remind 24 3` | remind N hours before each deadline (`off` to disable) |
| `/digest 08:00` | daily summary of the next 7 days (`off` to disable) |
| `/timezone Europe/London` | your timezone (IANA name) |
| `/ignore lesson, CAS` | hide items containing these words (`clear` to reset) |
| `/settings`, `/disconnect` | show settings / delete everything the bot stores about you |

Defaults: reminders 24 h and 3 h before a deadline, digest at 08:00. If you connect when a deadline is already inside the 24 h window you get one reminder, not two.

## Setup

1. Message [@BotFather](https://t.me/BotFather), send `/newbot`, copy the token.
2. Install and configure:
   ```bash
   python3 -m venv .venv && . .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env      # then fill in TELEGRAM_BOT_TOKEN, DEFAULT_TIMEZONE
   ```
   Set `ALLOWED_USER_IDS` (get your ID from [@userinfobot](https://t.me/userinfobot)) if you don't want strangers using your bot.
3. **Check your feed first** (see below), then run the bot:
   ```bash
   python -m homework_bot
   ```
4. In Telegram: `/start`, then get your link in ManageBac — **My Workspace → View Full Calendar → Subscribe to Calendar** (menu names may differ slightly between ManageBac versions) — and send `/connect <link>`.

The bot must stay running to send reminders (a small VPS, Raspberry Pi, or any always-on machine; a systemd service or `tmux` is enough).

### Check how your feed looks

```bash
python -m homework_bot.check_feed        # paste the link at the hidden prompt
python -m homework_bot.check_feed --raw  # also dump raw iCal fields
```

This prints every event the bot sees with its due time. Run it once before trusting the reminders.

## Assumptions to verify against your school's feed

I could not test against a real ManageBac account, so these are assumptions:

- **Due time = the event's start time (`DTSTART`).** If your feed puts the deadline in `DTEND` instead, times will be off — `check_feed --raw` shows which.
- **All-day items are treated as due at 23:59 local time** on that date.
- **The feed may also contain lessons/events**, not just homework. Use `/ignore` to hide words that appear in those titles.
- Schools can restrict calendar subscriptions; if "Subscribe to Calendar" is missing for you, ask your school.
- Reminders only cover the next 30 days of the feed.

## Development

```bash
pip install -r requirements-dev.txt
python -m pytest
```

Layout: `managebac.py` (fetch + parse feed), `reminders.py` (pure scheduling logic), `storage.py` (SQLite), `formatting.py` (messages), `bot.py` (Telegram handlers + polling job).
