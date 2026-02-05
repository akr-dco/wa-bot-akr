FROM node:18

# Install dependencies for Chromium
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libdrm2 \
    libgbm1 \
    libxshmfence1 \
    chromium \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set timezone 
ENV TZ=Asia/Jakarta
# Tell puppeteer to use system chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create app directory
WORKDIR /app

# Copy and install app dependencies
COPY package*.json ./
RUN npm install

# Copy app source code
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
