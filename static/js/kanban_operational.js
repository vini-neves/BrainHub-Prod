document.addEventListener("DOMContentLoaded", function() {
    
    // Acessa as configs vindas do HTML
    const CONFIG = window.KANBAN_CONFIG;

    // --- 1. REGRAS DE NEGÓCIO (REDES SOCIAIS) ---
    const networkRules = {
        'instagram': [{val: 'feed', text: 'Feed (Quadrado)'}, {val: 'story', text: 'Story'}, {val: 'reel_short', text: 'Reels'}],
        'facebook': [{val: 'feed', text: 'Feed'}, {val: 'story', text: 'Story'}],
        'tiktok': [{val: 'reel_short', text: 'TikTok Video'}],
        'youtube': [{val: 'video_long', text: 'Vídeo Longo'}, {val: 'reel_short', text: 'Shorts'}],
        'linkedin': [{val: 'feed', text: 'Post'}, {val: 'video_long', text: 'Vídeo'}],
        'x': [{val: 'feed', text: 'Post'}],
        'pinterest': [{val: 'pin', text: 'Pin'}],
        'threads': [{val: 'feed', text: 'Post'}]
    };

    // Torna a função global para o onchange do HTML poder acessar
    window.filterFormats = function() {
        const networkEl = document.getElementById('networkSelect');
        const formatSelect = document.getElementById('formatSelect');
        
        if (!networkEl || !formatSelect) return; 

        const network = networkEl.value;
        const currentVal = formatSelect.value;
        
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

    function getMockupClass(contentType) {
        if (['story', 'reel_short', 'pin'].includes(contentType)) return 'format-vertical';
        if (contentType === 'video_long') return 'format-horizontal';
        return 'format-square';
    }

    // --- 2. MODAIS (CRIAR E EDITAR) ---
    
    // Abrir modal de criação simples
    window.openNewTaskModal = function() {
        const el = document.getElementById('newTaskModal');
        if(el) {
            const bsModal = bootstrap.Modal.getOrCreateInstance(el);
            bsModal.show();
        } else {
            console.error("Modal newTaskModal não encontrado no DOM");
        }
    };

    // Listener seguro para o formulário de nova tarefa
    const newTaskForm = document.getElementById('newTaskForm');
    if (newTaskForm) {
        newTaskForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            
            // USA A URL VINDA DA CONFIGURAÇÃO
            fetch(CONFIG.urls.addTask, {
                method: 'POST',
                body: formData,
                headers: {'X-CSRFToken': CONFIG.csrfToken} // USA O TOKEN DA CONFIGURAÇÃO
            })
            .then(res => res.json())
            .then(data => {
                if(data.status === 'success') {
                    location.reload();
                } else {
                    alert(data.message);
                }
            })
            .catch(err => console.error(err));
        });
    }

    // Abrir modal de edição (Card Click)
    window.openEditModal = function(taskId) {
        const modalEl = document.getElementById('taskModal');
        if (!modalEl) return;

        const form = document.getElementById('kanbanTaskForm');
        if(form) {
            // Monta a URL usando o prefixo da config + ID
            form.action = `${CONFIG.urls.taskUpdate}${taskId}/`; 
            form.reset();
        }

        const titleEl = document.getElementById('modalTitle');
        if(titleEl) titleEl.innerText = "Carregando...";
        
        const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        bsModal.show();

        // Monta a URL de detalhes
        fetch(`${CONFIG.urls.taskDetails}${taskId}/`)
            .then(res => res.json())
            .then(data => {
                if(titleEl) titleEl.innerText = data.title;

                // Selects
                const netSelect = document.getElementById('networkSelect');
                if(netSelect) {
                    netSelect.value = data.social_network || '';
                    window.filterFormats(); // Chama a função global
                }
                
                const fmtSelect = document.getElementById('formatSelect');
                if(fmtSelect) fmtSelect.value = data.content_type || '';

                // Campos com verificação de existência
                const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
                
                if(data.scheduled_date) setVal('scheduled_date', data.scheduled_date.slice(0, 16));
                setVal('briefing_text', data.briefing_text || '');
                setVal('script_content', data.script_content || '');
                setVal('copy_content', data.copy_content || '');
                setVal('inputCaption', data.caption_content || '');

                // Link Arquivo
                const fileLink = document.getElementById('currentBriefingFileLink');
                if(fileLink) {
                    fileLink.innerHTML = data.briefing_files ? `<a href="${data.briefing_files}" target="_blank" class="text-decoration-none"><i class="fa-solid fa-paperclip"></i> Ver anexo atual</a>` : '';
                }

                // Mockup Logic
                const approvalSection = document.getElementById('approvalSection');
                const img = document.getElementById('designImage');
                const wrapper = document.getElementById('mockupWrapper');
                const captionPrev = document.getElementById('previewCaption');
                const clientName = document.getElementById('mockupClientName');
                const clientFooter = document.getElementById('mockupClientNameFooter');

                if (data.art_url && approvalSection && img) {
                    approvalSection.style.display = 'block';
                    img.src = data.art_url;
                    if(wrapper) wrapper.className = 'mockup-wrapper mx-auto position-relative bg-white border shadow-sm ' + getMockupClass(data.content_type);
                    if(captionPrev) captionPrev.innerText = data.caption_content || '';
                    if(clientName) clientName.innerText = data.client_name || 'Cliente';
                    if(clientFooter) clientFooter.innerText = data.client_name || 'Cliente';
                    
                    const btns = document.getElementById('approvalButtons');
                    if(btns) {
                        if(['review_internal', 'review_client'].includes(data.status)) {
                            btns.style.display = 'flex';
                        } else {
                            btns.style.display = 'none';
                        }
                    }
                } else if (approvalSection) {
                    approvalSection.style.display = 'none';
                }

                // Stepper
                document.querySelectorAll('.step-badge').forEach(b => {
                    b.classList.remove('active');
                    if(data.status && data.status.includes(b.dataset.step)) b.classList.add('active');
                });
            })
            .catch(err => {
                console.error(err);
                alert("Erro ao carregar tarefa");
            });
    };

    // --- 3. FUNCIONALIDADES VISUAIS ---
    
    const inputCap = document.getElementById('inputCaption');
    if(inputCap) {
        inputCap.addEventListener('input', function() {
            const prev = document.getElementById('previewCaption');
            if(prev) prev.innerText = this.value;
        });
    }

    // 4. CANVAS DE RABISCO
    let canvas, ctx, isDrawing = false;
    
    window.enableDrawingMode = function() {
        const img = document.getElementById('designImage');
        canvas = document.getElementById('feedbackCanvas');
        
        if(!img || !img.src || !canvas) return;

        canvas.width = img.clientWidth;
        canvas.height = img.clientHeight;
        canvas.style.pointerEvents = 'auto';
        canvas.style.border = '3px solid #dc3545';
        
        ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#dc3545';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        canvas.onmousedown = (e) => { isDrawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); };
        canvas.onmousemove = (e) => { if(isDrawing) { ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); } };
        canvas.onmouseup = () => { isDrawing = false; saveCanvas(); };
        
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Modo Desenho Ativado!', timer: 3000 });
    };

    function saveCanvas() {
        const hiddenInput = document.getElementById('feedback_image_annotation');
        if(hiddenInput && canvas) {
            hiddenInput.value = canvas.toDataURL();
        }
    }

    window.submitRejection = function() {
        Swal.fire({
            title: 'Reprovar Post?',
            input: 'textarea',
            inputPlaceholder: 'Descreva o que precisa ser alterado...',
            showCancelButton: true,
            confirmButtonText: 'Enviar para Correção',
            confirmButtonColor: '#d33'
        }).then((result) => {
            if (result.isConfirmed) {
                const form = document.getElementById('kanbanTaskForm');
                if(!form) return;
                
                let reason = document.createElement('input');
                reason.type = 'hidden'; reason.name = 'rejection_reason'; reason.value = result.value;
                form.appendChild(reason);

                let action = document.createElement('input');
                action.type = 'hidden'; action.name = 'action'; action.value = 'reject';
                form.appendChild(action);
                
                form.submit();
            }
        });
    };
});