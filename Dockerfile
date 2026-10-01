# Node.js + Python Hybrid Environment Dockerfile
FROM node:20-slim AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
# Pre-compile the app to avoid RAM spikes on server boot
RUN npm run build
# Strip out all heavy dev tools so the final image is extremely tiny
RUN npm prune --production --legacy-peer-deps

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
# Securely inject the pruned production dependencies and compiled codebase
COPY --from=frontend-build /app/node_modules ./node_modules
COPY --from=frontend-build /app/dist ./dist

# Render automatically assigns $PORT. We dynamically bind Uvicorn to it.
# We also launch the Node frontend. If Node uses process.env.PORT, we'll give it a static internal port instead so they don't clash.
ENV FRONTEND_PORT=3000
EXPOSE 3000 8000 10000

CMD ["sh", "-c", "PORT=$FRONTEND_PORT npm start & uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
