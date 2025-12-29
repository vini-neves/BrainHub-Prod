FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY . /app/
ENV SECRET_KEY=django-insecure-z3#bm50(&%a4peq8+#o8q@fwv5440o9hz2a)^tw%ou1c$n_in5
ENV DATABASE_NAME=dummy_db
ENV DATABASE_USER=dummy_user
ENV DATABASE_PASSWORD=dummy_password
ENV DATABASE_HOST=localhost
ENV DATABASE_PORT=5432
# Adicione outras se ele reclamar (ex: EMAIL_HOST, etc)

# Roda o collectstatic
RUN python manage.py collectstatic --noinput

# Comando final
CMD ["gunicorn", "--bind", "0.0.0.0:80", "config.wsgi:application"]
