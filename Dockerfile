FROM node:18-alpine

# Install system dependencies
RUN set -x \
 && apk add --no-cache \
        curl \
        ffmpeg \
        gnupg \
        python3 \
        py3-pip \
        git

# Create and activate a Python virtual environment
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Upgrade pip and install setuptools in the virtual environment
RUN pip install --upgrade pip \
 && pip install --no-cache-dir --upgrade setuptools

RUN python -m pip install -U --pre yt-dlp

# Clean up unnecessary packages
RUN apk del curl git

# Sets up cache.
RUN mkdir /.cache \
 && chmod 777 /.cache

WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm install
COPY . .

CMD ["node", "/app/main.js"]
