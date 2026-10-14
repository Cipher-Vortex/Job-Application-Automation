# Node.js + Python Hybrid Environment Dockerfile
FROM node:20-slim AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
# Pre-compile the app to avoid RAM spikes on server boot
RUN npm run build
# Keep all modules since playwright is required for Node workers

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

# The Node frontend serves the UI/Dashboard and needs to be exposed to the public internet.
# Render/Cloud automatically injects $PORT (usually 10000 or 3000), which Node listens to.
# We bind Uvicorn (Python API) to port 8000 and Node to PORT (default 3000).
ENV FASTAPI_URL=http://127.0.0.1:8000
EXPOSE 3000 8000
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port 8000 & node server/index.js"]
