document.addEventListener("DOMContentLoaded", function() {
    
    const CONFIG = window.KANBAN_CONFIG || {};
    const CLIENT_NETWORKS = window.CLIENT_NETWORKS || {}; 

    // Mapeamento visual
    const NETWORK_LABELS = {
        'facebook': 'Facebook', 'instagram': 'Instagram', 'linkedin': 'LinkedIn',
        'tiktok': 'TikTok', 'pinterest': 'Pinterest', 'youtube': 'YouTube',
        'threads': 'Threads', 'x': 'X (Twitter)', 'google_my_business': 'Google Meu Negócio'
    };

    const networkRules = {
        'instagram': [{val: 'feed', text: 'Feed (Quadrado)'}, {val: 'story', text: 'Story'}, {val: 'reel_short', text: 'Reels'}],
        'facebook': [{val: 'feed', text: 'Feed'}, {val: 'story', text: 'Story'}],
        'tiktok': [{val: 'reel_short', text: 'TikTok Video'}],
        'youtube': [{val: 'video_long', text: 'Vídeo Longo'}, {val: 'reel_short', text: 'Shorts'}],
        'linkedin': [{val: 'feed', text: 'Post'}, {val: 'video_long', text: 'Vídeo'}],
        'google_my_business': [{val: 'feed', text: 'Novidade/Oferta'}]
    };

    // ============================================================
    // 1. DRAG AND DROP (ARRASTAR E SOLTAR)
    // ============================================================
    
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-tasks-list');

    cards.forEach(card => {
        card.addEventListener('dragstart', dragStart);
        card.addEventListener('dragend', dragEnd);
    });

    columns.forEach(col => {
        col.addEventListener('dragover', dragOver);
        col.addEventListener('dragenter', dragEnter);
        col.addEventListener('dragleave', dragLeave);
        col.addEventListener('drop', dragDrop);
    });

    let draggedCard = null;

    function dragStart(e) {
        draggedCard = this;
        setTimeout(() => this.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = "move";
    }

    function dragEnd() {
        this.classList.remove('dragging');
        draggedCard = null;
    }

    function dragOver(e) {
        e.preventDefault(); // Necessário para permitir o drop
    }

    function dragEnter(e) {
        e.preventDefault();
        this.style.backgroundColor = '#e2e4e7'; // Feedback visual na coluna
    }

    function dragLeave() {
        this.style.backgroundColor = ''; // Remove feedback
    }

    function dragDrop(e) {
        this.style.backgroundColor = '';
        
        if (draggedCard) {
            this.appendChild(draggedCard); // Move o elemento no HTML
            
            // Pega os dados para salvar
            const taskId = draggedCard.getAttribute('data-id');
            const newStatus = this.getAttribute('data-status');
            
            // Coleta a nova ordem dos cards nesta coluna
            const newOrderList = Array.from(this.querySelectorAll('.kanban-card'))
                                      .map(card => card.getAttribute('data-id'));

            saveKanbanChange(taskId, newStatus, newOrderList);
        }
    }

    // Função que chama a API para salvar a mudança de coluna/ordem
    function saveKanbanChange(taskId, status, orderList) {
        // A URL geralmente é '/task/update/kanban/' ou similar. 
        // Vou usar a taskUpdate que já temos, ou adaptar se você tiver uma rota específica para DragDrop.
        // Baseado no seu views.py, você tem: class KanbanUpdateTask
        // Precisamos saber a URL dela. Vou assumir '/api/kanban/update/' ou usar a taskUpdate genérica.
        
        // Se não tiver URL específica de DragDrop, use a de update normal:
        const url = "/api/kanban/update/"; // AJUSTE ESSA ROTA NO SEU URLS.PY SE NÃO EXISTIR
        
        fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                task_id: taskId,
                status: status,
                newOrderList: orderList
            }),
            headers: {
                'X-CSRFToken': CONFIG.csrfToken,
                'Content-Type': 'application/json'
            }
        })
        .then(res => res.json())
        .then(data => {
            if(data.status !== 'success') {
                alert('Erro ao salvar posição: ' + data.message);
                location.reload(); // Reverte se der erro
            }
        })
        .catch(err => console.error(err));
    }


    // ============================================================
    // 2. FUNÇÕES DE MODAL (CLICK NO CARD E NOVO POST)
    // ============================================================

    // Torna as funções globais (window) para o onclick="" do HTML funcionar
    window.openNewTaskModal = function() {
        const modalEl = document.getElementById('taskModal');
        const form = document.getElementById('kanbanTaskForm');
        
        form.reset();
        document.getElementById('task-id').value = "";
        
        // Reset UI
        document.getElementById('modalKanbanType').innerText = "Briefing";
        document.getElementById('modalTitleInput').value = "";
        document.getElementById('networkSelect').innerHTML = '<option value="">Selecione um cliente...</option>';
        document.getElementById('networkSelect').disabled = true;
        document.getElementById('formatSelect').innerHTML = '<option value="">Selecione a rede...</option>';

        // Reseta Imagens
        const previewImg = document.getElementById('previewArtImg');
        const noArtText = document.getElementById('noArtText');
        if(previewImg) { previewImg.src = ""; previewImg.style.display = 'none'; }
        if(noArtText) noArtText.style.display = 'block';

        // Abre na primeira aba
        const triggerEl = document.querySelector('#taskTabs button[data-bs-target="#tab-briefing"]');
        if(triggerEl) bootstrap.Tab.getOrCreateInstance(triggerEl).show();

        new bootstrap.Modal(modalEl).show();
    };

    window.openEditModal = function(taskId) {
        // Evita abrir modal se estiver arrastando
        if (document.querySelector('.kanban-card.dragging')) return;

        const modalEl = document.getElementById('taskModal');
        const form = document.getElementById('kanbanTaskForm');
        
        form.reset();
        document.getElementById('task-id').value = taskId;
        
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();

        fetch(`${CONFIG.urls.taskDetails}${taskId}/`)
            .then(res => res.json())
            .then(data => {
                document.getElementById('modalTitleInput').value = data.title;
                document.getElementById('modalKanbanType').innerText = `Editando #${data.id}`;
                
                const clientSelect = document.getElementById('clientSelect');
                if(clientSelect) clientSelect.value = data.client_id;

                // Carrega Redes e Formatos
                window.updateSocialNetworks(data.client_id, data.social_network);
                
                // Formatos
                const fmtSelect = document.getElementById('formatSelect');
                if(fmtSelect) fmtSelect.dataset.value = data.content_type;
                window.filterFormats();

                // Campos
                setVal('scheduled_date', data.scheduled_date ? data.scheduled_date.slice(0, 10) : '');
                setVal('briefing_text', data.briefing_text);
                setVal('copy_content', data.copy_content);
                setVal('inputCaption', data.caption_content);
                setVal('script_content', data.script_content);

                // Imagens
                const previewImg = document.getElementById('previewArtImg');
                const noArtText = document.getElementById('noArtText');
                if(data.art_url) {
                    if(previewImg) { previewImg.src = data.art_url; previewImg.style.display = 'block'; }
                    if(noArtText) noArtText.style.display = 'none';
                    if(document.getElementById('designImage')) document.getElementById('designImage').src = data.art_url;
                } else {
                    if(previewImg) { previewImg.src = ""; previewImg.style.display = 'none'; }
                    if(noArtText) noArtText.style.display = 'block';
                    if(document.getElementById('designImage')) document.getElementById('designImage').src = "";
                }
                
                // Abre a aba correta
                const statusMap = {
                    'briefing': '#tab-briefing', 'copy': '#tab-copy', 'design': '#tab-design',
                    'review_internal': '#tab-approval', 'review_client': '#tab-approval', 'done': '#tab-approval'
                };
                let targetTabId = statusMap[data.status] || '#tab-briefing';
                const tabBtn = document.querySelector(`#taskTabs button[data-bs-target="${targetTabId}"]`);
                if(tabBtn) bootstrap.Tab.getOrCreateInstance(tabBtn).show();
            })
            .catch(err => console.error(err));
    };

    // ============================================================
    // 3. FUNÇÕES AUXILIARES (REDES, FORMATOS, ETC)
    // ============================================================

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

    window.updateSocialNetworks = function(clientId, selectedNetwork = null) {
        const netSelect = document.getElementById('networkSelect');
        const formatSelect = document.getElementById('formatSelect');
        
        netSelect.innerHTML = '<option value="">Selecione...</option>';
        if(formatSelect) formatSelect.innerHTML = '<option value="">Selecione a rede...</option>';
        
        if (!clientId) { netSelect.disabled = true; return; }

        const networks = CLIENT_NETWORKS[clientId.toString()] || [];
        
        if (networks.length === 0) {
            const option = document.createElement('option');
            option.text = "Nenhuma rede conectada";
            netSelect.add(option);
            netSelect.disabled = true;
            return;
        }

        netSelect.disabled = false;
        networks.forEach(netCode => {
            const label = NETWORK_LABELS[netCode] || netCode;
            const option = document.createElement('option');
            option.value = netCode;
            option.text = label;
            if (selectedNetwork && selectedNetwork === netCode) option.selected = true;
            netSelect.appendChild(option);
        });

        if(selectedNetwork) {
            netSelect.value = selectedNetwork;
            window.filterFormats();
        }
    };

    function setVal(id, val) {
        const el = document.getElementById(id);
        if(el) el.value = val || '';
    }

    // Listeners de mudança nos selects
    const clientSelect = document.getElementById('clientSelect');
    if(clientSelect) clientSelect.addEventListener('change', function() { window.updateSocialNetworks(this.value); });
    
    const networkSelect = document.getElementById('networkSelect');
    if(networkSelect) networkSelect.addEventListener('change', window.filterFormats);


    // ============================================================
    // 4. SUBMIT DO FORMULÁRIO (SALVAR)
    // ============================================================
    const form = document.getElementById('kanbanTaskForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const taskId = document.getElementById('task-id').value;
            const formData = new FormData(this);
            const titleInput = document.getElementById('modalTitleInput');
            if (titleInput) formData.set('title', titleInput.value);

            let url = CONFIG.urls.addTask;
            if(taskId) {
                url = `${CONFIG.urls.taskUpdate}${taskId}/`;
                formData.append('action', 'save');
            }

            const btn = document.getElementById('btnSaveTask');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "Salvando...";

            fetch(url, {
                method: 'POST',
                body: formData,
                headers: {'X-CSRFToken': CONFIG.csrfToken}
            })
            .then(res => res.json())
            .then(data => {
                if(data.status === 'success') {
                    window.location.replace(window.location.pathname);
                } else {
                    alert(data.message || "Erro ao salvar.");
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
            })
            .catch(err => {
                console.error(err);
                btn.disabled = false;
                btn.innerText = originalText;
            });
        });
    }

    // Funções extras (Aprovação)
    window.toggleRejectMode = function() {
        const tools = document.getElementById('rejectTools');
        if(tools) tools.style.display = tools.style.display === 'none' ? 'block' : 'none';
    };
    window.submitApproval = function() {
        const hiddenInput = document.createElement('input'); hiddenInput.type = 'hidden';
        hiddenInput.name = 'action'; hiddenInput.value = 'approve';
        form.appendChild(hiddenInput); form.requestSubmit();
    };
    window.submitRejection = function() {
        const hiddenInput = document.createElement('input'); hiddenInput.type = 'hidden';
        hiddenInput.name = 'action'; hiddenInput.value = 'reject';
        form.appendChild(hiddenInput); form.requestSubmit();
    };
    window.enableDrawingMode = function() { /* ... sua lógica de canvas ... */ };
});