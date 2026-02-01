from django.db import models
from django.conf import settings
import secrets
import os
import uuid
from django.utils.text import slugify
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone

# ==============================================================================
# 1. ESCOLHAS GLOBAIS E CONSTANTES (KANBAN & REDES)
# ==============================================================================

KANBAN_TYPES = [
    ('general', 'Geral'),
    ('operational', 'Operacional (Social Media)'),
]

# Unificamos todos os status possíveis aqui
ALL_STATUS_CHOICES = [
    # --- Status Gerais ---
    ('todo', 'A Fazer'),
    ('doing', 'Em Andamento'),
    ('done', 'Concluído'),
    
    # --- Status Operacionais (Fluxo de Produção) ---
    ('briefing', '1. Briefing'),
    ('copy', '2. Copywriting'),
    ('design', '3. Design'),
    ('review_internal', '4. Aprovação Interna'),
    ('review_client', '5. Aprovação Cliente'),
    ('scheduled', '6. Agendado/Finalizado'),
]

# --- NOVAS CONSTANTES PARA O KANBAN OPERACIONAL ---

# Redes Sociais (A Plataforma)
SOCIAL_NETWORKS = [
    ('instagram', 'Instagram'),
    ('facebook', 'Facebook'),
    ('tiktok', 'TikTok'),
    ('youtube', 'YouTube'),
    ('linkedin', 'LinkedIn'),
    ('x', 'X (Twitter)'),
    ('pinterest', 'Pinterest'),
    ('threads', 'Threads'),
]

# Tipos de Conteúdo (O Formato Agrupado)
CONTENT_TYPES = [
    ('feed', 'Feed / Postagem (Quadrado/Portrait)'), # Serve para: Insta, Face, LinkedIn, X, Threads
    ('story', 'Story (Vertical)'),                   # Serve para: Insta, Face
    ('reel_short', 'Reels / TikTok / Shorts'),       # Serve para: Insta, TikTok, YouTube Shorts
    ('video_long', 'Vídeo Longo (Horizontal)'),      # Serve para: YouTube, LinkedIn Vídeo
    ('pin', 'Pinterest Pin (Vertical)'),             # Serve para: Pinterest
]

# ==============================================================================
# 2. CLIENTE E PROJETOS
# ==============================================================================

class Client(models.Model):
    name = models.CharField(max_length=255, verbose_name="Nome do Cliente")
    cnpj = models.CharField(max_length=18, verbose_name="CNPJ", blank=True, null=True)
    
    # Dados de Contrato
    data_inicio_contrato = models.DateField(verbose_name="Início do Contrato", blank=True, null=True)
    data_finalizacao_contrato = models.DateField(verbose_name="Fim do Contrato", blank=True, null=True)
    
    # Dados do Representante
    nome_representante = models.CharField(max_length=255, verbose_name="Nome do Representante", blank=True)
    celular_representante = models.CharField(max_length=20, verbose_name="Celular do Representante", blank=True)
    email_representante = models.EmailField(verbose_name="Email do Representante", blank=True)
    
    # Arquivos
    anexo_contrato = models.FileField(upload_to='contratos/', verbose_name="Anexo do Contrato", blank=True, null=True)
    manual_marca = models.FileField(upload_to='manual/', verbose_name="Anexo do Manual da Marca", blank=True, null=True)
    
    # Logo para o mockup de aprovação
    logo = models.ImageField(upload_to='logos_clientes/', verbose_name="Logo do Cliente", blank=True, null=True)
    is_active = models.BooleanField(default=True, verbose_name="Cliente Ativo?")

    def __str__(self):
        return self.name

# ==============================================================================
# 3. REDES SOCIAIS (CONEXÕES / API)
# ==============================================================================

class SocialAccount(models.Model):
    PLATFORM_CHOICES = [
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
        ('linkedin', 'LinkedIn'),
        ('tiktok', 'TikTok'),
        ('pinterest', 'Pinterest'),
        ('youtube', 'YouTube'),
        ('threads', 'Threads'),
        ('x', 'X (Twitter)'),
        ('tiktok_ads', 'TikTok Ads'),
        ('linkedin_ads', 'LinkedIn Ads'),
        ('meta_ads', 'Meta Ads'),
        ('google_ads', 'Google Ads'),
        ('google_my_business', 'Google Meu Negócio'),
        ('ga4', 'Google Analytics 4'),
    ]
    
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="social_accounts", null=True, blank=True, verbose_name="Cliente Vinculado")
    platform = models.CharField(max_length=50, choices=PLATFORM_CHOICES)
    account_name = models.CharField(max_length=255, verbose_name="Nome da Conta")
    account_id = models.CharField(max_length=255, verbose_name="ID na Rede Social")
    access_token = models.TextField()
    refresh_token = models.TextField(blank=True, null=True)
    token_expires_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_platform_display()} - {self.account_name}"

# ==============================================================================
# 4. TAREFA (KANBAN GERAL E OPERACIONAL UNIFICADO)
# ==============================================================================

class Task(models.Model):
    # --- Controle Geral ---
    kanban_type = models.CharField(max_length=20, choices=KANBAN_TYPES, default='general')
    status = models.CharField(max_length=50, choices=ALL_STATUS_CHOICES, default='todo')
    
    # Se for operacional, vincula direto ao Cliente (além do projeto opcional)
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')

    PRIORITY_CHOICES = [
        ('high', 'Alta'),
        ('medium', 'Média'),
        ('low', 'Baixa'),
    ]
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='low')
    
    title = models.CharField(max_length=255, verbose_name="Título / Tema")
    description = models.TextField(blank=True, null=True, verbose_name="Descrição Geral")
    
    # --- CAMPOS ESPECÍFICOS DO FLUXO OPERACIONAL (Briefing -> Agendamento) ---
    
    # Passo 1: Briefing
    social_network = models.CharField(max_length=20, choices=SOCIAL_NETWORKS, blank=True, null=True, verbose_name="Rede Social")
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPES, blank=True, null=True, verbose_name="Formato")
    
    briefing_text = models.TextField(blank=True, null=True, verbose_name="Briefing Detalhado")
    briefing_files = models.FileField(upload_to='briefings/', blank=True, null=True, verbose_name="Anexo Briefing")
    
    scheduled_date = models.DateTimeField(null=True, blank=True, verbose_name="Data Prevista Publicação")

    # Passo 2: Copywriting
    script_content = models.TextField(blank=True, verbose_name="Roteiro (Vídeo/Carrossel)")
    copy_content = models.TextField(blank=True, verbose_name="Texto da Arte (Headline)")
    caption_content = models.TextField(blank=True, verbose_name="Legenda do Post")

    # Passo 3: Design
    final_art = models.ImageField(upload_to='designs/', blank=True, null=True, verbose_name="Arte Final / Capa")
    design_files = models.FileField(upload_to='designs_source/', blank=True, null=True, verbose_name="Editável (PSD/AI)")

    # Passo 4 e 5: Aprovação
    approval_token = models.CharField(max_length=64, unique=True, blank=True, null=True) # Link para cliente externo
    last_feedback = models.TextField(blank=True, null=True, verbose_name="Motivo Reprova")
    feedback_image_annotation = models.TextField(blank=True, null=True, verbose_name="Rabisco (Base64)")

    # --- CAMPOS PADRÃO ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    order = models.IntegerField(default=0) 
    deadline = models.DateField(null=True, blank=False, verbose_name="Prazo de Entrega")
    tags = models.CharField(max_length=255, blank=True, null=True, verbose_name="Tags")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    assigned_to = models.ManyToManyField(
        settings.AUTH_USER_MODEL, 
        blank=True, 
        related_name="assigned_tasks",
        verbose_name="Responsáveis"
    )

    class Meta:
        ordering = ['order']

    def save(self, *args, **kwargs):
        # Gera token para aprovação externa se for operacional e ainda não tiver
        if self.kanban_type == 'operational' and not self.approval_token:
            self.approval_token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.get_kanban_type_display()}] {self.title}"
        
    def get_mockup_class(self):
        """Retorna classe CSS para o mockup visual no frontend"""
        if self.content_type in ['story', 'reel_short', 'pin']:
            return 'format-vertical'
        elif self.content_type == 'video_long':
            return 'format-horizontal'
        return 'format-square'

    def can_edit(self, user):
        """Regras de permissão baseadas no status"""
        if user.is_superuser: return True
        
        # Adapte 'role' conforme seu modelo de User
        role = getattr(user, 'role', 'guest') 

        if self.status in ['briefing', 'copy']:
            return role in ['admin', 'copywriter', 'social_media']
        elif self.status == 'design':
            return role in ['admin', 'designer', 'photographer', 'social_media']
        elif self.status == 'review_internal':
            return role in ['admin', 'manager']
        elif self.status == 'review_client':
            return role == 'client'
        return False

    def to_dict(self):
        """Serializa a tarefa para JSON com detalhes dos responsáveis"""
        
        # Monta a lista de responsáveis com dados visuais (Iniciais e Nome)
        assignees_data = []
        for user in self.assigned_to.all():
            # Tenta pegar as iniciais (ex: "J" de John + "D" de Doe = JD)
            initials = ""
            if user.first_name:
                initials += user.first_name[0]
            if user.last_name:
                initials += user.last_name[0]
            
            # Se não tiver nome, pega as 2 primeiras letras do username
            if not initials:
                initials = user.username[:2]

            assignees_data.append({
                'id': user.id,
                'name': user.get_full_name() or user.username,
                'initials': initials.upper(),
                # Se tiver foto de perfil, pode adicionar aqui: 'avatar': user.avatar.url
            })

        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'priority': self.priority,
            'order': self.order,
            
            # --- DADOS DOS RESPONSÁVEIS (AQUI ESTÁ A CORREÇÃO) ---
            'assignees': assignees_data,  # Lista completa com nomes e iniciais
            'assigned_to': [u.id for u in self.assigned_to.all()], # Lista só de IDs (para formulários)
            
            # --- DADOS DE CLIENTE E PRAZO ---
            'client_name': self.client.name if self.client else None,
            'deadline': self.deadline.strftime('%d/%m/%Y') if self.deadline else None,
            'is_late': (self.deadline < timezone.now().date()) if self.deadline else False,
            
            # --- DADOS VISUAIS EXTRAS ---
            'social_network': self.social_network,
            'art_url': self.final_art.url if self.final_art else None,
        }

# ==============================================================================
# 5. ARQUIVOS E MÍDIA (DRIVE / R2)
# ==============================================================================

def client_r2_path(instance, filename):
    
    # Opção B: Se você usa django-tenants e quer o nome do tenant atual:
    from django.db import connection
    try:
        agency_name = slugify(connection.tenant.name)
    except:
        agency_name = 'public'

    # 2. Pega o nome do Cliente e limpa (tira espaços e acentos)
    # Ex: "McDonald's Brasil" vira "mcdonalds-brasil"
    client_name = slugify(instance.folder.client.name)
    
    # 3. Pega o nome da Pasta
    folder_name = slugify(instance.folder.name) if instance.folder else 'root'
    
    # 4. Mantém a extensão original do arquivo
    name, ext = os.path.splitext(filename)
    clean_filename = slugify(name) + ext
    unique_suffix = str(uuid.uuid4())[:4]
    final_filename = f"{clean_filename}_{unique_suffix}{ext}"

    return f'{agency_name}/{client_name}/{folder_name}/{final_filename}'

class MediaFolder(models.Model):
    name = models.CharField("Nome da Pasta", max_length=255)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='folders')
    
    # Auto-relacionamento: Permite criar subpastas dentro de pastas
    parent = models.ForeignKey(
        'self', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='subfolders'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['name']
        # Evita criar duas pastas com mesmo nome no mesmo lugar
        unique_together = ['parent', 'name', 'client'] 

    def __str__(self):
        return self.name

class MediaFile(models.Model):
    folder = models.ForeignKey(MediaFolder, on_delete=models.CASCADE, related_name='files')
    # O upload_to chama a função acima para decidir o caminho no R2
    file = models.FileField(upload_to=client_r2_path) 
    filename = models.CharField(max_length=255, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    def save(self, *args, **kwargs):
        # Salva metadados automaticamente antes de enviar
        if self.file:
            self.filename = os.path.basename(self.file.name)
            self.file_size = self.file.size
        super().save(*args, **kwargs)

    def __str__(self):
        return self.filename
    
@receiver(post_delete, sender=MediaFile)
def remove_file_from_storage(sender, instance, **kwargs):
    """
    Deleta o arquivo físico do storage (R2/S3) quando o objeto MediaFile 
    é deletado do banco de dados via Django Admin ou Views.
    """
    if instance.file:
        try:
            # save=False impede que o Django tente salvar o model novamente após apagar
            instance.file.delete(save=False) 
            print(f"--> Arquivo deletado do R2: {instance.filename}")
        except Exception as e:
            print(f"--> ERRO ao deletar do R2: {e}")

# ==============================================================================
# 6. CALENDÁRIO (SIMPLES / LEGADO)
# ==============================================================================
class CalendarEvent(models.Model):
    PLATFORM_CHOICES = [
        ('instagram', 'Instagram'),
        ('facebook', 'Facebook'),
        ('linkedin', 'LinkedIn'),
        ('tiktok', 'TikTok'),
        ('youtube', 'YouTube'),
    ]

    TYPE_CHOICES = [
        ('Feed', 'Feed'),
        ('Story', 'Story'),
        ('Reels', 'Reels'),
    ]

    STATUS_CHOICES = [
        ('Draft', 'Rascunho'),
        ('Pending', 'Pendente Aprovação'),
        ('Scheduled', 'Agendado'),
        ('Published', 'Publicado'),
    ]

    # Conexão real com o Cliente
    client = models.ForeignKey(Client, on_delete=models.CASCADE, null=True, blank=True)
    
    title = models.CharField(max_length=200, blank=True) # Título pode ser vazio se tiver cliente
    date = models.DateField()
    time = models.TimeField(default="09:00")
    
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='instagram')
    post_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='Feed')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    
    # Novos campos para o Modal Completo
    caption = models.TextField(blank=True, null=True)
    media = models.ImageField(upload_to='posts_media/', blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.client.name} - {self.date}"