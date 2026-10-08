from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from homework_bot.managebac import Assignment
from homework_bot.reminders import covered_leads, digest_due, due_reminders

NOW = datetime(2026, 10, 12, 12, 0, tzinfo=timezone.utc)


def mk(key, hours_from_now):
    return Assignment(key, key, NOW + timedelta(hours=hours_from_now), False)


def test_nothing_due_yet():
    assert due_reminders([mk("a", 48)], [24, 3], set(), NOW) == []


def test_first_lead_reached():
    [(a, h)] = due_reminders([mk("a", 23)], [24, 3], set(), NOW)
    assert (a.key, h) == ("a", 24)


def test_second_lead_fires_after_first_was_sent():
    a = mk("a", 2)
    [(_, h)] = due_reminders([a], [24, 3], {("a", 24)}, NOW)
    assert h == 3
    assert due_reminders([a], [24, 3], {("a", 24), ("a", 3)}, NOW) == []


def test_late_connect_sends_only_tightest_and_covers_looser():
    a = mk("a", 2)
    [(got, h)] = due_reminders([a], [24, 3], set(), NOW)
    assert h == 3
    assert covered_leads(a, [24, 3], NOW) == [24, 3]


def test_past_due_never_reminded():
    assert due_reminders([mk("a", -1)], [24, 3], set(), NOW) == []


def test_no_leads_configured():
    assert due_reminders([mk("a", 1)], [], set(), NOW) == []


def test_each_assignment_independent():
    got = due_reminders([mk("a", 2), mk("b", 30), mk("c", 20)], [24, 3], set(), NOW)
    assert {a.key for a, _ in got} == {"a", "c"}


LONDON = ZoneInfo("Europe/London")


def at(h, m=0):  # London local time on 12 Oct 2026 (BST, UTC+1)
    return datetime(2026, 10, 12, h, m, tzinfo=LONDON).astimezone(timezone.utc)


def test_digest_window():
    assert digest_due("08:00", LONDON, at(7, 59)) is None
    assert digest_due("08:00", LONDON, at(8, 0)) == "2026-10-12"
    assert digest_due("08:00", LONDON, at(13, 59)) == "2026-10-12"
    assert digest_due("08:00", LONDON, at(14, 0)) is None  # too late to be a "morning" digest
    assert digest_due(None, LONDON, at(8, 0)) is None


def test_digest_uses_user_timezone_not_utc():
    # 08:00 London is 07:00 UTC; at 08:00 UTC it's already 09:00 local
    assert digest_due("08:00", LONDON, datetime(2026, 10, 12, 7, 0, tzinfo=timezone.utc)) == "2026-10-12"
