# Always-on builder host (Render/Railway/Fly). Node + yt-dlp; serves the builder
# UI + /api + the generated /store. Reads GEMINI_API_KEY / SERP_API_KEY from env.
FROM node:20-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates git curl gnupg \
 && pip3 install --no-cache-dir --break-system-packages yt-dlp \
 # GitHub CLI — lets the hosted builder auto-publish each store to GitHub Pages
 # (uses GH_TOKEN env). Without GH_TOKEN set, generation still works (store at /store).
 && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
 && apt-get update && apt-get install -y --no-install-recommends gh \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# host platforms inject PORT; server.js reads process.env.PORT
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server.js"]
