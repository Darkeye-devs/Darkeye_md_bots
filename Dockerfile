FROM node:20-slim

# ffmpeg powers video stickers; build tools cover native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .
RUN mkdir -p data logs

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "src/index.js"]
