document.addEventListener("DOMContentLoaded", function() {
    const CONFIG = window.KANBAN_CONFIG || {};
    
    // Recebe o JSON que o Django montou: { 1: ['instagram', 'facebook'], ... }
    const CLIENT_NETWORKS = window.CLIENT_NETWORKS || {}; 

    // Mapeamento visual baseado no seu PLATFORM_CHOICES do models.py
    const NETWORK_LABELS = {
        'facebook': 'Facebook',
        'instagram': 'Instagram',
        'linkedin': 'LinkedIn',
        'tiktok': 'TikTok',
        'pinterest': 'Pinterest',
        'youtube': 'YouTube',
        'threads': 'Threads',
        'x': 'X (Twitter)',
        'tiktok_ads': 'TikTok Ads',
        'linkedin_ads': 'LinkedIn Ads',
        'meta_ads': 'Meta Ads',
        'google_ads': 'Google Ads',
        'google_my_business': 'Google Meu Negócio',
        'ga4': 'Google Analytics 4'
    };

    // Regras de Formatos (Mantida para as principais redes de conteúdo)
    const networkRules = {
        'instagram': [{val: 'feed', text: 'Feed (Quadrado)'}, {val: 'story', text: 'Story'}, {val: 'reel_short', text: 'Reels'}],
        'facebook': [{val: 'feed', text: 'Feed'}, {val: 'story', text: 'Story'}],
        'tiktok': [{val: 'reel_short', text: 'TikTok Video'}],
        'youtube': [{val: 'video_long', text: 'Vídeo Longo'}, {val: 'reel_short', text: 'Shorts'}],
        'linkedin': [{val: 'feed', text: 'Post'}, {val: 'video_long', text: 'Vídeo'}],
        'x': [{val: 'feed', text: 'Post'}],
        'pinterest': [{val: 'pin', text: 'Pin'}],
        'threads': [{val: 'feed', text: 'Post'}],
        'google_my_business': [{val: 'feed', text: 'Novidade/Oferta'}]
    };

    // --- FUNÇÃO PRINCIPAL: Atualiza o Select de Redes ---
    window.updateSocialNetworks = function(clientId, selectedNetwork = null) {
        const netSelect = document.getElementById('networkSelect');
        const formatSelect = document.getElementById('formatSelect');
        
        // 1. Limpa e trava o campo
        netSelect.innerHTML = '<option value="">Selecione...</option>';
        if(formatSelect) formatSelect.innerHTML = '<option value="">Selecione a rede...</option>';
        
        if (!clientId) {
            netSelect.disabled = true;
            return;
        }

        // 2. Pega as redes desse cliente do JSON
        const networks = CLIENT_NETWORKS[clientId] || [];

        // 3. Verifica se tem redes
        if (networks.length === 0) {
            const option = document.createElement('option');
            option.text = "Nenhuma rede conectada";
            netSelect.add(option);
            netSelect.disabled = true;
            return;
        }

        // 4. Preenche o Select
        netSelect.disabled = false;
        networks.forEach(netCode => {
            // Usa o Label bonito ou o próprio código se não achar
            const label = NETWORK_LABELS[netCode] || netCode;
            
            const option = document.createElement('option');
            option.value = netCode;
            option.text = label;
            
            // Se estiver editando e essa for a rede salva, seleciona ela
            if (selectedNetwork && selectedNetwork === netCode) {
                option.selected = true;
            }
            netSelect.appendChild(option);
        });

        // 5. Se já selecionou uma rede (edição), carrega os formatos dela
        if(selectedNetwork) {
            window.filterFormats();
        }
    };

    // --- LISTENER: Quando mudar o cliente no Modal ---
    const clientSelect = document.getElementById('clientSelect');
    if(clientSelect) {
        clientSelect.addEventListener('change', function() {
            // Pega o ID do cliente selecionado e roda a função
            window.updateSocialNetworks(this.value);
        });
    }

    // --- FORMATOS (Mantido igual) ---
    window.filterFormats = function() {
        const networkEl = document.getElementById('networkSelect');
        const formatSelect = document.getElementById('formatSelect');
        if (!networkEl || !formatSelect) return; 

        const network = networkEl.value;
        const currentVal = formatSelect.dataset.value || formatSelect.value;
        
        formatSelect.innerHTML = '<option value="">Selecione...</option>';
        
        if (network && networkRules[network]) {
            networkRules[network].forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.val;
                option.text = opt.text;
                if(opt.val === currentVal) option.selected = true;
                formatSelect.appendChild(option);
            });
        }
    };

    // --- ABRIR MODAL PARA NOVA TAREFA ---
    window.openNewTaskModal = function() {
        const modalEl = document.getElementById('taskModal');
        const form = document.getElementById('kanbanTaskForm');
        
        // 1. Limpa tudo
        form.reset();
        document.getElementById('task-id').value = ""; // ID vazio = Criação
        
        // 2. Ajusta UI para Criação
        document.getElementById('modalKanbanType').innerText = "Briefing";
        
        // Reseta o preview de imagem
        const previewImg = document.getElementById('previewArtImg');
        const noArtText = document.getElementById('noArtText');
        if(previewImg) previewImg.style.display = 'none';
        if(noArtText) noArtText.style.display = 'block';
        if(document.getElementById('designImage')) document.getElementById('designImage').src = "";
        if(document.getElementById('currentFileLink')) document.getElementById('currentFileLink').innerHTML = "";

        // Mostra a aba Briefing
        const triggerEl = document.querySelector('#taskTabs button[data-bs-target="#tab-briefing"]');
        bootstrap.Tab.getOrCreateInstance(triggerEl).show();

        // Abre o modal
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    };

    // --- ABRIR MODAL PARA EDIÇÃO ---
    window.openEditModal = function(taskId) {
        const modalEl = document.getElementById('taskModal');
        const form = document.getElementById('kanbanTaskForm');
        
        form.reset();
        document.getElementById('task-id').value = taskId; // ID preenchido = Edição
        
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();

        // Busca dados
        fetch(`${CONFIG.urls.taskDetails}${taskId}/`)
            .then(res => res.json())
            .then(data => {
                // Preenche campos
                document.getElementById('modalTitleInput').value = data.title;
                document.getElementById('modalKanbanType').innerText = `Editando #${data.id}`;
                
                // Seleciona Cliente
                const clientSelect = document.getElementById('clientSelect');
                if(clientSelect) clientSelect.value = data.client_id || "";

                // Aba Briefing
                setVal('networkSelect', data.social_network);
                const fmtSelect = document.getElementById('formatSelect');
                if(fmtSelect) fmtSelect.dataset.value = data.content_type;
                window.filterFormats(); 
                if(data.scheduled_date) setVal('scheduled_date', data.scheduled_date.slice(0, 10));
                setVal('briefing_text', data.briefing_text);
                
                // Link arquivo
                const fileLink = document.getElementById('currentFileLink');
                if(fileLink) fileLink.innerHTML = data.briefing_files ? `<a href="${data.briefing_files}" target="_blank" class="small"><i class="fa-solid fa-paperclip"></i> Ver anexo</a>` : "";

                // Copy e Design
                setVal('copy_content', data.copy_content);
                setVal('inputCaption', data.caption_content);
                setVal('script_content', data.script_content);

                // Imagens
                const previewImg = document.getElementById('previewArtImg');
                const noArtText = document.getElementById('noArtText');
                if(data.art_url) {
                    previewImg.src = data.art_url;
                    previewImg.style.display = 'block';
                    noArtText.style.display = 'none';
                    document.getElementById('designImage').src = data.art_url;
                } else {
                    previewImg.style.display = 'none';
                    noArtText.style.display = 'block';
                    document.getElementById('designImage').src = "";
                }

                // Aba Inteligente
                const statusMap = {
                    'briefing': '#tab-briefing',
                    'copy': '#tab-copy',
                    'design': '#tab-design',
                    'review_internal': '#tab-approval',
                    'review_client': '#tab-approval',
                    'done': '#tab-approval'
                };
                let targetTabId = statusMap[data.status] || '#tab-briefing';
                const tabBtn = document.querySelector(`#taskTabs button[data-bs-target="${targetTabId}"]`);
                bootstrap.Tab.getOrCreateInstance(tabBtn).show();

            })
            .catch(err => console.error(err));
    };

    function setVal(id, val) {
        const el = document.getElementById(id);
        if(el) el.value = val || '';
    }

    // --- SUBMISSÃO DO FORMULÁRIO (CRIAR OU EDITAR) ---
    const form = document.getElementById('kanbanTaskForm');
    
    // DEBUG: Verifica se achou o formulário
    if (!form) {
        console.error("ERRO CRÍTICO: O JavaScript não encontrou o <form id='kanbanTaskForm'> no HTML.");
    } else {
        console.log("SUCESSO: Formulário encontrado. Adicionando evento de Submit.");
        
        form.addEventListener('submit', function(e) {
            // 1. A LINHA MAIS IMPORTANTE
            e.preventDefault();
            console.log("INTERCEPTADO: O JavaScript bloqueou o envio padrão. Iniciando Fetch...");

            const taskId = document.getElementById('task-id').value;
            
            // 2. Cria o pacote
            const formData = new FormData(this);
            
            // 3. Adiciona o Título manualmente
            const titleInput = document.getElementById('modalTitleInput');
            if (titleInput) {
                console.log("Título capturado:", titleInput.value);
                formData.set('title', titleInput.value);
            } else {
                console.error("ERRO: Não achei o campo de título #modalTitleInput");
            }

            // 4. Decide URL
            let url = CONFIG.urls.addTask; 
            if(taskId) {
                url = `${CONFIG.urls.taskUpdate}${taskId}/`; 
                formData.append('action', 'save');
            }

            const btn = document.getElementById('btnSaveTask');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "A guardar...";

            // 5. Envia
            fetch(url, {
                method: 'POST',
                body: formData,
                headers: {'X-CSRFToken': CONFIG.csrfToken}
            })
            .then(res => res.json())
            .then(data => {
                console.log("Resposta do Servidor:", data);
                if(data.status === 'success') {
                    window.location.href = window.location.href;
                } else {
                    alert(data.message || "Erro ao guardar");
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
            })
            .catch(err => {
                console.error("Erro no Fetch:", err);
                alert("Erro de conexão");
                btn.disabled = false;
                btn.innerText = originalText;
            });
        });
    } document.getElementById('kanbanTaskForm');
    
    // DEBUG: Verifica se achou o formulário
    if (!form) {
        console.error("ERRO CRÍTICO: O JavaScript não encontrou o <form id='kanbanTaskForm'> no HTML.");
    } else {
        console.log("SUCESSO: Formulário encontrado. Adicionando evento de Submit.");
        
        form.addEventListener('submit', function(e) {
            // 1. A LINHA MAIS IMPORTANTE
            e.preventDefault();
            console.log("INTERCEPTADO: O JavaScript bloqueou o envio padrão. Iniciando Fetch...");

            const taskId = document.getElementById('task-id').value;
            
            // 2. Cria o pacote
            const formData = new FormData(this);
            
            // 3. Adiciona o Título manualmente
            const titleInput = document.getElementById('modalTitleInput');
            if (titleInput) {
                console.log("Título capturado:", titleInput.value);
                formData.set('title', titleInput.value);
            } else {
                console.error("ERRO: Não achei o campo de título #modalTitleInput");
            }

            // 4. Decide URL
            let url = CONFIG.urls.addTask; 
            if(taskId) {
                url = `${CONFIG.urls.taskUpdate}${taskId}/`; 
                formData.append('action', 'save');
            }

            const btn = document.getElementById('btnSaveTask');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "A guardar...";

            // 5. Envia
            fetch(url, {
                method: 'POST',
                body: formData,
                headers: {'X-CSRFToken': CONFIG.csrfToken}
            })
            .then(res => res.json())
            .then(data => {
                console.log("Resposta do Servidor:", data);
                if(data.status === 'success') {
                    window.location.href = window.location.href;
                } else {
                    alert(data.message || "Erro ao guardar");
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
            })
            .catch(err => {
                console.error("Erro no Fetch:", err);
                alert("Erro de conexão");
                btn.disabled = false;
                btn.innerText = originalText;
            });
        });
    }
    // (Pode manter as funções submitApproval, submitRejection, toggleRejectMode, enableDrawingMode aqui...)
    // Elas funcionam normalmente pois usam o mesmo ID de form.
    window.toggleRejectMode = function() {
        const tools = document.getElementById('rejectTools');
        tools.style.display = tools.style.display === 'none' ? 'block' : 'none';
    };
});