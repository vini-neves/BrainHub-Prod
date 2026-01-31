document.addEventListener("DOMContentLoaded", function() {
    
    // --- CONFIGURAÇÕES GLOBAIS ---
    const CONFIG = window.KANBAN_CONFIG || {};
    // JSON vindo do Django com as redes de cada cliente
    const CLIENT_NETWORKS = window.CLIENT_NETWORKS || {}; 

    // Mapeamento visual para os nomes das redes
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

    // Regras de Formatos de Conteúdo
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

    // ============================================================
    // 1. FUNÇÕES DINÂMICAS (UI)
    // ============================================================

    // Atualiza o Select de Formatos baseado na Rede escolhida
    window.filterFormats = function() {
        const networkEl = document.getElementById('networkSelect');
        const formatSelect = document.getElementById('formatSelect');
        if (!networkEl || !formatSelect) return; 

        const network = networkEl.value;
        // Tenta manter o valor selecionado se existir no dataset ou value atual
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

    // Atualiza o Select de Redes baseado no Cliente escolhido
    window.updateSocialNetworks = function(clientId, selectedNetwork = null) {
        const netSelect = document.getElementById('networkSelect');
        const formatSelect = document.getElementById('formatSelect');
        
        // Limpa campos
        netSelect.innerHTML = '<option value="">Selecione...</option>';
        if(formatSelect) formatSelect.innerHTML = '<option value="">Selecione a rede...</option>';
        
        if (!clientId) {
            netSelect.disabled = true;
            return;
        }

        // Busca redes no JSON (Converte ID para string para garantir match)
        const networks = CLIENT_NETWORKS[clientId.toString()] || [];

        console.log(`Cliente ID: ${clientId} | Redes:`, networks);

        if (networks.length === 0) {
            const option = document.createElement('option');
            option.text = "Nenhuma rede conectada";
            netSelect.add(option);
            netSelect.disabled = true;
            return;
        }

        // Preenche e destrava
        netSelect.disabled = false;
        networks.forEach(netCode => {
            const label = NETWORK_LABELS[netCode] || netCode;
            const option = document.createElement('option');
            option.value = netCode;
            option.text = label;
            
            if (selectedNetwork && selectedNetwork === netCode) {
                option.selected = true;
            }
            netSelect.appendChild(option);
        });

        // Se já tem rede, carrega formatos
        if(selectedNetwork) {
            netSelect.value = selectedNetwork; // Garante visualmente
            window.filterFormats();
        }
    };

    // Helper para preencher inputs
    function setVal(id, val) {
        const el = document.getElementById(id);
        if(el) el.value = val || '';
    }

    // ============================================================
    // 2. LISTENERS DE MUDANÇA
    // ============================================================

    // Quando muda o Cliente -> Carrega Redes
    const clientSelect = document.getElementById('clientSelect');
    if(clientSelect) {
        clientSelect.addEventListener('change', function() {
            window.updateSocialNetworks(this.value);
        });
    }

    // Quando muda a Rede -> Carrega Formatos
    const networkSelect = document.getElementById('networkSelect');
    if(networkSelect) {
        networkSelect.addEventListener('change', window.filterFormats);
    }

    // ============================================================
    // 3. ABRIR MODAIS
    // ============================================================

    // Modal de CRIAÇÃO (Novo Post)
    window.openNewTaskModal = function() {
        const modalEl = document.getElementById('taskModal');
        const form = document.getElementById('kanbanTaskForm');
        
        // Reset Total
        form.reset();
        document.getElementById('task-id').value = ""; // ID vazio indica criação
        
        // Reset Visual
        document.getElementById('modalKanbanType').innerText = "Briefing";
        document.getElementById('modalTitleInput').value = "";
        
        // Reset Selects
        document.getElementById('networkSelect').innerHTML = '<option value="">Selecione um cliente...</option>';
        document.getElementById('networkSelect').disabled = true;
        document.getElementById('formatSelect').innerHTML = '<option value="">Selecione a rede...</option>';

        // Reseta Imagens
        if(document.getElementById('previewArtImg')) document.getElementById('previewArtImg').style.display = 'none';
        if(document.getElementById('noArtText')) document.getElementById('noArtText').style.display = 'block';

        // Abre na Aba Briefing
        const triggerEl = document.querySelector('#taskTabs button[data-bs-target="#tab-briefing"]');
        if(triggerEl) bootstrap.Tab.getOrCreateInstance(triggerEl).show();

        new bootstrap.Modal(modalEl).show();
    };

    // Modal de EDIÇÃO
    window.openEditModal = function(taskId) {
        const modalEl = document.getElementById('taskModal');
        const form = document.getElementById('kanbanTaskForm');
        
        form.reset();
        document.getElementById('task-id').value = taskId;
        
        new bootstrap.Modal(modalEl).show();

        // Busca dados no servidor
        fetch(`${CONFIG.urls.taskDetails}${taskId}/`)
            .then(res => res.json())
            .then(data => {
                // Header
                document.getElementById('modalTitleInput').value = data.title;
                document.getElementById('modalKanbanType').innerText = `Editando #${data.id}`;
                
                // Cliente
                if(clientSelect) clientSelect.value = data.client_id;

                // Redes e Formatos (Lógica em Cadeia)
                window.updateSocialNetworks(data.client_id, data.social_network);
                
                const fmtSelect = document.getElementById('formatSelect');
                if(fmtSelect) fmtSelect.dataset.value = data.content_type; // Guarda valor para o filter usar
                window.filterFormats();

                // Campos de Texto
                if(data.scheduled_date) setVal('scheduled_date', data.scheduled_date.slice(0, 10));
                setVal('briefing_text', data.briefing_text);
                setVal('copy_content', data.copy_content);
                setVal('inputCaption', data.caption_content);
                setVal('script_content', data.script_content);

                // Imagens e Links
                const fileLink = document.getElementById('currentFileLink');
                if(fileLink) fileLink.innerHTML = data.briefing_files ? `<a href="${data.briefing_files}" target="_blank" class="small"><i class="fa-solid fa-paperclip"></i> Ver anexo</a>` : "";

                const previewImg = document.getElementById('previewArtImg');
                const noArtText = document.getElementById('noArtText');
                if(data.art_url) {
                    if(previewImg) { previewImg.src = data.art_url; previewImg.style.display = 'block'; }
                    if(noArtText) noArtText.style.display = 'none';
                    if(document.getElementById('designImage')) document.getElementById('designImage').src = data.art_url;
                } else {
                    if(previewImg) previewImg.style.display = 'none';
                    if(noArtText) noArtText.style.display = 'block';
                    if(document.getElementById('designImage')) document.getElementById('designImage').src = "";
                }

                // Aba Inteligente (Abre na aba certa conforme status)
                const statusMap = {
                    'briefing': '#tab-briefing', 'copy': '#tab-copy', 'design': '#tab-design',
                    'review_internal': '#tab-approval', 'review_client': '#tab-approval', 'done': '#tab-approval'
                };
                let targetTabId = statusMap[data.status] || '#tab-briefing';
                const tabBtn = document.querySelector(`#taskTabs button[data-bs-target="${targetTabId}"]`);
                if(tabBtn) bootstrap.Tab.getOrCreateInstance(tabBtn).show();
            })
            .catch(err => console.error("Erro ao carregar tarefa:", err));
    };

    // ============================================================
    // 4. SUBMISSÃO DO FORMULÁRIO (SALVAR)
    // ============================================================
    const form = document.getElementById('kanbanTaskForm');

    if (!form) {
        console.error("ERRO: Formulário #kanbanTaskForm não encontrado!");
    } else {
        form.addEventListener('submit', function(e) {
            // 1. IMPEDE O RELOAD PADRÃO (Essencial para Firefox)
            e.preventDefault();
            console.log("Submit interceptado via JS.");

            const taskId = document.getElementById('task-id').value;
            const formData = new FormData(this);

            // 2. ADICIONA O TÍTULO MANUALMENTE (Pois está fora do <form> no HTML)
            const titleInput = document.getElementById('modalTitleInput');
            if (titleInput) {
                formData.set('title', titleInput.value);
            }

            // 3. Define URL e Ação
            let url = CONFIG.urls.addTask; // Criar
            if(taskId) {
                url = `${CONFIG.urls.taskUpdate}${taskId}/`; // Editar
                formData.append('action', 'save');
            }

            // 4. UI Feedback
            const btn = document.getElementById('btnSaveTask');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "Salvando...";

            // 5. Envia Requisição
            fetch(url, {
                method: 'POST',
                body: formData,
                headers: {'X-CSRFToken': CONFIG.csrfToken}
            })
            .then(res => res.json())
            .then(data => {
                console.log("Resposta:", data);
                if(data.status === 'success') {
                    // CORREÇÃO FIREFOX: Limpa histórico de POST e recarrega limpo
                    window.location.replace(window.location.pathname);
                } else {
                    alert(data.message || "Erro ao salvar.");
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
            })
            .catch(err => {
                console.error("Erro Fetch:", err);
                alert("Erro de conexão.");
                btn.disabled = false;
                btn.innerText = originalText;
            });
        });
    }

    // ============================================================
    // 5. FERRAMENTAS EXTRAS (Aprovação e Desenho)
    // ============================================================
    
    // Toggle da área de rejeição
    window.toggleRejectMode = function() {
        const tools = document.getElementById('rejectTools');
        if(tools) tools.style.display = tools.style.display === 'none' ? 'block' : 'none';
    };

    // Botões de Aprovação/Rejeição chamam submit global via inputs hidden
    window.submitApproval = function(type) {
        // Lógica simplificada: Apenas submete o form com action='approve'
        // Você pode adicionar SweetAlert aqui se quiser confirmação
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = 'action';
        hiddenInput.value = 'approve';
        form.appendChild(hiddenInput);
        
        // Dispara o evento de submit manual
        form.requestSubmit(); 
    };

    window.submitRejection = function() {
        // Mesmo processo para rejeição
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = 'action';
        hiddenInput.value = 'reject';
        form.appendChild(hiddenInput);
        form.requestSubmit();
    };
    
    // Preview de Imagem no Upload (Aba Design)
    const artInput = document.querySelector('input[name="final_art"]');
    if(artInput) {
        artInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if(file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('previewArtImg');
                    if(preview) {
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                    }
                    const noArt = document.getElementById('noArtText');
                    if(noArt) noArt.style.display = 'none';
                }
                reader.readAsDataURL(file);
            }
        });
    }

    // Canvas de Desenho (Lógica de Rabisco)
    let canvas, ctx, isDrawing = false;
    window.enableDrawingMode = function() {
        const img = document.getElementById('designImage');
        canvas = document.getElementById('feedbackCanvas');
        
        if(!img || !img.src || !canvas) return;

        canvas.width = img.clientWidth;
        canvas.height = img.clientHeight;
        canvas.style.pointerEvents = 'auto';
        
        ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#dc3545';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        canvas.onmousedown = (e) => { isDrawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); };
        canvas.onmousemove = (e) => { if(isDrawing) { ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); } };
        canvas.onmouseup = () => { isDrawing = false; saveCanvas(); };
    };

    function saveCanvas() {
        let hiddenInput = document.querySelector('input[name="feedback_image_annotation"]');
        if(!hiddenInput) {
            hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = 'feedback_image_annotation';
            form.appendChild(hiddenInput);
        }
        hiddenInput.value = canvas.toDataURL();
    }

});