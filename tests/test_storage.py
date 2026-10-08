from homework_bot.storage import Storage


def test_user_lifecycle():
    s = Storage(":memory:")
    assert s.get_user(1) is None
    s.save_feed(1, "https://a.managebac.com/x", "Europe/London")
    u = s.get_user(1)
    assert (u.timezone, u.remind_hours, u.digest_time, u.ignore_words) == ("Europe/London", [24, 3], "08:00", [])

    s.update_setting(1, "remind_hours", [48, 2])
    s.update_setting(1, "digest_time", None)
    s.update_setting(1, "ignore_words", ["lesson", "CAS"])
    s.update_setting(1, "timezone", "Asia/Dubai")
    u = s.get_user(1)
    assert (u.timezone, u.remind_hours, u.digest_time, u.ignore_words) == ("Asia/Dubai", [48, 2], None, ["lesson", "CAS"])

    s.update_setting(1, "remind_hours", [])
    assert s.get_user(1).remind_hours == []


def test_reconnect_keeps_settings():
    s = Storage(":memory:")
    s.save_feed(1, "https://a.managebac.com/old", "UTC")
    s.update_setting(1, "timezone", "Asia/Dubai")
    s.save_feed(1, "https://a.managebac.com/new", "UTC")
    u = s.get_user(1)
    assert u.feed_url.endswith("/new") and u.timezone == "Asia/Dubai"


def test_sent_log_and_delete():
    s = Storage(":memory:")
    s.save_feed(1, "u", "UTC")
    assert not s.was_sent(1, "remind:24", "k")
    s.mark_sent(1, "remind:24", "k")
    s.mark_sent(1, "remind:24", "k")  # idempotent
    assert s.was_sent(1, "remind:24", "k")
    assert not s.was_sent(1, "remind:3", "k")
    assert not s.was_sent(2, "remind:24", "k")
    s.delete_user(1)
    assert s.get_user(1) is None and not s.was_sent(1, "remind:24", "k")


def test_update_setting_rejects_unknown_column():
    s = Storage(":memory:")
    s.save_feed(1, "u", "UTC")
    try:
        s.update_setting(1, "feed_url; DROP TABLE users", "x")
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError")


def test_db_file_is_private(tmp_path):
    p = tmp_path / "sub" / "db.sqlite3"
    Storage(str(p))
    assert p.stat().st_mode & 0o777 == 0o600
