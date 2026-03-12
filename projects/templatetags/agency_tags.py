from django import template
from django.apps import apps

register = template.Library()

@register.simple_tag
def get_agency_settings():
    """Busca o cadastro da agência com proteção contra erros"""
    try:
        # Tenta buscar o model chamado 'AgencyProfile' dinamicamente
        AgencyProfile = apps.get_model('projects', 'AgencyProfile')
        return AgencyProfile.objects.first()
    except LookupError:
        # Se a tabela ainda não existir no banco, não quebra o site!
        return None