// static/js/approval.js

let canvas = null;
let isDrawingInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
    // Inicialização básica
});

// --- FUNÇÕES DE AÇÃO GERAL ---

async function sendAction(action, feedback = null, imageData = null) {
    try {
        Swal.fire({ title: 'Enviando...', didOpen: () => Swal.showLoading() });

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                token: TOKEN,
                action: action,
                feedback: feedback,
                image_data: imageData
            })
        });

        const result = await response.json();

        if (response.ok) {
            Swal.fire('Sucesso!', result.message, 'success').then(() => {
                location.reload(); // Recarrega para mostrar status atualizado
            });
        } else {
            Swal.fire('Erro', result.message, 'error');
        }
    } catch (error) {
        console.error(error);
        Swal.fire('Erro', 'Falha na comunicação.', 'error');
    }
}

// --- FLUXO DE REPROVAÇÃO DE COPY ---

function startRejectCopy() {
    Swal.fire({
        title: 'O que precisa mudar no texto?',
        input: 'textarea',
        inputPlaceholder: 'Digite suas correções aqui...',
        showCancelButton: true,
        confirmButtonText: 'Enviar Correção',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            sendAction('reject_copy', result.value);
        }
    });
}

// --- FLUXO DE REPROVAÇÃO DE DESIGN (CANVAS) ---

function startRejectDesign() {
    // Esconde ações normais, mostra ferramentas de desenho
    document.getElementById('main-actions').style.display = 'none';
    document.getElementById('drawing-tools').style.display = 'block';
    
    // Esconde a imagem estática e inicializa o canvas se ainda não foi
    document.getElementById('original-image').style.display = 'none';
    
    if (!isDrawingInitialized) {
        initCanvas();
    }
}

function cancelDrawing() {
    document.getElementById('main-actions').style.display = 'block';
    document.getElementById('drawing-tools').style.display = 'none';
    document.getElementById('original-image').style.display = 'block';
    // O canvas fica escondido atrás ou limpamos, mas a instância fica
}

function initCanvas() {
    // Cria o canvas Fabric sobre o elemento <canvas>
    canvas = new fabric.Canvas('drawing-canvas', {
        isDrawingMode: true
    });

    // Configura o pincel
    canvas.freeDrawingBrush.width = 5;
    canvas.freeDrawingBrush.color = "red";

    // Carrega a imagem do post como fundo
    fabric.Image.fromURL(IMAGE_URL, function(img) {
        // Redimensiona a imagem para caber no container (375px largura padrão do mockup)
        const scale = 375 / img.width;
        
        canvas.setWidth(375);
        canvas.setHeight(img.height * scale);
        
        img.scale(scale);
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
        
        // Ajusta o tamanho do container do canvas no DOM
        const canvasEl = document.querySelector('.canvas-container');
        if(canvasEl) {
            canvasEl.style.width = '375px';
            canvasEl.style.height = (img.height * scale) + 'px';
        }
    }, { crossOrigin: 'anonymous' }); // Importante para evitar erro de segurança (CORS)

    isDrawingInitialized = true;
}

function setBrushColor(color) {
    if(canvas) {
        canvas.freeDrawingBrush.color = color;
        // Atualiza UI
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        event.target.classList.add('active');
    }
}

function saveDesignRejection() {
    const feedbackText = document.getElementById('design-feedback-text').value;
    
    if (!feedbackText) {
        Swal.fire('Atenção', 'Por favor, descreva também o que precisa ser mudado.', 'warning');
        return;
    }

    // Exporta o canvas para Base64 (Imagem)
    // O multiplicador garante boa resolução
    const dataURL = canvas.toDataURL({ format: 'png', multiplier: 2 });

    sendAction('reject_design', feedbackText, dataURL);
}