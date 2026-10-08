from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from homework_bot.formatting import format_digest, format_line, format_reminder, split_message
from homework_bot.managebac import Assignment

UTC = timezone.utc
LONDON = ZoneInfo("Europe/London")
NOW = datetime(2026, 10, 12, 8, 0, tzinfo=UTC)  # 09:00 London


def test_html_is_escaped():
    a = Assignment("k", "Essay <b>&</b>", NOW + timedelta(hours=5), False, url='https://x/?a="1"&b=2')
    line = format_line(a, LONDON, NOW)
    assert "Essay &lt;b&gt;&amp;&lt;/b&gt;" in line
    assert '"1"' not in line and "&quot;1&quot;" in line
    assert "in 5 h" in line


def test_all_day_shows_date_only():
    a = Assignment("k", "Read", datetime(2026, 10, 15, 22, 59, tzinfo=UTC), True)
    assert "Thu 15 Oct (in 3 days)" in format_line(a, LONDON, NOW)


def test_reminder_truncates_long_description():
    a = Assignment("k", "T", NOW + timedelta(hours=1), False, "x" * 1000)
    text = format_reminder(a, LONDON, NOW)
    assert len(text) < 500 and text.endswith("...</i>")


def test_digest_groups_by_local_day():
    # 23:30 UTC on the 12th is 00:30 London on the 13th -> "Tomorrow", not "Today"
    items = [
        Assignment("a", "A", datetime(2026, 10, 12, 15, 0, tzinfo=UTC), False),
        Assignment("b", "B", datetime(2026, 10, 12, 23, 30, tzinfo=UTC), False),
        Assignment("c", "C", datetime(2026, 10, 16, 9, 0, tzinfo=UTC), False),
    ]
    text = format_digest(items, LONDON, NOW)
    today, tomorrow, week = (text.index(s) for s in ("<b>Today", "<b>Tomorrow", "<b>This week"))
    assert today < text.index("<b>A<") < tomorrow < text.index("<b>B<") < week < text.index("<b>C<")


def test_split_message_respects_limit_and_keeps_lines():
    lines = [f"line {i} " + "y" * 50 for i in range(200)]
    chunks = split_message("\n".join(lines), limit=500)
    assert all(len(c) <= 500 for c in chunks) and len(chunks) > 1
    assert "\n".join(chunks).split("\n") == lines
