# Always-on builder host (Render/Railway/Fly). Node + yt-dlp; serves the builder
# UI + /api + the generated /store. Reads GEMINI_API_KEY / SERP_API_KEY from env.
FROM node:20-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates git curl \
 && pip3 install --no-cache-dir --break-system-packages yt-dlp \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# host platforms inject PORT; server.js reads process.env.PORT
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server.js"]
