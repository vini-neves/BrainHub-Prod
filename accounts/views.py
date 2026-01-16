from django.shortcuts import render, redirect, get_object_or_404
from django.conf import settings
from django.contrib.auth.decorators import login_required, user_passes_test
from django.http import HttpResponseBadRequest, JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth import get_user_model
from django.contrib import messages
from django.db import transaction, IntegrityError
from django_tenants.utils import schema_context
from datetime import timedelta 
from django.utils import timezone
# Bibliotecas Google OAuth2
from google_auth_oauthlib.flow import Flow 
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

# Imports Locais (Do próprio app accounts)
from .models import GoogleApiCredentials, Agency, Domain
from .forms import AgencyForm  # Certifique-se que o forms.py está em accounts/

User = get_user_model()

# ==============================================================================
# 1. AUTENTICAÇÃO GOOGLE (OAUTH2)
# ==============================================================================

def get_google_client_config():
    """Retorna a configuração do cliente Google baseada no settings."""
    return {
        "web": {
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "redirect_uris": [settings.GOOGLE_OAUTH_REDIRECT_URI],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }

@login_required
def google_auth_start(request):
    """
    Passo 1: Inicia o fluxo e redireciona o usuário para o Google.
    """
    client_config = get_google_client_config()

    flow = Flow.from_client_config(
        client_config=client_config,
        scopes=settings.GOOGLE_OAUTH_SCOPES,
        redirect_uri=settings.GOOGLE_OAUTH_REDIRECT_URI
    )

    authorization_url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent' # Força o refresh token se necessário
    )
    
    # Salva o estado na sessão para evitar CSRF
    request.session['oauth_state'] = state
    
    return redirect(authorization_url)


@login_required
def google_auth_callback(request):
    """
    Passo 2: O Google devolve o usuário para cá com o 'code'.
    Trocamos o code por tokens de acesso.
    """
    state = request.session.pop('oauth_state', None)
    
    # Verificação de segurança (CSRF)
    if state is None or state != request.GET.get('state'):
        return HttpResponseBadRequest("Falha na verificação de estado (CSRF).")

    client_config = get_google_client_config()
    
    flow = Flow.from_client_config(
        client_config=client_config,
        scopes=settings.GOOGLE_OAUTH_SCOPES,
        redirect_uri=settings.GOOGLE_OAUTH_REDIRECT_URI
    )

    code = request.GET.get('code')
    
    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Salva ou Atualiza as credenciais
        # Nota: O refresh_token às vezes só vem na primeira autenticação
        defaults = {}
        if credentials.refresh_token:
            defaults['refresh_token'] = credentials.refresh_token
            
        GoogleApiCredentials.objects.update_or_create(
            user=request.user,
            defaults=defaults
        )

        # Redireciona para o calendário (ajuste a rota conforme necessário)
        # Se você tiver uma url name 'calendar_view', use return redirect('calendar_view')
        return redirect('/calendar/') 

    except Exception as e:
        return HttpResponseBadRequest(f"Erro ao obter token do Google: {e}")


# ==============================================================================
# 2. GESTÃO DE USUÁRIOS (User Management)
# ==============================================================================

@login_required
def user_management_view(request):
    """
    Lista usuários. 
    - Superuser: Vê todos.
    - Admin de Agência: Vê apenas os da sua agência.
    """
    
    # Previne erro se o usuário logado não tiver agência
    user_agency = getattr(request.user, 'agency', None)

    if request.user.is_superuser:
        users = User.objects.all().select_related('agency').order_by('-date_joined')
        agencies = Agency.objects.all()
    elif user_agency:
        users = User.objects.filter(agency=user_agency).order_by('-date_joined')
        # Admin só pode ver/atribuir sua própria agência
        agencies = Agency.objects.filter(id=user_agency.id)
    else:
        # Usuário sem agência e sem ser superuser (caso raro)
        users = User.objects.none()
        agencies = Agency.objects.none()
        
    context = {
        'users': users,
        'agencies': agencies,
        'is_superuser': request.user.is_superuser
    }
    # Certifique-se que o template está em accounts/templates/accounts/user_list.html
    return render(request, 'accounts/user_list.html', context)


@login_required
@require_POST
def create_user_api(request):
    """
    API para criar ou editar usuários via Modal (AJAX).
    """
    try:
        data = request.POST
        user_id = data.get('user_id')
        password = data.get('password')
        username = data.get('username')
        is_active_status = 'is_active' in data
        
        # 1. Determina a Agência
        target_agency = None
        
        if request.user.is_superuser:
            # Superuser pode escolher a agência no form
            agency_id = data.get('agency')
            if agency_id:
                try:
                    target_agency = Agency.objects.get(id=agency_id)
                except Agency.DoesNotExist:
                    return JsonResponse({'status': 'error', 'message': 'Agência inválida.'}, status=400)
        else:
            # Usuário comum é forçado a criar usuário na sua própria agência
            target_agency = getattr(request.user, 'agency', None)
            if not target_agency:
                return JsonResponse({'status': 'error', 'message': 'Você não tem uma agência vinculada.'}, status=403)

        # --- MODO EDIÇÃO ---
        if user_id:
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return JsonResponse({'status': 'error', 'message': 'Usuário não encontrado.'}, status=404)

            # Segurança: Admin comum não pode editar usuários de outras agências
            if not request.user.is_superuser and user.agency != request.user.agency:
                 return JsonResponse({'status': 'error', 'message': 'Permissão negada.'}, status=403)

            # Valida username único (excluindo o próprio)
            if User.objects.filter(username=username).exclude(id=user.id).exists():
                return JsonResponse({'status': 'error', 'message': 'Username já em uso.'}, status=400)

            user.first_name = data.get('first_name')
            user.last_name = data.get('last_name')
            user.email = data.get('email')
            user.username = username
            user.role = data.get('role', 'viewer')
            user.is_active = is_active_status
            
            # Atualiza agência apenas se for superuser (para evitar admin movendo user para fora)
            if request.user.is_superuser and target_agency: 
                user.agency = target_agency

            if password:
                if len(password) < 8:
                    return JsonResponse({'status': 'error', 'message': 'Senha muito curta (min 8).'}, status=400)
                user.set_password(password)
            
            user.save()
            return JsonResponse({'status': 'success', 'message': 'Usuário atualizado!'})

        # --- MODO CRIAÇÃO ---
        else:
            if not password or len(password) < 8:
                return JsonResponse({'status': 'error', 'message': 'Senha obrigatória (min 8 chars).'}, status=400)
            
            if User.objects.filter(username=username).exists():
                 return JsonResponse({'status': 'error', 'message': 'Username já existe.'}, status=400)

            new_user = User.objects.create_user(
                username=username,
                email=data.get('email'),
                password=password,
                first_name=data.get('first_name'),
                last_name=data.get('last_name'),
                role=data.get('role', 'viewer'),
                agency=target_agency # Vincula à agência determinada acima
            )
            
            new_user.is_active = is_active_status
            new_user.save()

            return JsonResponse({'status': 'success', 'message': 'Usuário criado!'})

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': f"Erro interno: {str(e)}"}, status=500)


# ==============================================================================
# 3. GESTÃO DE AGÊNCIAS (SaaS Management)
# ==============================================================================

@login_required
def create_agency(request):
    """
    Cria uma nova Agência (Tenant) e seu Domínio.
    Apenas Superusers podem acessar.
    """
    
    if not request.user.is_superuser:
        messages.error(request, "Apenas superusuários podem criar agências.")
        return redirect('dashboard')

    if request.method == 'POST':
        form = AgencyForm(request.POST, request.FILES)
        if form.is_valid():
            try:
                # SOLUÇÃO DO ERRO:
                # Forçamos o Django a operar no schema 'public' para criar o Tenant.
                # Isso engana o django-tenants permitindo criar agências estando logado na 'brainz'.
                with schema_context('public'): 
                    
                    with transaction.atomic():
                        # 1. Salva o Tenant
                        tenant = form.save(commit=False)
                        if tenant.on_trial and not tenant.paid_until:
                            tenant.paid_until = timezone.now().date() + timedelta(days=15)
                        tenant.menu_config = {
                            'allowed_modules': form.cleaned_data['visible_menus']
                        }
                        tenant.save() # Dispara criação do Schema no Postgres (agora permitido)

                        # 2. Cria o Domínio
                        domain = Domain()
                        domain.domain = form.cleaned_data['domain_url']
                        domain.tenant = tenant
                        domain.is_primary = True
                        domain.save()

                messages.success(request, f"Agência '{tenant.name}' criada com sucesso!")
                return redirect('agency_list')

            except IntegrityError:
                messages.error(request, "Erro: Este domínio ou nome de schema já existe.")
            except Exception as e:
                messages.error(request, f"Erro crítico ao criar agência: {str(e)}")
    else:
        form = AgencyForm()

    return render(request, 'accounts/agency_list.html', {'form': form})


@login_required
def agency_list(request):
    """
    Lista todas as agências (exceto public).
    Apenas Superusers podem acessar.
    """
    
    if not request.user.is_superuser:
        messages.error(request, "Acesso negado.")
        return redirect('dashboard')

    # Busca no model Agency, excluindo o schema 'public' (SaaS Admin)
    agencies = Agency.objects.exclude(schema_name='public').order_by('-created_on')
    
    # Template agora em accounts/
    return render(request, 'accounts/agency_list.html', {'agencies': agencies})

# accounts/views.py

# ... mantenha os imports ...
from django_tenants.utils import schema_context # <--- Essencial

@login_required
def update_agency(request, pk):
    """Atualiza os dados de uma agência existente."""
    
    if not request.user.is_superuser:
        messages.error(request, "Permissão negada.")
        return redirect('agency_list')

    # CORREÇÃO: Envolvemos TUDO no contexto 'public'
    # Porque tanto buscar (get_object) quanto salvar (save) precisam ser no public.
    with schema_context('public'):
        
        # 1. Busca a agência dentro do schema public
        agency = get_object_or_404(Agency, pk=pk)

        if request.method == 'POST':
            form = AgencyForm(request.POST, request.FILES, instance=agency)
            
            if form.is_valid():
                try:
                    with transaction.atomic():
                        # 2. Atualiza dados básicos da Agência
                        tenant = form.save(commit=False)
                        
                        # Atualiza o JSON de menus
                        tenant.menu_config = {
                            'allowed_modules': form.cleaned_data['visible_menus']
                        }
                        
                        # Se removeu o trial manualmente na edição, zera a data ou mantém?
                        # Aqui mantemos a lógica que vem do form (se tiver data, salva)
                        
                        tenant.save() # Agora funciona porque estamos no contexto public

                        # 3. Atualiza o Domínio
                        # Domínios também ficam no schema public, então ok.
                        new_domain_url = form.cleaned_data['domain_url']
                        
                        # Busca o domínio primário atual
                        domain_obj = Domain.objects.filter(tenant=tenant, is_primary=True).first()
                        
                        if domain_obj:
                            # Só atualiza se mudou, pra evitar queries desnecessárias
                            if domain_obj.domain != new_domain_url:
                                domain_obj.domain = new_domain_url
                                domain_obj.save()
                        else:
                            # Caso de borda: cria se não existir
                            Domain.objects.create(domain=new_domain_url, tenant=tenant, is_primary=True)

                    messages.success(request, f"Agência '{tenant.name}' atualizada com sucesso!")
                    return redirect('agency_list')

                except IntegrityError:
                    messages.error(request, "Erro: Este domínio já está em uso por outra agência.")
                except Exception as e:
                    messages.error(request, f"Erro ao atualizar: {str(e)}")
        
    # Se não for POST, redireciona para a lista
    return redirect('agency_list')

def tenant_expired(request):
    """Renderiza a tela de bloqueio por falta de pagamento ou fim de trial."""
    return render(request, 'accounts/tenant_expired.html')

@login_required
def delete_agency(request, pk):
    """Exclui uma Agência e DESTRÓI o schema (banco de dados) dela."""
    
    # 1. Segurança Básica
    if not request.user.is_superuser:
        messages.error(request, "Permissão negada.")
        return redirect('agency_list')

    # 2. Busca a agência (no contexto atual ou public)
    # Usamos schema_context('public') para garantir que estamos buscando na tabela global
    with schema_context('public'):
        agency = get_object_or_404(Agency, pk=pk)

        # 3. TRAVA DE SEGURANÇA CRÍTICA
        if agency.schema_name in ['public', 'brainz']: # Adicione seu schema admin aqui
            messages.error(request, "Você não pode excluir os schemas do sistema (public/admin)!")
            return redirect('agency_list')

        if request.method == 'POST':
            try:
                with transaction.atomic():
                    agency_name = agency.name
                    # O django-tenants automaticamente faz o DROP SCHEMA no banco
                    agency.delete()
                    
                messages.success(request, f"Agência '{agency_name}' e todos os seus dados foram excluídos.")
            except Exception as e:
                messages.error(request, f"Erro ao excluir: {str(e)}")
    
    return redirect('agency_list')