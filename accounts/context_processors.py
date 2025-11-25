def agency_config(request):
    # O middleware do django-tenants já nos dá o "tenant"
    # (a agência) no objeto 'request'.
    agency = request.tenant

    # Se for um tenant (e não a tela pública de login)
    if agency:
        return {
            'agency_logo': agency.logo,
            'agency_primary_color': agency.primary_color,
            'agency_secondary_color': agency.secondary_color,
        }
    return {}