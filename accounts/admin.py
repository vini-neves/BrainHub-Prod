# accounts/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django_tenants.admin import TenantAdminMixin

from .models import Agency, Domain, CustomUser


# 1. Registra o modelo da Agência (o Tenant)
@admin.register(Agency)
class AgencyAdmin(TenantAdminMixin, admin.ModelAdmin):
    """
    Usa o TenantAdminMixin para ter uma visualização
    melhor dos tenants no admin.
    """
    list_display = ('name', 'schema_name', 'created_on')
    search_fields = ('name', 'schema_name')


# 2. Registra o modelo de Domínio
@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    """
    Admin padrão para os domínios.
    """
    list_display = ('domain', 'tenant', 'is_primary')
    search_fields = ('domain',)


# 3. Registra nosso Usuário Customizado
@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """
    Usa o UserAdmin padrão do Django, mas adiciona
    o campo 'agency' para ser visível.
    """

    # Adiciona 'agency' à lista de colunas
    list_display = ('username', 'email', 'agency', 'is_staff')

    # Adiciona 'agency' aos formulários de edição e criação
    # (Isto é um pouco complexo, mas é o jeito de estender o UserAdmin)
    fieldsets = UserAdmin.fieldsets + (
        ('Informações da Agência', {'fields': ('agency',)}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Informações da Agência', {'fields': ('agency',)}),
    )