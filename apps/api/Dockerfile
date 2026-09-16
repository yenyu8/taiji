FROM python:3.12-slim
WORKDIR /workspace
COPY apps/api/requirements.txt /workspace/requirements.txt
RUN pip install --no-cache-dir -r /workspace/requirements.txt
COPY apps/api /workspace/apps/api
COPY mods /workspace/mods
COPY packages /workspace/packages
ENV PYTHONPATH=/workspace/apps/api TAIJI_DB_PATH=/data/taiji.sqlite3
EXPOSE 8000
CMD ["uvicorn", "taiji_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
