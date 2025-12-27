# Usa uma imagem leve do Python
FROM python:3.10-slim

# Evita arquivos .pyc e logs presos
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Cria a pasta do app
WORKDIR /app

# Instala as dependências
COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copia o código do projeto
COPY . /app/

# --- A CORREÇÃO ESTÁ AQUI EMBAIXO ---
# Define uma chave falsa apenas para o comando collectstatic funcionar
ENV SECRET_KEY=chave_temporaria_apenas_para_build_nao_preocupe

# Roda o collectstatic para arrumar o CSS
RUN python manage.py collectstatic --noinput

# Comando para iniciar
# ATENÇÃO: Verifique se 'config.wsgi:application' está certo para o seu projeto
CMD ["gunicorn", "--bind", "0.0.0.0:80", "config.wsgi:application"]
