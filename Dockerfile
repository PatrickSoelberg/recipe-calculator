FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-dan \
    && rm -rf /var/lib/apt/lists/*

# Set Tesseract data environment variable
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/4.00/tessdata

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY server/requirements.txt .
RUN pip install -r requirements.txt

# Copy the rest of the application
COPY server/ .

# Verify Tesseract and language data
RUN tesseract --list-langs

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]