#accounts/context_processors.py

from django.urls import reverse

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

def sidebar_menu(request):
    """
    Gera o menu lateral dinamicamente.
    Regra Mestra: Schemas 'public' e 'brainz' têm acesso TOTAL irrestrito.
    """

    # --- 1. IDENTIFICAÇÃO DO CONTEXTO (TENANT) ---
    tenant = getattr(request, 'tenant', None)
    schema_name = getattr(tenant, 'schema_name', 'public')
    
    # Lista de schemas que são "Super Admins" do sistema
    # Eles veem tudo, inclusive menus de gestão de SaaS
    SUPER_SCHEMAS = ['public', 'brainz']

    # Lista de módulos habilitados
    allowed_modules = []

    if schema_name in SUPER_SCHEMAS:
        # REGRA: 'brainz' e 'public' têm acesso total a tudo
        allowed_modules = ['gestao', 'producao', 'social', 'arquivos', 'admin']
    else:
        # Outros tenants dependem do que contrataram (JSON no banco)
        config = getattr(tenant, 'menu_config', {})
        if config is None: config = {}
        allowed_modules = config.get('allowed_modules', [])

    # --- 2. ESTRUTURA DO MENU ---
    
    full_menu = [
        {
            "label": "Dashboard",
            "url_name": "dashboard",
            "icon": "fa-solid fa-house",
            "module_id": None, 
            "perms": None, 
        },
        {
            "label": "Gestão",
            "icon": "fa-solid fa-briefcase",
            "module_id": "gestao", 
            "perms": None,
            "submenu": [
                {
                    "label": "Clientes",
                    "url_name": "client_list",
                    "perms": None
                },
                {
                    "label": "Projetos",
                    "url_name": "project_list",
                    "perms": None
                },
            ]
        },
        {
            "label": "Produção",
            "icon": "fa-solid fa-table-columns",
            "module_id": "producao",
            "perms": None,
            "submenu": [
                {
                    "label": "Kanban Geral",
                    "url_name": "kanban_general",
                    "perms": None
                },
                {
                    "label": "Kanban Operacional",
                    "url_name": "kanban_operational",
                    "perms": None
                },
                {
                    "label": "Calendário",
                    "url_name": "calendar_view",
                    "perms": None
                },
            ]
        },
        {
            "label": "Social Media",
            "url_name": "social_dashboard",
            "icon": "fa-solid fa-share-nodes",
            "module_id": "social",
            "perms": None,
        },
        {
            "label": "Servidor de Mídia",
            "url_name": "media_dashboard",
            "icon": "feather:hard-drive",
            "module_id": "arquivos",
            "perms": None,
        },
        {
            "label": "Administração",
            "icon": "fa-solid fa-users-gear",
            "module_id": "admin",
            "perms": None,
            "submenu": [
                {
                    "label": "Usuários",
                    "url_name": "user_list",
                    "perms": None,
                },
                # Menu de Gestão de Agências (SaaS)
                # Só aparece para os schemas SUPER_SCHEMAS (public e brainz)
                {
                    "label": "Agências (SaaS)",
                    "url_name": "agency_list", 
                    "perms": None,
                    "only_super_schema": True # Flag customizada
                }
            ]
        },
    ]

    # --- 3. PROCESSAMENTO ---

    def check_access(user, item):
        """ Retorna True se o usuário/tenant pode ver este item """
        
        # A. Validação de Módulo (Tenant)
        mod_id = item.get('module_id')
        if mod_id and mod_id not in allowed_modules:
            return False
        
        # B. Validação de Ambiente Super Admin (SaaS)
        # Se o item exige ser Super Schema, checa se é 'brainz' ou 'public'
        if item.get('only_super_schema') and schema_name not in SUPER_SCHEMAS:
            return False

        # C. Validação de Permissão de Usuário (Django Auth)
        req_perms = item.get('perms')
        if req_perms:
            if not any(user.has_perm(p) for p in req_perms):
                return False
        
        return True

    final_menu = []
    current_url_name = request.resolver_match.url_name if request.resolver_match else ''

    for item in full_menu:
        # 1. Verifica acesso do Pai
        if not check_access(request.user, item):
            continue

        menu_item = item.copy()
        menu_item['is_active'] = False
        
        # 2. Processa Submenu
        if 'submenu' in item:
            filtered_sub = []
            for sub in item['submenu']:
                if check_access(request.user, sub):
                    
                    sub['is_active'] = (sub.get('url_name') == current_url_name)
                    if sub['is_active']:
                        menu_item['is_active'] = True
                    
                    try: sub['url'] = reverse(sub.get('url_name'))
                    except: sub['url'] = '#'
                    
                    filtered_sub.append(sub)
            
            menu_item['submenu'] = filtered_sub
            
            # Se não sobrou nada no submenu, esconde o pai
            if not filtered_sub:
                continue
        
        else:
            # Item Simples
            menu_item['is_active'] = (item.get('url_name') == current_url_name)
            try: menu_item['url'] = reverse(item.get('url_name'))
            except: menu_item['url'] = '#'

        final_menu.append(menu_item)

    return {'sidebar_menu': final_menu}