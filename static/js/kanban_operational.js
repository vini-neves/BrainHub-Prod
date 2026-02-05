document.addEventListener("DOMContentLoaded", function () {

    const CONFIG = window.KANBAN_CONFIG || {};
    const CLIENT_NETWORKS = window.CLIENT_NETWORKS || {};

    // ============================================================
    // 1. UTILITÁRIOS E CONFIGURAÇÕES
    // ============================================================
    const NETWORK_LABELS = {
        'facebook': 'Facebook', 'instagram': 'Instagram', 'linkedin': 'LinkedIn',
        'tiktok': 'TikTok', 'pinterest': 'Pinterest', 'youtube': 'YouTube',
        'threads': 'Threads', 'x': 'X (Twitter)', 'google_my_business': 'Google Meu Negócio'
    };

    const networkRules = {
        'instagram': [{ val: 'feed', text: 'Feed (Quadrado)' }, { val: 'story', text: 'Story' }, { val: 'reel_short', text: 'Reels' }],
        'facebook': [{ val: 'feed', text: 'Feed' }, { val: 'story', text: 'Story' }],
        'tiktok': [{ val: 'reel_short', text: 'TikTok Video' }],
        'youtube': [{ val: 'video_long', text: 'Vídeo Longo' }, { val: 'reel_short', text: 'Shorts' }],
        'linkedin': [{ val: 'feed', text: 'Post' }, { val: 'video_long', text: 'Vídeo' }],
        'google_my_business': [{ val: 'feed', text: 'Novidade/Oferta' }]
    };

    function updateModalHeader(tabName) {
        const titleEl = document.getElementById('modalKanbanType');
        const dotEl = document.getElementById('modalTypeDot');
        if (!titleEl || !dotEl) return;

        const cleanTab = tabName.replace('#tab-', '').replace('#', '');

        if (cleanTab === 'copy') {
            titleEl.innerText = "Copy"; dotEl.style.backgroundColor = "#0d6efd";
        } else if (cleanTab === 'design') {
            titleEl.innerText = "Design"; dotEl.style.backgroundColor = "#d63384";
        } else if (cleanTab === 'approval' || cleanTab.includes('review')) {
            titleEl.innerText = "Aprovação"; dotEl.style.backgroundColor = "#fd7e14";
        } else {
            titleEl.innerText = "Briefing"; dotEl.style.backgroundColor = "#6f42c1";
        }
    }

    // ============================================================
    // 2. DRAG AND DROP
    // ============================================================
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-tasks-list');

    cards.forEach(card => {
        card.addEventListener('dragstart', dragStart);
        card.addEventListener('dragend', dragEnd);
    });

    columns.forEach(col => {
        col.addEventListener('dragover', (e) => e.preventDefault());
        col.addEventListener('dragenter', (e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = '#f8f9fa'; });
        col.addEventListener('dragleave', (e) => { e.currentTarget.style.backgroundColor = ''; });
        col.addEventListener('drop', dragDrop);
    });

    let draggedCard = null;
    function dragStart(e) { draggedCard = this; setTimeout(() => this.classList.add('dragging'), 0); e.dataTransfer.effectAllowed = "move"; }
    function dragEnd() { this.classList.remove('dragging'); draggedCard = null; }

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
        fetch("/api/kanban/update/", {
            method: 'POST',
            body: JSON.stringify({ task_id: taskId, status: status, newOrderList: orderList }),
            headers: { 'X-CSRFToken': CONFIG.csrfToken, 'Content-Type': 'application/json' }
        }).then(res => res.json()).then(data => {
            if (data.status !== 'success') {
                Swal.fire('Erro', data.message, 'error');
                window.location.reload();
            }
        });
    }

    // ============================================================
    // 3. FUNÇÕES DO MODAL (NOVO POST E EDIÇÃO)
    // ============================================================
    window.openNewTaskModal = function () {
        const modalEl = document.getElementById('taskModal');
        const form = document.getElementById('kanbanTaskForm');
        if (form) form.reset();
        document.getElementById('task-id').value = "";
        
        const isOperational = window.location.href.includes("operational");
        CONFIG.urls.addTask = isOperational ? "/api/task/add-operational/" : "/api/task/add-general/";

        const netSelect = document.getElementById('networkSelect');
        if (netSelect) netSelect.innerHTML = '<option value="">Instagram</option>';

        // Reseta Uploads Visuais
        const previewImg = document.getElementById('designPreviewImg');
        const placeholder = document.getElementById('designUploadPlaceholder');
        const uploadText = document.getElementById('uploadTextMain');
        const uploadBox = document.querySelector('.upload-box-dashed');

        if (previewImg) { previewImg.src = ""; previewImg.style.display = 'none'; }
        if (placeholder) placeholder.style.display = 'block';
        if (uploadText) uploadText.innerText = "Arraste arquivos ou clique para fazer upload";
        if (uploadBox) { uploadBox.style.borderColor = "#a0aec0"; uploadBox.style.backgroundColor = "transparent"; }

        const triggerEl = document.querySelector('#taskTabs button[data-bs-target="#tab-briefing"]');
        if (triggerEl) bootstrap.Tab.getOrCreateInstance(triggerEl).show();
        updateModalHeader('briefing');
        new bootstrap.Modal(modalEl).show();
    };

    window.openEditModal = function (taskId) {
        if (document.querySelector('.kanban-card.dragging')) return;
        const modalEl = document.getElementById('taskModal');
        const form = document.getElementById('kanbanTaskForm');
        if (form) form.reset();
        document.getElementById('task-id').value = taskId;

        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();

        fetch(`${CONFIG.urls.taskDetails}${taskId}/`)
            .then(res => res.json())
            .then(data => {
                setVal('modalTitleInput', data.title);
                setVal('clientSelect', data.client_id);
                setVal('scheduled_date', data.scheduled_date ? data.scheduled_date.slice(0, 10) : '');
                
                window.updateSocialNetworks(data.client_id, data.social_network);
                setTimeout(() => {
                    const fmt = document.getElementById('formatSelect');
                    if (fmt) fmt.dataset.value = data.content_type;
                    window.filterFormats();
                }, 100);

                setVal('briefing_text', data.briefing_text);
                setVal('inputCaption', data.caption_content);
                setVal('script_content', data.script_content);

                populateDesignTab(data);
                populateCopyTab(data);
                populateApprovalTab(data);

                const statusMap = { 'briefing': '#tab-briefing', 'copy': '#tab-copy', 'design': '#tab-design', 'review_internal': '#tab-approval', 'review_client': '#tab-approval', 'done': '#tab-approval' };
                let targetTabId = statusMap[data.status] || '#tab-briefing';
                
                const tabBtn = document.querySelector(`#taskTabs button[data-bs-target="${targetTabId}"]`);
                if (tabBtn) bootstrap.Tab.getOrCreateInstance(tabBtn).show();
                updateModalHeader(targetTabId);
            });
    };

    // ============================================================
    // 4. PREENCHIMENTO VISUAL (POPULATE)
    // ============================================================
    function populateDesignTab(data) {

        const feedbackCard = document.getElementById('designFeedbackCard');
        const feedbackImg = document.getElementById('designFeedbackImg');
        const feedbackText = document.getElementById('designFeedbackText');

        // Se tiver imagem de anotação OU texto de feedback (e não estiver aprovado)
        if ( (data.feedback_image_annotation_url || data.last_feedback) && data.status === 'design') {
            
            if (feedbackCard) feedbackCard.style.display = 'block';
            
            // Preenche o texto
            if (feedbackText) feedbackText.innerText = data.last_feedback || "Ver imagem acima.";

            // Preenche a imagem riscada
            if (feedbackImg) {
                if (data.feedback_image_annotation_url) {
                    feedbackImg.src = data.feedback_image_annotation_url;
                    feedbackImg.style.display = 'block';
                } else {
                    feedbackImg.style.display = 'none';
                }
            }
        } else {
            // Esconde se não tiver ajustes
            if (feedbackCard) feedbackCard.style.display = 'none';
        }

        setText('designBriefTitle', data.title);
        setText('designNetwork', data.social_network || 'Geral');
        setText('designDate', data.scheduled_date ? data.scheduled_date.slice(0,10) : '--/--');
        setText('designBriefText', data.briefing_text || 'Sem briefing.');
        
        // Pega do input se possível (para preview em tempo real), senão do banco
        const scriptNow = document.getElementById('script_content') ? document.getElementById('script_content').value : '';
        const captionNow = document.getElementById('inputCaption') ? document.getElementById('inputCaption').value : '';
        
        setText('designScript', scriptNow || data.script_content || 'Sem roteiro.');
        setText('designCopyText', data.copy_content || 'Sem texto na arte.');
        setText('designCaption', captionNow || data.caption_content || 'Sem legenda.');

        const img = document.getElementById('designPreviewImg');
        const ph = document.getElementById('designUploadPlaceholder');
        if (img && ph) {
            if (data.art_url) { img.src = data.art_url; img.style.display = 'block'; ph.style.display = 'none'; }
            else { img.src = ""; img.style.display = 'none'; ph.style.display = 'block'; }
        }
        
        // Referencia
        const refContainer = document.getElementById('designRefContainer');
        if(refContainer && data.briefing_files) {
             refContainer.innerHTML = `<img src="${data.briefing_files}" class="briefing-thumb" style="width:100%; height:120px; object-fit:cover; border-radius:8px;" onclick="window.open('${data.briefing_files}')">`;
        }
    }

    function populateCopyTab(data) {
        setText('copyBriefTitle', data.title);
        setText('copyNetwork', data.social_network || 'Geral');
        setText('copyFormat', data.content_type || 'Post');
        setText('copyDate', data.scheduled_date ? data.scheduled_date.slice(0,10) : '--/--');
        setText('copyBriefText', data.briefing_text || 'Sem briefing.');
        
        const refContainer = document.getElementById('copyRefContainer');
        if(refContainer) {
            if(data.briefing_files) refContainer.innerHTML = `<img src="${data.briefing_files}" class="briefing-thumb" onclick="window.open('${data.briefing_files}')">`;
            else refContainer.innerHTML = '<span class="text-muted small">Sem referência.</span>';
        }
    }

    function populateApprovalTab(data) {
        setText('apprTitle', data.title);
        setText('apprClient', data.client_name);
        setText('apprNetwork', data.social_network);
        setText('apprFormat', data.content_type);
        
        if (data.scheduled_date && data.scheduled_date.length >= 10) {
            setText('apprDateDisplay', data.scheduled_date.slice(0, 10));
            setVal('apprDateInput', data.scheduled_date.slice(0, 10));
        }

        setText('apprCaption', data.caption_content || 'Sem legenda.');
        setText('apprScript', data.script_content || 'Sem roteiro.');
        setText('apprCopyText', data.copy_content || 'Sem copy.');

        const imgMobile = document.getElementById('approvalImage');
        const imgThumb = document.getElementById('apprThumb');
        
        if (data.art_url) {
            if(imgMobile) { 
                imgMobile.src = data.art_url; 
                imgMobile.onload = function() { initCanvas(); }; // Só inicia canvas depois de carregar
            }
            if(imgThumb) { imgThumb.src = data.art_url; imgThumb.style.display = 'block'; }
        } else {
            if(imgMobile) imgMobile.src = "";
            if(imgThumb) imgThumb.style.display = 'none';
        }
        window.clearCanvas();
    }

    function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }
    function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text || ''; }
    window.updateCharCount = function (el) { document.getElementById('charCount').innerText = el.value.length; };

    // ============================================================
    // 5. UPLOAD, CANVAS E CORREÇÃO DE RABISCO
    // ============================================================
    window.updateFileName = function(input) {
        if(input.files[0]) {
            document.getElementById('uploadTextMain').innerText = input.files[0].name;
            input.closest('.upload-box-dashed').style.borderColor = "#00bfa5";
        }
    };

    window.previewUpload = function (input) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();
            reader.onload = function (e) {
                const img = document.getElementById('designPreviewImg');
                const ph = document.getElementById('designUploadPlaceholder');
                img.src = e.target.result; img.style.display = 'block'; ph.style.display = 'none';
            }
            reader.readAsDataURL(input.files[0]);
        }
    }

    // --- LÓGICA DE CANVAS CORRIGIDA (ESCALA) ---
    let canvas, ctx, isDrawing = false, hasAnnotation = false;

    function initCanvas() {
        canvas = document.getElementById('annotationCanvas');
        const img = document.getElementById('approvalImage');
        if (canvas && img && img.clientWidth > 0) {
            // Define o tamanho interno do canvas igual ao tamanho visual da imagem
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
            
            ctx = canvas.getContext('2d');
            ctx.strokeStyle = "#ff0000"; 
            ctx.lineWidth = 4; 
            ctx.lineCap = "round";

            // Remove listeners antigos para evitar duplicação
            canvas.removeEventListener('mousedown', startDraw);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', endDraw);

            canvas.addEventListener('mousedown', startDraw);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', endDraw);
        }
    }

    // Função para pegar posição corrigida do mouse (Considerando Transform/Scale)
    function getMousePos(evt) {
        const rect = canvas.getBoundingClientRect(); 
        // Calcula a escala real (tamanho visual / tamanho interno)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (evt.clientX - rect.left) * scaleX,
            y: (evt.clientY - rect.top) * scaleY
        };
    }

    function startDraw(e) {
        isDrawing = true; 
        hasAnnotation = true;
        const pos = getMousePos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        
        const controls = document.getElementById('drawControls');
        if (controls) controls.style.display = 'block';
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getMousePos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }

    function endDraw() { isDrawing = false; }
    
    window.clearCanvas = function () {
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasAnnotation = false;
        document.getElementById('drawControls').style.display = 'none';
    };

    // ============================================================
    // 6. REDES SOCIAIS E FILTROS
    // ============================================================
    // ... (Código de redes sociais mantido igual, mas comprimido aqui para brevidade) ...
    window.updateSocialNetworks = function(id, sel) {
        const n = document.getElementById('networkSelect'); if(!n) return;
        n.innerHTML = '<option value="">Selecione...</option>';
        if(!id) return;
        (CLIENT_NETWORKS[id]||[]).forEach(c => {
            let opt = document.createElement('option'); opt.value=c; opt.text=NETWORK_LABELS[c]||c; 
            if(sel===c) opt.selected=true; n.appendChild(opt);
        });
        if(sel) { n.value=sel; window.filterFormats(); }
    };
    window.filterFormats = function() {
        const n = document.getElementById('networkSelect'); const f = document.getElementById('formatSelect');
        if(!n || !f) return;
        const val = f.dataset.value || f.value; f.innerHTML = '<option value="">Selecione...</option>';
        (networkRules[n.value]||[]).forEach(r => {
            let opt = document.createElement('option'); opt.value=r.val; opt.text=r.text;
            if(val===r.val) opt.selected=true; f.appendChild(opt);
        });
    };
    document.getElementById('clientSelect')?.addEventListener('change', function(){ window.updateSocialNetworks(this.value); });
    document.getElementById('networkSelect')?.addEventListener('change', window.filterFormats);


    // ============================================================
    // 7. AÇÕES PRINCIPAIS (SALVAR, VOLTAR, REJEITAR)
    // ============================================================

    // >>> NOVA FUNÇÃO: VOLTAR O CARD PARA UMA ETAPA ANTERIOR <<<
    // >>> FUNÇÃO CORRIGIDA: VOLTAR CARD (INTELIGENTE) <<<
    window.returnToStage = function(targetStage) {
        const taskId = document.getElementById('task-id').value;
        if(!taskId) return;

        // Verifica se é um retorno para Design e se tem anotações feitas
        if (targetStage === 'design' && typeof hasAnnotation !== 'undefined' && hasAnnotation) {
            // Se tem rabisco, precisamos pedir o motivo e salvar a imagem
            Swal.fire({
                title: 'Solicitar Ajuste',
                text: 'Descreva o que precisa ser alterado no design:',
                input: 'textarea',
                inputPlaceholder: 'Ex: Aumentar a logo e trocar a cor do fundo...',
                showCancelButton: true,
                confirmButtonText: 'Enviar para Designer',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#d63384', // Rosa do Design
                preConfirm: (text) => {
                    if (!text) { Swal.showValidationMessage('Escreva o motivo do ajuste'); }
                    return text;
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    sendReturnRequest(targetStage, result.value, true); // True = tem imagem
                }
            });
        } else {
            // Retorno simples (sem rabisco), ex: voltar para copy
            Swal.fire({
                title: 'Voltar etapa?',
                text: 'A tarefa voltará para a coluna anterior.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sim, voltar',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    sendReturnRequest(targetStage, null, false);
                }
            });
        }
    };

    function sendReturnRequest(targetStage, feedbackText, withImage) {
        Swal.fire({ title: 'Enviando...', didOpen: () => Swal.showLoading() });

        const form = document.getElementById('kanbanTaskForm');
        const formData = new FormData(form);
        
        formData.append('action', 'reject'); // Ação de rejeição/ajuste
        formData.append('force_status', targetStage); // Força o status (design/copy)
        
        if (feedbackText) {
            formData.append('rejection_reason', feedbackText);
        }

        const taskId = document.getElementById('task-id').value;
        const url = `${CONFIG.urls.taskUpdate}${taskId}/`;

        // Função interna para o fetch
        const executeFetch = () => {
            fetch(url, {
                method: 'POST',
                body: formData,
                headers: { 'X-CSRFToken': CONFIG.csrfToken }
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    window.location.reload();
                } else {
                    Swal.fire('Erro', data.message || 'Erro ao mover.', 'error');
                }
            })
            .catch(err => Swal.fire('Erro', 'Erro de conexão.', 'error'));
        };

        // Se tiver imagem, converte o canvas antes
        if (withImage && typeof canvas !== 'undefined') {
            canvas.toBlob(function(blob) {
                formData.append('feedback_image_annotation', blob, 'ajuste_design.png');
                executeFetch();
            });
        } else {
            executeFetch();
        }
    }

    // Navegação apenas visual (abas)
    window.goToTab = function (tabId) {
        const tabBtn = document.querySelector(`#taskTabs button[data-bs-target="#${tabId}"]`);
        if (tabBtn) {
            bootstrap.Tab.getOrCreateInstance(tabBtn).show();
            updateModalHeader(tabId);
        }
    };

    // Salvar e Avançar (Visual + Lógica)
    window.saveAndAdvance = function (nextTabName) { 
        const form = document.getElementById('kanbanTaskForm');
        const formData = new FormData(form);
        formData.append('action', 'save');

        const btn = document.activeElement;
        if(btn) { btn.innerText = "Salvando..."; btn.disabled = true; }

        const taskId = document.getElementById('task-id').value;
        let url = CONFIG.urls.addTask;
        if (taskId) url = `${CONFIG.urls.taskUpdate}${taskId}/`;

        fetch(url, { method: 'POST', body: formData, headers: { 'X-CSRFToken': CONFIG.csrfToken } })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                if(!taskId) {
                    document.getElementById('task-id').value = data.task_id;
                    CONFIG.urls.addTask = `${CONFIG.urls.taskUpdate}${data.task_id}/`;
                }

                if (nextTabName) {
                    // Preenche dados para a próxima aba antes de mostrar
                    if (nextTabName === 'copy') {
                        populateCopyTab({
                            title: document.getElementById('modalTitleInput').value,
                            briefing_text: document.getElementById('briefing_text').value,
                            social_network: document.getElementById('networkSelect').value,
                            content_type: document.getElementById('formatSelect').value,
                            scheduled_date: document.getElementById('scheduled_date').value
                        });
                    } else if (nextTabName === 'design') {
                        populateDesignTab({
                            title: document.getElementById('modalTitleInput').value,
                            briefing_text: document.getElementById('briefing_text').value,
                            copy_content: document.getElementById('copy_content_input') ? document.getElementById('copy_content_input').value : '',
                            caption_content: document.getElementById('inputCaption') ? document.getElementById('inputCaption').value : ''
                        });
                    }

                    const tabBtn = document.querySelector(`#taskTabs button[data-bs-target="#tab-${nextTabName}"]`);
                    if(tabBtn) {
                        bootstrap.Tab.getOrCreateInstance(tabBtn).show();
                        updateModalHeader(nextTabName);
                    }
                } else {
                    window.location.reload();
                }
            } else {
                Swal.fire('Erro', data.message, 'error');
            }
        })
        .finally(() => { if(btn) { btn.innerText = "Salvar / Enviar"; btn.disabled = false; } });
    };

    window.toggleRejectMode = function () {
        const panel = document.getElementById('rejectPanel');
        const actions = document.getElementById('mainActions');
        if (panel.style.display === 'none') {
            panel.style.display = 'block'; actions.style.display = 'none'; initCanvas();
        } else {
            panel.style.display = 'none'; actions.style.display = 'flex';
        }
    };

    window.saveWithAnnotation = function () {
        const feedback = document.getElementById('feedbackInput').value;
        if (!feedback) { Swal.fire('Erro', 'Escreva o motivo.', 'warning'); return; }
        
        const formData = new FormData(document.getElementById('kanbanTaskForm'));
        formData.append('action', 'reject'); // A view deve tratar isso para voltar status

        if (hasAnnotation && canvas) {
            canvas.toBlob(function (blob) {
                formData.append('feedback_image_annotation', blob, 'annotation.png');
                submitFormViaAjaxRejection(formData);
            });
        } else {
            submitFormViaAjaxRejection(formData);
        }
    };

    function submitFormViaAjaxRejection(formData) {
        Swal.fire({ title: 'Enviando ajuste...', didOpen: () => Swal.showLoading() });
        const taskId = document.getElementById('task-id').value;
        const url = `${CONFIG.urls.taskUpdate}${taskId}/`;

        fetch(url, { method: 'POST', body: formData, headers: { 'X-CSRFToken': CONFIG.csrfToken } })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                Swal.fire('Enviado!', 'Solicitação de ajuste enviada.', 'success').then(() => window.location.reload());
            } else {
                Swal.fire('Erro', data.message, 'error');
            }
        });
    }
});