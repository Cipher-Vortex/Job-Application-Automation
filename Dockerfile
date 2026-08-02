# Node.js + Python Hybrid Environment Dockerfile
FROM node:20-slim AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

FROM python:3.12-slim
WORKDIR /app

# Install System dependencies & Playwright dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install --with-deps chromium

COPY . .

EXPOSE 3000 8000

CMD ["sh", "-c", "npm start & uvicorn backend.main:app --host 0.0.0.0 --port 8000"]
