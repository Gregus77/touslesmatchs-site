FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY council/requirements.txt /app/council/requirements.txt
RUN pip install --no-cache-dir -r /app/council/requirements.txt

# Copy council code
COPY council/ /app/council/

# Create data directory
RUN mkdir -p /app/data /app/site

# Set Python path + timezone Paris
ENV PYTHONPATH=/app/council
ENV PYTHONUNBUFFERED=1
ENV TZ=Europe/Paris
# Force UTF-8 partout : sans ça, la locale C de l'image slim casse sur les
# accents français ('ascii' codec can't encode) → le Chief et Opus plantaient
# et forçaient un NOPICK chaque jour.
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV PYTHONUTF8=1
ENV PYTHONIOENCODING=utf-8
RUN ln -snf /usr/share/zoneinfo/Europe/Paris /etc/localtime && echo "Europe/Paris" > /etc/timezone

CMD ["python", "/app/council/scheduler.py"]
