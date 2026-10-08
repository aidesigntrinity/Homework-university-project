"""End-to-end: handlers and the polling job against a fake Telegram and a mocked ManageBac."""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import httpx
import respx

from homework_bot.bot import App
from homework_bot.config import Config
from homework_bot.storage import Storage

URL = "https://school.managebac.com/student/calendar.ics?token=SECRET"
NOW = datetime(2026, 10, 12, 6, 0, tzinfo=timezone.utc)  # 07:00 in London
CONFIG = Config("tok", frozenset(), "Europe/London", 15, ("managebac.com",), ":memory:")


def ics(*events: tuple[str, datetime]) -> bytes:
    body = "".join(
        f"BEGIN:VEVENT\nUID:{t}\nDTSTAMP:20261001T000000Z\n"
        f"DTSTART:{d:%Y%m%dT%H%M%SZ}\nSUMMARY:{t}\nEND:VEVENT\n"
        for t, d in events
    )
    return f"BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//t//EN\n{body}END:VCALENDAR\n".encode()


def make_app():
    storage = Storage(":memory:")
    return App(CONFIG, storage, httpx.AsyncClient()), storage


def ctx(args=()):
    c = MagicMock()
    c.args = list(args)
    c.bot.send_message = AsyncMock()
    return c


def sent_texts(c):
    return [call.args[1] for call in c.bot.send_message.await_args_list]


def poll(app, c, now):
    user = app.storage.get_user(1)
    return asyncio.run(app._poll_user(c, user, now))


def test_reminders_are_sent_once_and_later_lead_still_fires():
    feed = ics(("Soon task", NOW + timedelta(hours=2)), ("Tomorrow task", NOW + timedelta(hours=20)),
               ("Far task", NOW + timedelta(days=5)))
    app, storage = make_app()
    storage.save_feed(1, URL, "Europe/London")
    storage.update_setting(1, "digest_time", None)
    c = ctx()
    with respx.mock:
        respx.get(URL).respond(200, content=feed)
        poll(app, c, NOW)
        texts = sent_texts(c)
        assert len(texts) == 2 and any("Soon task" in t for t in texts) and any("Tomorrow task" in t for t in texts)

        c.bot.send_message.reset_mock()
        poll(app, c, NOW + timedelta(minutes=15))  # nothing new
        assert c.bot.send_message.await_count == 0

        poll(app, c, NOW + timedelta(hours=18))  # Tomorrow task now 2h away -> 3h lead
        texts = sent_texts(c)
        assert len(texts) == 1 and "Tomorrow task" in texts[0]


def test_digest_sent_once_per_day():
    feed = ics(("Today task", NOW + timedelta(hours=5)), ("Later task", NOW + timedelta(days=3)))
    app, storage = make_app()
    storage.save_feed(1, URL, "Europe/London")
    storage.update_setting(1, "remind_hours", [])
    storage.update_setting(1, "digest_time", "07:00")
    c = ctx()
    with respx.mock:
        respx.get(URL).respond(200, content=feed)
        poll(app, c, NOW)
        [text] = sent_texts(c)
        assert "Today task" in text and "Later task" in text and "<b>Today" in text
        c.bot.send_message.reset_mock()
        poll(app, c, NOW + timedelta(minutes=15))
        assert c.bot.send_message.await_count == 0


def test_ignore_words_filter_reminders():
    feed = ics(("Maths lesson", NOW + timedelta(hours=2)), ("Essay", NOW + timedelta(hours=2)))
    app, storage = make_app()
    storage.save_feed(1, URL, "Europe/London")
    storage.update_setting(1, "digest_time", None)
    storage.update_setting(1, "ignore_words", ["lesson"])
    c = ctx()
    with respx.mock:
        respx.get(URL).respond(200, content=feed)
        poll(app, c, NOW)
    [text] = sent_texts(c)
    assert "Essay" in text


def test_revoked_link_notifies_once_and_recovers():
    app, storage = make_app()
    storage.save_feed(1, URL, "Europe/London")
    storage.update_setting(1, "digest_time", None)
    c = ctx()
    with respx.mock:
        route = respx.get(URL).respond(403)
        poll(app, c, NOW)
        poll(app, c, NOW + timedelta(minutes=15))
        assert c.bot.send_message.await_count == 1  # told once, not every poll
        assert "/connect" in sent_texts(c)[0]

        route.respond(200, content=ics())  # link works again
        poll(app, c, NOW + timedelta(minutes=30))
        route.respond(403)  # and breaks again -> user is told again
        poll(app, c, NOW + timedelta(minutes=45))
        assert c.bot.send_message.await_count == 2


def test_temporary_error_is_silent():
    app, storage = make_app()
    storage.save_feed(1, URL, "Europe/London")
    c = ctx()
    with respx.mock:
        respx.get(URL).respond(503)
        poll(app, c, NOW)
    assert c.bot.send_message.await_count == 0


def update_for(chat_id=1):
    u = MagicMock()
    u.effective_chat.id = chat_id
    u.effective_message.delete = AsyncMock()
    u.effective_message.reply_text = AsyncMock()
    return u


def test_connect_saves_link_deletes_message_and_never_echoes_secret():
    app, storage = make_app()
    u, c = update_for(), ctx([URL])
    with respx.mock:
        respx.get(URL).respond(200, content=ics(("Task", datetime.now(timezone.utc) + timedelta(days=2))))
        asyncio.run(app.connect(u, c))
    u.effective_message.delete.assert_awaited_once()
    assert storage.get_user(1).feed_url == URL
    [text] = sent_texts(c)
    assert "Connected" in text and "1 upcoming" in text and "SECRET" not in text


def test_connect_rejects_foreign_host_without_fetching():
    app, storage = make_app()
    u, c = update_for(), ctx(["https://evil.example.com/x.ics"])
    with respx.mock:  # no routes: any request would raise
        asyncio.run(app.connect(u, c))
    assert storage.get_user(1) is None
    assert "ManageBac" in sent_texts(c)[0]


def test_connect_rejects_non_calendar_content():
    app, storage = make_app()
    u, c = update_for(), ctx([URL])
    with respx.mock:
        respx.get(URL).respond(200, content=b"<html>Sign in</html>")
        asyncio.run(app.connect(u, c))
    assert storage.get_user(1) is None
    assert sent_texts(c)[0].startswith("❌")


def test_homework_command_lists_items():
    app, storage = make_app()
    storage.save_feed(1, URL, "Europe/London")
    u, c = update_for(), ctx()
    soon = datetime.now(timezone.utc) + timedelta(days=2)
    with respx.mock:
        respx.get(URL).respond(200, content=ics(("Chemistry sheet", soon)))
        asyncio.run(app.homework(u, c))
    assert "Chemistry sheet" in u.effective_message.reply_text.await_args.args[0]


def test_commands_require_connection():
    app, _ = make_app()
    u, c = update_for(), ctx()
    asyncio.run(app.homework(u, c))
    assert "/connect" in u.effective_message.reply_text.await_args.args[0]


def test_settings_commands_validate_input():
    app, storage = make_app()
    storage.save_feed(1, URL, "Europe/London")
    for fn, args in [(app.remind, ["abc"]), (app.remind, ["0"]), (app.remind, ["9999"]),
                     (app.digest, ["25:99"]), (app.timezone, ["Mars/Base"])]:
        u = update_for()
        asyncio.run(fn(u, ctx(args)))
        assert "Usage" in u.effective_message.reply_text.await_args.args[0], (fn, args)
    u = update_for()
    asyncio.run(app.remind(u, ctx(["3", "24", "3"])))
    assert storage.get_user(1).remind_hours == [24, 3]
    asyncio.run(app.digest(update_for(), ctx(["7:05"])))
    assert storage.get_user(1).digest_time == "07:05"
    asyncio.run(app.timezone(update_for(), ctx(["Asia/Dubai"])))
    assert storage.get_user(1).timezone == "Asia/Dubai"
