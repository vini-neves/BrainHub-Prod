# projects/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Client, Project, Task, SocialAccount, 
    CalendarEvent, MediaFolder, MediaFile
)

# --- CLIENTE ---
@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'get_logo', 'cnpj', 'nome_representante', 'is_active')
    search_fields = ('name', 'cnpj', 'email_representante')
    list_filter = ('is_active', 'data_inicio_contrato')
    
    def get_logo(self, obj):
        if obj.logo:
            return format_html('<img src="{}" width="30" height="30" style="border-radius:50%;" />', obj.logo.url)
        return "-"
    get_logo.short_description = "Logo"

# --- PROJETO ---
@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'client', 'status', 'due_date', 'created_at')
    search_fields = ('name', 'client__name')
    list_filter = ('status', 'client')
    date_hierarchy = 'created_at'

# --- TAREFA (KANBAN UNIFICADO) ---
@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    # 1. MUDANÇA AQUI: Trocamos 'assigned_to' por 'get_assigned_to'
    list_display = (
        'title', 
        'kanban_type', 
        'status_colored', 
        'client', 
        'social_network', 
        'scheduled_date', 
        'get_assigned_to' 
    )
    
    # Filtros laterais (ManyToManyField funciona nativamente aqui, pode manter)
    list_filter = (
        'kanban_type', 
        'status', 
        'social_network', 
        'priority', 
        'client', 
        'assigned_to'
    )
    
    # Barra de busca
    search_fields = ('title', 'description', 'client__name', 'copy_content')
    
    # 2. MUDANÇA AQUI: Melhor interface para selecionar múltiplos usuários
    filter_horizontal = ('assigned_to',)

    # Organização do Formulário de Edição (Abas/Seções)
    fieldsets = (
        ('Dados Gerais', {
            'fields': ('title', 'description', 'project', 'client', 'kanban_type', 'status', 'priority', 'assigned_to', 'order')
        }),
        ('Fluxo Operacional (Briefing)', {
            'classes': ('collapse',), 
            'description': 'Preencha apenas se for uma tarefa de Social Media',
            'fields': ('social_network', 'content_type', 'briefing_text', 'briefing_files', 'scheduled_date')
        }),
        ('Conteúdo & Copy', {
            'classes': ('collapse',),
            'fields': ('script_content', 'copy_content', 'caption_content')
        }),
        ('Design & Arquivos', {
            'classes': ('collapse',),
            'fields': ('final_art', 'design_files')
        }),
        ('Aprovação & Feedback', {
            'classes': ('collapse',),
            'fields': ('approval_token', 'last_feedback', 'feedback_image_annotation')
        }),
    )

    def status_colored(self, obj):
        """Colore o status para facilitar visualização"""
        colors = {
            'done': 'green',
            'scheduled': 'green',
            'review_client': 'orange',
            'review_internal': 'orange',
            'todo': 'red',
            'briefing': 'blue'
        }
        color = colors.get(obj.status, 'black')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, obj.get_status_display())
    status_colored.short_description = 'Status'

    # 3. NOVA FUNÇÃO: Formata a lista de responsáveis para exibir na tabela
    def get_assigned_to(self, obj):
        # Pega todos os usuários e junta os nomes com vírgula
        return ", ".join([user.username for user in obj.assigned_to.all()])
    get_assigned_to.short_description = 'Responsáveis'