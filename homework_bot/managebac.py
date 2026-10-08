"""Fetch and parse a ManageBac calendar subscription (iCal) feed.

ManageBac's public API needs an admin-issued token, so students can't use it.
Every student can however copy a private "Subscribe to Calendar" URL from
ManageBac; that is what this module reads.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from urllib.parse import urljoin, urlsplit
from zoneinfo import ZoneInfo

import httpx
import recurring_ical_events
from icalendar import Calendar

MAX_FEED_BYTES = 5 * 1024 * 1024
MAX_REDIRECTS = 3
ALL_DAY_DUE_TIME = time(23, 59)


class FeedError(Exception):
    """The feed could not be fetched or parsed."""

    def __init__(self, message: str, permanent: bool = False):
        super().__init__(message)
        # permanent = retrying will not help (bad/revoked URL)
        self.permanent = permanent


@dataclass(frozen=True)
class Assignment:
    key: str  # stable id for de-duplicating reminders
    title: str
    due: datetime  # timezone-aware, UTC
    all_day: bool
    description: str = ""
    url: str | None = None


def normalize_feed_url(raw: str, allowed_hosts: tuple[str, ...]) -> str:
    """Turn user input into a safe https URL or raise FeedError."""
    url = raw.strip()
    if url.lower().startswith("webcal://"):
        url = "https://" + url[len("webcal://"):]
    parts = urlsplit(url)
    if parts.scheme != "https" or not parts.hostname:
        raise FeedError("The link must start with https:// or webcal://", permanent=True)
    if not _host_allowed(parts.hostname, allowed_hosts):
        raise FeedError(
            "That doesn't look like a ManageBac link "
            f"(allowed domains: {', '.join(allowed_hosts)}).",
            permanent=True,
        )
    return url


def _host_allowed(host: str, allowed_hosts: tuple[str, ...]) -> bool:
    host = host.lower()
    return any(host == a or host.endswith("." + a) for a in allowed_hosts)


async def fetch_feed(
    client: httpx.AsyncClient, url: str, allowed_hosts: tuple[str, ...]
) -> bytes:
    """Download the feed. Redirects are followed only within allowed hosts."""
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        try:
            async with client.stream("GET", current, follow_redirects=False) as resp:
                if resp.is_redirect:
                    current = normalize_feed_url(
                        urljoin(current, resp.headers.get("location", "")), allowed_hosts
                    )
                    continue
                if resp.status_code in (401, 403, 404, 410):
                    raise FeedError(
                        f"ManageBac refused the link (HTTP {resp.status_code}).",
                        permanent=True,
                    )
                if resp.status_code >= 400:
                    raise FeedError(f"ManageBac returned HTTP {resp.status_code}.")
                body = bytearray()
                async for chunk in resp.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_FEED_BYTES:
                        raise FeedError("The calendar feed is unexpectedly large.")
                return bytes(body)
        except httpx.HTTPError as exc:
            # Don't include str(exc): httpx messages can contain the secret URL.
            raise FeedError(f"Could not reach ManageBac ({type(exc).__name__}).") from exc
    raise FeedError("Too many redirects.", permanent=True)


def _to_utc(value: date, user_tz: ZoneInfo) -> tuple[datetime, bool]:
    # datetime is a subclass of date, so check it first
    if isinstance(value, datetime):
        if value.tzinfo is None:  # "floating" time -> the user's local time
            value = value.replace(tzinfo=user_tz)
        return value.astimezone(timezone.utc), False
    local = datetime.combine(value, ALL_DAY_DUE_TIME, tzinfo=user_tz)
    return local.astimezone(timezone.utc), True


def parse_feed(
    data: bytes, user_tz: ZoneInfo, start: datetime, end: datetime
) -> list[Assignment]:
    """Return events whose start (= due time) falls in [start, end), sorted by due."""
    try:
        cal = Calendar.from_ical(data)
    except ValueError as exc:
        raise FeedError("That doesn't look like a calendar file.", permanent=True) from exc

    if not any(c.name == "VEVENT" for c in cal.walk()) and b"BEGIN:VCALENDAR" not in data:
        raise FeedError("That doesn't look like a calendar file.", permanent=True)

    result: dict[str, Assignment] = {}
    # Widen the window a little: all-day events are shifted to 23:59 local time.
    events = recurring_ical_events.of(cal).between(
        start - timedelta(days=1), end + timedelta(days=1)
    )
    for ev in events:
        if str(ev.get("STATUS", "")).upper() == "CANCELLED":
            continue
        dtstart = ev.get("DTSTART")
        if dtstart is None:
            continue
        due, all_day = _to_utc(dtstart.dt, user_tz)
        if not (start <= due < end):
            continue
        uid = str(ev.get("UID", "")) or str(ev.get("SUMMARY", ""))
        key = f"{uid}|{due.isoformat()}"
        url = ev.get("URL")
        result[key] = Assignment(
            key=key,
            title=" ".join(str(ev.get("SUMMARY", "")).split()) or "(untitled)",
            due=due,
            all_day=all_day,
            description=str(ev.get("DESCRIPTION", "")).strip(),
            url=str(url) if url else None,
        )
    return sorted(result.values(), key=lambda a: (a.due, a.title))


def matches_ignore(assignment: Assignment, ignore_words: list[str]) -> bool:
    haystack = f"{assignment.title}\n{assignment.description}".lower()
    return any(w.lower() in haystack for w in ignore_words if w)
