FROM python:3.12-slim
RUN pip install uv
WORKDIR /app
COPY pyproject.toml ./
RUN uv pip install --system --no-cache .
COPY src ./src
ENV PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["python", "-m", "worker.main"]
