# syntax=docker/dockerfile:1
#
# SynOmics — Advanced Bioinformatics Platform ("Aistudio Core")
# Production container: Node 22 (API + built frontend) + Python 3.11 (compute engine).
#
# The core compute engine (server/synomics_engine.py) is dependency-free and runs
# on the stock python3 below. The heavier verifiable-AI modules (RDKit descriptors,
# causal discovery, neuro-symbolic, swarm, vision, Cython acceleration) need the
# scientific stack in requirements.txt. That install is gated behind a build arg so
# the image builds fast by default; set INSTALL_SCIENCE_STACK=true for the full platform.
#
#   docker build -t synomics .                                   # lean: core engine
#   docker build -t synomics --build-arg INSTALL_SCIENCE_STACK=true .   # full platform
#   docker run -p 8080:8080 -e PORT=8080 -e GEMINI_API_KEY=... synomics

FROM node:22-bookworm-slim AS build

WORKDIR /app

# Frontend + server bundle are built here; only node deps are needed at build time.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime image -------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ARG INSTALL_SCIENCE_STACK=false
ENV NODE_ENV=production \
    PORT=8080 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Python 3 (Debian bookworm ships 3.11) for the compute engine, plus build-essential
# only when the optional scientific stack is requested (Cython needs a C compiler).
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv \
 && if [ "$INSTALL_SCIENCE_STACK" = "true" ]; then apt-get install -y --no-install-recommends build-essential python3-dev; fi \
 && python3 -m venv /opt/venv \
 && rm -rf /var/lib/apt/lists/*

# Node runtime deps only (skip dev deps: vite/esbuild/tsx are build-time only).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Optional heavy scientific stack for the verifiable-AI modules.
COPY requirements.txt ./
RUN if [ "$INSTALL_SCIENCE_STACK" = "true" ]; then \
      pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt ; \
    else \
      echo "Skipping scientific stack (core engine is dependency-free). Set INSTALL_SCIENCE_STACK=true for full modules." ; \
    fi

# Built artifacts: frontend assets + esbuild server bundle land in dist/.
COPY --from=build /app/dist ./dist
# Python engine sources (server/*.py) are spawned at runtime by the Node server;
# the TS sources are already bundled into dist/server.mjs, so only the .py files matter.
COPY server ./server

# Drop root for runtime.
RUN chown -R node:node /app
USER node

EXPOSE 8080

# Container-native health probe hits the real /api/health route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.mjs"]
