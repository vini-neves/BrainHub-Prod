# accounts/middleware.py

import datetime
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone
from django.conf import settings

class TrialPeriodMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Pega o tenant atual (injetado pelo django-tenants)
        tenant = getattr(request, 'tenant', None)

        # Se não tem tenant ou é o schema public (Admin SaaS), deixa passar
        if not tenant or tenant.schema_name == 'public':
            return self.get_response(request)

        # 2. Definição das rotas livres (para não criar loop de redirecionamento)
        # O usuário precisa conseguir ver a página de "Bloqueado" e talvez a de "Pagamento"
        allowed_urls = [
            reverse('tenant_expired'), # Vamos criar essa URL
            '/static/', # Deixa carregar CSS/JS
            '/media/',
        ]
        
        # Se a URL atual já é uma das permitidas, deixa passar
        for url in allowed_urls:
            if request.path.startswith(url):
                return self.get_response(request)

        # 3. Lógica de Bloqueio
        # "Se estiver em período de testes"
        if tenant.on_trial:
            # Verifica se a data existe e se já passou
            if tenant.paid_until and tenant.paid_until < timezone.now().date():
                # BLOQUEIA! Redireciona para aviso de expiração
                return redirect('tenant_expired')

        # Se não for trial ou se o trial ainda estiver válido, segue o fluxo normal
        response = self.get_response(request)
        return response