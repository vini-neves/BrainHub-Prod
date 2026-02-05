document.addEventListener("DOMContentLoaded", function () {

    const CONFIG = window.KANBAN_CONFIG || {};
    const CLIENT_NETWORKS = window.CLIENT_NETWORKS || {};

    // Mapeamento visual das redes e formatos
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

    // ============================================================
    // 1. UTILITÁRIOS VISUAIS (HEADER DO MODAL)
    // ============================================================
    function updateModalHeader(tabName) {
        const titleEl = document.getElementById('modalKanbanType');
        const dotEl = document.getElementById('modalTypeDot');
        
        if (!titleEl || !dotEl) return;

        // Limpa hashtags se vierem no nome
        const cleanTab = tabName.replace('#tab-', '').replace('#', '');

        if (cleanTab === 'copy') {
            titleEl.innerText = "Copy";
            dotEl.style.backgroundColor = "#0d6efd"; // Azul
        } else if (cleanTab === 'design') {
            titleEl.innerText = "Design";
            dotEl.style.backgroundColor = "#d63384"; // Rosa
        } else if (cleanTab === 'approval' || cleanTab === 'review_internal' || cleanTab === 'review_client') {
            titleEl.innerText = "Aprovação";
            dotEl.style.backgroundColor = "#fd7e14"; // Laranja
        } else {
            titleEl.innerText = "Briefing";
            dotEl.style.backgroundColor = "#6f42c1"; // Roxo
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
    function dragEnter(e) { e.preventDefault(); this.style.backgroundColor = '#f8f9fa'; }
    function dragLeave() { this.style.backgroundColor = ''; }

    function dragDrop(e) {
        this.style.backgroundColor = '';
        if (draggedCard) {
            this.appendChild(draggedCard);
            const taskId = draggedCard.getAttribute('data-id');
            const newStatus = this.getAttribute('data-status');

            // Reordena
            const newOrderList = Array.from(this.querySelectorAll('.kanban-card')).map(card => card.getAttribute('data-id'));

            // Salva no backend
            saveKanbanChange(taskId, newStatus, newOrderList);
        }
    }

    function saveKanbanChange(taskId, status, orderList) {
        fetch("/api/kanban/update/", {
            method: 'POST',
            body: JSON.stringify({ task_id: taskId, status: status, newOrderList: orderList }),
            headers: { 'X-CSRFToken': CONFIG.csrfToken, 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'success') {
                Swal.fire('Erro', 'Erro ao mover card: ' + data.message, 'error');
                window.location.reload();
            }
        })
        .catch(err => console.error(err));
    }

    // ============================================================
    // 3. FUNÇÕES DO MODAL (NOVO POST E EDIÇÃO)
    // ============================================================

    // --- ABRIR MODAL "NOVO POST" ---
    window.openNewTaskModal = function () {
        const modalEl = document.getElementById('taskModal');
        const form = document.getElementById('kanbanTaskForm');

        if (form) form.reset();
        document.getElementById('task-id').value = "";

        // Define URL de criação
        const isOperational = window.location.href.includes("operational");
        CONFIG.urls.addTask = isOperational ? "/api/task/add-operational/" : "/api/task/add-general/";

        // Reseta selects
        const netSelect = document.getElementById('networkSelect');
        if (netSelect) netSelect.innerHTML = '<option value="">Instagram</option>';

        // Reseta Upload
        const previewImg = document.getElementById('designPreviewImg');
        const placeholder = document.getElementById('designUploadPlaceholder');
        const uploadText = document.getElementById('uploadTextMain');

        if (previewImg) { previewImg.src = ""; previewImg.style.display = 'none'; }
        if (placeholder) placeholder.style.display = 'block';
        if (uploadText) uploadText.innerText = "Arraste arquivos ou clique para fazer upload";

        const uploadBox = document.querySelector('.upload-box-dashed');
        if (uploadBox) {
            uploadBox.style.borderColor = "#a0aec0";
            uploadBox.style.backgroundColor = "transparent";
        }

        // Abre na aba Briefing
        const triggerEl = document.querySelector('#taskTabs button[data-bs-target="#tab-briefing"]');
        if (triggerEl) bootstrap.Tab.getOrCreateInstance(triggerEl).show();
        
        updateModalHeader('briefing'); // Reseta cabeçalho

        new bootstrap.Modal(modalEl).show();
    };

    // --- ABRIR MODAL "EDITAR" ---
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
                // 1. Preenche Campos Básicos
                setVal('modalTitleInput', data.title);
                setVal('clientSelect', data.client_id);
                setVal('scheduled_date', data.scheduled_date ? data.scheduled_date.slice(0, 10) : '');

                // 2. Atualiza Redes
                window.updateSocialNetworks(data.client_id, data.social_network);

                setTimeout(() => {
                    const fmtSelect = document.getElementById('formatSelect');
                    if (fmtSelect) fmtSelect.dataset.value = data.content_type;
                    window.filterFormats();
                }, 100);

                // 3. Textos
                setVal('briefing_text', data.briefing_text);
                setVal('inputCaption', data.caption_content);
                setVal('script_content', data.script_content);

                // 4. Preenche as Abas Escondidas
                populateDesignTab(data);
                populateCopyTab(data);
                populateApprovalTab(data);

                // 5. Decide qual aba abrir
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
                if (tabBtn) bootstrap.Tab.getOrCreateInstance(tabBtn).show();
                
                // Atualiza o título e cor do modal
                updateModalHeader(targetTabId);
            })
            .catch(err => console.error("Erro ao carregar tarefa:", err));
    };

    // ============================================================
    // 4. BOTÃO SALVAR E AVANÇAR (LÓGICA PRINCIPAL)
    // ============================================================
    
    window.saveAndAdvance = function (nextTabName) { 
        const form = document.getElementById('kanbanTaskForm');
        const formData = new FormData(form);

        formData.append('action', 'save');

        // Feedback Visual
        const btn = document.activeElement;
        let originalText = "Salvar";
        if(btn && btn.tagName === 'BUTTON') {
            originalText = btn.innerText;
            btn.innerText = "Salvando...";
            btn.disabled = true;
        }

        const taskId = document.getElementById('task-id').value;
        let url = CONFIG.urls.addTask;
        if (taskId) url = `${CONFIG.urls.taskUpdate}${taskId}/`;

        // Envio via AJAX
        fetch(url, {
            method: 'POST',
            body: formData,
            headers: { 'X-CSRFToken': CONFIG.csrfToken }
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                
                // Atualiza ID se for criação
                if(!taskId) {
                    document.getElementById('task-id').value = data.task_id;
                    CONFIG.urls.addTask = `${CONFIG.urls.taskUpdate}${data.task_id}/`;
                }

                // Se tiver próxima aba, troca visualmente
                if (nextTabName) {
                    const targetId = `#tab-${nextTabName}`;
                    const tabTrigger = document.querySelector(`#taskTabs button[data-bs-target="${targetId}"]`);
                    
                    if (tabTrigger) {
                        bootstrap.Tab.getOrCreateInstance(tabTrigger).show();
                        
                        // Atualiza título e cor
                        updateModalHeader(nextTabName);

                        // Atualiza resumos imediatos com o que está nos inputs
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
                    }
                } else {
                    // Se não tiver próxima aba (botão final), recarrega
                    window.location.reload();
                }
            } else {
                Swal.fire('Erro', data.message, 'error');
            }
        })
        .catch(err => {
            console.error(err);
            Swal.fire('Erro', 'Erro de conexão.', 'error');
        })
        .finally(() => {
            if(btn && btn.tagName === 'BUTTON') {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    };

    // Navegação Manual (botão Voltar/Cancelar)
    window.goToTab = function (tabId) {
        const tabBtn = document.querySelector(`#taskTabs button[data-bs-target="#${tabId}"]`);
        if (tabBtn) {
            bootstrap.Tab.getOrCreateInstance(tabBtn).show();
            updateModalHeader(tabId);
        }
    };

    // ============================================================
    // 5. POPULATE FUNCTIONS (PREENCHER DADOS VISUAIS)
    // ============================================================

    function populateDesignTab(data) {
        // --- 1. Cartão Briefing ---
        setText('designBriefTitle', data.title);
        setText('designNetwork', data.social_network || 'Geral');
        setText('designFormat', data.content_type || 'Post');
        
        if (data.scheduled_date && data.scheduled_date.length >= 10) {
            setText('designDate', data.scheduled_date.slice(0, 10));
            setText('designTime', data.scheduled_date.slice(11, 16) || '--:--');
        }
        setText('designBriefText', data.briefing_text || 'Sem briefing.');

        // --- 2. Cartão Copy (Novos Campos) ---
        // Aqui pegamos os dados que podem ter vindo da aba Copy ou do banco
        // Se a aba copy estiver aberta, tentamos pegar do input, senão do objeto data
        const scriptVal = document.getElementById('script_content') ? document.getElementById('script_content').value : data.script_content;
        const copyVal = document.getElementById('copy_content_input') ? document.getElementById('copy_content_input').value : data.copy_content;
        const captionVal = document.getElementById('inputCaption') ? document.getElementById('inputCaption').value : data.caption_content;

        setText('designScript', scriptVal || 'Sem roteiro.');
        setText('designCopyText', copyVal || 'Sem texto na arte.');
        setText('designCaption', captionVal || 'Sem legenda.');

        // --- 3. Cartão Referência ---
        const refContainer = document.getElementById('designRefContainer');
        if (refContainer) {
            if (data.briefing_files) {
                refContainer.innerHTML = `<img src="${data.briefing_files}" class="briefing-thumb" style="width: 100%; height: auto; max-height: 150px; object-fit: cover; border-radius: 8px;" onclick="window.open('${data.briefing_files}', '_blank')">`;
            } else {
                refContainer.innerHTML = '<span class="text-muted x-small fst-italic">Nenhuma referência.</span>';
            }
        }

        // --- 4. Preview Upload (Direita) ---
        const img = document.getElementById('designPreviewImg');
        const placeholder = document.getElementById('designUploadPlaceholder');
        if (img && placeholder) {
            if (data.art_url) {
                img.src = data.art_url; img.style.display = 'block';
                placeholder.style.display = 'none';
            } else {
                img.src = ""; img.style.display = 'none';
                placeholder.style.display = 'block';
            }
        }
    }

    function populateCopyTab(data) {
        setText('copyBriefTitle', data.title);
        setText('copyNetwork', data.social_network || 'Geral');
        setText('copyFormat', data.content_type || 'Post');

        if (data.scheduled_date && data.scheduled_date.length >= 10) {
            setText('copyDate', data.scheduled_date.slice(0, 10));
            setText('copyTime', data.scheduled_date.slice(11, 16) || '--:--');
        }

        setText('copyBriefText', data.briefing_text || 'Sem descrição.');

        const refContainer = document.getElementById('copyRefContainer');
        if (refContainer) {
            if (data.briefing_files) {
                refContainer.innerHTML = `<img src="${data.briefing_files}" class="briefing-thumb" onclick="window.open('${data.briefing_files}', '_blank')">`;
            } else {
                refContainer.innerHTML = '<span class="text-muted small fst-italic">Sem referência.</span>';
            }
        }
    }

    function populateApprovalTab(data) {
        setText('apprTitle', data.title);
        setText('apprClient', data.client_name);
        setText('apprNetwork', data.social_network || 'Geral');
        setText('apprDate', data.scheduled_date || '--/--');
        setText('apprCaption', data.caption_content || 'Sem legenda.');

        const img = document.getElementById('approvalImage');
        if (img) {
            if (data.art_url) {
                img.src = data.art_url;
                img.onload = function () { initCanvas(); };
            } else {
                img.src = "";
            }
        }
        window.clearCanvas();
    }

    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text || '';
    }

    window.updateCharCount = function (textarea) {
        document.getElementById('charCount').innerText = textarea.value.length;
    };

    // ============================================================
    // 6. UPLOAD E CANVAS
    // ============================================================

    window.updateFileName = function (input) {
        if (input.files && input.files.length > 0) {
            const txtMain = document.getElementById('uploadTextMain');
            if (txtMain) txtMain.innerText = input.files[0].name;
            const box = input.closest('.upload-box-dashed');
            if (box) {
                box.style.borderColor = "#00bfa5";
                box.style.backgroundColor = "#f0fdf4";
            }
        }
    };

    window.previewUpload = function (input) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();
            reader.onload = function (e) {
                const img = document.getElementById('designPreviewImg');
                const placeholder = document.getElementById('designUploadPlaceholder');
                if (img) { img.src = e.target.result; img.style.display = 'block'; }
                if (placeholder) placeholder.style.display = 'none';
            }
            reader.readAsDataURL(input.files[0]);
        }
    }

    let canvas, ctx, isDrawing = false, hasAnnotation = false;
    function initCanvas() {
        canvas = document.getElementById('annotationCanvas');
        const img = document.getElementById('approvalImage');
        if (canvas && img && img.clientWidth > 0) {
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
            ctx = canvas.getContext('2d');
            ctx.strokeStyle = "#ff0000"; ctx.lineWidth = 4; ctx.lineCap = "round";
            canvas.addEventListener('mousedown', startDraw);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', endDraw);
        }
    }
    function startDraw(e) {
        isDrawing = true; hasAnnotation = true;
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        const controls = document.getElementById('drawControls');
        if (controls) controls.style.display = 'block';
    }
    function draw(e) {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
    }
    function endDraw() { isDrawing = false; }
    window.clearCanvas = function () {
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasAnnotation = false;
        const controls = document.getElementById('drawControls');
        if (controls) controls.style.display = 'none';
    };

    // ============================================================
    // 7. LISTENERS E REDES SOCIAIS
    // ============================================================
    window.updateSocialNetworks = function (clientId, selectedNetwork = null) {
        const netSelect = document.getElementById('networkSelect');
        const formatSelect = document.getElementById('formatSelect');
        if (!netSelect) return;
        netSelect.innerHTML = '<option value="">Selecione...</option>';
        if (formatSelect) formatSelect.innerHTML = '<option value="">Selecione a rede...</option>';
        if (!clientId) return;

        const networks = CLIENT_NETWORKS[clientId.toString()] || [];
        networks.forEach(netCode => {
            const label = NETWORK_LABELS[netCode] || netCode;
            const option = document.createElement('option');
            option.value = netCode;
            option.text = label;
            if (selectedNetwork && selectedNetwork === netCode) option.selected = true;
            netSelect.appendChild(option);
        });
        if (selectedNetwork) {
            netSelect.value = selectedNetwork;
            window.filterFormats();
        }
    };

    window.filterFormats = function () {
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
                if (opt.val === currentVal) option.selected = true;
                formatSelect.appendChild(option);
            });
        }
    };

    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) clientSelect.addEventListener('change', function () { window.updateSocialNetworks(this.value); });
    const networkSelect = document.getElementById('networkSelect');
    if (networkSelect) networkSelect.addEventListener('change', window.filterFormats);

    // ============================================================
    // 8. FUNÇÕES FINAIS (SUBMIT, REJECT)
    // ============================================================
    window.toggleRejectMode = function () {
        const panel = document.getElementById('rejectPanel');
        const actions = document.getElementById('mainActions');
        if (panel && actions) {
            if (panel.style.display === 'none') {
                panel.style.display = 'block'; actions.style.display = 'none'; initCanvas();
            } else {
                panel.style.display = 'none'; actions.style.display = 'grid';
            }
        }
    };

    function submitFormViaAjax(formData) {
        // Função usada pelo saveWithAnnotation (rejeição)
        Swal.fire({ title: 'Salvando...', didOpen: () => { Swal.showLoading() } });
        const taskId = document.getElementById('task-id').value;
        let url = CONFIG.urls.addTask;
        if (taskId) url = `${CONFIG.urls.taskUpdate}${taskId}/`;

        fetch(url, {
            method: 'POST', body: formData, headers: { 'X-CSRFToken': CONFIG.csrfToken }
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                Swal.fire({ title: 'Salvo!', icon: 'success', timer: 1000, showConfirmButton: false }).then(() => { window.location.reload(); });
            } else {
                Swal.fire('Erro', data.message, 'error');
            }
        })
        .catch(err => Swal.fire('Erro', 'Erro de conexão.', 'error'));
    }

    window.saveWithAnnotation = function () {
        const feedback = document.getElementById('feedbackInput').value;
        if (!feedback) { Swal.fire('Erro', 'Escreva o motivo.', 'warning'); return; }
        const formData = new FormData(document.getElementById('kanbanTaskForm'));
        formData.append('action', 'reject');
        if (hasAnnotation && canvas) {
            canvas.toBlob(function (blob) {
                formData.append('feedback_image_annotation', blob, 'annotation.png');
                submitFormViaAjax(formData);
            });
        } else {
            submitFormViaAjax(formData);
        }
    };
});