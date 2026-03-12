from django import template
from projects.models import Agency # TROQUE 'Agency' PELO NOME REAL DO SEU MODEL DE AGÊNCIA

register = template.Library()

@register.simple_tag
def get_agency_settings():
    """Busca o primeiro cadastro de agência no banco de dados"""
    # Se você tiver apenas 1 agência cadastrada, o .first() pega ela perfeitamente
    return Agency.objects.first()