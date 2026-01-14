/* static/js/media_manager.js */

document.addEventListener("DOMContentLoaded", function() {
    // 1. Inicializa ícones Feather
    if (typeof feather !== 'undefined') {
        feather.replace();
    }

    // 2. Funções para abrir/fechar modais
    window.openModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'flex';
    }

    window.closeModal = function(element) {
        const modal = element.closest('.modal');
        if (modal) modal.style.display = 'none';
    }

    // Fechar ao clicar fora do modal
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
        }
    }
});

/* static/js/media_manager.js */

function confirmDelete(event, title, text) {
    // 1. Impede que o clique propague para o Card (não abre a pasta)
    event.stopPropagation();
    
    // 2. Impede o envio imediato do formulário
    event.preventDefault();

    // 3. Identifica o formulário que contém o botão clicado
    const button = event.currentTarget;
    const form = button.closest('form');

    // 4. Dispara o SweetAlert
    Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444', // Vermelho
        cancelButtonColor: '#6b7280', // Cinza
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar',
        reverseButtons: true // Botão de cancelar na esquerda (opcional)
    }).then((result) => {
        if (result.isConfirmed) {
            // 5. Se o usuário confirmou, envia o formulário manualmente
            form.submit();
        }
    });
}

async function uploadInBatch(inputElement) {
    const files = inputElement.files;
    const total = files.length;
    
    if (total === 0) return;

    // 1. Abre o SweetAlert de Carregamento (Loading)
    // 'allowOutsideClick: false' impede que o usuário clique fora e cancele o envio
    Swal.fire({
        title: 'Enviando Fotos',
        html: `Preparando envio de <b>${total}</b> arquivos...`,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false, // Esconde botão OK enquanto carrega
        didOpen: () => {
            Swal.showLoading(); // Mostra o spinner girando
        }
    });

    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    const clientId = document.getElementById('clientId').value; 

    let successCount = 0;
    let errorCount = 0;

    // Loop: Envia UM arquivo de cada vez
    for (let i = 0; i < total; i++) {
        const formData = new FormData();
        formData.append('foto', files[i]); 
        formData.append('client_id', clientId); 

        try {
            // 2. Atualiza o texto do SweetAlert com o progresso
            // Usamos Swal.getHtmlContainer() para mudar o texto sem fechar o modal
            const progressText = `Enviando arquivo <b>${i + 1}</b> de ${total}<br><small>${files[i].name}</small>`;
            if (Swal.getHtmlContainer()) {
                Swal.getHtmlContainer().innerHTML = progressText;
            }
            
            // Faz o envio
            const response = await fetch('/api/upload/photo/', { 
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken },
                body: formData
            });

            if (response.ok) {
                successCount++;
            } else {
                console.error(`Erro no arquivo ${files[i].name}`);
                errorCount++;
            }

        } catch (err) {
            console.error(err);
            errorCount++;
        }
    }

    // 3. Resultado Final
    // Define o ícone e a mensagem baseados no resultado
    let iconType = 'success';
    let titleText = 'Upload Concluído!';
    
    if (errorCount > 0 && successCount > 0) {
        iconType = 'warning';
        titleText = 'Concluído com Alertas';
    } else if (errorCount > 0 && successCount === 0) {
        iconType = 'error';
        titleText = 'Falha no Upload';
    }

    Swal.fire({
        title: titleText,
        html: `
            Total enviado: <b>${total}</b><br>
            <span style="color:var(--c-green)">Sucesso: ${successCount}</span><br>
            <span style="color:var(--c-red)">Erros: ${errorCount}</span>
        `,
        icon: iconType,
        confirmButtonText: 'OK'
    }).then(() => {
        // Recarrega a página ao clicar em OK
        location.reload();
    });
}