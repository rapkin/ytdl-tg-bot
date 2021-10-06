FROM node:14.14-alpine

RUN set -x \
 && apk add --no-cache \
        curl \
        ffmpeg \
        gnupg \
        python3 \
    # Install youtube-dl
    # https://github.com/rg3/youtube-dl
 && curl -Lo /usr/local/bin/youtube-dl https://yt-dl.org/downloads/latest/youtube-dl \
 && curl -Lo youtube-dl.sig https://yt-dl.org/downloads/latest/youtube-dl.sig \
 && gpg --keyserver keyserver.ubuntu.com --recv-keys '7D33D762FD6C35130481347FDB4B54CBA4826A18' \
 && gpg --keyserver keyserver.ubuntu.com --recv-keys 'ED7F5BF46B3BBED81C87368E2C393E0F18A9236D' \
 && gpg --verify youtube-dl.sig /usr/local/bin/youtube-dl \
 && chmod a+rx /usr/local/bin/youtube-dl \
    # Requires python -> python3.
 && ln -s /usr/bin/python3 /usr/bin/python \
    # Clean-up
 && rm youtube-dl.sig \
 && apk del curl gnupg \
    # Sets up cache.
 && mkdir /.cache \
 && chmod 777 /.cache

WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm install
COPY . .

CMD ["node", "/app/main.js"]
