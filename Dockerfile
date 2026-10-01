# Node.js + Python Hybrid Environment Dockerfile
FROM node:20-slim AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .

FROM python:3.12-slim
WORKDIR /app

# Install System dependencies & Playwright dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
# Force torch CPU-only wheels first to prevent 2GB+ CUDA package blob downloads from sentence-transformers
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install --with-deps chromium

COPY . .
# Copy the built node_modules from the first stage
COPY --from=frontend-build /app/node_modules ./node_modules

EXPOSE 3000 8000

CMD ["sh", "-c", "npm start & uvicorn backend.main:app --host 0.0.0.0 --port 8000"]
