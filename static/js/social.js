document.addEventListener('DOMContentLoaded', () => {
        
    // --- Setup de variáveis ---
    const createPostBtn = document.getElementById('create-post-btn');
    const createPostModal = document.getElementById('create-post-modal');
    const createPostForm = document.getElementById('create-post-form');
    const postListContainer = document.querySelector('.posts-list'); // Assumindo que este é o container dos agendados
    const CSRF_TOKEN = "{{ csrf_token }}";
    const CREATE_POST_API_URL = "{% url 'create_social_post_api' %}";

    // Inicializa ícones (para os checkboxes e o botão principal)
    feather.replace();

    // --- Lógica de Modal ---
    createPostBtn.addEventListener('click', () => {
        createPostModal.style.display = 'flex';
        document.body.classList.add('modal-open');
    });

    // Evento para fechar o modal
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = document.getElementById(e.target.dataset.modalId);
            if (modal) {
                modal.style.display = 'none';
                document.body.classList.remove('modal-open');
                createPostForm.reset();
            }
        });
    });

    // Fechar modal ao clicar fora
    window.addEventListener('click', (event) => {
        if (event.target == createPostModal) {
            createPostModal.style.display = 'none';
            document.body.classList.remove('modal-open');
            createPostForm.reset();
        }
    });
    
    // --- Lógica de Submissão do Formulário ---
    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Verifica se pelo menos uma conta foi selecionada
        const selectedAccounts = createPostForm.querySelectorAll('input[name="accounts"]:checked');
        if (selectedAccounts.length === 0) {
            Swal.fire('Atenção', 'Selecione pelo menos uma conta para agendar a postagem.', 'warning');
            return;
        }

        // Usamos FormData para lidar corretamente com o upload de arquivos
        const formData = new FormData(createPostForm);

        try {
            const response = await fetch(CREATE_POST_API_URL, {
                method: 'POST',
                body: formData, // FormData lida com o cabeçalho Content-Type automaticamente
                // Não é necessário adicionar 'Content-Type': 'application/json' com FormData
                headers: {
                    'X-CSRFToken': CSRF_TOKEN
                }
            });

            const result = await response.json();

            if (response.ok) {
                // Adiciona o novo post à lista de agendados no frontend (opcional)
                appendNewPostToDashboard(result);
                
                createPostModal.style.display = 'none';
                createPostForm.reset();
                Swal.fire('Agendado!', 'Sua postagem foi salva e agendada com sucesso.', 'success');
            } else {
                Swal.fire('Erro!', result.message || 'Ocorreu um erro ao agendar a postagem.', 'error');
            }
        } catch (error) {
            Swal.fire('Erro!', 'Erro de rede ou na comunicação com o servidor.', 'error');
            console.error(error);
        }
    });
    
    // Função utilitária para adicionar o post ao dashboard
    function appendNewPostToDashboard(postData) {
        const newPostHTML = `
            <div class="post-item scheduled">
                <div>
                    <strong>${postData.scheduled_for}</strong>
                    <p style="margin: 5px 0; font-size: 0.9em;">${postData.content_snippet}...</p>
                    <div style="font-size: 0.8em; color: #888;">
                        ${postData.accounts.join(', ')}
                    </div>
                </div>
                <span style="background: #e0f7fa; color: #006064; padding: 5px 10px; border-radius: 15px; font-size: 0.8em;">Agendado</span>
            </div>
        `;
        // Adiciona o novo post no topo da lista
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newPostHTML.trim();
        postListContainer.prepend(tempDiv.firstChild);
    }
});