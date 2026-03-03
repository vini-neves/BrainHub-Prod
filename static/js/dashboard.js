document.addEventListener('DOMContentLoaded', function () {
    // ==========================================
    // 1. Saudação Dinâmica
    // ==========================================
    const greetingElement = document.getElementById('dynamic-greeting');
    if (greetingElement) {
        const hour = new Date().getHours();
        let greeting;

        if (hour < 12) {
            greeting = 'Bom dia';
        } else if (hour < 18) {
            greeting = 'Boa tarde';
        } else {
            greeting = 'Boa noite';
        }

        // Pega o nome do usuário que foi injetado no HTML
        const username = greetingElement.dataset.username || 'Membro';

        // Define a saudação dinâmica
        greetingElement.textContent = `${greeting}, ${username}!`;
    }

    // ==========================================
    // 2. Integração de Dados do Django -> JS
    // ==========================================
    let statusData = [0, 0, 0, 0]; // Valores padrão de segurança
    const donutDataElement = document.getElementById('donutData');
    
    // Se o Django injetou os dados corretamente, nós os lemos aqui
    if (donutDataElement) {
        statusData = JSON.parse(donutDataElement.textContent);
    }

    // ==========================================
    // 3. Gráfico de Linha (Alcance vs Engajamento)
    // ==========================================
    const ctxLine = document.getElementById('lineChart');
    if (ctxLine) {
        new Chart(ctxLine.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
                datasets: [{
                    label: 'Alcance',
                    data: [30, 38, 40, 38, 48, 52, 55, 60, 58, 65, 75, 80],
                    borderColor: '#4e73df',
                    backgroundColor: 'rgba(78, 115, 223, 0.05)',
                    tension: 0.4,
                    borderWidth: 3,
                    fill: true
                }, {
                    label: 'Engajamento',
                    data: [5, 6, 8, 7, 9, 10, 11, 10, 12, 13, 14, 15],
                    borderColor: '#36b9cc',
                    borderWidth: 2,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    y: { beginAtZero: true, grid: { borderDash: [2, 2] } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // ==========================================
    // 4. Gráfico de Rosca (Status dos Posts)
    // ==========================================
    const ctxDonut = document.getElementById('donutChart');
    if (ctxDonut) {
        new Chart(ctxDonut.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Publicados', 'Aprovados', 'Em Revisão', 'Reprovados'],
                datasets: [{
                    data: statusData, // <--- Aqui o JS usa a lista enviada pelo banco!
                    backgroundColor: ['#1cc88a', '#4e73df', '#f6c23e', '#e74a3b'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', // Espessura da rosca
                plugins: { legend: { display: false } } // Escondemos a legenda padrão para usar a do HTML
            }
        });
    }

    // ==========================================
    // 5. Sparklines (Mini gráficos nos cards)
    // ==========================================
    const sparkOptions = { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { legend: { display: false }, tooltip: { enabled: false } }, 
        scales: { x: { display: false }, y: { display: false } }, 
        elements: { point: { radius: 0 } } 
    };

    const spark1 = document.getElementById('spark1');
    if (spark1) {
        new Chart(spark1.getContext('2d'), {
            type: 'line', data: { labels: [1, 2, 3, 4, 5, 6], datasets: [{ data: [10, 15, 12, 20, 18, 25], borderColor: '#4e73df', tension: 0.4, borderWidth: 2 }] }, options: sparkOptions
        });
    }

    const spark2 = document.getElementById('spark2');
    if (spark2) {
        new Chart(spark2.getContext('2d'), {
            type: 'line', data: { labels: [1, 2, 3, 4, 5, 6], datasets: [{ data: [5, 8, 6, 10, 9, 15], borderColor: '#4e73df', tension: 0.4, borderWidth: 2 }] }, options: sparkOptions
        });
    }

});