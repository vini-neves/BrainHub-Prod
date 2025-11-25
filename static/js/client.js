// static/js/client.js


document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores dos Modais ---
    const addClientBtn = document.getElementById('add-client-btn');
    const addClientModal = document.getElementById('add-client-modal');
    const addClientForm = document.getElementById('add-client-form');
    
    const clientDetailModal = document.getElementById('client-detail-modal');
    const clientDetailContent = document.getElementById('client-detail-content');
    
    // --- NOVO: Seletores do Modal de Projeto ---
    const addProjectModal = document.getElementById('add-project-modal');
    const addProjectForm = document.getElementById('add-project-form');
    // --- FIM NOVO ---

    const closeButtons = document.querySelectorAll('.close-button');

    // --- Funções Auxiliares ---
    function openModal(modalElement) {
        modalElement.style.display = 'flex';
        document.body.classList.add('modal-open');
    }

    function closeModal(modalElement) {
        modalElement.style.display = 'none';
        document.body.classList.remove('modal-open');
    }

    function addNewClientRow(clientData) {
        const table = $('#client-table').DataTable();
        const newRow = `
            <tr>
                <td><a href="#" class="view-client-details" data-client-id="${clientData.id}" style="font-weight: bold; color: var(--primary-color);">${clientData.name}</a></td>
                <td>${clientData.cnpj || 'Não informado'}</td>
                <td>${clientData.nome_representante || '-'}</td>
                <td>${clientData.email_representante || '-'}</td>
                <td>${clientData.data_finalizacao_contrato || 'Ativo'}</td>
            </tr>
        `;
        table.row.add($(newRow)).draw(false);
    }
    
    // --- NOVO: Função de Alerta (usando SweetAlert) ---
    function showAlert(icon, title, text) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: icon,
                title: title,
                text: text,
                timer: (icon === 'success' ? 2000 : 4000),
                showConfirmButton: (icon === 'error')
            });
        } else {
            alert(text);
        }
    }

    // --- Event Listeners ---
    addClientBtn.addEventListener('click', () => openModal(addClientModal));

    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.dataset.modalId;
            const modalElement = document.getElementById(modalId);
            if (modalElement) closeModal(modalElement);
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target == addClientModal) closeModal(addClientModal);
        if (event.target == clientDetailModal) closeModal(clientDetailModal);
        if (event.target == addProjectModal) closeModal(addProjectModal); // <-- NOVO
    });

    // Submissão do formulário de CADASTRO DE CLIENTE
    addClientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addClientForm);
        
        try {
            const response = await fetch(ADD_CLIENT_URL, {
                method: 'POST',
                headers: { 'X-CSRFToken': CSRF_TOKEN },
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    showAlert('success', 'Sucesso!', result.message);
                    addNewClientRow(result.client);
                } else {
                    showAlert('error', 'Erro de Validação', 'Por favor, corrija os erros no formulário.');
                }
            } else {
                showAlert('error', 'Erro no Servidor', 'Não foi possível salvar o cliente.');
            }
        } catch (error) {
            showAlert('error', 'Erro de Rede', 'Não foi possível conectar ao servidor.');
        }
    });

    // Submissão do formulário de CADASTRO DE PROJETO (NOVO)
    addProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addProjectForm);
        
        try {
            const response = await fetch(ADD_PROJECT_URL, {
                method: 'POST',
                headers: { 'X-CSRFToken': CSRF_TOKEN },
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showAlert('success', 'Sucesso!', result.message);
                closeModal(addProjectModal);
                addProjectForm.reset();
                // TODO: Recarregar o modal de detalhes do cliente para mostrar o novo projeto
                // (Por enquanto, o usuário precisa fechar e abrir o modal de detalhes)
            } else {
                showAlert('error', 'Erro de Validação', 'Por favor, corrija os erros no formulário.');
            }
        } catch (error) {
            showAlert('error', 'Erro de Rede', 'Não foi possível salvar o projeto.');
        }
    });

    // Lógica de "Delegação de Eventos" para os Modais
    document.body.addEventListener('click', async (e) => {
        
        // --- Abrir Modal de DETALHES DO CLIENTE ---
        if (e.target.classList.contains('view-client-details')) {
            e.preventDefault();
            const clientId = e.target.dataset.clientId;
            if (clientId) {
                try {
                    const response = await fetch(`${CLIENT_DETAIL_URL_BASE}${clientId}/details/`);
                    if (response.ok) {
                        clientDetailContent.innerHTML = await response.text();
                        openModal(clientDetailModal);
                        // Re-ativa o Feather icons para os ícones no modal
                        if (typeof feather !== 'undefined') feather.replace();
                    } else {
                        showAlert('error', 'Erro', 'Não foi possível carregar os detalhes do cliente.');
                    }
                } catch (error) {
                    showAlert('error', 'Erro de Rede', 'Não foi possível conectar ao servidor.');
                }
            }
        }
        
        // --- Abrir Modal de ADICIONAR PROJETO (vindo do modal de detalhes) ---
        if (e.target.classList.contains('add-project-from-detail')) {
            e.preventDefault();
            const clientId = e.target.dataset.clientId;
            
            // Pré-seleciona o cliente no formulário de projeto
            const clientSelect = addProjectForm.querySelector('#id_client');
            if (clientSelect) {
                clientSelect.value = clientId;
            }
            
            // Fecha o modal de detalhes e abre o modal de projeto
            closeModal(clientDetailModal);
            openModal(addProjectModal);
        }
    });
});