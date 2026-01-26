# projects/forms.py
from django import forms
from .models import Client, MediaFolder
from django.contrib.auth.forms import AuthenticationForm
from django.core.exceptions import ValidationError

class ClientForm(forms.ModelForm):
    # Campos de data com type="date"
    data_inicio_contrato = forms.DateField(
        widget=forms.DateInput(attrs={'type': 'date', 'class': 'form-input'}), 
        required=False
    )
    data_finalizacao_contrato = forms.DateField(
        widget=forms.DateInput(attrs={'type': 'date', 'class': 'form-input'}), 
        required=False
    )

    class Meta:
        model = Client
        fields = '__all__' # Pega todos, inclusive is_active
        
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-input', 'placeholder': 'Nome Fantasia'}),
            # Adicionamos classes específicas para o JS pegar e aplicar máscara
            'cnpj': forms.TextInput(attrs={'class': 'form-input mask-cnpj', 'placeholder': '00.000.000/0001-00', 'maxlength': '18'}),
            'celular_representante': forms.TextInput(attrs={'class': 'form-input mask-phone', 'placeholder': '(00) 00000-0000', 'maxlength': '15'}),
            
            'nome_representante': forms.TextInput(attrs={'class': 'form-input'}),
            'email_representante': forms.EmailInput(attrs={'class': 'form-input'}),

            'anexo_contrato': forms.FileInput(attrs={
                'class': 'form-input', 
                'style': 'display: none;',  # Esconde o input original
                'onchange': 'updateFileName(this)' # Atualiza o visual
            }),

            'manual_marca': forms.FileInput(attrs={
                'class': 'form-input', 
                'style': 'display: none;',
                'onchange': 'updateFileName(this)'
            }),
            
            'logo': forms.FileInput(attrs={
                'class': 'form-input', 
                'style': 'display: none;',
                'onchange': 'updateFileName(this)'
            }),
            
            'is_active': forms.CheckboxInput(attrs={'class': 'form-checkbox'}),
        }



class TenantAuthenticationForm(AuthenticationForm):
    """
    Este formulário customizado faz a checagem do tenant.
    """
    def __init__(self, request=None, *args, **kwargs):
        """
        O 'request' é a chave. Ele nos diz qual tenant (agência)
        está sendo acessado.
        """
        self.request = request
        super().__init__(request=request, *args, **kwargs)

    def clean(self):
        # Roda a validação padrão primeiro (checa usuário e senha)
        # Isso nos dá o 'self.user_cache' (o usuário autenticado)
        super().clean() 

        if self.user_cache is None:
            # Se o login/senha falhou, não fazemos nada
            return

        # --- A VERIFICAÇÃO DE SEGURANÇA CRÍTICA ---
        # 'self.user_cache' é o usuário (ex: usuario_agencia)
        # 'self.request.tenant' é a agência da URL (ex: tenant2)

        # (Ignora a checagem para superusuários, se você quiser)
        if self.user_cache.is_superuser:
            return

        if self.user_cache.agency != self.request.tenant:
            # O usuário NÃO pertence a esta agência.
            # Rejeita o login.
            raise ValidationError(
                "Este usuário não pertence a esta agência. "
                "Verifique seu usuário e senha.",
                code='invalid_tenant'
            )

        return self.cleaned_data

class FolderForm(forms.ModelForm):
    class Meta:
        model = MediaFolder
        fields = ['name']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-input', 'placeholder': 'Ex: Ensaio Nike 2024'})
        }

# Widget customizado para permitir "multiple" no HTML
class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True

class MultipleFileField(forms.FileField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("widget", MultipleFileInput())
        super().__init__(*args, **kwargs)

    def clean(self, data, initial=None):
        single_file_clean = super().clean
        # Importante: Se vier uma lista, valida cada um.
        if isinstance(data, (list, tuple)):
            result = [single_file_clean(d, initial) for d in data]
        else:
            result = single_file_clean(data, initial)
        return result

class MediaFileForm(forms.Form):
    files = MultipleFileField(label='Selecione as imagens', required=True)