# projects/services.py
import requests
from django.conf import settings
from .models import SocialAccount

class MetaService:
    BASE_URL = "https://graph.facebook.com/v19.0"

    def get_auth_url(self, state_token):
        """ Gera a URL para o botão 'Conectar Facebook' """
        scopes = ",".join(settings.META_SCOPES)
        return (
            f"https://www.facebook.com/v19.0/dialog/oauth?"
            f"client_id={settings.META_APP_ID}&"
            f"redirect_uri={settings.META_REDIRECT_URI}&"
            f"state={state_token}&"
            f"scope={scopes}"
        )

    def exchange_code_for_token(self, code):
        """ Troca o código temporário por um User Access Token """
        url = (
            f"{self.BASE_URL}/oauth/access_token?"
            f"client_id={settings.META_APP_ID}&"
            f"redirect_uri={settings.META_REDIRECT_URI}&"
            f"client_secret={settings.META_APP_SECRET}&"
            f"code={code}"
        )
        response = requests.get(url)
        return response.json() # Retorna {access_token, ...}

    def get_user_pages(self, user_access_token, client_obj):
        """
        Busca as Páginas do Facebook e Contas do Instagram vinculadas.
        """
        print(f"--- DEBUG META START ---")
        print(f"1. Token Recebido: {user_access_token[:10]}...") # Mostra só o começo por segurança
        
        # 1. Busca as páginas que o usuário administra
        url = f"{self.BASE_URL}/me/accounts?access_token={user_access_token}&fields=id,name,access_token,instagram_business_account"
        
        response = requests.get(url)
        data = response.json()

        # ESPIONAGEM AQUI
        print(f"2. Resposta Bruta do Facebook: {data}")

        if 'data' not in data:
            print("ERRO CRÍTICO: Campo 'data' não encontrado na resposta.")
            return []
        
        if len(data['data']) == 0:
            print("ALERTA: O Facebook retornou uma lista de páginas VAZIA. O usuário tem páginas criadas?")

        saved_accounts = []

        for page in data['data']:
            print(f"3. Processando Página: {page.get('name')} (ID: {page.get('id')})")
            
            try:
                # --- SALVAR PÁGINA DO FACEBOOK ---
                fb_account, created = SocialAccount.objects.update_or_create(
                    account_id=page['id'],
                    client=client_obj,
                    defaults={
                        'platform': 'facebook',
                        'account_name': page['name'],
                        'access_token': page['access_token'],
                        'is_active': True
                    }
                )
                print(f"   -> Facebook Salvo? {created} (ID BD: {fb_account.id})")
                saved_accounts.append(fb_account)

                # --- SALVAR CONTA DO INSTAGRAM (Se houver) ---
                if 'instagram_business_account' in page:
                    ig_data = page['instagram_business_account']
                    print(f"   -> Instagram Encontrado: {ig_data}")
                    
                    ig_info = self.get_instagram_details(ig_data['id'], user_access_token)
                    
                    ig_account, created = SocialAccount.objects.update_or_create(
                        account_id=ig_data['id'],
                        client=client_obj,
                        defaults={
                            'platform': 'instagram',
                            'account_name': ig_info.get('username', 'Instagram User'),
                            'access_token': page['access_token'], 
                            'is_active': True
                        }
                    )
                    print(f"   -> Instagram Salvo? {created}")
                    saved_accounts.append(ig_account)
                else:
                    print("   -> Nenhuma conta de Instagram vinculada a esta página.")

            except Exception as e:
                print(f"ERRO AO SALVAR NO BANCO: {e}")

        print(f"--- DEBUG META END ---")
        return saved_accounts
        
    def get_instagram_details(self, ig_id, access_token):
        """ Busca detalhes (username) da conta do Instagram """
        url = f"{self.BASE_URL}/{ig_id}?fields=username,profile_picture_url&access_token={access_token}"
        response = requests.get(url)
        return response.json()# projects/services.py
import requests
from django.conf import settings
from .models import SocialAccount

class MetaService:
    BASE_URL = "https://graph.facebook.com/v19.0"

    def get_auth_url(self, state_token):
        """ Gera a URL para o botão 'Conectar Facebook' """
        scopes = ",".join(settings.META_SCOPES)
        return (
            f"https://www.facebook.com/v19.0/dialog/oauth?"
            f"client_id={settings.META_APP_ID}&"
            f"redirect_uri={settings.META_REDIRECT_URI}&"
            f"state={state_token}&"
            f"scope={scopes}"
        )

    def exchange_code_for_token(self, code):
        """ Troca o código temporário por um User Access Token """
        url = (
            f"{self.BASE_URL}/oauth/access_token?"
            f"client_id={settings.META_APP_ID}&"
            f"redirect_uri={settings.META_REDIRECT_URI}&"
            f"client_secret={settings.META_APP_SECRET}&"
            f"code={code}"
        )
        response = requests.get(url)
        return response.json() # Retorna {access_token, ...}

    def get_user_pages(self, user_access_token, client_obj):
        """
        Busca as Páginas do Facebook e Contas do Instagram vinculadas.
        Salva ou atualiza no banco de dados.
        """
        # 1. Busca as páginas que o usuário administra
        url = f"{self.BASE_URL}/me/accounts?access_token={user_access_token}&fields=id,name,access_token,instagram_business_account"
        
        response = requests.get(url)
        data = response.json()

        if 'data' not in data:
            print("Erro ao buscar páginas:", data)
            return []

        saved_accounts = []

        for page in data['data']:
            # --- SALVAR PÁGINA DO FACEBOOK ---
            # O token da página (page_access_token) é vital para postar sem o usuário estar logado
            fb_account, created = SocialAccount.objects.update_or_create(
                account_id=page['id'],
                client=client_obj, # Vincula ao cliente da agência
                defaults={
                    'platform': 'facebook',
                    'account_name': page['name'],
                    'access_token': page['access_token'], # Token específico da página
                    'is_active': True
                }
            )
            saved_accounts.append(fb_account)

            # --- SALVAR CONTA DO INSTAGRAM (Se houver) ---
            if 'instagram_business_account' in page:
                ig_data = page['instagram_business_account']
                # Precisamos buscar o nome do Instagram (a lista de pages só dá o ID)
                ig_info = self.get_instagram_details(ig_data['id'], user_access_token)
                
                ig_account, created = SocialAccount.objects.update_or_create(
                    account_id=ig_data['id'],
                    client=client_obj,
                    defaults={
                        'platform': 'instagram',
                        'account_name': ig_info.get('username', 'Instagram User'),
                        # Instagram usa o token do usuário ou da página vinculada
                        'access_token': page['access_token'], 
                        'is_active': True
                    }
                )
                saved_accounts.append(ig_account)
        
        return saved_accounts

    def get_instagram_details(self, ig_id, access_token):
        """ Busca detalhes (username) da conta do Instagram """
        url = f"{self.BASE_URL}/{ig_id}?fields=username,profile_picture_url&access_token={access_token}"
        response = requests.get(url)
        return response.json()