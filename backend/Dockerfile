FROM python:3.12-slim

WORKDIR /app

# Install deps first (cached layer unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Run migrations then start the server.
# Using a shell entrypoint so we can chain commands.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"]

EXPOSE 8000
