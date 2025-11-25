// static/js/login.js

document.addEventListener('DOMContentLoaded', function() {
    
    const toggleButton = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('id_password');
    
    if (toggleButton && passwordInput) {
        toggleButton.addEventListener('click', function() {
            // Verifica o tipo do input (password ou text)
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Troca o ícone (simplesmente mudando a opacidade)
            this.style.opacity = (type === 'password') ? '0.6' : '1.0';
        });
        
        // Estilo inicial
        toggleButton.style.opacity = '0.6';
    }
});