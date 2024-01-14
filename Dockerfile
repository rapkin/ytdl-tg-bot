FROM node:18-alpine

RUN set -x \
 && apk add --no-cache \
        curl \
        ffmpeg \
        gnupg \
        python3 \
        py3-pip \
        git \
 && pip3 install --upgrade pip \
 && pip3 install --no-cache-dir --upgrade setuptools \
    # Clone yt-dlp repository
 && git clone https://github.com/yt-dlp/yt-dlp.git /yt-dlp \
    # Install yt-dlp
 && cd /yt-dlp \
 && python3 setup.py install \
    # Clean-up
 && cd / \
 && rm -rf /yt-dlp \
 && apk del curl git \
    # Sets up cache.
 && mkdir /.cache \
 && chmod 777 /.cache

WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm install
COPY . .

CMD ["node", "/app/main.js"]
