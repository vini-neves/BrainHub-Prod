// static/js/dashboard.js

document.addEventListener('DOMContentLoaded', function () {
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
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    new Chart(ctxLine, {
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

    // 2. Gráfico de Rosca (Status)
    const ctxDonut = document.getElementById('donutChart').getContext('2d');
    new Chart(ctxDonut, {
        type: 'doughnut',
        data: {
            labels: ['Publicados', 'Aprovados', 'Em Revisão', 'Reprovados'],
            datasets: [{
                data: [57, 25, 7, 11],
                backgroundColor: ['#1cc88a', '#4e73df', '#f6c23e', '#e74a3b'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%', // Espessura da rosca
            plugins: { legend: { display: false } } // Escondemos a legenda padrão para usar a HTML
        }
    });

    // 3. Sparklines (Mini gráficos top)
    const sparkOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, elements: { point: { radius: 0 } } };

    new Chart(document.getElementById('spark1').getContext('2d'), {
        type: 'line', data: { labels: [1, 2, 3, 4, 5, 6], datasets: [{ data: [10, 15, 12, 20, 18, 25], borderColor: '#4e73df', tension: 0.4, borderWidth: 2 }] }, options: sparkOptions
    });
    new Chart(document.getElementById('spark2').getContext('2d'), {
        type: 'line', data: { labels: [1, 2, 3, 4, 5, 6], datasets: [{ data: [5, 8, 6, 10, 9, 15], borderColor: '#4e73df', tension: 0.4, borderWidth: 2 }] }, options: sparkOptions
    });

});