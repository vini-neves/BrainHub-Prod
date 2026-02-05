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
    // 1. LÓGICA DE DESENHO NO CANVAS (RISCAR IMAGEM)
    // ============================================================
    let canvas, ctx;
    let isDrawing = false;
    let hasAnnotation = false;

    function initCanvas() {
        canvas = document.getElementById('annotationCanvas');
        const img = document.getElementById('approvalImage');
        
        // Só inicia se a imagem e o canvas existirem e a imagem tiver tamanho
        if(canvas && img && img.clientWidth > 0) {
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
            
            ctx = canvas.getContext('2d');
            ctx.strokeStyle = "#ff0000"; // Cor Vermelha
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            
            // Event Listeners para Mouse
            canvas.addEventListener('mousedown', startDraw);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', endDraw);
            canvas.addEventListener('mouseout', endDraw);
            
            // Event Listeners para Touch (Celular/Tablet)
            canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e.touches[0]); });
            canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); });
            canvas.addEventListener('touchend', endDraw);
        }
    }

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function startDraw(e) {
        isDrawing = true;
        hasAnnotation = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        
        // Mostra botão de limpar se existir
        const controls = document.getElementById('drawControls');
        if(controls) controls.style.display = 'block';
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }

    function endDraw() {
        isDrawing = false;
        ctx.beginPath();
    }

    window.clearCanvas = function() {
        if(!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasAnnotation = false;
        const controls = document.getElementById('drawControls');
        if(controls) controls.style.display = 'none';
    };


    // ============================================================
    // 2. DRAG AND DROP (ARRASTAR E SOLTAR)
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

    function dragOver(e) { e.preventDefault(); }

    function dragEnter(e) {
        e.preventDefault();
        this.style.backgroundColor = '#e2e4e7';
    }

    function dragLeave() {
        this.style.backgroundColor = '';
    }

    function dragDrop(e) {
        this.style.backgroundColor = '';
        if (draggedCard) {
            this.appendChild(draggedCard);
            const taskId = draggedCard.getAttribute('data-id');
            const newStatus = this.getAttribute('data-status');
            const newOrderList = Array.from(this.querySelectorAll('.kanban-card')).map(card => card.getAttribute('data-id'));
            saveKanbanChange(taskId, newStatus, newOrderList);
        }
    }

    function saveKanbanChange(taskId, status, orderList) {
        const url = "/api/kanban/update/"; 
        
        fetch(url, {
            method: 'POST',
            body: JSON.stringify({ task_id: taskId, status: status, newOrderList: orderList }),
            headers: { 'X-CSRFToken': CONFIG.csrfToken, 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(data => {
            if(data.status !== 'success') {
                Swal.fire('Erro', 'Erro ao salvar posição: ' + data.message, 'error');
                location.reload();
            }
        })
        .catch(err => console.error(err));
    }


    // ============================================================
    // 3. FUNÇÕES DE MODAL (ABRIR, EDITAR E POPULAR ABA APROVAÇÃO)
    // ============================================================

    // Preenche a aba "Aprovação" com o layout de celular
    function populateApprovalTab(data) {
        // Textos
        const els = {
            'apprTitle': data.title,
            'apprClient': data.client_name,
            'apprNetwork': data.social_network || 'Geral',
            'apprDate': data.scheduled_date || 'Sem data',
            'apprCaption': data.caption_content || 'Sem legenda.',
            'apprScript': data.script_content || 'Sem roteiro.'
        };

        for (const [id, val] of Object.entries(els)) {
            const el = document.getElementById(id);
            if(el) el.innerText = val;
        }
        
        // Imagem e Canvas
        const img = document.getElementById('approvalImage');
        if (data.art_url) {
            img.src = data.art_url;
            img.style.display = 'block';
            // Inicia o canvas apenas após a imagem carregar para pegar o tamanho certo
            img.onload = function() { 
                initCanvas(); 
            };
        } else {
            img.src = "";
            img.style.display = 'none';
        }
        
        // Reseta estados visuais
        const rejectPanel = document.getElementById('rejectPanel');
        const mainActions = document.getElementById('mainActions');
        if(rejectPanel) rejectPanel.style.display = 'none';
        if(mainActions) mainActions.style.display = 'grid';
        
        window.clearCanvas();
    }

    window.openNewTaskModal = function() {
        const modalEl = document.getElementById('taskModal');
        const form = document.getElementById('kanbanTaskForm');
        
        form.reset();
        document.getElementById('task-id').value = "";
        
        // Detecta contexto (Operacional vs Geral)
        const isOperational = window.location.href.includes("operational");
        
        if (isOperational) {
            document.getElementById('modalKanbanType').innerText = "Novo Job / Briefing";
            CONFIG.urls.addTask = "/api/task/add-operational/";
        } else {
            document.getElementById('modalKanbanType').innerText = "Nova Tarefa Geral";
            CONFIG.urls.addTask = "/api/task/add-general/";
        }

        const netSelect = document.getElementById('networkSelect');
        if(netSelect) {
            netSelect.innerHTML = '<option value="">Selecione um cliente...</option>';
            netSelect.disabled = true;
        }

        const previewImg = document.getElementById('previewArtImg');
        const noArtText = document.getElementById('noArtText');
        if(previewImg) { previewImg.src = ""; previewImg.style.display = 'none'; }
        if(noArtText) noArtText.style.display = 'block';

        const triggerEl = document.querySelector('#taskTabs button[data-bs-target="#tab-briefing"]');
        if(triggerEl) bootstrap.Tab.getOrCreateInstance(triggerEl).show();

        new bootstrap.Modal(modalEl).show();
    };

    window.openEditModal = function(taskId) {
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
                // Preenche campos básicos
                document.getElementById('modalTitleInput').value = data.title;
                document.getElementById('modalKanbanType').innerText = `Editando #${data.id}`;
                
                const clientSelect = document.getElementById('clientSelect');
                if(clientSelect) clientSelect.value = data.client_id;

                window.updateSocialNetworks(data.client_id, data.social_network);
                
                const fmtSelect = document.getElementById('formatSelect');
                if(fmtSelect) fmtSelect.dataset.value = data.content_type;
                window.filterFormats();

                setVal('scheduled_date', data.scheduled_date ? data.scheduled_date.slice(0, 10) : '');
                setVal('briefing_text', data.briefing_text);
                setVal('copy_content', data.copy_content);
                setVal('inputCaption', data.caption_content);
                setVal('script_content', data.script_content);

                // Preview da Arte na aba Design
                const previewImg = document.getElementById('previewArtImg');
                const noArtText = document.getElementById('noArtText');
                if(data.art_url) {
                    if(previewImg) { previewImg.src = data.art_url; previewImg.style.display = 'block'; }
                    if(noArtText) noArtText.style.display = 'none';
                } else {
                    if(previewImg) { previewImg.src = ""; previewImg.style.display = 'none'; }
                    if(noArtText) noArtText.style.display = 'block';
                }

                // >>> IMPORTANTE: Popula a aba de aprovação com o novo layout <<<
                populateApprovalTab(data);
                
                // Abre a aba correta baseado no status
                const statusMap = {
                    'briefing': '#tab-briefing', 'copy': '#tab-copy', 'design': '#tab-design',
                    'review_internal': '#tab-approval', 'review_client': '#tab-approval', 'done': '#tab-approval', 'scheduled': '#tab-approval'
                };
                let targetTabId = statusMap[data.status] || '#tab-briefing';
                const tabBtn = document.querySelector(`#taskTabs button[data-bs-target="${targetTabId}"]`);
                if(tabBtn) bootstrap.Tab.getOrCreateInstance(tabBtn).show();
            })
            .catch(err => console.error(err));
    };


    // ============================================================
    // 4. FUNÇÕES AUXILIARES DE FORMULÁRIO
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

    const clientSelect = document.getElementById('clientSelect');
    if(clientSelect) clientSelect.addEventListener('change', function() { window.updateSocialNetworks(this.value); });
    
    const networkSelect = document.getElementById('networkSelect');
    if(networkSelect) networkSelect.addEventListener('change', window.filterFormats);


    // ============================================================
    // 5. SUBMIT CENTRALIZADO (COM SWEETALERT)
    // ============================================================
    
    // Função Genérica para Enviar Formulário via AJAX com Feedback Visual
    function submitFormViaAjax(formData) {
        Swal.fire({
            title: 'Processando...',
            text: 'Salvando suas alterações',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading() }
        });

        const taskId = document.getElementById('task-id').value;
        
        // Define URL (Criação ou Edição)
        let url = CONFIG.urls.addTask;
        if(taskId) {
            url = `${CONFIG.urls.taskUpdate}${taskId}/`;
        }

        fetch(url, {
            method: 'POST',
            body: formData,
            headers: {'X-CSRFToken': CONFIG.csrfToken}
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                Swal.fire({
                    title: 'Sucesso!',
                    text: 'Tarefa salva com sucesso.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    // Recarrega a página para atualizar as colunas
                    window.location.reload();
                });
            } else {
                Swal.fire('Erro', data.message || "Erro desconhecido ao salvar.", 'error');
            }
        })
        .catch(err => {
            console.error(err);
            Swal.fire('Erro', 'Erro de conexão com o servidor.', 'error');
        });
    }

    // Listener para o botão "Salvar Tarefa" padrão
    const form = document.getElementById('kanbanTaskForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const titleInput = document.getElementById('modalTitleInput');
            if (titleInput) formData.set('title', titleInput.value);
            
            // Adiciona action 'save' padrão se não tiver outra
            if(!formData.has('action')) {
                formData.append('action', 'save');
            }

            submitFormViaAjax(formData);
        });
    }

    // ============================================================
    // 6. AÇÕES ESPECÍFICAS (APROVAR / REJEITAR)
    // ============================================================

    // Alterna a visualização do painel de rejeição
    window.toggleRejectMode = function() {
        const panel = document.getElementById('rejectPanel');
        const actions = document.getElementById('mainActions');
        
        if (panel && actions) {
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                actions.style.display = 'none';
                initCanvas(); // Garante que o canvas está pronto para desenhar
            } else {
                panel.style.display = 'none';
                actions.style.display = 'grid';
            }
        }
    };

    // Botão Aprovar (Verde)
    window.submitApproval = function(action) {
        const form = document.getElementById('kanbanTaskForm');
        const formData = new FormData(form);
        formData.append('action', action);
        submitFormViaAjax(formData);
    };

    // Botão Confirmar Ajuste (Vermelho) - Envia Imagem Riscada
    window.saveWithAnnotation = function() {
        const feedback = document.getElementById('feedbackInput').value;
        if (!feedback) {
            Swal.fire('Atenção', 'Por favor, descreva o motivo do ajuste.', 'warning');
            return;
        }
        
        const form = document.getElementById('kanbanTaskForm');
        const formData = new FormData(form);
        formData.append('action', 'reject');
        
        // Se houve risco na tela, converte canvas para imagem e anexa
        if (hasAnnotation && canvas) {
            canvas.toBlob(function(blob) {
                formData.append('feedback_image_annotation', blob, 'annotation.png');
                submitFormViaAjax(formData);
            });
        } else {
            // Se não riscou, envia só o texto
            submitFormViaAjax(formData);
        }
    };

    window.enableDrawingMode = function() { 
        // Apenas um atalho caso precise chamar externamente,
        // mas o initCanvas já é chamado ao abrir o reject mode.
        initCanvas(); 
    };
    window.updateFileName = function(input) {
        if (input.files && input.files.length > 0) {
            document.getElementById('uploadTextMain').innerText = input.files[0].name;
            document.getElementById('uploadTextSub').innerText = "Arquivo selecionado pronto para envio";
            document.querySelector('.upload-box-dashed').style.borderColor = "#198754"; // Borda verde
            document.querySelector('.upload-icon').style.color = "#198754";
        }
    };
});