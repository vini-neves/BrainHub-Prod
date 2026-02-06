document.addEventListener("DOMContentLoaded", function () {

    const CONFIG = window.KANBAN_CONFIG || {};
    const CLIENT_NETWORKS = window.CLIENT_NETWORKS || {};

    const NETWORK_LABELS = {
        'facebook': 'Facebook', 'instagram': 'Instagram', 'linkedin': 'LinkedIn',
        'tiktok': 'TikTok', 'pinterest': 'Pinterest', 'youtube': 'YouTube'
    };

    const networkRules = {
        'instagram': [{ val: 'feed', text: 'Feed' }, { val: 'story', text: 'Story' }, { val: 'reel_short', text: 'Reels' }],
        'facebook': [{ val: 'feed', text: 'Feed' }, { val: 'story', text: 'Story' }],
        'tiktok': [{ val: 'reel_short', text: 'Video' }],
        'youtube': [{ val: 'video_long', text: 'Vídeo' }, { val: 'reel_short', text: 'Shorts' }],
        'linkedin': [{ val: 'feed', text: 'Post' }, { val: 'video_long', text: 'Vídeo' }]
    };

    // --- HEADER CONTROL ---
    function updateModalHeader(tabName) {
        const titleEl = document.getElementById('modalKanbanType');
        const dotEl = document.getElementById('modalTypeDot');
        const modalDialog = document.querySelector('.modal-dialog-clean'); // Get the modal dialog

        if (!titleEl || !dotEl) return;

        const cleanTab = tabName.replace('#tab-', '').replace('#', '');

        // Default: Narrow width (700px)
        if(modalDialog) modalDialog.style.maxWidth = "700px";

        if (cleanTab === 'copy') {
            titleEl.innerText = "Copy"; 
            dotEl.style.backgroundColor = "#0d6efd";
        } 
        else if (cleanTab === 'design') {
            titleEl.innerText = "Design"; 
            dotEl.style.backgroundColor = "#d63384";
            // Widen for Design
            if(modalDialog) modalDialog.style.maxWidth = "1100px"; 
        } 
        else if (cleanTab === 'approval' || cleanTab.includes('review')) {
            titleEl.innerText = "Aprovação"; 
            dotEl.style.backgroundColor = "#fd7e14";
            // Widen for Approval
            if(modalDialog) modalDialog.style.maxWidth = "1100px"; 
        } 
        else {
            titleEl.innerText = "Briefing"; 
            dotEl.style.backgroundColor = "#6f42c1";
        }
    }

    // --- DRAG & DROP ---
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-tasks-list');
    
    cards.forEach(c => {
        c.addEventListener('dragstart', function() { this.classList.add('dragging'); });
        c.addEventListener('dragend', function() { this.classList.remove('dragging'); });
    });

    columns.forEach(col => {
        col.addEventListener('dragover', e => e.preventDefault());
        col.addEventListener('drop', function() {
            const card = document.querySelector('.dragging');
            if (card) {
                this.appendChild(card);
                saveKanbanChange(card.dataset.id, this.dataset.status, 
                    Array.from(this.querySelectorAll('.kanban-card')).map(c => c.dataset.id)
                );
            }
        });
    });

    function saveKanbanChange(id, status, order) {
        fetch("/api/kanban/update/", {
            method: 'POST',
            body: JSON.stringify({ task_id: id, status: status, newOrderList: order }),
            headers: { 'X-CSRFToken': CONFIG.csrfToken, 'Content-Type': 'application/json' }
        });
    }

    // --- MODAL OPEN ---
    window.openNewTaskModal = function () {
        document.getElementById('kanbanTaskForm').reset();
        document.getElementById('task-id').value = "";
        CONFIG.urls.addTask = window.location.href.includes("operational") ? "/api/task/add-operational/" : "/api/task/add-general/";
        
        const preview = document.getElementById('designPreviewImg');
        if(preview) { preview.style.display = 'none'; preview.src = ''; }
        document.getElementById('designUploadPlaceholder').style.display = 'block';
        
        const tabBtn = document.querySelector('#taskTabs button[data-bs-target="#tab-briefing"]');
        if(tabBtn) bootstrap.Tab.getOrCreateInstance(tabBtn).show();
        updateModalHeader('briefing');
        new bootstrap.Modal(document.getElementById('taskModal')).show();
    };

    window.openEditModal = function (taskId) {
        if (document.querySelector('.dragging')) return;
        
        document.getElementById('kanbanTaskForm').reset();
        document.getElementById('task-id').value = taskId;
        new bootstrap.Modal(document.getElementById('taskModal')).show();

        fetch(`${CONFIG.urls.taskDetails}${taskId}/`)
            .then(res => res.json())
            .then(data => {
                setVal('modalTitleInput', data.title);
                setVal('clientSelect', data.client_id);
                setVal('scheduled_date', data.scheduled_date ? data.scheduled_date.slice(0, 10) : '');
                setVal('briefing_text', data.briefing_text);
                setVal('script_content', data.script_content);
                setVal('inputCaption', data.caption_content);
                
                window.updateSocialNetworks(data.client_id, data.social_network);
                
                // Popula abas
                populateDesignTab(data);
                populateCopyTab(data);
                populateApprovalTab(data);

                // Abre aba correta
                const map = { 'briefing': '#tab-briefing', 'copy': '#tab-copy', 'design': '#tab-design', 'review_internal': '#tab-approval', 'review_client': '#tab-approval' };
                const target = map[data.status] || '#tab-briefing';
                const tabBtn = document.querySelector(`#taskTabs button[data-bs-target="${target}"]`);
                if(tabBtn) {
                    bootstrap.Tab.getOrCreateInstance(tabBtn).show();
                    updateModalHeader(target);
                }
            });
    };

    // --- POPULATE TABS ---
    function populateDesignTab(data) {
        // FEEDBACK LOGIC
        const fbCard = document.getElementById('designFeedbackCard');
        const fbImg = document.getElementById('designFeedbackImg');
        const fbText = document.getElementById('designFeedbackText');
        
        if ((data.feedback_image_annotation_url || data.last_feedback) && data.status === 'design') {
            fbCard.style.display = 'block';
            fbText.innerText = data.last_feedback || "Ver imagem.";
            if (data.feedback_image_annotation_url) {
                fbImg.src = data.feedback_image_annotation_url;
                fbImg.style.display = 'block';
            } else { fbImg.style.display = 'none'; }
        } else {
            fbCard.style.display = 'none';
        }

        setText('designBriefTitle', data.title);
        setText('designNetwork', data.social_network || 'Geral');
        setText('designBriefText', data.briefing_text);
        setText('designScript', data.script_content || 'Sem roteiro');
        setText('designCopyText', data.copy_content || 'Sem copy');
        
        // Preview Arte
        const img = document.getElementById('designPreviewImg');
        const ph = document.getElementById('designUploadPlaceholder');
        if (data.art_url) { img.src = data.art_url; img.style.display = 'block'; ph.style.display = 'none'; }
        else { img.src = ""; img.style.display = 'none'; ph.style.display = 'block'; }
    }

    function populateCopyTab(data) {
        setText('copyBriefTitle', data.title);
        setText('copyNetwork', data.social_network || 'Geral');
        setText('copyDate', data.scheduled_date ? data.scheduled_date.slice(0,10) : '--/--');
        setText('copyBriefText', data.briefing_text);
    }

    function populateApprovalTab(data) {
        setText('apprTitle', data.title);
        setText('apprClient', data.client_name);
        setText('apprNetwork', data.social_network);
        setText('apprCaption', data.caption_content || 'Sem legenda');
        setText('apprScript', data.script_content || 'Sem roteiro');
        setText('apprCopyText', data.copy_content || 'Sem copy');
        
        // Imagens
        const imgMobile = document.getElementById('approvalImage');
        const imgThumb = document.getElementById('apprThumb');
        
        if (data.art_url) {
            if(imgMobile) { 
                imgMobile.style.display = 'block'; // Força visibilidade
                imgMobile.src = data.art_url; 
                // Inicializa o canvas somente quando a imagem carregar para ter as dimensões certas
                imgMobile.onload = function() { initCanvas(); }; 
            }
            if(imgThumb) { 
                imgThumb.src = data.art_url; 
            }
        } else {
            if(imgMobile) { imgMobile.src = ""; imgMobile.style.display = 'none'; }
        }
        
        // Limpa o canvas anterior e reseta controles
        window.clearCanvas();
        document.getElementById('drawControls').style.display = 'none'; 
    }

    // --- CANVAS (CORRIGIDO) ---
    let canvas, ctx, isDrawing = false, hasAnnotation = false;
    let currentColor = "rgba(255, 0, 0, 0.8)"; // Vermelho padrão com leve transparência

    function initCanvas() {
        canvas = document.getElementById('annotationCanvas');
        const img = document.getElementById('approvalImage');

        if (canvas && img && img.clientWidth > 0) {
            // O Canvas precisa ter EXATAMENTE o tamanho da imagem renderizada
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
            
            ctx = canvas.getContext('2d');
            
            // Configuração inicial do pincel
            ctx.strokeStyle = currentColor; 
            ctx.lineWidth = 4; 
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            // Listeners de mouse e touch
            canvas.removeEventListener('mousedown', startDraw);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', stopDraw);
            
            canvas.addEventListener('mousedown', startDraw);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', stopDraw);
            // Touch support (para celular real ou simulação)
            canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e.touches[0]); });
            canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); });
            canvas.addEventListener('touchend', stopDraw);
        }
    }

    // Nova função para trocar cores
    window.changeColor = function(color, btnElement) {
        // Define a cor (se for vermelho, mantemos transparência, senão opaco)
        if (color === '#ff0000') {
            currentColor = "rgba(255, 0, 0, 0.8)";
        } else {
            currentColor = color;
        }
        
        if (ctx) ctx.strokeStyle = currentColor;

        // Atualiza visual dos botões
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        if(btnElement) btnElement.classList.add('active');
    };

    function getMousePos(evt) {
        const rect = canvas.getBoundingClientRect();
        // Fator de escala caso o CSS redimensione o canvas
        const scaleX = canvas.width / rect.width; 
        const scaleY = canvas.height / rect.height;

        return {
            x: (evt.clientX - rect.left) * scaleX,
            y: (evt.clientY - rect.top) * scaleY
        };
    }

    function startDraw(e) {
        isDrawing = true; hasAnnotation = true;
        const pos = getMousePos(e);
        ctx.beginPath(); 
        ctx.moveTo(pos.x, pos.y);
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getMousePos(e);
        ctx.lineTo(pos.x, pos.y); 
        ctx.stroke();
    }

    function stopDraw() { isDrawing = false; }
    
    window.clearCanvas = function() {
        if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasAnnotation = false;
    };
    
    window.clearCanvas = function() {
        if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasAnnotation = false;
        document.getElementById('drawControls').style.display = 'none';
    };
    // --- ACTIONS (VOLTAR, SALVAR) ---
    
    // Retorno Inteligente (Captura canvas se for design)
    window.returnToStage = function(targetStage) {
        const taskId = document.getElementById('task-id').value;
        if(!taskId) return;

        // Se estiver voltando pro design e tiver rabisco
        if (targetStage === 'design' && hasAnnotation) {
            Swal.fire({
                title: 'Solicitar Ajuste',
                text: 'Descreva o ajuste no design:',
                input: 'textarea',
                showCancelButton: true,
                confirmButtonText: 'Enviar',
                confirmButtonColor: '#d63384'
            }).then((res) => {
                if (res.isConfirmed) {
                    canvas.toBlob(blob => {
                        sendAction(targetStage, 'reject', res.value, blob);
                    });
                }
            });
        } else {
            // Retorno simples (sem imagem)
            sendAction(targetStage, 'save', null, null);
        }
    };

    window.saveAndAdvance = function(nextTabName) {
        const action = (nextTabName === 'approve') ? 'approve' : 'save';
        sendAction(null, action, null, null, nextTabName);
    };

    window.saveWithAnnotation = function() {
        const reason = document.getElementById('feedbackInput').value;
        if(!reason) { Swal.fire('Erro', 'Escreva o motivo.', 'warning'); return; }
        
        if (hasAnnotation) {
            canvas.toBlob(blob => sendAction(null, 'reject', reason, blob));
        } else {
            sendAction(null, 'reject', reason, null);
        }
    };

    // Função central de envio
    function sendAction(forceStatus, actionType, feedbackText, blobImage, visualNextTab) {
        Swal.fire({ title: 'Salvando...', didOpen: () => Swal.showLoading() });
        
        const formData = new FormData(document.getElementById('kanbanTaskForm'));
        formData.append('action', actionType);
        if(forceStatus) formData.append('force_status', forceStatus);
        if(feedbackText) formData.append('rejection_reason', feedbackText);
        if(blobImage) formData.append('feedback_image_annotation', blobImage, 'ajuste.png');

        const taskId = document.getElementById('task-id').value;
        let url = CONFIG.urls.addTask;
        if(taskId) url = `${CONFIG.urls.taskUpdate}${taskId}/`;

        fetch(url, { method: 'POST', body: formData, headers: {'X-CSRFToken': CONFIG.csrfToken} })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                if (!taskId && !visualNextTab) { window.location.reload(); return; }
                
                // Se foi criação, atualiza ID
                if (!taskId) {
                    document.getElementById('task-id').value = data.task_id;
                    CONFIG.urls.addTask = `${CONFIG.urls.taskUpdate}${data.task_id}/`;
                }

                // Se tem próxima aba visual (sem reload)
                if (visualNextTab && visualNextTab !== 'approve') {
                    Swal.close();
                    const tabBtn = document.querySelector(`#taskTabs button[data-bs-target="#tab-${visualNextTab}"]`);
                    if(tabBtn) {
                        bootstrap.Tab.getOrCreateInstance(tabBtn).show();
                        updateModalHeader(visualNextTab);
                        // Repopula para atualizar dados recém digitados
                        if(visualNextTab === 'copy') populateCopyTab(getObjectFromInputs());
                        if(visualNextTab === 'design') populateDesignTab(getObjectFromInputs());
                    }
                } else {
                    window.location.reload(); // Aprovação, rejeição ou voltar recarrega
                }
            } else {
                Swal.fire('Erro', data.message, 'error');
            }
        })
        .catch(err => Swal.fire('Erro', 'Conexão falhou', 'error'));
    }

    // Helper para pegar dados atuais dos inputs para preview imediato
    function getObjectFromInputs() {
        return {
            title: document.getElementById('modalTitleInput').value,
            briefing_text: document.getElementById('briefing_text').value,
            script_content: document.getElementById('script_content') ? document.getElementById('script_content').value : '',
            caption_content: document.getElementById('inputCaption') ? document.getElementById('inputCaption').value : '',
            // Adicione outros conforme necessário
        };
    }

    // Helpers
    function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }
    function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text || ''; }
    window.updateFileName = function(input) { if(input.files[0]) document.getElementById('uploadTextMain').innerText = input.files[0].name; };
    window.previewUpload = function(input) {
        if(input.files[0]) {
            const reader = new FileReader();
            reader.onload = e => {
                const img = document.getElementById('designPreviewImg');
                img.src = e.target.result; img.style.display = 'block';
                document.getElementById('designUploadPlaceholder').style.display = 'none';
            };
            reader.readAsDataURL(input.files[0]);
        }
    };
    window.toggleRejectMode = function() {
        const p = document.getElementById('rejectPanel');
        const a = document.getElementById('mainActions');
        const controls = document.getElementById('drawControls'); // Container das cores

        if (p.style.display === 'none') { 
            // Entrar no modo de edição/rejeição
            p.style.display = 'block'; 
            a.style.display = 'none'; 
            controls.style.display = 'block'; // Mostra as cores
            
            setTimeout(initCanvas, 100); // Garante alinhamento
        } else { 
            // Sair do modo
            p.style.display = 'none'; 
            a.style.display = 'flex'; 
            controls.style.display = 'none'; // Esconde as cores
        }
    };
    
    // Dropdowns
    window.updateSocialNetworks = function(id, sel) {
        const n = document.getElementById('networkSelect'); if(!n) return;
        n.innerHTML = '<option value="">Selecione...</option>';
        (CLIENT_NETWORKS[id]||[]).forEach(c => {
            const opt = document.createElement('option'); opt.value = c; opt.text = c; 
            if(sel===c) opt.selected = true; n.appendChild(opt);
        });
    };
    document.getElementById('clientSelect')?.addEventListener('change', function(){ window.updateSocialNetworks(this.value); });
});