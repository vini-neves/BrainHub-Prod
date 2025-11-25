# fix_public.py

from accounts.models import Agency, Domain

print("--- EXECUTANDO SCRIPT DE CORREÇÃO ---")

public_tenant = None

# --- Bloco 1: Corrigindo o Tenant ---
try:
    # 1. Tenta buscar o tenant 'public'
    public_tenant = Agency.objects.get(schema_name='public')
    print("Tenant 'public' já existe.")

except Agency.DoesNotExist:
    # 2. Se não existe, cria
    print("Criando o tenant 'public'...")
    public_tenant = Agency(
        schema_name='public',
        name='Plataforma Principal'
    )

    # 3. Define o atributo especial ANTES de salvar
    public_tenant.auto_create_schema = False
    public_tenant.save()
    print("Tenant 'public' criado com sucesso.")

except Exception as e:
    print(f"Um erro inesperado ocorreu no Bloco 1: {e}")


# --- Bloco 2: Criando o Domínio ---
# Só executa se o Bloco 1 tiver sucesso (public_tenant não é None)
if public_tenant:
    try:
        if not Domain.objects.filter(domain='localhost').exists():
            Domain.objects.create(
                domain='localhost',
                tenant=public_tenant,
                is_primary=True
            )
            print("Domínio 'localhost' foi configurado com sucesso.")
        else:
            print("Domínio 'localhost' já estava configurado.")

    except Exception as e:
        print(f"Um erro ocorreu ao criar o domínio: {e}")
else:
    print("ERRO: Bloco 2 não executado porque o tenant 'public' não foi encontrado ou criado.")

print("\n--- SCRIPT FINALIZADO ---")