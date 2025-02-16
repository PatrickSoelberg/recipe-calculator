FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-dan \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /usr/share/tesseract-ocr/tessdata

# Find and copy language data files
RUN find /usr -name "*.traineddata" -exec cp {} /usr/share/tesseract-ocr/tessdata/ \;

# Set Tesseract data environment variable
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/tessdata/

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY server/requirements.txt .
RUN pip install -r requirements.txt

# Copy the rest of the application
COPY server/ .

# Verify Tesseract installation and language data
RUN tesseract --list-langs

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]