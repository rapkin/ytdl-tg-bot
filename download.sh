#!/bin/bash

# Exit on error
set -e

# Check for the correct number of arguments
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <video_url> <final_output_path>"
    exit 1
fi

# Assign input parameters to variables
VIDEO_URL="$1"
FINAL_OUTPUT="$2"

# Extract directory from FINAL_OUTPUT for the temporary download path
OUTPUT_DIR=$(dirname "$FINAL_OUTPUT")
OUTPUT_BASENAME=$(basename "$FINAL_OUTPUT")
# Generate a unique filename using a hash of the current date-time and a random value
TMP_DOWNLOAD="downloaded_video_$OUTPUT_BASENAME.%(ext)s"
DOWNLOAD_PATH="$OUTPUT_DIR/$TMP_DOWNLOAD"

# Step 1: Download the video
yt-dlp -o "$DOWNLOAD_PATH" "$VIDEO_URL"

# Assuming yt-dlp will download one file, find that file. This step assumes that the download directory only contains this download.
DOWNLOADED_FILE=$(find $OUTPUT_DIR -type f -name "downloaded_video_$OUTPUT_BASENAME.*" | head -n 1)

# Verify that a file was downloaded
if [ -z "$DOWNLOADED_FILE" ]; then
    echo "Download failed or file not found."
    exit 1
fi

# Step 2: Re-encode the video
ffmpeg -i "$DOWNLOADED_FILE" \
    -c:v libx264 \
    -vf "format=yuv420p" \
    -metadata:s:v:0 rotate=0 \
    -c:a aac -b:a 128k \
    "$FINAL_OUTPUT"

# Optional: Remove the original downloaded file
rm "$DOWNLOADED_FILE"
