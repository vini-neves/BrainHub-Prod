# accounts/models.py

from django.db import models
from django.contrib.auth.models import AbstractUser
from django_tenants.models import TenantMixin, DomainMixin
from django.conf import settings

# 1. Modelo da Agência (Tenant) e Customização
# TenantMixin faz a mágica de criar um "schema" separado no Postgres
class Agency(TenantMixin):
    name = models.CharField(max_length=255, verbose_name="Nome da Agência")
    created_on = models.DateField(auto_now_add=True)

    # --- CAMPOS DE CUSTOMIZAÇÃO (WHITE-LABEL) ---
    logo = models.ImageField(upload_to='logos/', null=True, blank=True)
    primary_color = models.CharField(max_length=7, default='#FFFFFF', verbose_name="Cor Primária")
    secondary_color = models.CharField(max_length=7, default='#000000', verbose_name="Cor Secundária")
    # Você pode adicionar URLs de fontes do Google Fonts, etc.

    # Configuração obrigatória do django-tenants
    auto_create_schema = True

    def __str__(self):
        return self.name

# 2. Modelo de Domínio
# Diz qual URL pertence a qual Agência
class Domain(DomainMixin):
    pass # Não precisamos de campos extras por enquanto

# 3. Nosso Novo Modelo de Usuário Customizado
# Ele é "compartilhado", mas sabe a qual agência o usuário pertence
class CustomUser(AbstractUser):
    # Linka o usuário a UMA agência.
    # Usamos models.PROTECT para não deletar a agência se houver usuários nela.
    agency = models.ForeignKey(
        Agency, 
        on_delete=models.PROTECT, 
        null=True, 
        blank=True,
        related_name="users"
    )
    
    # Adicione aqui outros campos que quiser (ex: 'cargo')
    
    def __str__(self):
        return self.username

class GoogleApiCredentials(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name="google_credentials"
    )
    refresh_token = models.TextField(verbose_name="Refresh Token")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Credenciais do Google para {self.user.username}"