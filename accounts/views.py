# accounts/views.py

from django.shortcuts import render, redirect
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseBadRequest
from google_auth_oauthlib.flow import Flow # A biblioteca que instalamos
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from .models import GoogleApiCredentials

# Esta view é acessada pelo usuário para INICIAR o login
def get_google_client_config():
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
    Inicia o fluxo OAuth 2.0.
    """
    client_config = get_google_client_config()

    # --- CORREÇÃO AQUI ---
    # Trocamos 'from_client_secrets_file' por 'from_client_config'
    flow = Flow.from_client_config(
        client_config=client_config,
        scopes=settings.GOOGLE_OAUTH_SCOPES,
        redirect_uri=settings.GOOGLE_OAUTH_REDIRECT_URI
    )
    # --- FIM DA CORREÇÃO ---

    authorization_url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent' 
    )
    
    request.session['oauth_state'] = state
    
    return redirect(authorization_url)


@login_required
def google_auth_callback(request):
    """
    O Google redireciona para cá após o usuário dar permissão.
    """
    state = request.session.pop('oauth_state', None)
    if state is None or state != request.GET.get('state'):
        return HttpResponseBadRequest("Falha na verificação de estado (CSRF).")

    client_config = get_google_client_config()
    
    # --- CORREÇÃO AQUI ---
    # Trocamos 'from_client_secrets_file' por 'from_client_config'
    flow = Flow.from_client_config(
        client_config=client_config,
        scopes=settings.GOOGLE_OAUTH_SCOPES,
        redirect_uri=settings.GOOGLE_OAUTH_REDIRECT_URI
    )
    # --- FIM DA CORREÇÃO ---

    code = request.GET.get('code')
    
    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Deleta credenciais antigas se existirem
        GoogleApiCredentials.objects.filter(user=request.user).delete()
        
        # Salva o novo refresh token
        GoogleApiCredentials.objects.create(
            user=request.user,
            refresh_token=credentials.refresh_token
        )

        # Redireciona de volta para o calendário do tenant
        # (Você pode mudar isso para uma página de "Sucesso" no admin público)
        return redirect('http://tenant1.localhost:8000/calendar/')

    except Exception as e:
        return HttpResponseBadRequest(f"Erro ao obter token: {e}")