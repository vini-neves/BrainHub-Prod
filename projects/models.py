# projects/models.py

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.shortcuts import reverse

# --- DEFINIÇÕES DE ESCOLHAS ---
KANBAN_TYPES = [
    ('general', 'Geral'),
    ('operational', 'Operacional'),
]

TASK_STATUS_CHOICES = [
    # Geral
    ('todo', 'A Fazer'),
    ('in_progress', 'Em Progresso'),
    ('done', 'Concluído'),
    
    # Operacional
    ('briefing', 'Briefing'),
    ('copy', 'Copy'),
    ('design', 'Design'),
    ('internal_approval', 'Aprovação Interna'),
    ('client_approval', 'Aprovação Cliente'),
    ('scheduling', 'Agendamento da Postagem'),
    ('published', 'Publicado'),
]

# --- MODELO CLIENT ---
class Client(models.Model):
    name = models.CharField(max_length=255, verbose_name="Nome do Cliente")
    cnpj = models.CharField(max_length=18, verbose_name="CNPJ", blank=True, null=True)
    data_inicio_contrato = models.DateField(verbose_name="Início do Contrato", blank=True, null=True)
    data_finalizacao_contrato = models.DateField(verbose_name="Fim do Contrato", blank=True, null=True)
    
    nome_representante = models.CharField(max_length=255, verbose_name="Nome do Representante", blank=True)
    celular_representante = models.CharField(max_length=20, verbose_name="Celular do Representante", blank=True)
    email_representante = models.EmailField(verbose_name="Email do Representante", blank=True)
    
    anexo_contrato = models.FileField(upload_to='contratos/', verbose_name="Anexo do Contrato", blank=True, null=True)
    manual_marca = models.FileField(upload_to='manual/', verbose_name="Anexo do Manual da Marca", blank=True, null=True)
    
    def __str__(self):
        return self.name

# --- MODELO PROJECT ---
class Project(models.Model):
    STATUS_CHOICES = [
        ('em_andamento', 'Em Andamento'),
        ('finalizado', 'Finalizado'),
        ('pausado', 'Pausado'),
    ]

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="projects", null=True, blank=True)
    name = models.CharField(max_length=255, verbose_name="Nome do Projeto")
    description = models.TextField(blank=True, null=True, verbose_name="Descrição")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='em_andamento', verbose_name="Status")
    start_date = models.DateField(verbose_name="Data de Início", null=True, blank=True)
    due_date = models.DateField(verbose_name="Data de Entrega", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

# --- MODELO TASK (Corrigido para updated_at e to_dict) ---
class Task(models.Model):
    kanban_type = models.CharField(max_length=20, choices=KANBAN_TYPES, default='general')
    status = models.CharField(max_length=20, choices=TASK_STATUS_CHOICES, default='todo')
    
    social_post = models.ForeignKey('SocialPost', on_delete=models.SET_NULL, null=True, blank=True, related_name='task_link')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    
    # CAMPOS DE DATA E ORDENAÇÃO
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última Atualização") # <-- ESSENCIAL
    order = models.IntegerField(default=0) 
    
    # CAMPOS DE USUÁRIO
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name="assigned_tasks",
        verbose_name="Atribuído a"
    )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title
        
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description or "Nenhuma descrição.",
            'status': self.get_status_display(),
            'project_name': self.project.name,
            'created_at': self.created_at.strftime('%d/%m/%Y às %H:%M'),
            'updated_at': self.updated_at.strftime('%d/%m/%Y às %H:%M'), # <-- AGORA FUNCIONARÁ
            'assigned_to': self.assigned_to.username if self.assigned_to else 'Ninguém atribuído',
        }

# --- MODELOS SOCIAL MEDIA ---
class SocialAccount(models.Model):
    PLATFORM_CHOICES = [
        ('facebook', 'Facebook Page'),
        ('instagram', 'Instagram Business'),
        ('linkedin', 'LinkedIn Company'),
        ('tiktok', 'TikTok Business'),
    ]
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    account_name = models.CharField(max_length=255, verbose_name="Nome da Conta")
    account_id = models.CharField(max_length=255, verbose_name="ID na Rede Social") # ID da página/perfil
    
    # Tokens de Acesso (Sensíveis!)
    access_token = models.TextField()
    refresh_token = models.TextField(blank=True, null=True)
    token_expires_at = models.DateTimeField(blank=True, null=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="social_accounts", null=True, blank=True, verbose_name="Cliente Vinculado")

    def __str__(self):
        return f"{self.get_platform_display()} - {self.account_name}"

class SocialPost(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Rascunho'),
        ('scheduled', 'Agendado'),
        ('published', 'Publicado'),
        ('failed', 'Falhou'),
    ]

    # --- CAMPOS DE CONTEÚDO E STATUS ---
    content = models.TextField(verbose_name="Legenda/Texto")
    image = models.ImageField(upload_to='social_posts/', blank=True, null=True, verbose_name="Imagem/Vídeo")
    scheduled_for = models.DateTimeField(verbose_name="Data e Hora da Publicação")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Relação com o Cliente
    client = models.ForeignKey(
        Client, 
        on_delete=models.CASCADE, 
        related_name="social_posts"
    )

    approval_status = models.CharField(
        max_length=30, 
        choices=[
            ('draft', 'Rascunho'), 
            ('copy_review', 'Aprovação: Copy'), 
            ('design_review', 'Aprovação: Design'), 
            ('internal_approval', 'Aprovação Interna'), 
            ('client_approval', 'Aprovação Cliente'), 
            ('approved_to_schedule', 'Pronto para Agendar')
        ],
        default='draft',
        verbose_name="Status do Fluxo Operacional"
    )
    
    copy_feedback = models.TextField(blank=True, null=True, verbose_name="Feedback da Copy")
    design_feedback = models.TextField(blank=True, null=True, verbose_name="Feedback do Design")
    approval_token = models.CharField(max_length=32, unique=True, blank=True, null=True)


    likes_count = models.IntegerField(default=0)
    comments_count = models.IntegerField(default=0)
    shares_count = models.IntegerField(default=0)
    views_count = models.IntegerField(default=0)
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Post ({self.get_status_display()}) - {self.scheduled_for}"
    pass

class SocialPostDestination(models.Model):
    DESTINATION_CHOICES = [
        ('facebook_feed', 'Facebook - Feed'),
        ('facebook_story', 'Facebook - Story'),
        ('instagram_feed', 'Instagram - Feed'),
        ('instagram_story', 'Instagram - Story'),
        ('instagram_reel', 'Instagram - Reel'),
        ('youtube_video', 'YouTube - Vídeo'),
        ('youtube_short', 'YouTube - Short'),
        ('linkedin_feed', 'LinkedIn - Feed'),
        ('pinterest_pin', 'Pinterest - Pin'),
        ('x_post', 'X (Twitter) - Post'),
        ('threads_post', 'Threads - Post'),
    ]
    
    post = models.ForeignKey('SocialPost', on_delete=models.CASCADE)
    account = models.ForeignKey('SocialAccount', on_delete=models.CASCADE)
    
    # O tipo de postagem (ex: 'instagram_reel')
    platform_type = models.CharField(max_length=50, choices=DESTINATION_CHOICES, verbose_name="Tipo de Postagem")
    
    def __str__(self):
        return f"{self.post.client.name} - {self.get_platform_type_display()}"
    pass

# EVENTOS DO CALENDÁRIO
class CalendarEvent(models.Model):
    title = models.CharField(max_length=255, verbose_name="Título da Entrega")
    start_date = models.DateField(verbose_name="Data de Início")
    description = models.TextField(blank=True, null=True, verbose_name="Descrição")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name="calendar_events"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'date': self.start_date.strftime('%Y-%m-%d'),
            'description': self.description,
        }

