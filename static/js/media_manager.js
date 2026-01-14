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
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function uploadInBatch(inputElement) {
    if (typeof Swal === 'undefined') {
        alert("ERRO: SweetAlert2 não carregado.");
        return;
    }

    const files = Array.from(inputElement.files);
    const total = files.length;
    
    if (total === 0) return;

    Swal.fire({
        title: 'Iniciando Upload...',
        html: `Preparando fila de <b>${total}</b> arquivos.`,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => { Swal.showLoading(); }
    });

    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    const clientIdInput = document.getElementById('clientId');

    if (!csrfInput || !clientIdInput) {
        Swal.fire('Erro', 'Dados do cliente não encontrados.', 'error');
        return;
    }

    const csrfToken = csrfInput.value;
    const clientId = clientIdInput.value;

    let successCount = 0;
    let errorCount = 0;

    // --- O LOOP SEQUENCIAL ---
    for (const [index, file] of files.entries()) {
        
        // Atualiza mensagem visual
        const msg = `Enviando <b>${index + 1}</b> de <b>${total}</b>...<br><small>${file.name}</small>`;
        if(Swal.getHtmlContainer()) Swal.getHtmlContainer().innerHTML = msg;

        const formData = new FormData();
        formData.append('foto', file);
        formData.append('client_id', clientId);

        try {
            // === NOVO: DELAY DE 500ms ENTRE ARQUIVOS ===
            // Isso impede que o servidor bloqueie por excesso de requisições
            if (index > 0) {
                await sleep(500); 
            }

            const response = await fetch('/api/upload/photo/', { 
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken },
                body: formData
            });

            if (response.ok) {
                successCount++;
            } else {
                console.error(`Erro ${response.status} no arquivo: ${file.name}`);
                errorCount++;
            }
        } catch (err) {
            console.error(`Erro de rede: ${file.name}`, err);
            errorCount++;
        }
    }

    // Relatório Final
    let iconType = 'success';
    let titleText = 'Upload Finalizado';
    
    if (errorCount > 0) {
        iconType = successCount > 0 ? 'warning' : 'error';
        titleText = `Finalizado com ${errorCount} erros`;
    }

    Swal.fire({
        title: titleText,
        html: `
            Total processado: <b>${total}</b><br>
            <b style="color:var(--c-green)">Sucesso: ${successCount}</b><br>
            <b style="color:var(--c-red)">Falhas: ${errorCount}</b>
        `,
        icon: iconType,
        confirmButtonText: 'OK'
    }).then(() => {
        location.reload();
    });
}