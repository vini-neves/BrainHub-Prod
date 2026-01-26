# projects/services.py
import requests
from django.conf import settings
from .models import SocialAccount
import urllib.parse
from requests.auth import HTTPBasicAuth

class MetaService:
    BASE_URL = "https://graph.facebook.com/v19.0"

    def get_auth_url(self, state_token, redirect_uri):
        scopes = ",".join(settings.META_SCOPES)
        params = {
            "client_id": settings.META_APP_ID,
            "redirect_uri": redirect_uri,
            "state": state_token,
            "scope": scopes,
            "response_type": "code"
        }
        return f"https://www.facebook.com/v19.0/dialog/oauth?{urllib.parse.urlencode(params)}"

    def exchange_code_for_token(self, code, redirect_uri):
        url = (
            f"{self.BASE_URL}/oauth/access_token?"
            f"client_id={settings.META_APP_ID}&"
            f"redirect_uri={redirect_uri}&"
            f"client_secret={settings.META_APP_SECRET}&"
            f"code={code}"
        )
        response = requests.get(url)
        return response.json()

    def save_only_facebook_pages(self, user_access_token, client_obj):
        """ Salva APENAS páginas do Facebook (Ignora Instagram) """
        url = f"{self.BASE_URL}/me/accounts?access_token={user_access_token}&fields=id,name,access_token"
        response = requests.get(url)
        data = response.json()
        
        if 'data' not in data: return 0
        
        count = 0
        for page in data['data']:
            SocialAccount.objects.update_or_create(
                account_id=page['id'],
                client=client_obj,
                defaults={
                    'platform': 'facebook', # <--- Força Facebook
                    'account_name': page['name'],
                    'access_token': page['access_token'],
                    'is_active': True
                }
            )
            count += 1
        return count

    def save_only_instagram_accounts(self, user_access_token, client_obj):
        """ Salva APENAS contas do Instagram (Ignora Páginas soltas) """
        # Aqui pedimos o campo instagram_business_account
        url = f"{self.BASE_URL}/me/accounts?access_token={user_access_token}&fields=id,name,access_token,instagram_business_account"
        response = requests.get(url)
        data = response.json()
        
        if 'data' not in data: return 0
        
        count = 0
        for page in data['data']:
            # Só entra se tiver Instagram vinculado
            if 'instagram_business_account' in page:
                ig_data = page['instagram_business_account']
                ig_details = self.get_instagram_details(ig_data['id'], user_access_token)
                
                SocialAccount.objects.update_or_create(
                    account_id=ig_data['id'],
                    client=client_obj,
                    defaults={
                        'platform': 'instagram', # <--- Força Instagram
                        'account_name': ig_details.get('username', 'Instagram User'),
                        'access_token': page['access_token'], # Token da página que gerencia o insta
                        'is_active': True
                    }
                )
                count += 1
        return count

    def get_instagram_details(self, ig_id, access_token):
        """ Pega o @usuario e foto do perfil """
        url = f"{self.BASE_URL}/{ig_id}?fields=username,profile_picture_url&access_token={access_token}"
        try:
            return requests.get(url).json()
        except:
            return {}

class LinkedInService:
    # URLs Oficiais
    AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
    TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
    USER_INFO_URL = "https://api.linkedin.com/v2/userinfo"

    def get_auth_url(self, state_token, redirect_uri):
        """ Gera a URL do botão 'Conectar LinkedIn' """
        scope_string = " ".join(settings.LINKEDIN_SCOPES) # LinkedIn usa espaço, não vírgula
        params = {
            "response_type": "code",
            "client_id": settings.LINKEDIN_CLIENT_ID,
            "redirect_uri": redirect_uri, 
            "state": state_token,
            "scope": scope_string
        }
        
        # Transforma o dicionário em string de URL
        return f"{self.AUTH_URL}?{urllib.parse.urlencode(params)}"

    def exchange_code_for_token(self, code, redirect_uri):
        """ Troca o código pelo Access Token """
        payload = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_uri, # <--- USA A VARIÁVEL AQUI
            'client_id': settings.LINKEDIN_CLIENT_ID,
            'client_secret': settings.LINKEDIN_CLIENT_SECRET
        }
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        
        response = requests.post(self.TOKEN_URL, data=payload, headers=headers)
        return response.json()

    def get_user_profile(self, access_token):
        """ Busca dados do usuário (Nome, Foto, Sub/ID) """
        headers = {'Authorization': f'Bearer {access_token}'}
        response = requests.get(self.USER_INFO_URL, headers=headers)
        return response.json()

    def save_account(self, token_data, client_obj):
        """ Salva a conta no banco """
        access_token = token_data.get('access_token')
        if not access_token:
            return None

        # Busca dados do perfil
        profile_data = self.get_user_profile(access_token)
        
        # O ID único no OpenID Connect chama-se 'sub'
        linkedin_id = profile_data.get('sub')
        name = profile_data.get('name')
        picture = profile_data.get('picture', '')

        if not linkedin_id:
            return None

        # Salva no banco (Tabela SocialAccount)
        account, created = SocialAccount.objects.update_or_create(
            account_id=linkedin_id,
            client=client_obj,
            defaults={
                'platform': 'linkedin',
                'account_name': name,
                'access_token': access_token,
                # O token do LinkedIn dura 60 dias, depois precisa renovar
                'is_active': True 
            }
        )
        return account

class TikTokService:
    # Endpoints da API V2 do TikTok
    AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
    TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
    USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/"
    
    def get_auth_url(self, state_token, redirect_uri):
        """
        Gera a URL para o usuário clicar e autorizar o app.
        """
        # Escopos necessários para ler perfil e postar vídeos
        scopes = [
            "user.info.basic",
            # "video.upload",
            # "video.publish"
        ]
        
        # AQUI ESTÁ A CORREÇÃO (client_key em vez de client_id)
        params = {
            "client_key": settings.TIKTOK_CLIENT_KEY, 
            "response_type": "code",
            "scope": ",".join(scopes), # Separa os escopos por vírgula
            'redirect_uri': redirect_uri,
            "state": state_token,
        }
        
        # Converte o dicionário para formato de URL (ex: key=valor&key2=valor2)
        url_params = urllib.parse.urlencode(params)
        
        return f"{self.AUTH_URL}?{url_params}"

    def get_access_token(self, code, redirect_uri):
        """
        Troca o 'code' recebido no callback pelo 'access_token' definitivo.
        """
        data = {
            "client_key": settings.TIKTOK_CLIENT_KEY,
            "client_secret": settings.TIKTOK_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            'redirect_uri': redirect_uri,
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cache-Control": "no-cache"
        }

        try:
            response = requests.post(self.TOKEN_URL, data=data, headers=headers)
            response.raise_for_status() # Levanta erro se não for 200 OK
            return response.json() # Retorna o JSON com access_token e open_id
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Erro ao obter token do TikTok: {e}")
            if response is not None:
                print(f"Detalhes do erro: {response.text}")
            return None

    def get_user_info(self, access_token):
        """ Busca dados básicos do usuário (Nome e Avatar) """
        fields = ["display_name", "avatar_url"]
        params = {"fields": ",".join(fields)}
        headers = {"Authorization": f"Bearer {access_token}"}

        try:
            response = requests.get(self.USER_INFO_URL, params=params, headers=headers)
            if response.status_code == 200:
                data = response.json().get('data', {})
                return {
                    'name': data.get('display_name', 'Usuário TikTok'),
                    'avatar': data.get('avatar_url', '')
                }
            return None
        except Exception as e:
            print(f"Erro User Info TikTok: {e}")
            return None
    
    def save_account(self, token_data, client_obj):
        """ Salva/Atualiza a conta no banco de dados """
        
        # O TikTok retorna 'open_id' como identificador único do usuário
        access_token = token_data.get('access_token')
        open_id = token_data.get('open_id') 
        
        if not access_token or not open_id:
            print(f"Dados incompletos do TikTok: {token_data}")
            return None

        # Tenta buscar o nome do usuário para salvar bonitinho
        # (Certifique-se de ter o método get_user_info na classe também)
        user_info = self.get_user_info(access_token)
        name = user_info.get('name') if user_info else "TikTok User"

        # Salva no banco (Tabela SocialAccount)
        account, created = SocialAccount.objects.update_or_create(
            account_id=open_id,
            client=client_obj,
            defaults={
                'platform': 'tiktok',
                'account_name': name,
                'access_token': access_token,
                'refresh_token': token_data.get('refresh_token', ''),
                'is_active': True
            }
        )
        return account

class PinterestService:
    # Endpoints da API V5
    AUTH_URL = "https://www.pinterest.com/oauth/"
    TOKEN_URL = "https://api.pinterest.com/v5/oauth/token"
    USER_INFO_URL = "https://api.pinterest.com/v5/user_account"

    def get_auth_url(self, state_token, redirect_uri):
        """ Gera a URL de login """
        params = {
            "client_id": settings.PINTEREST_APP_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": ",".join(settings.PINTEREST_SCOPES),
            "state": state_token,
        }
        return f"{self.AUTH_URL}?{urllib.parse.urlencode(params)}"

    def exchange_code_for_token(self, code, redirect_uri):
        """ Troca o code pelo token usando Basic Auth """
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        }
        
        # Pinterest exige autenticação Basic (ID:Secret em base64) no header
        auth = HTTPBasicAuth(settings.PINTEREST_APP_ID, settings.PINTEREST_APP_SECRET)

        try:
            response = requests.post(self.TOKEN_URL, data=data, auth=auth)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Erro Pinterest Token: {e}")
            if response: print(response.text)
            return None

    def get_user_info(self, access_token):
        """ Busca dados do usuário (Nome e Foto) """
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.get(self.USER_INFO_URL, headers=headers)
            if response.status_code == 200:
                return response.json() # Retorna {username, profile_image, etc}
            return None
        except Exception as e:
            print(f"Erro User Info Pinterest: {e}")
            return None

    def save_account(self, token_data, client_obj):
        """ Salva no Banco """
        access_token = token_data.get('access_token')
        refresh_token = token_data.get('refresh_token')
        
        if not access_token: return None

        # Busca info do perfil
        user_info = self.get_user_info(access_token)
        if not user_info: return None

        username = user_info.get('username')
        # Tenta pegar a imagem de melhor qualidade (se disponível)
        profile_image = user_info.get('profile_image')
        
        # O ID único do Pinterest geralmente é o username ou buscado em outro endpoint, 
        # mas aqui usaremos o username como identificador principal se o ID não vier claro.
        # Nota: A API v5 não retorna um ID numérico simples no endpoint /user_account por padrão,
        # mas o username é único.
        account_id = username 

        account, created = SocialAccount.objects.update_or_create(
            account_id=account_id, 
            client=client_obj,
            defaults={
                'platform': 'pinterest',
                'account_name': username,
                'access_token': access_token,
                'refresh_token': refresh_token,
                'is_active': True
            }
        )
        return account