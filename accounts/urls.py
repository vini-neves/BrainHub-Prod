# accounts/urls.py

from django.urls import path
from . import views

urlpatterns = [
    path('team/', views.user_management_view, name='user_list'),
    path('api/team/create/', views.create_user_api, name='create_user_api'),

    path('saas/agencies/', views.agency_list, name='agency_list'),
    path('saas/agencies/create/', views.create_agency, name='create_agency'),
    path('saas/agencies/update/<int:pk>/', views.update_agency, name='update_agency'),
    path('subscription/expired/', views.tenant_expired, name='tenant_expired'),
    path('saas/agencies/delete/<int:pk>/', views.delete_agency, name='delete_agency'),

]