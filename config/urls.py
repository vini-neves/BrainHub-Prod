# config/urls.py

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# 1. Importe as novas views do app 'accounts'
from accounts import views as accounts_views

urlpatterns = [
    path('admin/', admin.site.urls),

    # 2. Adicione as URLs de autenticação do Google AQUI
    path('google-auth-start/', accounts_views.google_auth_start, name='google_auth_start'),
    path('google-auth-callback/', accounts_views.google_auth_callback, name='google_auth_callback'),

    # 3. O 'projects.urls' (do tenant) continua separado
    path('', include('projects.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)