import logging

import httpx

from .bot import build_application
from .config import load_config
from .storage import Storage


def main() -> None:
    logging.basicConfig(
        format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO
    )
    # httpx logs full request URLs at INFO, and the calendar URL is a secret.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    config = load_config()
    storage = Storage(config.database_path)
    http = httpx.AsyncClient(timeout=httpx.Timeout(20.0), headers={"User-Agent": "homework-reminder-bot/1.0"})
    build_application(config, storage, http).run_polling()


if __name__ == "__main__":
    main()
