document.addEventListener('DOMContentLoaded', function() {
    // 1. CONFIGURAÇÃO DO CLIENTE E ESTILO DE IMAGEM GLOBAL
    const clientName = window.CLIENT_NAME_FROM_DJANGO || "Cliente";
    let currentObjectFit = 'cover'; 

    document.querySelectorAll('.client-name-slot').forEach(slot => {
        slot.textContent = clientName;
    });

    // 2. TROCA DE PLATAFORMA (E INICIALIZAÇÃO)
    const platformRadios = document.querySelectorAll('input[name="platform"]');
    const platformLayouts = document.querySelectorAll('.platform-layout');
    const previewLabelName = document.getElementById('preview-platform-name');

    function activatePlatform(selectedPlatform) {
        platformLayouts.forEach(layout => layout.classList.remove('active'));
        const targetLayout = document.querySelector(`.layout-${selectedPlatform}`);
        if (targetLayout) targetLayout.classList.add('active');
        if(previewLabelName) {
            previewLabelName.textContent = selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1);
        }
    }

    platformRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            activatePlatform(this.getAttribute('data-platform'));
        });
    });

    // Ativa a primeira plataforma ao carregar a página
    if(platformRadios.length > 0) {
        platformRadios[0].checked = true;
        activatePlatform(platformRadios[0].getAttribute('data-platform'));
    }

    // 3. SINCRONIZAÇÃO DA LEGENDA (COM TRAVA DE SEGURANÇA)
    const captionInput = document.getElementById('caption-input');
    const charCounter = document.getElementById('char-counter');
    const captionSlots = document.querySelectorAll('.caption-slot');

    function updateCaptionPreview(text) {
        if(charCounter) charCounter.textContent = `${text.length}/2200`;
        captionSlots.forEach(slot => {
            if (text.trim() === "") {
                slot.textContent = "Sua legenda...";
                slot.style.color = "#9ca3af";
            } else {
                slot.textContent = text;
                slot.style.color = ""; 
            }
        });
    }

    // A trava de segurança contra o erro "null"
    if (captionInput) {
        captionInput.addEventListener('input', (e) => updateCaptionPreview(e.target.value));
    }

    // 4. CONTROLE DE AJUSTE DE IMAGEM (FIT)
    const fitBtns = document.querySelectorAll('.fit-btn');
    fitBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            fitBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentObjectFit = this.getAttribute('data-fit');
            applyObjectFitToAllMedia();
        });
    });

    function applyObjectFitToAllMedia() {
        document.querySelectorAll('.mockup-carousel-item img, .mockup-carousel-item video').forEach(media => {
            media.style.objectFit = currentObjectFit;
            media.style.backgroundColor = currentObjectFit === 'contain' ? '#111827' : 'transparent';
        });
    }

    // 5. UPLOAD DE MÍDIA E DRAG & DROP 
    let selectedFiles = [];
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const emptyState = document.getElementById('dropzone-empty-state');
    const thumbnailsGrid = document.getElementById('thumbnails-grid');

    if(dropZone && fileInput) {
        dropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'LABEL' && !e.target.closest('.media-thumbnail') && !e.target.closest('.btn-remove-media')) {
                 fileInput.click();
            }
        });

        fileInput.addEventListener('change', (e) => {
            const newFiles = Array.from(e.target.files);
            if (newFiles.length > 0) {
                if(emptyState) emptyState.style.display = 'none';
                if(thumbnailsGrid) thumbnailsGrid.style.display = 'flex';
                document.getElementById('image-fit-controls').style.display = 'flex'; 
                
                newFiles.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        selectedFiles.push({
                            id: Date.now() + Math.random(),
                            file: file,
                            url: ev.target.result,
                            type: file.type.startsWith('video/') ? 'video' : 'image'
                        });
                        renderThumbnails();
                        renderMockup();
                    };
                    reader.readAsDataURL(file);
                });
            }
            fileInput.value = ''; 
        });
    }

    function renderThumbnails() {
        if(!thumbnailsGrid) return;
        const items = thumbnailsGrid.querySelectorAll('.media-thumbnail');
        items.forEach(i => i.remove());
        const addBtn = thumbnailsGrid.querySelector('.btn-add-more-media');

        selectedFiles.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'media-thumbnail';
            div.draggable = true;
            div.dataset.index = index;
            
            let content = item.type === 'video' 
                ? `<video src="${item.url}" style="width:100%; height:100%; object-fit:cover;"></video>` 
                : `<img src="${item.url}" alt="thumb" style="width:100%; height:100%; object-fit:cover;">`;

            div.innerHTML = `
                ${content}
                <div class="drag-handle-overlay"><i class="fa-solid fa-arrows-up-down-left-right"></i></div>
                <div class="btn-remove-media" onclick="removeFile(${index})"><i class="fa-solid fa-xmark"></i></div>
            `;

            div.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.target.closest('.media-thumbnail').classList.add('dragging');
            });

            div.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingItem = document.querySelector('.dragging');
                const currentItem = e.target.closest('.media-thumbnail');
                if(currentItem && currentItem !== draggingItem) {
                    currentItem.classList.add('drag-over');
                }
            });

            div.addEventListener('dragleave', (e) => {
                const currentItem = e.target.closest('.media-thumbnail');
                if(currentItem) currentItem.classList.remove('drag-over');
            });

            div.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggingItem = document.querySelector('.dragging');
                const currentItem = e.target.closest('.media-thumbnail');
                
                if(draggingItem && currentItem && draggingItem !== currentItem) {
                    currentItem.classList.remove('drag-over');
                    const fromIndex = +draggingItem.dataset.index;
                    const toIndex = +currentItem.dataset.index;
                    
                    const itemToMove = selectedFiles[fromIndex];
                    selectedFiles.splice(fromIndex, 1);
                    selectedFiles.splice(toIndex, 0, itemToMove);
                    
                    renderThumbnails();
                    renderMockup();
                }
            });

            div.addEventListener('dragend', (e) => {
                e.target.closest('.media-thumbnail').classList.remove('dragging');
                document.querySelectorAll('.media-thumbnail').forEach(el => el.classList.remove('drag-over'));
            });

            if(addBtn) thumbnailsGrid.insertBefore(div, addBtn);
        });

        if (selectedFiles.length === 0) {
            if(emptyState) emptyState.style.display = 'flex';
            thumbnailsGrid.style.display = 'none';
            document.getElementById('image-fit-controls').style.display = 'none';
        }
    }

    window.removeFile = function(index) {
        selectedFiles.splice(index, 1);
        renderThumbnails();
        renderMockup();
    }

    function renderMockup() {
        document.querySelectorAll('.mock-media-container').forEach(container => {
            if (selectedFiles.length === 0) {
                container.style.display = 'flex';
                container.innerHTML = `<span class="mock-media-placeholder-text" style="color:#9ca3af">Sua mídia aqui</span>`;
                return;
            }

            container.style.display = 'block'; 
            let innerHTML = `<div class="mockup-carousel">`;

            selectedFiles.forEach(item => {
                innerHTML += `<div class="mockup-carousel-item">`;
                if (item.type === 'video') {
                    innerHTML += `<video src="${item.url}" controls playsinline style="width:100%; height:100%; object-fit:${currentObjectFit}; background-color:${currentObjectFit === 'contain' ? '#111827' : 'transparent'};"></video>`;
                } else {
                    innerHTML += `<img src="${item.url}" style="width:100%; height:100%; object-fit:${currentObjectFit}; background-color:${currentObjectFit === 'contain' ? '#111827' : 'transparent'};">`;
                }
                innerHTML += `</div>`;
            });
            innerHTML += `</div>`;

            if (selectedFiles.length > 1) {
                innerHTML += `<div class="carousel-counter-pill">1/${selectedFiles.length}</div>`;
                innerHTML += `<div class="carousel-indicators">`;
                selectedFiles.forEach((_, i) => innerHTML += `<div class="carousel-dot ${i===0 ? 'active' : ''}"></div>`);
                innerHTML += `</div>`;
            }

            container.innerHTML = innerHTML;

            if (selectedFiles.length > 1) {
                const track = container.querySelector('.mockup-carousel');
                const pill = container.querySelector('.carousel-counter-pill');
                const dots = container.querySelectorAll('.carousel-dot');

                if (track) {
                    track.addEventListener('scroll', () => {
                        const index = Math.round(track.scrollLeft / track.offsetWidth);
                        if (index >= 0 && index < selectedFiles.length) {
                            if(pill) pill.textContent = `${index + 1}/${selectedFiles.length}`;
                            dots.forEach(d => d.classList.remove('active'));
                            if (dots[index]) dots[index].classList.add('active');
                        }
                    });
                }
            }
        });
    }

    // 6. ENVIAR PARA A API (SALVAR POST)
    const form = document.getElementById('create-post-form');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if(selectedFiles.length === 0) {
                Swal.fire('Atenção', 'Adicione pelo menos uma imagem ou vídeo.', 'warning');
                return;
            }

            // Verifica se tem alguma rede social conectada para esse cliente
            const platforms = document.querySelectorAll('input[name="platform"]');
            if(platforms.length === 0) {
                 Swal.fire('Atenção', 'Este cliente não tem nenhuma rede social conectada.', 'warning');
                 return;
            }

            const btn = this.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Salvando...';
            btn.disabled = true;

            const formData = new FormData(this);
            
            selectedFiles.forEach((item) => {
                formData.append('media_files', item.file);
            });

            try {
                // Aqui você vai apontar para a sua URL real de salvar no Django
                const response = await fetch('/api/social/create_post/', { 
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                    }
                });
                
                const result = await response.json();

                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: 'Post agendado e enviado para o Kanban!'
                    }).then(() => {
                        window.location.href = window.DASHBOARD_URL;
                    });
                } else {
                    Swal.fire('Erro', result.message || 'Erro ao criar post.', 'error');
                }
            } catch (error) {
                Swal.fire('Erro', 'Rota de salvar post ainda não configurada.', 'info');
                console.log(error);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
});