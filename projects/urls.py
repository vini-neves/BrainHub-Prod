from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    # --- DASHBOARD & LOGIN ---
    path('', views.dashboard, name='dashboard'),
    path('login/', views.TenantLoginView.as_view(), name='login'),
    path('logout/', auth_views.LogoutView.as_view(template_name='projects/logout.html'), name='logout'),

    # --- ESQUECI A SENHA ---
    path('password_reset/', auth_views.PasswordResetView.as_view(
        template_name='projects/password_reset_form.html',
        email_template_name='projects/password_reset_email.html',
        subject_template_name='projects/password_reset_subject.txt'
    ), name='password_reset'),
    path('password_reset/done/', auth_views.PasswordResetDoneView.as_view(
        template_name='projects/password_reset_done.html'
    ), name='password_reset_done'),
    path('reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
        template_name='projects/password_reset_confirm.html'
    ), name='password_reset_confirm'),
    path('reset/done/', auth_views.PasswordResetCompleteView.as_view(
        template_name='projects/password_reset_complete.html'
    ), name='password_reset_complete'),

    # --- KANBAN UNIFICADO (GERAL & OPERACIONAL) ---
    # Rotas de Visualização
    path('kanban/general/', views.kanban_view, {'kanban_type': 'general'}, name='kanban_general'),
    path('kanban/operational/', views.kanban_view, {'kanban_type': 'operational'}, name='kanban_operational'),
    
    # APIs de Manipulação (Drag&Drop, CRUD)
    path('api/task/add-general/', views.AddTaskAPI.as_view(), name='add_task_api'),
    path('api/task/add-operational/', views.AddOperationalTaskAPI.as_view(), name='add_operational_task'),
    path('api/task/update-drag/', views.KanbanUpdateTask.as_view(), name='kanban_update_task'),
    path('api/task/edit/<int:pk>/', views.EditTaskAPI.as_view(), name='edit_task_api'),
    path('api/task/delete/<int:pk>/', views.DeleteTaskAPI.as_view(), name='delete_task_api'),
    path('api/task/details/<int:pk>/', views.get_task_details_api, name='get_task_details_api'),
    path('api/kanban/update/', views.KanbanUpdateTask.as_view(), name='kanban_update_task'),

    # --- FORMULÁRIO COMPLETO DE EDIÇÃO (MODAL HTML) ---
    # Esta rota recebe o POST do formulário com arquivos (Briefing/Copy/Design)
    path('task/update/<int:pk>/', views.update_task_kanban, name='update_task_kanban'),

    # --- CLIENTES & PROJETOS ---
    path('clients/', views.client_list_create, name='client_list'),
    path('clients/<int:pk>/metrics/', views.client_metrics_dashboard, name='client_metrics'),
    
    # APIs de Cliente
    path('api/clients/list-simple/', views.get_clients_list_api, name='get_clients_list_api'),
    path('api/clients/create/', views.create_client_api, name='create_client_api'),
    path('api/clients/<int:pk>/get/', views.get_client_data_api, name='get_client_data_api'),
    path('api/clients/<int:pk>/details/', views.client_detail_api, name='client_detail_api'),
    path('api/clients/<int:pk>/update/', views.update_client_api, name='update_client_api'),
    path('api/clients/<int:pk>/delete/', views.delete_client_api, name='delete_client_api'),

    # --- APROVAÇÃO EXTERNA (CLIENTE) ---
    # 1. Gerar Link (Botão na Agência)
    path('api/approval/generate-link/<int:task_id>/', views.send_approval_link, name='send_approval_link'),
    
    # 2. Tela Pública do Cliente
    path('approval/<str:token>/', views.external_approval_view, name='external_approval_view'),
    
    # 3. Ação de Aprovar/Reprovar (Cliente)
    path('api/approval/process/', views.ProcessApprovalAction.as_view(), name='process_approval_action'),

    # --- CALENDÁRIO ---
    path('calendar/', views.calendar_view, name='calendar_view'),
    path('api/calendar/events/', views.get_calendar_events, name='get_calendar_events'),
    path('api/calendar/clients/', views.get_clients_for_select, name='get_clients_for_select'),
    # Mantido para compatibilidade, mas funcionalidade absorvida pelo Kanban
    path('api/calendar/add/', views.add_calendar_event, name='add_calendar_event'),

    # --- SOCIAL DASHBOARD & AUTH ---
    path('social/', views.social_dashboard, name='social_dashboard'),
    
    # --- META (FACEBOOK & INSTAGRAM) ---
    # Início Separado (Novas Funções)
    path('auth/facebook/start/<int:client_id>/', views.facebook_auth_start, name='facebook_auth_start'),
    path('auth/instagram/start/<int:client_id>/', views.instagram_auth_start, name='instagram_auth_start'),
    
    # Callback Único (Obrigatório ser na raiz ou bater com o painel da Meta)
    path('meta-callback/', views.meta_auth_callback, name='meta_auth_callback'),

    # --- LINKEDIN ---
    path('auth/linkedin/start/<int:client_id>/', views.linkedin_auth_start, name='linkedin_auth_start'),
    path('linkedin-callback/', views.linkedin_auth_callback, name='linkedin_auth_callback'),

    # --- TIKTOK ---
    path('auth/tiktok/start/<int:client_id>/', views.tiktok_auth_start, name='tiktok_auth_start'),
    path('tiktok-callback/', views.tiktok_auth_callback, name='tiktok_auth_callback'),

    # --- GESTÃO DE MÍDIA (DRIVE) ---
    path('media-center/', views.media_dashboard, name='media_dashboard'),
    path('client/<int:client_id>/media/', views.media_manager, name='media_root'),
    path('client/<int:client_id>/media/<int:folder_id>/', views.media_manager, name='media_folder'),
    
    # Ações de Mídia
    path('media/folder/<int:folder_id>/delete/', views.delete_folder, name='delete_folder'),
    path('media/file/<int:file_id>/delete/', views.delete_file, name='delete_file'),
    path('api/media/upload/', views.upload_photo_api, name='api_upload_photo'),
    path('media/download-batch/', views.download_batch, name='media_download_batch'),
]