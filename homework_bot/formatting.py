"""Render assignments as Telegram HTML messages."""

from datetime import datetime, timedelta
from html import escape
from zoneinfo import ZoneInfo

from .managebac import Assignment

TELEGRAM_LIMIT = 4096


def _relative(due: datetime, now: datetime) -> str:
    delta = due - now
    if delta < timedelta(0):
        return "overdue"
    if delta < timedelta(hours=1):
        return f"in {max(1, int(delta.total_seconds() // 60))} min"
    if delta < timedelta(hours=48):
        return f"in {int(delta.total_seconds() // 3600)} h"
    return f"in {delta.days} days"


def format_due(a: Assignment, tz: ZoneInfo, now: datetime) -> str:
    local = a.due.astimezone(tz)
    when = local.strftime("%a %d %b") if a.all_day else local.strftime("%a %d %b, %H:%M")
    return f"{when} ({_relative(a.due, now)})"


def format_line(a: Assignment, tz: ZoneInfo, now: datetime) -> str:
    title = escape(a.title)
    if a.url:
        title = f'<a href="{escape(a.url, quote=True)}">{title}</a>'
    return f"• <b>{title}</b>\n   {format_due(a, tz, now)}"


def format_list(header: str, items: list[Assignment], tz: ZoneInfo, now: datetime) -> str:
    return header + "\n\n" + "\n".join(format_line(a, tz, now) for a in items)


def format_reminder(a: Assignment, tz: ZoneInfo, now: datetime) -> str:
    text = f"⏰ <b>Homework due soon</b>\n\n{format_line(a, tz, now)}"
    if a.description:
        snippet = a.description if len(a.description) <= 300 else a.description[:297] + "..."
        text += f"\n\n<i>{escape(snippet)}</i>"
    return text


def format_digest(items: list[Assignment], tz: ZoneInfo, now: datetime) -> str:
    today = now.astimezone(tz).date()
    groups: dict[str, list[Assignment]] = {"Today": [], "Tomorrow": [], "This week": []}
    for a in items:
        days = (a.due.astimezone(tz).date() - today).days
        if days == 0:
            groups["Today"].append(a)
        elif days == 1:
            groups["Tomorrow"].append(a)
        else:
            groups["This week"].append(a)
    parts = ["🗓 <b>Homework digest</b>"]
    for name, group in groups.items():
        if group:
            parts.append(f"\n<b>{name}</b>\n" + "\n".join(format_line(a, tz, now) for a in group))
    return "\n".join(parts)


def split_message(text: str, limit: int = TELEGRAM_LIMIT) -> list[str]:
    """Split on line boundaries so HTML tags (one per line) stay intact."""
    chunks, current = [], ""
    for line in text.split("\n"):
        if current and len(current) + len(line) + 1 > limit:
            chunks.append(current)
            current = line
        else:
            current = f"{current}\n{line}" if current else line
    if current:
        chunks.append(current)
    return chunks
