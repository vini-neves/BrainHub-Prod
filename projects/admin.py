# projects/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Client, Task, SocialAccount, 
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


# --- TAREFA (KANBAN UNIFICADO) ---
@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    # Colunas da Tabela
    list_display = (
        'title', 
        'kanban_type', 
        'status_colored', 
        'client', 
        'social_network', 
        'scheduled_date', 
        'assigned_to'
    )
    
    # Filtros laterais
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
    
    # Organização do Formulário de Edição (Abas/Seções)
    fieldsets = (
        ('Dados Gerais', {
            'fields': ('title', 'description', 'client', 'kanban_type', 'status', 'priority', 'assigned_to', 'order')
        }),
        ('Fluxo Operacional (Briefing)', {
            'classes': ('collapse',), # Começa fechado se não quiser poluir
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

# --- CONTAS SOCIAIS ---
@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = ('account_name', 'platform', 'client', 'is_active', 'token_expires_at')
    list_filter = ('platform', 'is_active', 'client')
    search_fields = ('account_name', 'account_id')

# --- ARQUIVOS (DRIVE / R2) ---
@admin.register(MediaFolder)
class MediaFolderAdmin(admin.ModelAdmin):
    list_display = ('name', 'client', 'parent', 'created_at')
    list_filter = ('client',)
    search_fields = ('name', 'client__name')

@admin.register(MediaFile)
class MediaFileAdmin(admin.ModelAdmin):
    list_display = ('filename', 'folder', 'file_size', 'uploaded_at')
    search_fields = ('filename', 'folder__name')
    readonly_fields = ('uploaded_at',)

# --- CALENDÁRIO (LEGADO) ---
@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ('title', 'client', 'date', 'platform', 'status')
    list_filter = ('status', 'platform', 'date')
    date_hierarchy = 'date'

# OBS: SocialPost e SocialPostDestination foram removidos pois 
# a funcionalidade foi absorvida pela Task (Kanban Operacional).