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
    # Clone youtube-dl repository
 && git clone https://github.com/ytdl-org/youtube-dl.git /youtube-dl \
    # Install youtube-dl
 && cd /youtube-dl \
 && python3 setup.py install \
    # Clean-up
 && cd / \
 && rm -rf /youtube-dl \
 && apk del curl git \
    # Sets up cache.
 && mkdir /.cache \
 && chmod 777 /.cache

WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm install
COPY . .

CMD ["node", "/app/main.js"]
