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
    // 1. DRAG AND DROP
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
    // 2. FUNÇÕES DO MODAL (NOVO POST E EDIÇÃO)
    // ============================================================

    // --- ABRIR MODAL "NOVO POST" ---
    window.openNewTaskModal = function () {
        const modalEl = document.getElementById('taskModal');
        const form = document.getElementById('kanbanTaskForm');

        // 1. Reseta o formulário
        if (form) form.reset();

        // 2. Garante que é criação (ID vazio)
        document.getElementById('task-id').value = "";

        // 3. Define URL de criação
        const isOperational = window.location.href.includes("operational");
        CONFIG.urls.addTask = isOperational ? "/api/task/add-operational/" : "/api/task/add-general/";

        // 4. Reseta selects
        const netSelect = document.getElementById('networkSelect');
        if (netSelect) {
            netSelect.innerHTML = '<option value="">Instagram</option>'; // Padrão
            // Não desabilitamos mais, pois o layout clean já mostra
        }

        // 5. Reseta Upload e Preview (IDs novos do layout Clean)
        const previewImg = document.getElementById('designPreviewImg');
        const placeholder = document.getElementById('designUploadPlaceholder');
        const uploadText = document.getElementById('uploadTextMain');

        if (previewImg) { previewImg.src = ""; previewImg.style.display = 'none'; }
        if (placeholder) placeholder.style.display = 'block';
        if (uploadText) uploadText.innerText = "Arraste arquivos ou clique para fazer upload";

        // Remove borda verde do upload se houver
        const uploadBox = document.querySelector('.upload-box-dashed');
        if (uploadBox) {
            uploadBox.style.borderColor = "#a0aec0";
            uploadBox.style.backgroundColor = "transparent";
        }

        // 6. Abre na aba Briefing sempre
        const triggerEl = document.querySelector('#taskTabs button[data-bs-target="#tab-briefing"]');
        if (triggerEl) bootstrap.Tab.getOrCreateInstance(triggerEl).show();

        // 7. Mostra o modal
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

                // 2. Atualiza Redes Sociais e Formatos
                window.updateSocialNetworks(data.client_id, data.social_network);

                // Pequeno delay para garantir que o select populou antes de setar o valor
                setTimeout(() => {
                    const fmtSelect = document.getElementById('formatSelect');
                    if (fmtSelect) fmtSelect.dataset.value = data.content_type;
                    window.filterFormats();
                }, 100);

                // 3. Textos
                setVal('briefing_text', data.briefing_text);
                setVal('inputCaption', data.caption_content);
                setVal('script_content', data.script_content);

                // 4. Preenche as Abas Escondidas (Design/Aprovação)
                populateDesignTab(data);
                populateCopyTab(data);
                populateApprovalTab(data);

                // 5. Decide qual aba abrir baseado no status
                const statusMap = {
                    'briefing': '#tab-briefing',
                    'copy': '#tab-copy',
                    'design': '#tab-design',
                    'review_internal': '#tab-approval',
                    'review_client': '#tab-approval',
                    'done': '#tab-approval'
                };
                let targetTabId = statusMap[data.status] || '#tab-briefing';

                // Força abrir a aba correta
                const tabBtn = document.querySelector(`#taskTabs button[data-bs-target="${targetTabId}"]`);
                if (tabBtn) bootstrap.Tab.getOrCreateInstance(tabBtn).show();
            })
            .catch(err => console.error("Erro ao carregar tarefa:", err));
    };

    // ============================================================
    // 3. FUNÇÕES AUXILIARES DE PREENCHIMENTO (Populate)
    // ============================================================

    function populateDesignTab(data) {
        // Verifica se os elementos existem antes de tentar preencher
        setText('designBriefTitle', data.title);
        setText('designNetwork', data.social_network || 'Geral');
        setText('designDate', data.scheduled_date || '--/--');
        setText('designBriefText', data.briefing_text || 'Sem briefing.');
        setText('designHeadline', data.copy_content || 'Sem copy.');
        setText('designCaption', data.caption_content || 'Sem legenda.');

        // Preview da Arte
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

    // --- POPULA A ABA COPY (RESUMO ESQUERDA) ---
    function populateCopyTab(data) {
        // 1. Textos do Resumo
        setText('copyBriefTitle', data.title);
        setText('copyNetwork', data.social_network || 'Geral');
        setText('copyFormat', data.content_type || 'Post');

        // Data e Hora separadas
        if (data.scheduled_date) {
            setText('copyDate', data.scheduled_date.slice(0, 10)); // Pega só YYYY-MM-DD
            // Se tiver hora salva no banco, mostraria aqui. Como o scheduled_date as vezes é datetime:
            setText('copyTime', data.scheduled_date.slice(11, 16) || '--:--');
        }

        setText('copyBriefText', data.briefing_text || 'Sem descrição.');

        // 2. Mídia de Referência (Miniatura)
        const refContainer = document.getElementById('copyRefContainer');
        if (refContainer) {
            if (data.briefing_files) {
                // Se for imagem, mostra thumb. Se for arquivo, mostra link.
                // Aqui assumindo que briefing_files é URL de imagem para simplificar visual
                refContainer.innerHTML = `
                <img src="${data.briefing_files}" class="briefing-thumb" onclick="window.open('${data.briefing_files}', '_blank')">
            `;
            } else {
                refContainer.innerHTML = '<span class="text-muted small fst-italic">Sem referência.</span>';
            }
        }
    }

    // Contador de Caracteres Simples
    window.updateCharCount = function (textarea) {
        document.getElementById('charCount').innerText = textarea.value.length;
    };

    function populateApprovalTab(data) {
        setText('apprTitle', data.title);
        setText('apprClient', data.client_name);
        setText('apprNetwork', data.social_network || 'Geral');
        setText('apprDate', data.scheduled_date || '--/--');
        setText('apprCaption', data.caption_content || 'Sem legenda.');

        // Imagem do Celular
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

    // Atalhos seguros
    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text || '';
    }

    // ============================================================
    // 4. LÓGICA DE UPLOAD E CANVAS
    // ============================================================

    // Atualiza nome do arquivo no Upload Tracejado (Briefing)
    window.updateFileName = function (input) {
        if (input.files && input.files.length > 0) {
            const txtMain = document.getElementById('uploadTextMain');
            if (txtMain) txtMain.innerText = input.files[0].name;

            // Estilo visual de sucesso
            const box = input.closest('.upload-box-dashed');
            if (box) {
                box.style.borderColor = "#00bfa5";
                box.style.backgroundColor = "#f0fdf4";
            }
        }
    };

    // Preview do Upload de Design (Aba Design)
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

    // Canvas (Riscar imagem)
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
    // 5. REDES SOCIAIS E FILTROS
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

    // Listeners
    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) clientSelect.addEventListener('change', function () { window.updateSocialNetworks(this.value); });

    const networkSelect = document.getElementById('networkSelect');
    if (networkSelect) networkSelect.addEventListener('change', window.filterFormats);

    // ============================================================
    // 6. SALVAR E NAVEGAR (SAVE & ADVANCE)
    // ============================================================

    // Botão de navegação entre abas
    window.goToTab = function (tabId) {
        const tabBtn = document.querySelector(`#taskTabs button[data-bs-target="#${tabId}"]`);
        if (tabBtn) bootstrap.Tab.getOrCreateInstance(tabBtn).show();
    };

    // Botão Salvar Principal
    window.saveAndAdvance = function (nextStatus) {
        const form = document.getElementById('kanbanTaskForm');
        const formData = new FormData(form);

        formData.append('action', 'save');
        // Se quisermos forçar a mudança de status pelo botão, descomente abaixo:
        // if(nextStatus) formData.append('force_status', nextStatus);

        submitFormViaAjax(formData);
    };

    function submitFormViaAjax(formData) {
        Swal.fire({
            title: 'Salvando...',
            didOpen: () => { Swal.showLoading() }
        });

        const taskId = document.getElementById('task-id').value;
        let url = CONFIG.urls.addTask;
        if (taskId) url = `${CONFIG.urls.taskUpdate}${taskId}/`;

        fetch(url, {
            method: 'POST',
            body: formData,
            headers: { 'X-CSRFToken': CONFIG.csrfToken }
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    Swal.fire({
                        title: 'Salvo!',
                        icon: 'success',
                        timer: 1000,
                        showConfirmButton: false
                    }).then(() => {
                        window.location.reload();
                    });
                } else {
                    Swal.fire('Erro', data.message, 'error');
                }
            })
            .catch(err => {
                console.error(err);
                Swal.fire('Erro', 'Erro de conexão.', 'error');
            });
    }

    // Funções extras (Aprovação / Rejeição)
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