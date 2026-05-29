FROM node:20-slim

# Skip Puppeteer downloading its own Chromium copy to speed up builds
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Map path to system installed Google Chrome stable
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Install latest chrome dev package and fonts to support major charsets
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user with UID 1000 for Hugging Face Spaces compatibility
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Set working directory inside user's home
WORKDIR $HOME/app

# Install dependencies (only copy backend package files)
COPY --chown=user:user backend/package*.json ./
RUN npm install

# Copy backend source code with correct ownership
COPY --chown=user:user backend/ .

# Expose port (3001 by default, Hugging Face maps port 7860 dynamically via the PORT env variable)
EXPOSE 3001

# Command to run
CMD [ "node", "server.js" ]
