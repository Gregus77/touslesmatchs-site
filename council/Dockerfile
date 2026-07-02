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
RUN ln -snf /usr/share/zoneinfo/Europe/Paris /etc/localtime && echo "Europe/Paris" > /etc/timezone

CMD ["python", "/app/council/scheduler.py"]
