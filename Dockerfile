##FROM node:12-slim
##
##RUN apt update
##RUN apt install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
##RUN apt-get install -y build-essential
## We don't need the standalone Chromium
##ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
##
##RUN apt-get update && apt-get install gnupg wget -y && \
##  wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
##  sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
##  apt-get update && \
##  apt-get install google-chrome-stable -y --no-install-recommends && \
##  rm -rf /var/lib/apt/lists/*
##
##RUN npm install -g puppeteer
#
#
#
##FROM node:16
##
### Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
### Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
### installs, work.
##RUN apt-get update \
##    && apt-get install -y wget gnupg \
##    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
##    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
##    && apt-get update \
##    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 \
##      --no-install-recommends \
##    && rm -rf /var/lib/apt/lists/*
##
##WORKDIR /home/pptruser
##RUN npm i puppeteer \
##    # Add user so we don't need --no-sandbox.
##    # same layer as npm install to keep re-chowned files from using up several hundred MBs more space
##    && groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
##    && mkdir -p /home/pptruser/Downloads \
##    && chown -R pptruser:pptruser /home/pptruser \
##    && (node -e "require('child_process').execSync(require('puppeteer').executablePath() + ' --credits', {stdio: 'inherit'})" > THIRD_PARTY_NOTICES)
##
##USER pptruser
##COPY ./package*.json ./
##RUN npm ci
##COPY . ./
##CMD ["google-chrome-stable"]
###ENTRYPOINT ["node", "/index.js"]
#
#FROM node:current-alpine
#
## manually installing chrome
#RUN apk add chromium
#ENV PYTHONUNBUFFERED=1
#RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python
#RUN python3 -m ensurepip
#RUN pip3 install --no-cache --upgrade pip setuptools
#RUN apk add --update make automake gcc g++ subversion python3-dev
## skips puppeteer installing chrome and points to correct binary
#ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
#    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
#
#WORKDIR /app
#COPY ["package.json", "package-lock.json*", "./"]
##RUN npm install

#FROM node:15.11.0
#
#RUN apt update
#
#RUN apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libnss3 lsb-release xdg-utils wget ca-certificates
#
#COPY . ./app


#FROM node:18.9.0
#RUN  apt-get update \
#     # See https://crbug.com/795759
#     && apt-get install -yq libgconf-2-4 \
#     # Install latest chrome dev package, which installs the necessary libs to
#     # make the bundled version of Chromium that Puppeteer installs work.
#     && apt-get install -y wget xvfb --no-install-recommends \
#     && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
#     && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
#     && apt-get update \
#     && apt-get install -y google-chrome-stable --no-install-recommends \
#     && rm -rf /var/lib/apt/lists/*
#
#
#ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
#
#COPY . ./app
#WORKDIR /app


FROM ubuntu:20.04

#RUN apt update
#RUN apt-get install -y build-essential
#ENV NODE_VERSION=15.11.0
#RUN apt install -y curl
#RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
#ENV NVM_DIR=/root/.nvm
#RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
#RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
#RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
#ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"
#RUN node --version
#RUN npm --version
#
#RUN apt-get install -y python3.7
#RUN python3 --version
#
#RUN apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget libgbm-dev
