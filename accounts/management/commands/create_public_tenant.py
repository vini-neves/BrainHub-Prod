# accounts/management/commands/create_public_tenant.py

from django.core.management.base import BaseCommand
from accounts.models import Agency, Domain
import sys

class Command(BaseCommand):
    help = 'Cria o tenant publico (schema public) e o dominio localhost'

    def handle(self, *args, **options):
        
        # Usamos self.stdout.write para imprimir no console
        self.stdout.write(self.style.MIGRATE_HEADING("--- EXECUTANDO COMANDO DE CORREÇÃO ---"))
        
        public_tenant = None

        # --- Bloco 1: Corrigindo o Tenant ---
        try:
            public_tenant = Agency.objects.get(schema_name='public')
            self.stdout.write(self.style.SUCCESS("Tenant 'public' já existe."))
            
        except Agency.DoesNotExist:
            self.stdout.write("Criando o tenant 'public'...")
            public_tenant = Agency(
                schema_name='public',
                name='Plataforma Principal'
            )
            # Define o atributo especial ANTES de salvar
            public_tenant.auto_create_schema = False
            public_tenant.save()
            self.stdout.write(self.style.SUCCESS("Tenant 'public' criado com sucesso."))
            
        except Exception as e:
            # self.stderr.write usa texto vermelho para erros
            self.stderr.write(f"Um erro inesperado ocorreu no Bloco 1: {e}")
            sys.exit(1) # Para o script se falhar aqui


        # --- Bloco 2: Criando o Domínio ---
        # Só executa se o Bloco 1 tiver sucesso
        if public_tenant:
            try:
                if not Domain.objects.filter(domain='localhost').exists():
                    Domain.objects.create(
                        domain='localhost',
                        tenant=public_tenant,
                        is_primary=True
                    )
                    self.stdout.write(self.style.SUCCESS("Domínio 'localhost' foi configurado com sucesso."))
                else:
                    self.stdout.write(self.style.SUCCESS("Domínio 'localhost' já estava configurado."))
                    
            except Exception as e:
                self.stderr.write(f"Um erro ocorreu ao criar o domínio: {e}")
        
        self.stdout.write(self.style.MIGRATE_HEADING("\n--- COMANDO FINALIZADO ---"))