// static/js/calendar.js

document.addEventListener('DOMContentLoaded', function() {
    
    // --- Seletores do DOM ---
    const calendarGrid = document.querySelector('.calendar-grid');
    const monthYearDisplay = document.getElementById('month-year-display');
    const prevMonthButton = document.getElementById('prev-month');
    const nextMonthButton = document.getElementById('next-month');
    const todayButton = document.getElementById('today-button');

    // --- Seletores do Modal ---
    const modalOverlay = document.getElementById('event-modal-overlay');
    const modalForm = document.getElementById('event-form');
    const modalTitleInput = document.getElementById('event-title');
    const modalDateInput = document.getElementById('event-date');
    const openModalButton = document.getElementById('add-event-button');
    const closeModalButton = document.getElementById('modal-close-button');
    const cancelModalButton = document.getElementById('modal-cancel-button');

    // --- Pegando URLs do Django ---
    const urls = JSON.parse(document.getElementById('django-urls').textContent);
    const CSRF_TOKEN = urls.csrfToken;

    // --- Estado do Calendário ---
    let currentDate = new Date();
    let events = []; // Guarda os eventos do mês

    /**
     * Busca eventos do servidor para o mês e ano
     */
    async function fetchEvents(year, month) {
        // month + 1 porque getMonth() é 0-11 e a API espera 1-12
        const response = await fetch(`${urls.getEvents}?year=${year}&month=${month + 1}`);
        if (!response.ok) {
            console.error("Falha ao buscar eventos");
            return [];
        }
        return await response.json();
    }

    /**
     * Renderiza o calendário (dias, eventos, etc.)
     */
    async function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // 1. Busca os eventos antes de desenhar
        try {
            events = await fetchEvents(year, month);
        } catch (e) {
            console.error("Erro ao buscar eventos:", e);
            events = [];
        }


        // 2. LIMPEZA ROBUSTA DO GRID
        // Remove todas as células de dia (.day-cell) da grade,
        // mas deixa os cabeçalhos (.day-header) intactos.
        const cellsToRemove = calendarGrid.querySelectorAll('.day-cell');
        cellsToRemove.forEach(cell => cell.remove());


        // 3. Define o texto do cabeçalho
        const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
        monthYearDisplay.textContent = `${monthName.toUpperCase()} ${year}`;

        // 4. Cálculos dos dias
        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = firstDayOfMonth.getDay(); // 0=Dom, 1=Seg, ...

        // 5. Cria as células de "preenchimento" (dias do mês anterior)
        for (let i = 0; i < firstDayOfWeek; i++) {
            calendarGrid.appendChild(createPaddingCell());
        }

        // 6. Cria as células dos dias do mês
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            
            // Filtra eventos para este dia específico
            const eventsForDay = events.filter(e => {
                const eventDate = new Date(e.date + 'T00:00:00'); // Garante data local
                return eventDate.toDateString() === date.toDateString();
            });

            const isToday = date.toDateString() === today.toDateString();
            
            calendarGrid.appendChild(createDayCell(day, isToday, eventsForDay));
        }
    }

    function createPaddingCell() {
        const paddingCell = document.createElement('div');
        paddingCell.classList.add('day-cell', 'padding');
        return paddingCell;
    }

    function createDayCell(day, isToday, eventsForDay) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('day-cell');
        
        if (isToday) {
            dayCell.classList.add('today');
        }
        
        const dayNumber = document.createElement('div');
        dayNumber.classList.add('day-number');
        dayNumber.textContent = day;
        dayCell.appendChild(dayNumber);

        eventsForDay.forEach(event => {
            const eventTag = document.createElement('div');
            eventTag.classList.add('event-tag');
            eventTag.textContent = event.title;
            dayCell.appendChild(eventTag);
        });

        return dayCell;
    }

    // --- Funções do Modal ---
    function showModal() {
        modalOverlay.style.display = 'flex';
        // Define a data do input para a data atual (hoje)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        modalDateInput.value = `${year}-${month}-${day}`;
    }

    function hideModal() {
        modalOverlay.style.display = 'none';
        modalForm.reset(); // Limpa o formulário
    }

    async function handleFormSubmit(e) {
        e.preventDefault(); 
        
        const title = modalTitleInput.value;
        const date = modalDateInput.value;

        if (!title || !date) {
            alert('Por favor, preencha o título e a data.');
            return;
        }

        try {
            const response = await fetch(urls.addEvent, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': CSRF_TOKEN
                },
                body: JSON.stringify({
                    title: title,
                    date: date
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao salvar o evento.');
            }

            hideModal();
            renderCalendar(); // Recarrega o calendário para mostrar o novo evento
            
        } catch (error) {
            console.error('Erro ao salvar evento:', error);
            alert('Não foi possível salvar o evento: ' + error.message);
        }
    }

    // --- Event Listeners (Controles) ---
    prevMonthButton.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthButton.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    todayButton.addEventListener('click', () => {
        currentDate = new Date();
        renderCalendar();
    });

    // --- Listeners do Modal ---
    openModalButton.addEventListener('click', showModal);
    closeModalButton.addEventListener('click', hideModal);
    cancelModalButton.addEventListener('click', hideModal);
    modalForm.addEventListener('submit', handleFormSubmit);

    // --- Inicialização ---
    renderCalendar();
});