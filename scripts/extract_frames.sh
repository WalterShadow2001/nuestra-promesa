#!/bin/bash
set -e
mkdir -p /tmp/verify_frames
echo "Dir creado: /tmp/verify_frames"
ls -d /tmp/verify_frames

echo "Extrayendo frame logo (1s)..."
ffmpeg -y -i /home/z/my-project/download/nuestra_promesa.mp4 -vf "select=eq(n\,30)" -vframes 1 /tmp/verify_frames/frame_logo.png < /dev/null 2>&1 | tail -1

echo "Extrayendo frame foto1 (10s)..."
ffmpeg -y -i /home/z/my-project/download/nuestra_promesa.mp4 -vf "select=eq(n\,300)" -vframes 1 /tmp/verify_frames/frame_foto1.png < /dev/null 2>&1 | tail -1

echo "Extrayendo frame foto2 (20s)..."
ffmpeg -y -i /home/z/my-project/download/nuestra_promesa.mp4 -vf "select=eq(n\,600)" -vframes 1 /tmp/verify_frames/frame_foto2.png < /dev/null 2>&1 | tail -1

echo "Extrayendo frame final (28s)..."
ffmpeg -y -i /home/z/my-project/download/nuestra_promesa.mp4 -vf "select=eq(n\,850)" -vframes 1 /tmp/verify_frames/frame_final.png < /dev/null 2>&1 | tail -1

ls -la /tmp/verify_frames/
