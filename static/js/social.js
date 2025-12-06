// static/js/social.js

document.addEventListener('DOMContentLoaded', () => {
    
    // Inicializa ícones
    if (typeof feather !== 'undefined') feather.replace();

    // ELEMENTOS
    const captionInput = document.getElementById('input-caption');
    const mediaInput = document.getElementById('input-media');
    const clientSelect = document.getElementById('post-client');
    const tabsContainer = document.getElementById('preview-tabs-container');
    const accountCheckboxes = document.querySelectorAll('input[name="accounts"]');
    
    // MAPA DE MOCKUPS (Qual mockup usar para qual rede)
    const MOCKUP_MAP = {
        'facebook': 'mockup-feed',
        'instagram': 'mockup-feed',
        'linkedin': 'mockup-linkedin',
        'threads': 'mockup-feed',
        'twitter': 'mockup-feed', // ou criar mockup específico
        'youtube': 'mockup-youtube',
        'tiktok': 'mockup-vertical',
        'pinterest': 'mockup-feed'
    };

    // --- 1. PREVIEW EM TEMPO REAL ---

    function updatePreviewText() {
        const text = captionInput.value || "Sua legenda aparecerá aqui...";
        document.querySelectorAll('.caption-text').forEach(el => el.innerText = text);
    }

    function updatePreviewMedia() {
        const file = mediaInput.files[0];
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');

            // Atualiza TODAS as tags de imagem/vídeo em TODOS os mockups
            if (isImage) {
                document.querySelectorAll('.preview-video').forEach(el => el.style.display = 'none');
                document.querySelectorAll('.placeholder-media').forEach(el => el.style.display = 'none');
                document.querySelectorAll('.preview-img').forEach(el => {
                    el.src = objectUrl;
                    el.style.display = 'block';
                });
            } else if (isVideo) {
                document.querySelectorAll('.preview-img').forEach(el => el.style.display = 'none');
                document.querySelectorAll('.placeholder-media').forEach(el => el.style.display = 'none');
                document.querySelectorAll('.preview-video').forEach(el => {
                    el.src = objectUrl;
                    el.style.display = 'block';
                });
            }
        }
    }

    function updateClientInfo() {
        if (clientSelect.selectedIndex > 0) {
            const opt = clientSelect.options[clientSelect.selectedIndex];
            const name = opt.text;
            const logo = opt.dataset.logo || "https://ui-avatars.com/api/?name=" + name + "&background=random";
            
            document.querySelectorAll('.client-name').forEach(el => el.innerText = name);
            document.querySelectorAll('.client-avatar').forEach(el => el.src = logo);
        }
    }

    // LISTENERS DE INPUT
    if(captionInput) captionInput.addEventListener('input', updatePreviewText);
    if(mediaInput) mediaInput.addEventListener('change', updatePreviewMedia);
    if(clientSelect) clientSelect.addEventListener('change', updateClientInfo);


    // --- 2. LÓGICA DE ABAS ---

    function hideAllMockups() {
        document.querySelectorAll('.device-mockup').forEach(el => el.classList.remove('active'));
    }

    function activateMockup(platform) {
        // Remove active das abas
        document.querySelectorAll('.preview-tab').forEach(tab => tab.classList.remove('active'));
        
        // Ativa a aba visualmente (procura pelo texto ou data attribute - simplificado aqui)
        // Em produção, adicionar data-platform no span da aba ajudaria
        
        hideAllMockups();
        
        let mockupId = MOCKUP_MAP[platform] || 'mockup-feed';
        const mockup = document.getElementById(mockupId);
        if(mockup) mockup.classList.add('active');
    }

    function updateTabs() {
        tabsContainer.innerHTML = '';
        let hasSelection = false;

        accountCheckboxes.forEach(cb => {
            if (cb.checked) {
                hasSelection = true;
                const platform = cb.dataset.platform;
                
                const tab = document.createElement('span');
                tab.className = 'preview-tab';
                tab.innerText = platform.charAt(0).toUpperCase() + platform.slice(1);
                
                tab.addEventListener('click', function() {
                    document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    activateMockup(platform);
                });

                tabsContainer.appendChild(tab);
            }
        });

        if (!hasSelection) {
            tabsContainer.innerHTML = '<span style="color:#aaa;">Selecione os canais à esquerda.</span>';
            hideAllMockups();
        } else {
            // Ativa a primeira aba automaticamente
            const firstTab = tabsContainer.querySelector('.preview-tab');
            if(firstTab) firstTab.click();
        }
    }

    // Listener nos checkboxes
    accountCheckboxes.forEach(cb => cb.addEventListener('change', updateTabs));


    // --- 3. ENVIO DO FORMULÁRIO (AJAX) ---
    const form = document.getElementById('create-post-form');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const btn = this.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.innerText = "Salvando...";
            btn.disabled = true;

            const formData = new FormData(this);

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'X-CSRFToken': CSRF_TOKEN },
                    body: formData
                });
                
                const result = await response.json();

                if (response.ok) {
                    if (typeof Swal !== 'undefined') {
                        Swal.fire('Sucesso!', 'Post criado e enviado para o Kanban!', 'success').then(() => {
                            window.location.href = KANBAN_URL;
                        });
                    } else {
                        alert("Sucesso!");
                        window.location.href = KANBAN_URL;
                    }
                } else {
                    alert('Erro: ' + result.message);
                }
            } catch (error) {
                console.error(error);
                alert('Erro de rede.');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
});