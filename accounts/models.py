# accounts/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django_tenants.models import TenantMixin, DomainMixin
from django.conf import settings
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache

# 1. Modelo da Agência (Tenant)
class Agency(TenantMixin):
    name = models.CharField(max_length=255, verbose_name="Nome da Agência")
    
    # Configuração de Menu
    menu_config = models.JSONField(default=dict, blank=True, null=True)
    
    # Campos de Controle
    paid_until = models.DateField(verbose_name="Pago até", blank=True, null=True)
    on_trial = models.BooleanField(default=True, verbose_name="Em período de teste?")
    
    # CORREÇÃO: Havia dois 'created_on'. Mantive apenas este com verbose_name.
    created_on = models.DateField(auto_now_add=True, verbose_name="Criado em")

    # Customização White-Label
    logo = models.ImageField(upload_to='logos/', null=True, blank=True)
    primary_color = models.CharField(max_length=7, default='#FFFFFF', verbose_name="Cor Primária")
    secondary_color = models.CharField(max_length=7, default='#000000', verbose_name="Cor Secundária")

    auto_create_schema = True

    def __str__(self):
        return self.name

class Domain(DomainMixin):
    pass

# 2. Modelo de Usuário Customizado (Atualizado)
class CustomUser(AbstractUser):
    ROLES = (
        ('admin', 'Administrador'),
        ('editor', 'Editor'),
        ('viewer', 'Visualizador'),
        ("designer", 'Designer'),
        ('traffic_manager', 'Gestor de Tráfego'),
        ('photographer', 'Fotógrafo'),
        ('social_media', 'Social Media'),
        ('copywriter', 'Copywriter'),
        ('client', 'Cliente'),
    )

    # Link com a Agência
    agency = models.ForeignKey(
        Agency, 
        on_delete=models.PROTECT, 
        null=True, 
        blank=True,
        related_name="users"
    )
    
    # --- NOVOS CAMPOS ADICIONADOS ---
    role = models.CharField(max_length=20, choices=ROLES, default='viewer', verbose_name="Função")
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    
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
    
@receiver(post_save, sender=Domain)
@receiver(post_delete, sender=Domain)
def clear_hosts_cache(sender, instance, **kwargs):
    """
    Sempre que um domínio é criado ou deletado,
    limpa o cache para que o ALLOWED_HOSTS atualize na hora.
    """
    cache.delete('DYNAMIC_ALLOWED_HOSTS')