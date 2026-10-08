import asyncio
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx
import pytest
import respx

from homework_bot.managebac import (
    Assignment,
    FeedError,
    fetch_feed,
    matches_ignore,
    normalize_feed_url,
    parse_feed,
)

HOSTS = ("managebac.com", "managebac.cn")
LONDON = ZoneInfo("Europe/London")
START = datetime(2026, 10, 8, tzinfo=timezone.utc)
END = datetime(2026, 11, 8, tzinfo=timezone.utc)


def by_title(items):
    return {a.title: a for a in items}


def test_parse_timed_utc(sample_ics):
    a = by_title(parse_feed(sample_ics, LONDON, START, END))["Physics: Lab report"]
    assert a.due == datetime(2026, 10, 12, 14, 0, tzinfo=timezone.utc)
    assert not a.all_day
    assert a.url == "https://school.managebac.com/student/tasks/1"
    assert "pendulum" in a.description


def test_parse_tzid_converted_to_utc(sample_ics):
    # 12:00 in London on 13 Oct 2026 is BST (UTC+1)
    a = by_title(parse_feed(sample_ics, LONDON, START, END))["English essay"]
    assert a.due == datetime(2026, 10, 13, 11, 0, tzinfo=timezone.utc)


def test_all_day_is_end_of_day_in_user_timezone(sample_ics):
    a = by_title(parse_feed(sample_ics, LONDON, START, END))["History reading"]
    assert a.all_day
    assert a.due.astimezone(LONDON).strftime("%Y-%m-%d %H:%M") == "2026-10-15 23:59"
    dubai = by_title(parse_feed(sample_ics, ZoneInfo("Asia/Dubai"), START, END))["History reading"]
    assert dubai.due.astimezone(ZoneInfo("Asia/Dubai")).strftime("%H:%M") == "23:59"


def test_floating_time_uses_user_timezone(sample_ics):
    a = by_title(parse_feed(sample_ics, LONDON, START, END))["Floating time task"]
    assert a.due == datetime(2026, 10, 14, 8, 0, tzinfo=timezone.utc)  # 09:00 BST


def test_recurring_events_expanded_with_distinct_keys(sample_ics):
    lessons = [a for a in parse_feed(sample_ics, LONDON, START, END) if a.title == "Maths lesson"]
    assert len(lessons) == 4
    assert len({a.key for a in lessons}) == 4


def test_cancelled_skipped_and_title_whitespace_collapsed(sample_ics):
    titles = {a.title for a in parse_feed(sample_ics, LONDON, START, END)}
    assert "Cancelled quiz" not in titles
    assert "Title with newline and spaces" in titles


def test_window_and_sorting(sample_ics):
    items = parse_feed(sample_ics, LONDON, datetime(2026, 10, 13, tzinfo=timezone.utc),
                       datetime(2026, 10, 16, tzinfo=timezone.utc))
    assert [a.due for a in items] == sorted(a.due for a in items)
    assert "Physics: Lab report" not in {a.title for a in items}


def test_garbage_is_rejected():
    with pytest.raises(FeedError) as e:
        parse_feed(b"<html>please log in</html>", LONDON, START, END)
    assert e.value.permanent


def test_empty_calendar_is_fine():
    assert parse_feed(b"BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n", LONDON, START, END) == []


def test_matches_ignore():
    a = Assignment("k", "Maths LESSON", START, False, "room 4")
    assert matches_ignore(a, ["lesson"])
    assert matches_ignore(a, ["ROOM"])
    assert not matches_ignore(a, ["physics"])
    assert not matches_ignore(a, [])


@pytest.mark.parametrize(
    "raw",
    [
        "http://school.managebac.com/x.ics",
        "https://evil.example.com/x.ics",
        "https://managebac.com.evil.example/x.ics",
        "https://notmanagebac.com/x.ics",
        "ftp://school.managebac.com/x",
        "not a url",
        "https://169.254.169.254/latest/meta-data",
    ],
)
def test_normalize_rejects(raw):
    with pytest.raises(FeedError):
        normalize_feed_url(raw, HOSTS)


def test_normalize_accepts_webcal_and_subdomains():
    assert normalize_feed_url("webcal://school.managebac.com/c.ics?t=1", HOSTS) == \
        "https://school.managebac.com/c.ics?t=1"
    assert normalize_feed_url("  https://managebac.com/c.ics ", HOSTS) == "https://managebac.com/c.ics"
    assert normalize_feed_url("https://x.managebac.cn/c", HOSTS)


def _fetch(url, routes):
    async def go():
        async with httpx.AsyncClient() as c:
            return await fetch_feed(c, url, HOSTS)
    with respx.mock:
        routes()
        return asyncio.run(go())


def test_fetch_ok():
    url = "https://school.managebac.com/c.ics"
    assert _fetch(url, lambda: respx.get(url).respond(200, content=b"BEGIN:VCALENDAR")) == b"BEGIN:VCALENDAR"


def test_fetch_follows_redirect_within_allowed_hosts():
    a, b = "https://school.managebac.com/a", "https://cdn.managebac.com/b"
    def routes():
        respx.get(a).respond(302, headers={"location": b})
        respx.get(b).respond(200, content=b"ok")
    assert _fetch(a, routes) == b"ok"


def test_fetch_refuses_redirect_to_other_host():
    a = "https://school.managebac.com/a"
    with pytest.raises(FeedError):
        _fetch(a, lambda: respx.get(a).respond(302, headers={"location": "http://169.254.169.254/"}))


@pytest.mark.parametrize("status,permanent", [(403, True), (404, True), (500, False), (503, False)])
def test_fetch_http_errors(status, permanent):
    url = "https://school.managebac.com/c.ics"
    with pytest.raises(FeedError) as e:
        _fetch(url, lambda: respx.get(url).respond(status))
    assert e.value.permanent is permanent


def test_fetch_network_error_does_not_leak_url():
    url = "https://school.managebac.com/c.ics?token=SECRET123"
    with pytest.raises(FeedError) as e:
        _fetch(url, lambda: respx.get(url).mock(side_effect=httpx.ConnectError("boom " + url)))
    assert "SECRET123" not in str(e.value)
    assert not e.value.permanent
