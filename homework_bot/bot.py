"""Telegram handlers and the background polling job."""

import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from telegram import Update
from telegram.constants import ParseMode
from telegram.error import Forbidden, TelegramError
from telegram.ext import Application, CommandHandler, ContextTypes, filters

from .config import Config
from .formatting import format_digest, format_list, format_reminder, split_message
from .managebac import (
    Assignment,
    FeedError,
    fetch_feed,
    matches_ignore,
    normalize_feed_url,
    parse_feed,
)
from .reminders import covered_leads, digest_due, due_reminders
from .storage import Storage, User

log = logging.getLogger(__name__)

LOOKAHEAD = timedelta(days=30)
DEFAULT_LIST_DAYS = 14
MAX_LIST_DAYS = 90

HELP = (
    "<b>ManageBac homework reminders</b>\n\n"
    "/connect <code>&lt;link&gt;</code> – link your ManageBac calendar\n"
    "/homework [days] – upcoming homework (default 14 days)\n"
    "/remind <code>24 3</code> – hours before a deadline to remind you (<code>off</code> to disable)\n"
    "/digest <code>08:00</code> – daily summary time (<code>off</code> to disable)\n"
    "/timezone <code>Europe/London</code> – your timezone\n"
    "/ignore <code>word1, word2</code> – hide items containing these words (<code>clear</code> to reset)\n"
    "/settings – show current settings\n"
    "/disconnect – forget my link and settings\n\n"
    "<b>How to get the link:</b> ManageBac → My Workspace → View Full Calendar → "
    "<i>Subscribe to Calendar</i> → copy the URL. Treat it like a password: anyone "
    "with it can read your calendar. I'll delete the message you paste it in."
)


class App:
    """Holds shared state (config, db, http client) for handlers and jobs."""

    def __init__(self, config: Config, storage: Storage, http: httpx.AsyncClient):
        self.config = config
        self.storage = storage
        self.http = http

    # --- helpers -----------------------------------------------------------

    async def load_assignments(self, user: User, now: datetime) -> list[Assignment]:
        data = await fetch_feed(self.http, user.feed_url, self.config.allowed_feed_hosts)
        items = parse_feed(data, ZoneInfo(user.timezone), now - timedelta(hours=1), now + LOOKAHEAD)
        return [a for a in items if not matches_ignore(a, user.ignore_words)]

    async def reply(self, update: Update, text: str) -> None:
        for chunk in split_message(text):
            await update.effective_message.reply_text(
                chunk, parse_mode=ParseMode.HTML, disable_web_page_preview=True
            )

    # --- commands ----------------------------------------------------------

    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        await self.reply(update, HELP)

    async def connect(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg = update.effective_message
        chat_id = update.effective_chat.id
        if not context.args:
            await self.reply(update, "Usage: /connect <code>&lt;your ManageBac calendar link&gt;</code>\n\n" + HELP)
            return
        # The link is a secret: remove it from the chat history right away.
        try:
            await msg.delete()
        except TelegramError:
            pass

        async def say(text: str) -> None:
            await context.bot.send_message(chat_id, text, parse_mode=ParseMode.HTML)

        try:
            url = normalize_feed_url(context.args[0], self.config.allowed_feed_hosts)
            existing = self.storage.get_user(chat_id)
            tz = existing.timezone if existing else self.config.default_timezone
            now = datetime.now(timezone.utc)
            data = await fetch_feed(self.http, url, self.config.allowed_feed_hosts)
            items = parse_feed(data, ZoneInfo(tz), now - timedelta(hours=1), now + LOOKAHEAD)
        except FeedError as exc:
            await say(f"❌ {exc}")
            return
        self.storage.save_feed(chat_id, url, self.config.default_timezone)
        await say(
            f"✅ Connected (I deleted your message with the link). I can see {len(items)} "
            f"upcoming item(s) in the next 30 days.\n\n"
            f"Timezone: <code>{tz}</code>. If that's wrong, use /timezone. "
            "Try /homework now, and /settings to tune reminders."
        )

    async def disconnect(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        self.storage.delete_user(update.effective_chat.id)
        await self.reply(update, "Done – your link and settings are deleted.")

    async def _require_user(self, update: Update) -> User | None:
        user = self.storage.get_user(update.effective_chat.id)
        if user is None:
            await self.reply(update, "You haven't connected ManageBac yet – use /connect.")
        return user

    async def homework(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        user = await self._require_user(update)
        if user is None:
            return
        days = DEFAULT_LIST_DAYS
        if context.args:
            try:
                days = min(max(1, int(context.args[0])), MAX_LIST_DAYS)
            except ValueError:
                await self.reply(update, "Usage: /homework [number of days]")
                return
        now = datetime.now(timezone.utc)
        try:
            items = await self.load_assignments(user, now)
        except FeedError as exc:
            await self.reply(update, f"❌ {exc}")
            return
        tz = ZoneInfo(user.timezone)
        items = [a for a in items if a.due <= now + timedelta(days=days)]
        if not items:
            await self.reply(update, f"Nothing due in the next {days} days 🎉")
            return
        await self.reply(update, format_list(f"📚 <b>Due in the next {days} days</b>", items, tz, now))

    async def remind(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        user = await self._require_user(update)
        if user is None:
            return
        args = [a.lower() for a in context.args]
        if args == ["off"]:
            hours: list[int] = []
        else:
            try:
                hours = sorted({int(a) for a in args}, reverse=True)
            except ValueError:
                hours = []
            if not hours or any(not 1 <= h <= 24 * 14 for h in hours):
                await self.reply(update, "Usage: /remind <code>24 3</code> (hours before deadline, 1–336) or /remind <code>off</code>")
                return
        self.storage.update_setting(user.chat_id, "remind_hours", hours)
        await self.reply(
            update,
            "Reminders: " + (", ".join(f"{h}h" for h in hours) + " before each deadline." if hours else "off."),
        )

    async def digest(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        user = await self._require_user(update)
        if user is None:
            return
        arg = context.args[0].lower() if context.args else ""
        if arg == "off":
            value = None
        else:
            try:
                parsed = datetime.strptime(arg, "%H:%M")
                value = parsed.strftime("%H:%M")
            except ValueError:
                await self.reply(update, "Usage: /digest <code>08:00</code> (24h, your timezone) or /digest <code>off</code>")
                return
        self.storage.update_setting(user.chat_id, "digest_time", value)
        await self.reply(update, f"Daily digest: {value + ' (' + user.timezone + ')' if value else 'off'}.")

    async def timezone(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        user = await self._require_user(update)
        if user is None:
            return
        name = context.args[0] if context.args else ""
        try:
            ZoneInfo(name)
        except (ZoneInfoNotFoundError, ValueError):
            await self.reply(update, "Usage: /timezone <code>Europe/London</code> (an IANA name like Asia/Dubai, America/New_York)")
            return
        self.storage.update_setting(user.chat_id, "timezone", name)
        await self.reply(update, f"Timezone set to <code>{name}</code>.")

    async def ignore(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        user = await self._require_user(update)
        if user is None:
            return
        raw = " ".join(context.args).strip()
        if not raw:
            await self.reply(update, "Usage: /ignore <code>lesson, CAS</code> or /ignore <code>clear</code>")
            return
        words = [] if raw.lower() == "clear" else [w.strip() for w in raw.split(",") if w.strip()]
        self.storage.update_setting(user.chat_id, "ignore_words", words)
        await self.reply(update, "Ignoring items containing: " + (", ".join(words) if words else "nothing."))

    async def settings(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        user = await self._require_user(update)
        if user is None:
            return
        await self.reply(
            update,
            "<b>Settings</b>\n"
            f"Timezone: <code>{user.timezone}</code>\n"
            f"Reminders: {', '.join(f'{h}h' for h in user.remind_hours) or 'off'} before deadline\n"
            f"Daily digest: {user.digest_time or 'off'}\n"
            f"Ignoring: {', '.join(user.ignore_words) or 'nothing'}",
        )

    # --- background job ----------------------------------------------------

    async def poll(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        self.storage.prune_sent()
        now = datetime.now(timezone.utc)
        for user in self.storage.all_users():
            try:
                await self._poll_user(context, user, now)
            except Forbidden:
                log.info("User %s blocked the bot; removing", user.chat_id)
                self.storage.delete_user(user.chat_id)
            except Exception:
                log.exception("Polling failed for chat %s", user.chat_id)

    async def _poll_user(
        self, context: ContextTypes.DEFAULT_TYPE, user: User, now: datetime
    ) -> None:
        tz = ZoneInfo(user.timezone)
        try:
            items = await self.load_assignments(user, now)
        except FeedError as exc:
            log.warning("Feed error for chat %s: %s", user.chat_id, exc)
            if exc.permanent and not self.storage.was_sent(user.chat_id, "feed_error", "feed"):
                self.storage.mark_sent(user.chat_id, "feed_error", "feed")
                await context.bot.send_message(
                    user.chat_id,
                    "⚠️ ManageBac no longer accepts your calendar link, so I can't check "
                    "homework. Use /connect with a fresh link (the old one may have been regenerated).",
                )
            return
        self.storage.clear_sent(user.chat_id, "feed_error", "feed")

        # Deadline reminders
        sent = {
            (a.key, h)
            for a in items
            for h in user.remind_hours
            if self.storage.was_sent(user.chat_id, f"remind:{h}", a.key)
        }
        for a, _hours in due_reminders(items, user.remind_hours, sent, now):
            await context.bot.send_message(
                user.chat_id, format_reminder(a, tz, now),
                parse_mode=ParseMode.HTML, disable_web_page_preview=True,
            )
            for h in covered_leads(a, user.remind_hours, now):
                self.storage.mark_sent(user.chat_id, f"remind:{h}", a.key)

        # Daily digest
        day = digest_due(user.digest_time, tz, now)
        if day and not self.storage.was_sent(user.chat_id, "digest", day):
            self.storage.mark_sent(user.chat_id, "digest", day)
            week = [a for a in items if a.due <= now + timedelta(days=7)]
            if week:
                for chunk in split_message(format_digest(week, tz, now)):
                    await context.bot.send_message(
                        user.chat_id, chunk, parse_mode=ParseMode.HTML, disable_web_page_preview=True
                    )


def build_application(config: Config, storage: Storage, http: httpx.AsyncClient) -> Application:
    async def close_http(_: Application) -> None:
        await http.aclose()

    app = Application.builder().token(config.telegram_token).post_shutdown(close_http).build()
    h = App(config, storage, http)

    # Only private chats (the feed URL is a secret), optionally an allowlist.
    gate = filters.ChatType.PRIVATE
    if config.allowed_user_ids:
        gate = gate & filters.User(user_id=set(config.allowed_user_ids))

    for name, fn in [
        ("start", h.start), ("help", h.start), ("connect", h.connect),
        ("disconnect", h.disconnect), ("homework", h.homework), ("remind", h.remind),
        ("digest", h.digest), ("timezone", h.timezone), ("ignore", h.ignore),
        ("settings", h.settings),
    ]:
        app.add_handler(CommandHandler(name, fn, filters=gate))

    app.job_queue.run_repeating(
        h.poll, interval=config.poll_interval_minutes * 60, first=10, name="poll"
    )
    return app
