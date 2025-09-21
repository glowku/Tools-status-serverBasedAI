FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
ENV PORT 5000
ENV DISABLE_DNS_CHECKS true
CMD ["python", "app.py"]
