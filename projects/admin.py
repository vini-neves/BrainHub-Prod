# projects/admin.py

from django.contrib import admin
from .models import Project, Task, Client, CalendarEvent, SocialAccount, SocialPost, SocialPostDestination

# --- ADMIN INLINE PARA RELACIONAMENTOS ---
class SocialPostDestinationInline(admin.TabularInline):
    model = SocialPostDestination
    extra = 1

# --- ADMIN CLASSES ---

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'cnpj', 'nome_representante', 'data_inicio_contrato')
    search_fields = ('name', 'cnpj', 'email_representante')
    list_filter = ('data_inicio_contrato',)

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'client', 'status', 'start_date', 'due_date', 'created_at')
    search_fields = ('name',)
    list_filter = ('status', 'client')

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'project', 'status', 'kanban_type', 'assigned_to', 'updated_at')
    list_filter = ('status', 'kanban_type', 'assigned_to', 'project')
    search_fields = ('title', 'description')
    list_display_links = ('title', 'project')

@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ('title', 'start_date', 'created_by')
    list_filter = ('start_date', 'created_by')

@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = ('account_name', 'platform', 'client', 'is_active', 'token_expires_at')
    list_filter = ('platform', 'is_active', 'client')
    search_fields = ('account_name', 'account_id')

@admin.register(SocialPost)
class SocialPostAdmin(admin.ModelAdmin):
    list_display = ('content', 'client', 'approval_status', 'scheduled_for', 'status')
    list_filter = ('approval_status', 'status', 'client')
    search_fields = ('content',)
    inlines = [SocialPostDestinationInline] # Permite adicionar destinos na mesma página

@admin.register(SocialPostDestination)
class SocialPostDestinationAdmin(admin.ModelAdmin):
    list_display = ('post', 'account', 'platform_type')
    list_filter = ('platform_type', 'account')