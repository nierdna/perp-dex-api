# Multi-stage build để tối ưu kích thước image
FROM python:3.13-slim as builder

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first để tận dụng Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --user -r requirements.txt

# Final stage
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Copy Python dependencies từ builder stage
COPY --from=builder /root/.local /root/.local

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY . .

# Expose port (Railway sẽ cung cấp PORT env variable)
# Default port 8080 nếu PORT không được set
EXPOSE 8080

# Health check (sử dụng port 8080 hoặc PORT env variable)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import os, urllib.request; port = os.getenv('PORT', '8080'); urllib.request.urlopen(f'http://localhost:{port}/api/status')" || exit 1

# Run the application
# Railway sẽ cung cấp PORT env variable, nếu không có thì dùng 8080
CMD python api_server.py

