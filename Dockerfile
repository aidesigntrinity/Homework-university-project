FROM python:3.13-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/data/bot.sqlite3

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY homework_bot ./homework_bot
RUN mkdir -p /data

CMD ["python", "-m", "homework_bot"]
