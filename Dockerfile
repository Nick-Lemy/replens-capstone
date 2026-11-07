FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OPENBLAS_NUM_THREADS=1 \
    OMP_NUM_THREADS=2 \
    HOME=/home/app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ffmpeg libgl1 libegl1 libgles2 libglib2.0-0 libportaudio2 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home app

WORKDIR /workspace
COPY app/backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY app/backend /workspace/app/backend
RUN python app/backend/setup_models.py

USER 10001
EXPOSE 8000
CMD ["python", "-m", "app.backend.start"]
