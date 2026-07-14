# Always-on builder host (Render/Railway/Fly). Node + yt-dlp; serves the builder
# UI + /api + the generated /store. Reads GEMINI_API_KEY / SERP_API_KEY from env.
#
# Hardened for reliable auto-deploy on small free tiers: the old image used
# `pip3 install yt-dlp` (needs python3+pip, network-flaky) and added the GitHub
# CLI apt repo (key fetch + second apt-get) — any hiccup failed the WHOLE build,
# leaving the stale container live. Now both are single self-contained binary
# downloads, and gh is non-fatal, so a transient network error can't wedge the
# deploy.
FROM node:20-slim

# minimal base deps only
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git xz-utils \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# yt-dlp as the self-contained static binary (PyInstaller build — no python/pip,
# far fewer moving parts than the pip install).
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp \
 && /usr/local/bin/yt-dlp --version

# GitHub CLI (auto-publish each store to GitHub Pages via GH_TOKEN). NON-FATAL:
# if the download hiccups the build still succeeds; generation works without gh
# (store served at /store), only auto-publish is skipped.
RUN set -e; \
    GH_VER=2.63.2; \
    ( curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VER}/gh_${GH_VER}_linux_amd64.tar.gz" -o /tmp/gh.tgz \
      && tar -xzf /tmp/gh.tgz -C /tmp \
      && mv "/tmp/gh_${GH_VER}_linux_amd64/bin/gh" /usr/local/bin/gh \
      && chmod a+rx /usr/local/bin/gh \
      && rm -rf /tmp/gh.tgz "/tmp/gh_${GH_VER}_linux_amd64" \
      && gh --version ) \
    || echo "WARN: gh install skipped — auto-publish disabled, generation still works";

WORKDIR /app
COPY . .

# host platforms inject PORT; server.js reads process.env.PORT
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server.js"]
