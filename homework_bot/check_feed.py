"""Debug helper: show how your ManageBac calendar feed is being read.

    python -m homework_bot.check_feed            # prompts for the link (hidden)
    python -m homework_bot.check_feed --raw      # also dump raw fields of each event

Use it before running the bot to confirm that your homework shows up with the
right due time. The link is a secret, so it is read with a hidden prompt rather
than as a command-line argument (which would land in your shell history).
"""

import argparse
import asyncio
import getpass
import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx
from dotenv import load_dotenv
from icalendar import Calendar

from .managebac import FeedError, fetch_feed, normalize_feed_url, parse_feed


async def run(raw: bool) -> None:
    cfg = load_config_lenient()
    url = normalize_feed_url(getpass.getpass("ManageBac calendar link (hidden): "), cfg[1])
    tz = ZoneInfo(cfg[0])
    now = datetime.now(timezone.utc)
    async with httpx.AsyncClient(timeout=20) as client:
        data = await fetch_feed(client, url, cfg[1])
    items = parse_feed(data, tz, now - timedelta(days=7), now + timedelta(days=60))
    print(f"\n{len(items)} event(s) from 7 days ago to 60 days ahead (times in {tz}):\n")
    for a in items:
        local = a.due.astimezone(tz)
        stamp = local.strftime("%a %d %b %Y") if a.all_day else local.strftime("%a %d %b %Y %H:%M")
        print(f"  {stamp}{' (all-day)' if a.all_day else ''}  {a.title}")
    if raw:
        print("\n--- raw events ---")
        for ev in Calendar.from_ical(data).walk("VEVENT"):
            print({k: str(v)[:120] for k, v in ev.items()})


def load_config_lenient() -> tuple[str, tuple[str, ...]]:
    """This tool doesn't need a bot token, so don't require one."""
    load_dotenv()
    tz = os.environ.get("DEFAULT_TIMEZONE", "UTC")
    hosts = tuple(
        h.strip().lower().lstrip(".")
        for h in os.environ.get("ALLOWED_FEED_HOSTS", "managebac.com,managebac.cn").split(",")
        if h.strip()
    )
    return tz, hosts


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", action="store_true", help="also print raw iCal fields")
    args = ap.parse_args()
    try:
        asyncio.run(run(args.raw))
    except FeedError as exc:
        raise SystemExit(f"Error: {exc}")


if __name__ == "__main__":
    main()
