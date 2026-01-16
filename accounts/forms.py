# accounts/forms.py
from django import forms
from django.core.exceptions import ValidationError
from .models import Agency

from django import forms
from django.core.exceptions import ValidationError
from .models import Agency

class AgencyForm(forms.ModelForm):
    # =========================================================================
    # CAMPOS EXTRAS (Não existem diretamente no Model Agency)
    # =========================================================================
    
    # 1. Domínio: Será salvo na tabela 'Domain' pela view
    domain_url = forms.CharField(
        label="Domínio de Acesso",
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control', 
            'placeholder': 'cliente.meusistema.com'
        }),
        help_text="Digite apenas o endereço (ex: empresa.com)"
    )
    
    # 2. Módulos: Será convertido em JSON e salvo no campo 'menu_config' da Agency
    visible_menus = forms.MultipleChoiceField(
        label="Módulos Habilitados",
        required=False,
        choices=[
            ('dashboard', 'Dashboard'),
            ('gestao', 'Gestão'),
            ('producao', 'Produção'),
            ('social', 'Social Media'),
            ('arquivos', 'Arquivos'),
            ('admin', 'Administração'),
        ],
        widget=forms.CheckboxSelectMultiple(attrs={'class': 'form-check-input'})
    )

    # =========================================================================
    # METADATA (Campos diretos do Model Agency)
    # =========================================================================
    class Meta:
        model = Agency
        fields = [
            'name', 
            'schema_name', 
            'logo', 
            'primary_color', 
            'secondary_color', 
            'on_trial', 
            'paid_until'
        ]
        
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nome da Agência'}),
            'schema_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'schema_banco_dados'}),
            
            # Upload de Imagem
            'logo': forms.FileInput(attrs={'class': 'form-control', 'accept': 'image/*'}),
            
            # Seletores de Cor (HTML5 Color Picker)
            'primary_color': forms.TextInput(attrs={'type': 'color', 'class': 'form-control form-control-color'}),
            'secondary_color': forms.TextInput(attrs={'type': 'color', 'class': 'form-control form-control-color'}),
            
            # Datas e Checkbox
            'paid_until': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'on_trial': forms.CheckboxInput(attrs={'class': 'form-check-input', 'id': 'on_trial'}),
        }

    # =========================================================================
    # VALIDAÇÕES CUSTOMIZADAS (CLEAN)
    # =========================================================================

    def clean_schema_name(self):
        """
        Valida o nome do Schema para evitar conflitos no Postgres.
        """
        schema_name = self.cleaned_data['schema_name']
        
        # 1. Proíbe nomes reservados do sistema
        reserved_names = ['public', 'www', 'admin', 'postgres', 'root']
        if schema_name in reserved_names:
            raise ValidationError(f"O nome '{schema_name}' é reservado pelo sistema e não pode ser usado.")
        
        # 2. Garante formatação segura (letras minúsculas e sem espaços)
        # Ex: "Minha Agência" vira "minha_agencia"
        safe_name = schema_name.lower().strip().replace(' ', '_')
        
        # 3. Validação extra: apenas alfanuméricos e underscore
        if not safe_name.replace('_', '').isalnum():
             raise ValidationError("O schema deve conter apenas letras, números e underline (_).")

        return safe_name

    def clean_domain_url(self):
        """
        Limpa a URL para salvar apenas o domínio puro.
        """
        domain = self.cleaned_data.get('domain_url', '')
        
        if domain:
            # Remove protocolos se o usuário digitou
            domain = domain.replace('https://', '').replace('http://', '')
            
            # Remove barras no final (ex: .com/)
            if domain.endswith('/'):
                domain = domain[:-1]
            
            # Remove espaços
            domain = domain.strip().lower()
            
        return domain