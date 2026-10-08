"""Pure scheduling logic: decide what to tell the user, without any I/O."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from .managebac import Assignment

DIGEST_GRACE = timedelta(hours=6)  # don't send a "morning" digest hours late


def due_reminders(
    assignments: list[Assignment],
    remind_hours: list[int],
    already_sent: set[tuple[str, int]],
    now: datetime,
) -> list[tuple[Assignment, int]]:
    """Return (assignment, hours) pairs to send now.

    A reminder for lead time H becomes due once ``due - H`` has passed. If several
    lead times are due at once (e.g. the user just connected and the deadline is
    in 10h, with reminders at 24h and 3h) only the tightest one is sent, so the
    user isn't spammed. Callers should then mark every lead time returned by
    ``covered_leads`` as sent. ``already_sent`` holds (assignment.key, hours).
    """
    out: list[tuple[Assignment, int]] = []
    for a in assignments:
        if a.due <= now:
            continue
        reached = [h for h in remind_hours if a.due - timedelta(hours=h) <= now]
        if not reached:
            continue
        tightest = min(reached)
        if (a.key, tightest) in already_sent:
            continue
        out.append((a, tightest))
    return out


def covered_leads(assignment: Assignment, remind_hours: list[int], now: datetime) -> list[int]:
    """Lead times that count as handled once a reminder for this assignment was sent."""
    return [h for h in remind_hours if assignment.due - timedelta(hours=h) <= now]


def digest_due(digest_time: str | None, tz: ZoneInfo, now: datetime) -> str | None:
    """Return the local date key ("YYYY-MM-DD") if the digest should go out now."""
    if not digest_time:
        return None
    local = now.astimezone(tz)
    hh, mm = (int(x) for x in digest_time.split(":"))
    scheduled = datetime.combine(local.date(), time(hh, mm), tzinfo=tz)
    if scheduled <= local < scheduled + DIGEST_GRACE:
        return local.date().isoformat()
    return None
