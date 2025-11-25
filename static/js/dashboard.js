// static/js/dashboard.js

document.addEventListener('DOMContentLoaded', function() {
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
});