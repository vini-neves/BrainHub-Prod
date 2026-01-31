import json
import secrets
import datetime
import requests
import zipfile
import io

from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.views.generic import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.db import models, connection
from django.urls import reverse
from django.conf import settings
from django.contrib import messages
from django.utils import timezone
from django.contrib.auth import views as auth_views
from django.core.files.base import ContentFile

# --- IMPORTS LOCAIS ---
from .models import (
    Task, CalendarEvent, Client, SocialAccount, 
    MediaFolder, MediaFile, SOCIAL_NETWORKS, CONTENT_TYPES
)
from .forms import ClientForm, TenantAuthenticationForm, MediaFileForm, FolderForm
from accounts.models import CustomUser
from .services import MetaService, LinkedInService, TikTokService, PinterestService

# ==============================================================================
# 1. DASHBOARDS E VISÕES GERAIS
# ==============================================================================

class TenantLoginView(auth_views.LoginView):
    form_class = TenantAuthenticationForm
    template_name = 'projects/login.html'

@login_required
def dashboard(request):
    """Dashboard Principal (Visão Geral da Agência)"""
    
    # Tarefas Gerais (Kanban Padrão)
    pending_tasks = Task.objects.filter(status__in=['todo', 'doing'], kanban_type='general')
    completed_tasks = Task.objects.filter(status='done', kanban_type='general')
    
    # Métricas Operacionais (Social Media)
    # scheduled = tasks no status 'scheduled'
    posts_metrics = {
        'scheduled': Task.objects.filter(status='scheduled').count(),
        'pending_approval': Task.objects.filter(status__in=['review_internal', 'review_client']).count(),
        'in_production': Task.objects.filter(status__in=['copy', 'design']).count()
    }

    # Gráficos de Status Geral
    status_counts = Task.objects.values('status').annotate(count=models.Count('id'))
    chart_status_data = {item['status']: item['count'] for item in status_counts}

    context = {
        'pending_tasks_count': pending_tasks.count(),
        'completed_tasks_count': completed_tasks.count(),
        'total_tasks': pending_tasks.count() + completed_tasks.count(),
        'chart_status_data': json.dumps(chart_status_data),
        'posts_metrics': json.dumps(posts_metrics),
        'recent_tasks': pending_tasks.order_by('-updated_at')[:5],
        'upcoming_events': CalendarEvent.objects.filter(date__gte=timezone.now().date()).order_by('date')[:5]
    }
    return render(request, 'projects/dashboard.html', context)

@login_required
def social_dashboard(request):
    """Renderiza o painel principal de redes sociais."""
    connected_accounts = SocialAccount.objects.all()
    clients = Client.objects.all()
    
    # Histórico agora são as Tasks operacionais recentes
    posts_history = Task.objects.filter(
        kanban_type='operational'
    ).order_by('-created_at')[:10]

    context = {
        'connected_accounts': connected_accounts,
        'clients': clients,
        'posts_history': posts_history,
    }
    return render(request, 'projects/social_dashboard.html', context)

# ==============================================================================
# 2. CLIENTES E PROJETOS
# ==============================================================================

@login_required
def client_list_create(request):
    clients = Client.objects.all()
    add_client_form = ClientForm()
    return render(request, 'projects/client_list.html', {
        'clients': clients, 'add_client_form': add_client_form
    })

@login_required
def client_detail(request, pk):
    client = get_object_or_404(Client, pk=pk)
    return render(request, 'projects/client_detail.html', {
        'client': client,
    })

@login_required
def client_detail_api(request, pk):
    """HTML do modal de detalhes."""
    client = get_object_or_404(Client, pk=pk)
    
    return render(request, 'projects/client_detail_modal.html', {
        'client': client,
    })

@login_required
def get_client_data_api(request, pk):
    client = get_object_or_404(Client, pk=pk)
    connected_platforms = list(client.social_accounts.filter(is_active=True).values_list('platform', flat=True))
    
    data = {
        'id': client.id,
        'name': client.name,
        'cnpj': client.cnpj,
        'nome_representante': client.nome_representante,
        'celular_representante': client.celular_representante,
        'email_representante': client.email_representante,
        'data_inicio_contrato': client.data_inicio_contrato.strftime('%Y-%m-%d') if client.data_inicio_contrato else '',
        'data_finalizacao_contrato': client.data_finalizacao_contrato.strftime('%Y-%m-%d') if client.data_finalizacao_contrato else '',
        'is_active': client.is_active,
        'connected_platforms': connected_platforms,
        'anexo_contrato_url': client.anexo_contrato.url if client.anexo_contrato else None,
        'manual_marca_url': client.manual_marca.url if client.manual_marca else None,
        'logo_url': client.logo.url if client.logo else None,
    }
    return JsonResponse(data)

@login_required
def get_clients_list_api(request):
    clients = Client.objects.all().values('id', 'name')
    return JsonResponse({'clients': list(clients)})

@login_required
def client_metrics_dashboard(request, pk):
    """
    Dashboard de métricas específicas de um cliente.
    Calcula status das Tasks Gerais e Operacionais (Posts).
    """
    client = get_object_or_404(Client, pk=pk)
    
    # 1. Todas as tarefas vinculadas a este cliente
    all_tasks = Task.objects.filter(client=client)
    
    # --- Métricas de Tarefas Gerais (Projetos/Gestão) ---
    general_tasks = all_tasks.filter(kanban_type='general')
    task_status_counts = general_tasks.values('status').annotate(count=models.Count('id'))
    task_chart_data = {item['status']: item['count'] for item in task_status_counts}

    # --- Métricas de Social Media (Tasks Operacionais) ---
    op_tasks = all_tasks.filter(kanban_type='operational')
    post_status_counts = op_tasks.values('status').annotate(count=models.Count('id'))
    post_chart_data = {item['status']: item['count'] for item in post_status_counts}
    
    total_posts_created = op_tasks.count()
    total_posts_scheduled = op_tasks.filter(status='scheduled').count()
    
    # Placeholders (Model Task ainda não tem likes/views)
    total_likes = 0 
    total_views = 0

    context = {
        'client': client,
        'task_chart_data': json.dumps(task_chart_data),
        'post_chart_data': json.dumps(post_chart_data),
        'total_tasks': general_tasks.count(),
        'total_posts': total_posts_created,
        'posts_scheduled': total_posts_scheduled,
        'total_likes': total_likes,
        'total_views': total_views,
    }
    return render(request, 'projects/client_metrics.html', context)

@login_required
@require_POST
def create_client_api(request):
    form = ClientForm(request.POST, request.FILES)
    if form.is_valid():
        client = form.save()
        return JsonResponse({'status': 'success', 'message': 'Cliente cadastrado!', 'client_id': client.id})
    return JsonResponse({'status': 'error', 'errors': form.errors}, status=400)

@login_required
@require_POST
def update_client_api(request, pk):
    client = get_object_or_404(Client, pk=pk)
    form = ClientForm(request.POST, request.FILES, instance=client)
    if form.is_valid():
        client = form.save()
        return JsonResponse({'status': 'success', 'message': 'Cliente atualizado!'})
    return JsonResponse({'status': 'error', 'errors': form.errors}, status=400)

@login_required
@require_POST
def delete_client_api(request, pk):
    client = get_object_or_404(Client, pk=pk)
    client.delete()
    return JsonResponse({'status': 'success', 'message': 'Cliente removido.'})


# ==============================================================================
# 3. KANBAN E TAREFAS (CORE DO SISTEMA)
# ==============================================================================

@login_required
def kanban_view(request, kanban_type='general'):
    """View Principal que renderiza o Kanban (Geral ou Operacional)"""
    
    # 1. Definição de Colunas e Template
    if kanban_type == 'operational':
        stages = [
            ('briefing', 'Briefing'),
            ('copy', 'Copy'),
            ('design', 'Design'),
            ('review_internal', 'Aprovação Interna'),
            ('review_client', 'Aprovação Cliente'),
            ('scheduled', 'Agendado'),
        ]
        template = 'projects/operational_kanban.html'
        title = 'Fluxo de Produção'
    else:
        stages = [
            ('todo', 'A Fazer'), 
            ('doing', 'Em Andamento'), 
            ('done', 'Concluído')
        ]
        template = 'projects/general_kanban.html'
        title = 'Tarefas Gerais'

    # 2. Busca tarefas e serializa
    tasks = Task.objects.filter(kanban_type=kanban_type).order_by('order')
    kanban_data = {}
    
    for key, label in stages:
        stage_tasks = tasks.filter(status=key)
        kanban_data[key] = [task.to_dict() for task in stage_tasks]

    # ==================================================================
    # 3. LÓGICA DE REDES SOCIAIS (CORREÇÃO AQUI)
    # ==================================================================
    
    # Busca apenas clientes ativos
    clients = Client.objects.filter(is_active=True)
    client_networks_map = {}
    
    # DEBUG: Vai imprimir no terminal do VS Code/CMD
    print(f"\n--- INICIANDO MAPEAMENTO DE REDES ({kanban_type}) ---")

    for client in clients:
        # Tenta buscar pelo related_name definido no Model (social_accounts)
        # Se não achar, tenta o padrão do Django (socialaccount_set)
        if hasattr(client, 'social_accounts'):
            qs = client.social_accounts.all()
        elif hasattr(client, 'socialaccount_set'):
            qs = client.socialaccount_set.all()
        else:
            qs = None

        if qs is not None:
            # Pega apenas as plataformas ativas, remove duplicatas e cria lista
            platforms = list(set(qs.filter(is_active=True).values_list('platform', flat=True)))
            client_networks_map[client.id] = platforms
            
            # Print para conferência
            print(f"Cliente: {client.name} (ID {client.id}) -> Redes: {platforms}")
        else:
            client_networks_map[client.id] = []
            print(f"Cliente: {client.name} (ID {client.id}) -> Sem relacionamento encontrado.")
            
    print("--- FIM DO MAPEAMENTO ---\n")

    # 4. Contexto
    context = {
        'kanban_data': kanban_data,
        'kanban_data_json': json.dumps(kanban_data),
        'stages': stages,
        'clients': clients,
        'users': CustomUser.objects.filter(agency=request.tenant),
        'kanban_type': kanban_type,
        'page_title': title,
        
        # --- O JSON QUE O JAVASCRIPT PRECISA ---
        'client_networks_json': json.dumps(client_networks_map),
        
        'social_networks': SOCIAL_NETWORKS,
        'content_types': CONTENT_TYPES, 
    }
    return render(request, template, context)

@login_required
def kanban_board(request):
    """View Legada/Alternativa para Kanban Geral (se ainda usar)"""
    return kanban_view(request, 'general')

@login_required
def operational_kanban_board(request):
    """View Legada/Alternativa para Kanban Operacional (se ainda usar)"""
    return kanban_view(request, 'operational')

@login_required
def update_task_kanban(request, pk):
    """
    VIEW CRÍTICA: Processa o formulário do Modal (Briefing, Copy, Design, Aprovação).
    Recebe POST padrão (não JSON) para lidar com arquivos.
    """
    task = get_object_or_404(Task, pk=pk)
    
    if request.method == 'POST':
        action = request.POST.get('action') # save, approve, reject
        
        # 1. Campos de Briefing
        if 'social_network' in request.POST: task.social_network = request.POST.get('social_network')
        if 'content_type' in request.POST: task.content_type = request.POST.get('content_type')
        if 'briefing_text' in request.POST: task.briefing_text = request.POST.get('briefing_text')
        
        # Data (trata string vazia)
        sched_date = request.POST.get('scheduled_date')
        if sched_date:
            task.scheduled_date = sched_date
        
        if request.FILES.get('briefing_files'):
            task.briefing_files = request.FILES.get('briefing_files')

        # 2. Campos de Copy
        if 'script_content' in request.POST: task.script_content = request.POST.get('script_content')
        if 'copy_content' in request.POST: task.copy_content = request.POST.get('copy_content')
        if 'caption_content' in request.POST: task.caption_content = request.POST.get('caption_content')

        # 3. Campos de Design
        if request.FILES.get('final_art'):
            task.final_art = request.FILES.get('final_art')
        if request.FILES.get('design_files'):
            task.design_files = request.FILES.get('design_files')

        # 4. Lógica de Aprovação / Rejeição
        if action == 'approve':
            if task.status == 'review_internal':
                task.status = 'review_client'
            elif task.status == 'review_client':
                task.status = 'scheduled'
                
        elif action == 'reject':
            rejection_reason = request.POST.get('rejection_reason')
            image_annotation = request.POST.get('feedback_image_annotation')
            
            task.last_feedback = rejection_reason
            if image_annotation:
                task.feedback_image_annotation = image_annotation
                
            # Regra: Se reprovou, volta para design
            task.status = 'design' 
            
        task.save()
        messages.success(request, f"Tarefa '{task.title}' atualizada.")
        
    return redirect(request.META.get('HTTP_REFERER', 'dashboard'))

@login_required
def get_task_details_api(request, pk):
    task = get_object_or_404(Task, pk=pk)
    return JsonResponse(task.to_dict())

# --- APIs JSON para Drag & Drop e Criação Rápida ---

@method_decorator(csrf_exempt, name='dispatch')
class AddTaskAPI(View):
    """Cria tarefa Geral e Salva TODOS os campos"""
    @method_decorator(login_required)
    def post(self, request, *args, **kwargs):
        try:
            # 1. Captura os dados básicos
            title = request.POST.get('title')
            kanban_type = request.POST.get('kanban_type', 'general')
            priority = request.POST.get('priority', 'low')
            
            description = request.POST.get('description', '')
            deadline = request.POST.get('deadline')
            
            # --- MUDANÇA 1: PEGA LISTA DE TAGS ---
            tags_list = request.POST.getlist('tags') 
            tags_str = ",".join(tags_list) if tags_list else ""

            # --- MUDANÇA 2: PEGA LISTA DE RESPONSÁVEIS ---
            assigned_ids = request.POST.getlist('assigned_to')

            # Validação básica
            if not title:
                return JsonResponse({'status':'error', 'message':'Título é obrigatório'}, status=400)
            
            # Tratamento de Data vazia
            if deadline == '': deadline = None

            # Calcula a ordem
            max_order = Task.objects.filter(kanban_type=kanban_type, status='todo').aggregate(models.Max('order'))['order__max']
            new_order = (max_order or 0) + 1
            
            # --- MUDANÇA 3: CRIA A TAREFA SEM O CAMPO assigned_to ---
            task = Task.objects.create(
                title=title,
                kanban_type=kanban_type,
                status='todo',
                priority=priority,
                description=description,      
                deadline=deadline,
                tags=tags_str,
                created_by=request.user,
                order=new_order
                # REMOVIDO: assigned_to_id=... (Isso causava o erro)
            )
            
            # --- MUDANÇA 4: ADICIONA OS RESPONSÁVEIS DEPOIS DE CRIAR ---
            if assigned_ids:
                # Limpa IDs vazios e converte para inteiro
                clean_ids = [int(x) for x in assigned_ids if x]
                task.assigned_to.set(clean_ids)
            
            return JsonResponse({'status':'success', 'task': task.to_dict()})

        except Exception as e:
            print(f"Erro ao criar tarefa: {e}")
            return JsonResponse({'status':'error', 'message': str(e)}, status=500)            
@method_decorator(csrf_exempt, name='dispatch')
class EditTaskAPI(View):
    """Edita os dados da tarefa (Título, Desc, Data, Resp) via JSON"""
    @method_decorator(login_required)
    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk)
        
        try:
            # Atualiza campos simples apenas se eles forem enviados
            if 'title' in request.POST:
                task.title = request.POST.get('title')
            
            if 'description' in request.POST:
                task.description = request.POST.get('description')
                
            if 'priority' in request.POST:
                task.priority = request.POST.get('priority')
            
            # Tratamento de Data
            if 'deadline' in request.POST:
                deadline = request.POST.get('deadline')
                if deadline: 
                    task.deadline = deadline
                else:
                    task.deadline = None # Permite limpar a data

            # Tratamento de Tags
            # getlist retorna lista vazia se não tiver nada, então verificamos se a chave existe
            if 'tags' in request.POST:
                tags_list = request.POST.getlist('tags')
                task.tags = ",".join(tags_list)
            
            # Tratamento de Responsáveis (ManyToMany)
            if 'assigned_to' in request.POST:
                assigned_ids = request.POST.getlist('assigned_to')
                clean_ids = [int(x) for x in assigned_ids if x]
                task.assigned_to.set(clean_ids)
            # Nota: Se o campo 'assigned_to' não vier no POST, mantemos os atuais.
            # Se vier vazio (lista vazia), o .set([]) vai limpar. Isso é o correto.

            task.save()
            return JsonResponse({'status':'success', 'task': task.to_dict()})
            
        except Exception as e:
            return JsonResponse({'status':'error', 'message': str(e)}, status=500)
            
@login_required
def get_task_details_api(request, pk):
    """API Leve apenas para buscar dados para o Modal de Edição"""
    task = get_object_or_404(Task, pk=pk)
    try:
        return JsonResponse(task.to_dict())
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@method_decorator(csrf_exempt, name='dispatch')
class AddOperationalTaskAPI(View):
    """Cria tarefa Operacional (Social Media)"""
    @method_decorator(login_required)
    def post(self, request, *args, **kwargs):
        try:
            title = request.POST.get('title')
            client_id = request.POST.get('client')
            desc = request.POST.get('description', '')
            assigned_id = request.POST.get('assigned_to')
            
            if not title: return JsonResponse({'status':'error', 'message':'Título obrigatório'}, status=400)
            
            if not client_id:
                 return JsonResponse({'status':'error', 'message':'Selecione um Cliente ou Projeto.'}, status=400)
            
            max_order = Task.objects.filter(kanban_type='operational', status='briefing').aggregate(models.Max('order'))['order__max']
            new_order = (max_order or 0) + 1
            
            task = Task.objects.create(
                title=title,
                description=desc,
                kanban_type='operational',
                status='briefing',
                client_id=client_id,
                created_by=request.user,
                assigned_to_id=assigned_id or None,
                order=new_order
            )
            return JsonResponse({'status':'success', 'task': task.to_dict()})
        except Exception as e:
            return JsonResponse({'status':'error', 'message': str(e)}, status=500)

@method_decorator(csrf_exempt, name='dispatch')
class KanbanUpdateTask(View):
    """Drag and Drop API"""
    @method_decorator(login_required)
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            task = Task.objects.get(id=data.get('task_id'))
            
            if data.get('status'):
                task.status = data.get('status')
                task.save()
            
            if data.get('newOrderList'):
                for idx, t_id in enumerate(data['newOrderList']):
                    Task.objects.filter(id=t_id).update(order=idx)
                    
            return JsonResponse({'status': 'success'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@method_decorator(csrf_exempt, name='dispatch')
class DeleteTaskAPI(View):
    @method_decorator(login_required)
    def delete(self, request, pk):
        get_object_or_404(Task, pk=pk).delete()
        return JsonResponse({'status': 'success'})

# ==============================================================================
# 4. APROVAÇÃO EXTERNA (Link Público)
# ==============================================================================

@login_required
def send_approval_link(request, task_id):
    """Gera link para cliente aprovar a Task"""
    task = get_object_or_404(Task, pk=task_id)
    
    if not task.approval_token:
        task.approval_token = secrets.token_hex(16)
        task.save()
        
    url = request.build_absolute_uri(
        reverse('external_approval_view', kwargs={'token': task.approval_token})
    )
    
    if task.status == 'review_internal':
        task.status = 'review_client'
        task.save()

    return JsonResponse({'status': 'success', 'approval_url': url})

def external_approval_view(request, token):
    """Tela pública para o cliente (Não requer login)"""
    task = get_object_or_404(Task, approval_token=token)
    context = {
        'task': task,
        'image_url': task.final_art.url if task.final_art else None
    }
    return render(request, 'projects/external_approval.html', context)

@method_decorator(csrf_exempt, name='dispatch')
class ProcessApprovalAction(View):
    """API que recebe o Approve/Reject da tela pública do cliente"""
    def post(self, request):
        try:
            data = json.loads(request.body)
            token = data.get('token')
            action = data.get('action')
            feedback = data.get('feedback')
            
            task = get_object_or_404(Task, approval_token=token)
            
            if action == 'approve':
                task.status = 'scheduled'
                task.last_feedback = None
            elif action == 'reject':
                task.status = 'review_internal' 
                task.last_feedback = feedback
                
            task.save()
            return JsonResponse({'status': 'success'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

# ==============================================================================
# 5. CALENDÁRIO & MÍDIA
# ==============================================================================

@login_required
def calendar_view(request):
    return render(request, 'projects/calendar.html')

@login_required
def get_calendar_events(request):
    year = request.GET.get('year')
    month = request.GET.get('month')
    
    events_data = []
    
    # Busca Tasks Operacionais agendadas
    tasks = Task.objects.filter(
        kanban_type='operational', 
        scheduled_date__year=year, 
        scheduled_date__month=month
    )
    for t in tasks:
        events_data.append({
            'id': t.id,
            'title': t.title,
            'date': t.scheduled_date.strftime('%Y-%m-%d'),
            'time': t.scheduled_date.strftime('%H:%M'),
            'type': 'task',
            'status': t.status,
            'image': t.final_art.url if t.final_art else None
        })
        
    return JsonResponse(events_data, safe=False)

@login_required
def get_clients_for_select(request):
    """API para preencher o dropdown do modal."""
    clients = Client.objects.filter(is_active=True).values('id', 'name')
    return JsonResponse(list(clients), safe=False)

@login_required
@csrf_exempt
def add_calendar_event(request):
    """Legacy: Cria post simples via calendário (Compatibilidade)"""
    if request.method == 'POST':
        try:
            # Lógica simples para criar um evento direto
            return JsonResponse({'message': 'Funcionalidade substituída pelo Kanban.'}, status=200)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Método inválido'}, status=405)

# --- MEDIA MANAGER (Drive / R2) ---

@login_required
def media_manager(request, client_id, folder_id=None):
    client = get_object_or_404(Client, pk=client_id)
    current_folder = None
    if folder_id:
        current_folder = get_object_or_404(MediaFolder, pk=folder_id, client=client)

    if request.method == 'POST':
        if 'create_folder' in request.POST:
            folder_form = FolderForm(request.POST)
            if folder_form.is_valid():
                new_folder = folder_form.save(commit=False)
                new_folder.client = client
                new_folder.parent = current_folder
                new_folder.save()
                messages.success(request, "Pasta criada!")
                return redirect(request.path)

        elif 'upload_files' in request.POST:
            file_form = MediaFileForm(request.POST, request.FILES)
            if file_form.is_valid():
                files = request.FILES.getlist('files')
                if current_folder:
                    count = 0
                    for f in files:
                        MediaFile.objects.create(folder=current_folder, file=f)
                        count += 1
                    messages.success(request, f"{count} arquivos enviados!")
                else:
                    messages.error(request, "Selecione uma pasta.")
                return redirect(request.path)
            else:
                messages.error(request, "Erro no formulário.")

    folder_form = FolderForm()
    file_form = MediaFileForm()
    
    breadcrumbs = []
    temp = current_folder
    while temp:
        breadcrumbs.insert(0, temp)
        temp = temp.parent

    subfolders = MediaFolder.objects.filter(client=client, parent=current_folder)
    files = MediaFile.objects.filter(folder=current_folder) if current_folder else []

    context = {
        'client': client,
        'current_folder': current_folder,
        'breadcrumbs': breadcrumbs,
        'subfolders': subfolders,
        'files': files,
        'folder_form': folder_form,
        'file_form': file_form,
    }
    return render(request, 'projects/media_manager.html', context)

@login_required
def media_dashboard(request):
    clients = Client.objects.all().order_by('name')
    return render(request, 'projects/media_dashboard.html', {'clients': clients})

@login_required
def delete_folder(request, folder_id):
    folder = get_object_or_404(MediaFolder, pk=folder_id)
    client_id = folder.client.id
    parent_id = folder.parent.id if folder.parent else None
    folder.delete()
    messages.success(request, "Pasta excluída.")
    if parent_id:
        return redirect('media_folder', client_id=client_id, folder_id=parent_id)
    return redirect('media_root', client_id=client_id)

@login_required
def delete_file(request, file_id):
    file = get_object_or_404(MediaFile, pk=file_id)
    folder = file.folder
    file.delete()
    messages.success(request, "Arquivo excluído.")
    return redirect('media_folder', client_id=folder.client.id, folder_id=folder.id)

@login_required
@require_POST
def upload_photo_api(request):
    file = request.FILES.get('foto')
    client_id = request.POST.get('client_id')
    folder_id = request.POST.get('folder_id')

    if not file or not folder_id:
        return JsonResponse({'status': 'error', 'message': 'Dados inválidos.'}, status=400)

    try:
        client = get_object_or_404(Client, pk=client_id)
        current_folder = get_object_or_404(MediaFolder, pk=folder_id, client=client)
        media_file = MediaFile.objects.create(folder=current_folder, file=file)
        return JsonResponse({'status': 'success', 'file_id': media_file.id, 'file_name': media_file.filename})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

def download_batch(request):
    if request.method == 'POST':
        file_ids = request.POST.getlist('selected_files')
        download_token = request.POST.get('download_token')
        if not file_ids: return redirect(request.META.get('HTTP_REFERER', '/'))

        files = MediaFile.objects.filter(id__in=file_ids)
        if not files.exists(): return redirect(request.META.get('HTTP_REFERER', '/'))

        first_file = files.first()
        client_name = slugify(first_file.folder.client.name)
        zip_filename = f"imagens_{client_name}.zip"

        zip_buffer = io.BytesIO()
        try:
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for media_file in files:
                    try:
                        file_content = media_file.file.read()
                        zip_file.writestr(media_file.filename, file_content)
                    except: continue
        except: pass

        zip_buffer.seek(0)
        response = HttpResponse(zip_buffer, content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{zip_filename}"'
        if download_token:
            response.set_cookie('download_token', download_token, max_age=10)
        return response
    return redirect('/')

# ==============================================================================
# 6. AUTH SOCIAL (OAUTH)
# ==============================================================================

# --- FACEBOOK (Início) ---
@login_required
def facebook_auth_start(request, client_id):
    request.session['meta_client_id'] = client_id
    state = secrets.token_urlsafe(16)
    request.session['meta_oauth_state'] = state
    
    # DEFINIMOS A INTENÇÃO AQUI
    request.session['meta_intent'] = 'facebook_only' 
    request.session['social_auth_origin'] = request.META.get('HTTP_REFERER', '/social/')
    
    service = MetaService()
    # Redireciona para o login da Meta
    return redirect(service.get_auth_url(state, redirect_uri=settings.META_REDIRECT_URI))

# --- INSTAGRAM (Início) ---
@login_required
def instagram_auth_start(request, client_id):
    request.session['meta_client_id'] = client_id
    state = secrets.token_urlsafe(16)
    request.session['meta_oauth_state'] = state
    
    # DEFINIMOS A INTENÇÃO AQUI
    request.session['meta_intent'] = 'instagram_only'
    request.session['social_auth_origin'] = request.META.get('HTTP_REFERER', '/social/')
    
    service = MetaService()
    # Redireciona para o mesmo login da Meta
    return redirect(service.get_auth_url(state, redirect_uri=settings.META_REDIRECT_URI))

# --- CALLBACK ÚNICO (Recebe a resposta e decide o que fazer) ---
@login_required
def meta_auth_callback(request):
    code = request.GET.get('code')
    state = request.GET.get('state')
    
    # ... (Validações de segurança CSRF iguais) ...
    if not state or state != request.session.get('meta_oauth_state'):
        messages.error(request, "Erro CSRF Meta.")
        return redirect('social_dashboard')

    client_id = request.session.get('meta_client_id')
    client = get_object_or_404(Client, pk=client_id)
    
    # Recupera qual era a intenção do usuário
    intent = request.session.get('meta_intent', 'both') 

    service = MetaService()
    token_data = service.exchange_code_for_token(code, redirect_uri=settings.META_REDIRECT_URI)
    
    if 'access_token' in token_data:
        access_token = token_data['access_token']
        count = 0
        
        # DECIDE QUAL FUNÇÃO CHAMAR
        if intent == 'instagram_only':
            count = service.save_only_instagram_accounts(access_token, client)
            tipo = "Instagram"
        elif intent == 'facebook_only':
            count = service.save_only_facebook_pages(access_token, client)
            tipo = "Facebook"
        else:
            # Caso antigo (salva tudo)
            c1 = service.save_only_facebook_pages(access_token, client)
            c2 = service.save_only_instagram_accounts(access_token, client)
            count = c1 + c2
            tipo = "Meta"

        if count > 0:
            messages.success(request, f"{count} conta(s) de {tipo} conectada(s) com sucesso!")
        else:
            if intent == 'instagram_only':
                messages.warning(request, "Nenhuma conta de Instagram vinculada encontrada. Verifique se sua Página do Facebook tem um Instagram conectado.")
            else:
                messages.warning(request, f"Nenhuma conta de {tipo} encontrada.")
    else:
        messages.error(request, "Erro ao conectar com a Meta.")

    origin_url = request.session.get('social_auth_origin', '/social/')
    return redirect(origin_url)

@login_required
def linkedin_auth_start(request, client_id):
    # 1. Salva dados na sessão
    request.session['linkedin_client_id'] = client_id
    state = secrets.token_urlsafe(16)
    request.session['linkedin_oauth_state'] = state
    
    # 2. Salva de onde o usuário veio (ex: https://cliente1.app.brainzhub.com.br/social/)
    # Se não tiver referer, manda para o dashboard padrão
    request.session['social_auth_origin'] = request.META.get('HTTP_REFERER', '/social/')

    service = LinkedInService()
    # Usa a URL centralizada do settings
    return redirect(service.get_auth_url(state, redirect_uri=settings.LINKEDIN_REDIRECT_URI))

@login_required
def linkedin_auth_callback(request):
    code = request.GET.get('code')
    state = request.GET.get('state')
    
    # Validações...
    if not state or state != request.session.get('linkedin_oauth_state'):
        messages.error(request, "Erro CSRF LinkedIn.")
        return redirect('social_dashboard')

    client_id = request.session.get('linkedin_client_id')
    client = get_object_or_404(Client, pk=client_id)
    
    service = LinkedInService()
    # Troca o token usando a MESMA URL centralizada
    token_data = service.exchange_code_for_token(code, redirect_uri=settings.LINKEDIN_REDIRECT_URI)

    if 'access_token' in token_data:
        account = service.save_account(token_data, client)
        if account:
            messages.success(request, f"LinkedIn conectado: {account.account_name}")
    else:
        messages.error(request, "Erro ao conectar LinkedIn.")

    # 3. RECUPERA A URL DE ORIGEM E REDIRECIONA O USUÁRIO DE VOLTA
    origin_url = request.session.get('social_auth_origin', '/social/')
    return redirect(origin_url)

@login_required
def tiktok_auth_start(request, client_id):
    # 1. Salva contexto na sessão
    request.session['tiktok_client_id'] = client_id
    state = secrets.token_urlsafe(16)
    request.session['tiktok_oauth_state'] = state
    
    # 2. Salva Origem (para onde voltar depois)
    request.session['social_auth_origin'] = request.META.get('HTTP_REFERER', '/social/')
    
    service = TikTokService()
    # 3. Redireciona usando a URL fixa do settings
    return redirect(service.get_auth_url(state, redirect_uri=settings.TIKTOK_REDIRECT_URI))

@login_required
def tiktok_auth_callback(request):
    code = request.GET.get('code')
    state = request.GET.get('state')
    error = request.GET.get('error')

    # Tratamento de erro vindo do TikTok (usuário cancelou)
    if error:
        messages.error(request, "Conexão com TikTok cancelada.")
        return redirect(request.session.get('social_auth_origin', '/social/'))

    # Validação CSRF
    if not state or state != request.session.get('tiktok_oauth_state'):
        messages.error(request, "Erro de segurança (CSRF) no TikTok.")
        return redirect('social_dashboard')

    client_id = request.session.get('tiktok_client_id')
    if not client_id:
        messages.error(request, "Sessão expirada.")
        return redirect('social_dashboard')

    client = get_object_or_404(Client, pk=client_id)
    service = TikTokService()
    
    # 4. Troca código por token (usando a MESMA URL fixa)
    token_data = service.get_access_token(code, redirect_uri=settings.TIKTOK_REDIRECT_URI)

    if token_data and 'access_token' in token_data:
        account = service.save_account(token_data, client)
        if account:
            messages.success(request, f"TikTok conectado: {account.account_name}")
        else:
            messages.error(request, "Erro ao salvar dados do TikTok.")
    else:
        messages.error(request, "Falha na comunicação com TikTok.")

    # 5. Redireciona de volta para o subdomínio do cliente
    origin_url = request.session.get('social_auth_origin', '/social/')
    return redirect(origin_url)

# --- PINTEREST ---

@login_required
def pinterest_auth_start(request, client_id):
    request.session['pinterest_client_id'] = client_id
    state = secrets.token_urlsafe(16)
    request.session['pinterest_oauth_state'] = state
    
    # Salva onde o usuário estava para voltar depois
    request.session['social_auth_origin'] = request.META.get('HTTP_REFERER', '/social/')
    
    service = PinterestService()
    # Usa URL centralizada
    return redirect(service.get_auth_url(state, redirect_uri=settings.PINTEREST_REDIRECT_URI))

@login_required
def pinterest_auth_callback(request):
    code = request.GET.get('code')
    state = request.GET.get('state')
    
    if not state or state != request.session.get('pinterest_oauth_state'):
        messages.error(request, "Erro CSRF Pinterest.")
        return redirect('social_dashboard')

    client_id = request.session.get('pinterest_client_id')
    client = get_object_or_404(Client, pk=client_id)
    
    service = PinterestService()
    # Troca token com URL centralizada
    token_data = service.exchange_code_for_token(code, redirect_uri=settings.PINTEREST_REDIRECT_URI)

    if token_data and 'access_token' in token_data:
        account = service.save_account(token_data, client)
        if account:
            messages.success(request, f"Pinterest conectado: {account.account_name}")
        else:
            messages.error(request, "Erro ao salvar dados do Pinterest.")
    else:
        messages.error(request, "Falha na comunicação com Pinterest.")

    # Retorna ao tenant
    origin_url = request.session.get('social_auth_origin', '/social/')
    return redirect(origin_url)

# Instâncias de Classe (para URLS)
add_task_api = AddTaskAPI.as_view()
add_operational_task_api = AddOperationalTaskAPI.as_view()
delete_task_api = DeleteTaskAPI.as_view()
kanban_update_task_api = KanbanUpdateTask.as_view()
process_approval_action = ProcessApprovalAction.as_view()