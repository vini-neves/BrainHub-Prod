from pathlib import Path
from decouple import config, Csv # Importe o Csv para listas
import os
from django.core.cache import cache

# 1. Lendo SECRET_KEY do ambiente
SECRET_KEY = config('SECRET_KEY')

# 2. Lendo DEBUG do ambiente (convertendo para Boolean)
# DEBUG = config('DEBUG', default=False, cast=bool)

DebUG = config('DEBUG', default=True, cast=bool)

# 3. Lógica Híbrida de ALLOWED_HOSTS (Ambiente + Banco de Dados)
def get_allowed_hosts():
    # Primeiro, pega a lista definida no EasyPanel (ex: "meusite.com,localhost")
    # Se estiver "*", aceita tudo (cuidado em produção)
    env_hosts = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())
    
    # Converte para lista Python modificável
    hosts = list(env_hosts)

    # Se DEBUG for False, tentamos buscar os domínios extras no banco (Lógica SaaS)
    # Usamos cache para não matar o banco de dados
    cached_domains = cache.get('DYNAMIC_ALLOWED_HOSTS')
    
    if cached_domains:
        hosts.extend(cached_domains)
    else:
        try:
            # Importação dentro da função para evitar erro de carregamento (AppRegistryNotReady)
            from accounts.models import Domain
            
            # Pega apenas os valores da coluna 'domain'
            db_domains = list(Domain.objects.values_list('domain', flat=True))
            
            # Adiciona na lista principal
            hosts.extend(db_domains)
            
            # Salva no cache por 5 minutos (300s)
            cache.set('DYNAMIC_ALLOWED_HOSTS', db_domains, 300)
            
        except Exception:
            # Se der erro (ex: tabela não existe ainda na primeira migração), segue a vida
            pass
            
    # Remove duplicatas mantendo a lista limpa
    return list(set(hosts))

ALLOWED_HOSTS = get_allowed_hosts()

BASE_DIR = Path(__file__).resolve().parent.parent


STORAGES = {
    # Gerenciamento de arquivos de mídia (Uploads) -> Vai para o Cloudflare R2
    "default": {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        "OPTIONS": {
            "access_key": config('R2_ACCESS_KEY_ID'),
            "secret_key": config('R2_SECRET_ACCESS_KEY'),
            "bucket_name": config('R2_BUCKET_NAME'),
            "endpoint_url": config('R2_ENDPOINT_URL'),
            "region_name": "auto",
            "signature_version": "s3v4",
            "querystring_auth": True,
            "custom_domain": "pub-b8657b7ea8b548f9a6d5a7eb461f1e7a.r2.dev",
        },
    },
    # Gerenciamento de arquivos estáticos (CSS, JS) -> Continua local
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

CSRF_TRUSTED_ORIGINS = [
    'https://randolph-governable-ayana.ngrok-free.dev',
]

# Application definition

SHARED_APPS = [
    'django_tenants',
    #'tenants',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'storages', 
    'accounts',
]

TENANT_APPS = [
    'django.contrib.contenttypes', 
    'django.contrib.auth',
    'projects',
]

INSTALLED_APPS = list(SHARED_APPS) + [app for app in TENANT_APPS if app not in SHARED_APPS]

MIDDLEWARE = [
    'django_tenants.middleware.main.TenantMainMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django_htmx.middleware.HtmxMiddleware',
    'accounts.middleware.TrialPeriodMiddleware',
]

TENANT_MODEL = "accounts.Agency" 
TENANT_DOMAIN_MODEL = "accounts.Domain"

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'accounts.context_processors.agency_config',
                'accounts.context_processors.sidebar_menu',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django_tenants.postgresql_backend', 
        
        # CORREÇÃO: Use os nomes exatos do .env
        'NAME': config('DATABASE_NAME'),
        'USER': config('DATABASE_USER'),
        'PASSWORD': config('DATABASE_PASSWORD'), 
        'HOST': config('DATABASE_HOST'),
        'PORT': config('DATABASE_PORT'),
    }
}

DATABASE_ROUTERS = (
    'django_tenants.routers.TenantSyncRouter',
)

# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

ROOT_URLCONF = 'config.urls'

# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static_root')

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

AUTH_USER_MODEL = 'accounts.CustomUser'

# config/settings.py

# Para onde o Django redireciona *depois* do login
LOGIN_REDIRECT_URL = 'dashboard'

# Qual é a URL da nossa página de login
LOGIN_URL = 'login'

# Qual é a URL da nossa página de logout
LOGOUT_REDIRECT_URL = 'login'

# Configurações de Mídia
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Configurações da API do Google
GOOGLE_OAUTH_CLIENT_ID = config('GOOGLE_OAUTH_CLIENT_ID')
GOOGLE_OAUTH_CLIENT_SECRET = config('GOOGLE_OAUTH_CLIENT_SECRET')

# A URL de retorno que você configurou no Google
GOOGLE_OAUTH_REDIRECT_URI = "http://localhost:8000/google-auth-callback/"

# Os escopos que estamos solicitando
GOOGLE_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]

# Para desenvolvimento, imprime e-mails no console em vez de enviá-los.
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# META API
META_APP_ID = config('META_APP_ID')
META_APP_SECRET = config('META_APP_SECRET')
META_REDIRECT_URI = config('META_REDIRECT_URI')

# Escopos (Permissões) que vamos pedir
# Precisamos de permissão para ler páginas, publicar posts e ler insights
META_SCOPES = [
    'email',
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_read_user_content',
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_insights',
    # 'business_management' 
]

SOCIAL_AUTH_BASE_URL = config('SOCIAL_AUTH_BASE_URL', default='http://localhost:8000')

# LINKEDIN API
LINKEDIN_CLIENT_ID = config('LINKEDIN_CLIENT_ID')
LINKEDIN_CLIENT_SECRET = config('LINKEDIN_CLIENT_SECRET')
LINKEDIN_REDIRECT_URI = f"{SOCIAL_AUTH_BASE_URL}/linkedin-callback/"
LINKEDIN_SCOPES = ['openid', 'profile', 'email', 'w_member_social']

# TIKTOK SETTINGS
TIKTOK_CLIENT_KEY = config('TIKTOK_CLIENT_KEY')
TIKTOK_CLIENT_SECRET = config('TIKTOK_CLIENT_SECRET')
TIKTOK_REDIRECT_URI = f"{SOCIAL_AUTH_BASE_URL}/tiktok-callback/"


# --- CONFIGURAÇÕES DE PROXY (Obrigatório para EasyPanel) ---
# Diz ao Django para confiar no cabeçalho Host que o EasyPanel envia
USE_X_FORWARDED_HOST = True
# Diz ao Django que a conexão é segura (HTTPS)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# --- DEBUG DE TENANTS ---
# Se o domínio não for encontrado, exibe o site público em vez de 404.
# Isso vai nos provar se o erro é de domínio ou de rota.
SHOW_PUBLIC_IF_NO_TENANT_FOUND = True
