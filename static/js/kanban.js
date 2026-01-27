/* static/js/kanban.js */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Kanban JS iniciado'); 

    // 1. Inicializa o Quadro
    if (window.KANBAN_INITIAL_DATA) {
        renderBoard(window.KANBAN_INITIAL_DATA);
    } else {
        console.error('Dados iniciais (KANBAN_INITIAL_DATA) não encontrados.');
    }

    // 2. Configura Eventos Globais
    setupGlobalEventListeners();

    // 3. Inicializa Drag and Drop
    setupDragAndDrop();

    // 4. Ativa ícones Feather
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
});

/**
 * Renderiza todas as colunas e cards
 */
function renderBoard(data) {
    document.querySelectorAll('.column-cards').forEach(el => el.innerHTML = '');

    let allTasks = [];

    if (Array.isArray(data)) {
        allTasks = data;
    } else if (typeof data === 'object' && data !== null) {
        Object.values(data).forEach(columnTasks => {
            if (Array.isArray(columnTasks)) {
                allTasks = allTasks.concat(columnTasks);
            }
        });
    }

    allTasks.forEach(task => {
        const column = document.getElementById(`column-${task.status}`);
        if (column) {
            const container = column.querySelector('.column-cards');
            
            const safeTask = {
                ...task,
                priority: task.priority || 'low',
                id: task.id
            };

            const cardHTML = createCardHTML(safeTask);
            container.insertAdjacentHTML('beforeend', cardHTML);
        }
    });

    updateTaskCounts();
    if (typeof feather !== 'undefined') feather.replace();
}

/**
 * GERA O HTML DO CARD
 */
/**
 * GERA O HTML DO CARD
 */
function createCardHTML(task) {
    let priorityClass = 'priority-low';
    let priorityLabel = 'Baixa';

    // 1. Lógica de Cores da Prioridade
    if (task.priority === 'high') {
        priorityClass = 'priority-high';
        priorityLabel = 'Alta';
    } else if (task.priority === 'medium') {
        priorityClass = 'priority-medium';
        priorityLabel = 'Média';
    } 
    
    // 2. Lógica das Tags (Corrigida para evitar redeclaração)
    let tagsHTML = ''; 
    let tagsList = [];

    // Verifica se veio como array ou string e converte
    if (Array.isArray(task.tags)) {
        tagsList = task.tags;
    } else if (typeof task.tags === 'string' && task.tags.trim() !== '') {
        tagsList = task.tags.split(',');
    }

    // Gera o HTML das tags
    if (tagsList.length > 0) {
        tagsList.forEach(tag => {
            const cleanTag = tag.trim();
            if(cleanTag) {
                tagsHTML += `<span class="context-tag">${cleanTag}</span>`;
            }
        });
    }

    // 3. Lógica das Iniciais do Usuário
    let userInitials = '--';
    if (task.assigned_to_initials) {
        userInitials = task.assigned_to_initials;
    } else if (task.assigned_to_username) {
        userInitials = task.assigned_to_username.substring(0, 2).toUpperCase();
    }

    let avatarsHTML = '';
    
    if (task.assignees && task.assignees.length > 0) {
        // Cria uma bolinha para cada responsável
        task.assignees.forEach((user, index) => {
            // Um pequeno ajuste de margem negativa para sobrepor (efeito visual legal)
            
            avatarsHTML += `
                <div class="card-assignee-avatar" title="${user.full_name}">
                    ${user.initials}
                </div>
            `;
        });
    } else {
        // Se não tiver ninguém
        avatarsHTML = '<div class="card-assignee-avatar" style="background:#eee; color:#ccc;">--</div>';
    }

    // 4. Retorno do HTML
    return `
    <div class="kanban-card" draggable="true" data-id="${task.id}" data-priority="${task.priority}">
        <div class="card-header">
            <span class="priority-pill ${priorityClass}">
                <i data-feather="flag" style="width: 12px; height: 12px;"></i> ${priorityLabel}
            </span>
            
            <div class="card-actions" style="position: absolute; top: 15px; right: 15px;">
                <button type="button" id="btn-delete-task" class="btn-delete-task" data-id="${task.id}" title="Excluir">
                    <i data-feather="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
            </div>
        </div>

        <h4 class="kanban-card-title">${task.title}</h4>
        
        <div class="card-footer">
            <div class="tags-container-wrapper">
                ${tagsHTML}
                ${task.deadline ? `<span class="task-date"><i data-feather="calendar" style="width:10px;"></i> ${task.deadline}</span>` : ''}
            </div>

            <div style="display:flex; align-items:center;">
                ${avatarsHTML}
            </div>
        </div>
    </div>
    `;
}
/**
 * Event Listeners Globais
 */
function setupGlobalEventListeners() {
    const board = document.querySelector('.kanban-board');

    // A. Cliques no Board
    if (board) {
        board.addEventListener('click', function(e) {
            // 1. Botão Excluir (Dentro do Card)
            const deleteBtn = e.target.closest('.btn-delete-task');
            if (deleteBtn) {
                e.stopPropagation(); 
                const taskId = deleteBtn.dataset.id;
                confirmDeleteTask(taskId);
                return;
            }

            // 2. Clique no Card -> ABRE EDIÇÃO (Mudança aqui!)
            const card = e.target.closest('.kanban-card');
            if (card) {
                const taskId = card.dataset.id;
                openEditModal(taskId); // Chama a nova função de edição
            }
        });
    }

    // B. Botão "Nova Tarefa" (Abre Modal Limpo)
    const addTaskBtn = document.getElementById('add-task-btn');
    if(addTaskBtn) {
        const newBtn = addTaskBtn.cloneNode(true);
        addTaskBtn.parentNode.replaceChild(newBtn, addTaskBtn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Reseta para o estado "Novo"
            const form = document.getElementById('add-task-form');
            if(form) form.reset();
            
            document.getElementById('task-id').value = ""; // Limpa ID
            
            const titleEl = document.getElementById('modal-title');
            if(titleEl) titleEl.innerText = "Nova Tarefa";

            const modal = document.getElementById('add-task-modal');
            if(modal) modal.style.display = 'flex';
            
            form.reset();
            document.querySelectorAll('.assignee-option').forEach(el => el.classList.remove('selected'));
        });
    }

    // C. Form "Salvar/Editar Tarefa"
    const addForm = document.getElementById('add-task-form');
    if(addForm) {
        const newForm = addForm.cloneNode(true);
        addForm.parentNode.replaceChild(newForm, addForm);
        newForm.addEventListener('submit', handleAddTaskSubmit);
    }

    // D. Fechar Modais
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.dataset.modalId;
            const modal = document.getElementById(modalId) || e.target.closest('.modal');
            if(modal) modal.style.display = 'none';
        });
    });

    // E. Fechar clicando fora
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
        }
    }
}

/**
 * ABRE O MODAL EM MODO DE EDIÇÃO
 */
function openEditModal(taskId) {
    const modal = document.getElementById('add-task-modal');
    const form = document.getElementById('add-task-form');
    const modalTitle = document.getElementById('modal-title');

    // 1. Limpa o formulário e reseta visuais para evitar dados antigos
    form.reset();
    document.querySelectorAll('.assignee-option').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('input[name="tags"]').forEach(cb => cb.checked = false);
    
    // 2. Define o ID no input hidden e muda o título
    document.getElementById('task-id').value = taskId;
    if(modalTitle) modalTitle.innerText = "Editar Tarefa";

    // 3. Busca os dados atuais da tarefa
    // Usa a variável global dinâmica definida no HTML
    const url = window.GET_TASK_DETAILS_URL_BASE + taskId + '/';

    fetch(url)
        .then(res => res.json())
        .then(task => {
            // --- A. CAMPOS DE TEXTO ---
            if(document.getElementById('task-title')) {
                document.getElementById('task-title').value = task.title;
            }
            if(document.getElementById('task-description')) {
                document.getElementById('task-description').value = task.description || '';
            }

            // --- B. PRIORIDADE (RADIO BUTTONS) ---
            if(task.priority) {
                const radio = form.querySelector(`input[name="priority"][value="${task.priority}"]`);
                if(radio) radio.checked = true;
            }

            // --- C. DATA DE ENTREGA (DATE INPUT) ---
            const dateInput = document.getElementById('task-deadline');
            if (dateInput && task.deadline) {
                // O input date exige formato YYYY-MM-DD
                // O Django geralmente manda DD/MM/YYYY no to_dict
                if (task.deadline.includes('/')) {
                    const [dia, mes, ano] = task.deadline.split('/');
                    dateInput.value = `${ano}-${mes}-${dia}`;
                } else {
                    dateInput.value = task.deadline;
                }
            }

            // --- D. TAGS (CHECKBOXES) ---
            if (task.tags && Array.isArray(task.tags)) {
                task.tags.forEach(tagValue => {
                    // Procura o checkbox com esse value e marca
                    // Usamos CSS selector com aspas para garantir que values com espaço funcionem
                    const checkbox = document.querySelector(`input[name="tags"][value="${tagValue}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }

            // --- E. RESPONSÁVEIS (VISUAL GRID + SELECT HIDDEN) ---
            const selectAssignee = document.getElementById('task-assigned-to');
            
            // E1. Limpa o select hidden
            if (selectAssignee) {
                Array.from(selectAssignee.options).forEach(opt => opt.selected = false);
            }

            // E2. Marca os que vieram do banco
            if (task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0) {
                task.assignees.forEach(user => {
                    // 1. Marca no Select Escondido (para o envio do form funcionar)
                    if (selectAssignee) {
                        const option = Array.from(selectAssignee.options).find(opt => opt.value == user.id);
                        if (option) option.selected = true;
                    }

                    // 2. Marca no Grid Visual (para o usuário ver)
                    // Busca pelo atributo onclick que contém o ID do usuário
                    const visualItem = document.querySelector(`.assignee-option[onclick*="'${user.id}'"]`);
                    if (visualItem) {
                        visualItem.classList.add('selected');
                    }
                });
            }

            // 4. Finalmente, exibe o modal
            modal.style.display = 'flex';
        })
        .catch(err => {
            console.error("Erro ao carregar tarefa para edição:", err);
            
            // Tratamento de erro amigável
            if (err.message && err.message.includes('<!DOCTYPE html>')) {
                 alert("Erro de conexão ou servidor (404/500). Verifique o console.");
            } else {
                 alert("Não foi possível carregar os dados da tarefa.");
            }
        });
}

/**
 * SUBMIT DO FORMULÁRIO (CRIA OU EDITA)
 */
function handleAddTaskSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const taskId = document.getElementById('task-id').value; // Verifica se tem ID

    // Feedback visual
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Salvando...';
    submitBtn.disabled = true;

    const formData = new FormData(form);

    // DECIDE A URL
    let url = window.ADD_TASK_API_URL;
    
    if (taskId) {
        // --- CORREÇÃO DA URL DE EDIÇÃO ---
        // Usa a variável global vinda do Django + ID + Barra final
        url = window.EDIT_TASK_URL_BASE + taskId + '/'; 
    }

    console.log("Enviando para URL:", url); // Debug: Veja no console se a URL está certa

    fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
            'X-CSRFToken': window.CSRF_TOKEN
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => { throw new Error(text); });
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'success') {
            document.getElementById('add-task-modal').style.display = 'none';
            window.location.reload(); 
        } else {
            alert('Erro: ' + (data.message || JSON.stringify(data.errors)));
        }
    })
    .catch(error => {
        console.error('ERRO:', error);
        
        // Melhora a mensagem de erro para o usuário
        if (error.message.includes('<!DOCTYPE html>')) {
             if (error.message.includes('Page not found')) {
                 alert('Erro 404: A URL de edição está incorreta. Verifique o console.');
             } else {
                 alert('Erro 500: Erro interno no servidor.');
             }
        } else {
             alert('Erro ao salvar: ' + error.message);
        }
    })
    .finally(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    });
}

/**
 * Lógica de Drag and Drop
 */
function setupDragAndDrop() {
    const columns = document.querySelectorAll('.kanban-column');

    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('kanban-card')) {
            e.target.classList.add('dragging');
            e.dataTransfer.setData('text/plain', e.target.dataset.id);
        }
    });

    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('kanban-card')) {
            e.target.classList.remove('dragging');
        }
    });

    columns.forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            const afterElement = getDragAfterElement(column.querySelector('.column-cards'), e.clientY);
            const draggable = document.querySelector('.dragging');
            const container = column.querySelector('.column-cards');
            
            if (draggable) {
                if (afterElement == null) {
                    container.appendChild(draggable);
                } else {
                    container.insertBefore(draggable, afterElement);
                }
            }
        });

        column.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggable = document.querySelector('.dragging');
            if (!draggable) return;

            const newStatus = column.dataset.status;
            const taskId = draggable.dataset.id;
            
            updateTaskStatus(taskId, newStatus);
            updateTaskCounts();
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Atualiza status (Backend)
 */
function updateTaskStatus(taskId, newStatus) {
    const url = window.KANBAN_UPDATE_URL;
    const csrf = window.CSRF_TOKEN;

    if (!url) { console.error("URL de update não definida"); return; }

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf
        },
        body: JSON.stringify({
            task_id: taskId,
            status: newStatus
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status !== 'success') {
            alert('Erro ao mover tarefa. Recarregue a página.');
        }
    })
    .catch(error => console.error('Erro de rede:', error));
}

/**
 * Excluir Tarefa
 */
function confirmDeleteTask(taskId) {
    if(confirm('Tem certeza que deseja excluir esta tarefa permanentemente?')) {
        const url = window.DELETE_TASK_URL_BASE + taskId + '/';

        fetch(url, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': window.CSRF_TOKEN,
                'Content-Type': 'application/json'
            }
        })
        .then(res => {
            if(res.ok) {
                const card = document.querySelector(`.kanban-card[data-id="${taskId}"]`);
                if(card) card.remove();
                updateTaskCounts();
            } else {
                alert('Erro ao excluir tarefa.');
            }
        })
        .catch(err => console.error(err));
    }
}

function updateTaskCounts() {
    document.querySelectorAll('.kanban-column').forEach(col => {
        const count = col.querySelectorAll('.kanban-card').length;
        const badge = col.querySelector('.task-count');
        if(badge) badge.textContent = count;
    });
}

function toggleAssigneeVisual(userId, element) {
    // 1. Alterna classe visual
    element.classList.toggle('selected');
    
    // 2. Sincroniza com o Select Escondido
    const select = document.getElementById('task-assigned-to');
    const option = Array.from(select.options).find(opt => opt.value == userId);
    
    if (option) {
        option.selected = !option.selected; // Inverte o estado
    }
}