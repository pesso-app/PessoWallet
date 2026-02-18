// ==================== CONFIGURACIÓN ====================
const DB_NAME = 'PessoDB';
const DB_VERSION = 4; // Incrementado para forzar actualización
const PRIMARY_COLOR = '#1C5CCF';

let db = null;
let envelopes = [];
let goals = [];
let currentPin = '';
let userName = 'Sixto';
let isLoggedIn = false;
let pendingWithdrawal = null;

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    try {
        applyTheme();
        
        // Inicializar DB primero
        await initDB();
        
        if (checkSession()) {
            console.log('Sesión activa, entrando directo...');
            showMainApp();
            await loadData();
            updateDate();
            populateSelects();
            renderSavingsCards();
            updateUserName();
            updateActivity();
            return;
        }
        
        await loadData();
        setupLogin();
        updateDate();
        
        setTimeout(() => {
            document.getElementById('loginScreen').classList.add('fade-in');
        }, 100);
        
    } catch (error) {
        console.error('Error inicializando app:', error);
    }
}

function applyTheme() {
    const isDarkMode = localStorage.getItem('pesso_dark_mode') === 'true';
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

function showMainApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    isLoggedIn = true;
}

function updateUserName() {
    const savedName = localStorage.getItem('pesso_user') || 'Sixto';
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
        userNameEl.textContent = `Welcome back, ${savedName}`;
    }
}

// ==================== SESIÓN ====================

function checkSession() {
    const session = localStorage.getItem('pesso_session');
    const lastActivity = parseInt(localStorage.getItem('pesso_last_activity') || '0');
    const fiveMinutes = 5 * 60 * 1000;
    
    if (!session) return false;
    if (Date.now() - lastActivity > fiveMinutes) {
        localStorage.removeItem('pesso_session');
        return false;
    }
    return true;
}

function updateActivity() {
    localStorage.setItem('pesso_last_activity', Date.now().toString());
}

function login() {
    localStorage.setItem('pesso_session', 'active');
    localStorage.setItem('pesso_login_time', Date.now().toString());
    localStorage.setItem('pesso_last_activity', Date.now().toString());
    isLoggedIn = true;
}

// ==================== BASE DE DATOS ====================

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('Error abriendo DB:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            db = request.result;
            console.log('DB abierta correctamente, version:', DB_VERSION);
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            console.log('Actualizando DB a versión:', event.newVersion);
            const db = event.target.result;
            
            // Crear object stores si no existen
            if (!db.objectStoreNames.contains('envelopes')) {
                console.log('Creando object store: envelopes');
                db.createObjectStore('envelopes', { keyPath: 'id' });
            }
            
            if (!db.objectStoreNames.contains('goals')) {
                console.log('Creando object store: goals');
                db.createObjectStore('goals', { keyPath: 'id' });
            }
            
            if (!db.objectStoreNames.contains('notifications')) {
                console.log('Creando object store: notifications');
                const notifStore = db.createObjectStore('notifications', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                notifStore.createIndex('date', 'date', { unique: false });
            }
        };
    });
}

async function loadData() {
    try {
        const savedEnvelopes = await getAllFromStore('envelopes');
        if (savedEnvelopes.length === 0) {
            envelopes = [
                { id: '1', name: 'Travels', icon: 'airplane', amount: 20, goal: null },
                { id: '2', name: 'Car', icon: 'car', amount: 20, goal: null },
                { id: '3', name: 'Vacation', icon: 'sunny', amount: 20, goal: null },
                { id: '4', name: 'House', icon: 'home', amount: 20, goal: null },
                { id: '5', name: 'Investments', icon: 'trending-up', amount: 20, goal: null },
                { id: '6', name: 'Emergencies', icon: 'medical', amount: 20, goal: null }
            ];
            for (let e of envelopes) await saveToStore('envelopes', e);
        } else {
            envelopes = savedEnvelopes;
        }
        
        const savedGoals = await getAllFromStore('goals');
        if (savedGoals.length === 0) {
            goals = [
                { id: '1', name: 'New Car', target: 15000, saved: 3500, emoji: '🚗', date: null },
                { id: '2', name: 'Viaje Europa', target: 5000, saved: 1200, emoji: '✈️', date: null },
                { id: '3', name: 'Fondo Emergencia', target: 10000, saved: 1500, emoji: '🛡️', date: null }
            ];
            for (let g of goals) await saveToStore('goals', g);
        } else {
            goals = savedGoals;
        }
        
        updateTotal();
        
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// ==================== LOGIN ====================

function setupLogin() {
    const savedPin = localStorage.getItem('pesso_pin');
    const savedName = localStorage.getItem('pesso_user');
    
    if (!savedPin) {
        localStorage.setItem('pesso_pin', '1234');
        localStorage.setItem('pesso_user', userName);
    } else {
        userName = savedName || 'Usuario';
    }
    
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
        userNameEl.textContent = `Welcome back, ${userName}`;
    }
}

function enterPin(num) {
    if (currentPin.length < 4) {
        currentPin += num;
        updatePinDots();
        
        if (currentPin.length === 4) {
            setTimeout(verifyPin, 100);
        }
    }
}

function deletePin() {
    currentPin = currentPin.slice(0, -1);
    updatePinDots();
    document.getElementById('pinError').textContent = '';
}

function updatePinDots() {
    const dots = document.querySelectorAll('.pin-dots span');
    dots.forEach((dot, i) => {
        dot.classList.toggle('filled', i < currentPin.length);
    });
}

function verifyPin() {
    const savedPin = localStorage.getItem('pesso_pin');
    
    if (currentPin === savedPin) {
        login();
        
        document.getElementById('loginScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            setTimeout(() => {
                document.getElementById('mainApp').style.opacity = '1';
            }, 50);
        }, 300);
        
        currentPin = '';
        updatePinDots();
        populateSelects();
        renderSavingsCards();
        updateUserName();
        updateActivity();
    } else {
        document.getElementById('pinError').textContent = 'PIN incorrecto';
        currentPin = '';
        setTimeout(updatePinDots, 200);
    }
}

function biometric() {
    showToast('Face ID no disponible');
}

// ==================== HOME ====================

function updateDate() {
    const date = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        dateEl.textContent = date.toLocaleDateString('en-US', options);
    }
}

function updateTotal() {
    const total = envelopes.reduce((sum, e) => sum + e.amount, 0);
    const formatted = total.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    const balanceEl = document.getElementById('totalBalance');
    if (balanceEl) {
        balanceEl.textContent = `$${formatted}`;
    }
    
    localStorage.setItem('pesso_balance', formatted);
}

// ==================== SAVINGS CARDS ====================

function renderSavingsCards() {
    const container = document.getElementById('savingsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (envelopes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No savings accounts yet</p>
            </div>
        `;
        return;
    }
    
    envelopes.forEach(env => {
        const card = document.createElement('div');
        card.className = 'ios-card savings-card';
        card.onclick = () => showQuickActions(env.id);
        
        let goalHtml = '';
        if (env.goal && env.goal > 0) {
            const progress = Math.min(100, (env.amount / env.goal) * 100);
            goalHtml = `
                <div class="savings-goal-indicator">
                    <ion-icon name="flag-outline"></ion-icon>
                    <span class="savings-goal-text">Meta: $${env.goal.toLocaleString()} (${progress.toFixed(0)}%)</span>
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="ios-card-header compact">
                <div>
                    <div class="ios-card-title">${env.name}</div>
                    <div class="ios-card-subtitle">Savings</div>
                </div>
                <div class="icon-box bg-primary compact-icon">
                    <ion-icon name="${env.icon || 'cash'}-outline"></ion-icon>
                </div>
            </div>
            <div class="ios-card-amount compact-amount">$${env.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
            ${goalHtml}
        `;
        
        container.appendChild(card);
    });
}

function showQuickActions(envelopeId) {
    console.log('Quick actions for:', envelopeId);
}

// ==================== MODALS ====================

function showAddModal() {
    if (!isLoggedIn) {
        showToast('Debes iniciar sesión');
        return;
    }
    
    // Resetear formulario
    document.getElementById('addAmount').value = '';
    document.getElementById('savingGoalCheck').checked = false;
    document.getElementById('savingGoalGroup').classList.add('hidden');
    document.getElementById('savingGoalAmount').value = '';
    
    // Resetear radio buttons
    document.getElementById('addToSavings').checked = true;
    toggleAddDestination();
    
    populateSelects();
    
    const modal = document.getElementById('addModal');
    if (modal) modal.classList.remove('hidden');
}

function showWithdrawModal() {
    if (!isLoggedIn) {
        showToast('Debes iniciar sesión');
        return;
    }
    
    document.getElementById('withdrawAmount').value = '';
    populateSelects();
    
    const modal = document.getElementById('withdrawModal');
    if (modal) modal.classList.remove('hidden');
}

function showTransferModal() {
    if (!isLoggedIn) {
        showToast('Debes iniciar sesión');
        return;
    }
    
    populateTransferSelects();
    
    const modal = document.getElementById('transferModal');
    if (modal) modal.classList.remove('hidden');
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => {
        if (m.id !== 'errorModal' && m.id !== 'goalWarningModal') {
            m.classList.add('hidden');
            document.body.classList.remove('modal-open');
        }
    });
}

function toggleAddDestination() {
    const isSavings = document.getElementById('addToSavings').checked;
    const savingsGroup = document.getElementById('savingsSelectGroup');
    const goalsGroup = document.getElementById('goalsSelectGroup');
    const goalCheckGroup = document.getElementById('goalCheckGroup');
    
    if (savingsGroup) savingsGroup.classList.toggle('hidden', !isSavings);
    if (goalsGroup) goalsGroup.classList.toggle('hidden', isSavings);
    if (goalCheckGroup) goalCheckGroup.classList.toggle('hidden', !isSavings);
}

function toggleSavingGoal() {
    const isChecked = document.getElementById('savingGoalCheck').checked;
    const group = document.getElementById('savingGoalGroup');
    if (group) group.classList.toggle('hidden', !isChecked);
}

// ==================== SELECTS ====================

function populateSelects() {
    const addSavingsSelect = document.getElementById('addSavingsSelect');
    const addGoalSelect = document.getElementById('addGoalSelect');
    const withdrawSelect = document.getElementById('withdrawEnvelope');
    
    // Savings select
    if (addSavingsSelect) {
        addSavingsSelect.innerHTML = '';
        envelopes.forEach(env => {
            const option = document.createElement('option');
            option.value = env.id;
            option.textContent = `${env.name} ($${env.amount.toFixed(2)})`;
            addSavingsSelect.appendChild(option);
        });
    }
    
    // Goals select
    if (addGoalSelect) {
        addGoalSelect.innerHTML = '';
        if (goals.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No goals available';
            addGoalSelect.appendChild(option);
        } else {
            goals.forEach(goal => {
                const option = document.createElement('option');
                option.value = goal.id;
                option.textContent = `${goal.emoji} ${goal.name} ($${goal.saved.toFixed(2)} / $${goal.target.toFixed(2)})`;
                addGoalSelect.appendChild(option);
            });
        }
    }
    
    // Withdraw select
    if (withdrawSelect) {
        withdrawSelect.innerHTML = '';
        envelopes.forEach(env => {
            const option = document.createElement('option');
            option.value = env.id;
            option.textContent = `${env.name} ($${env.amount.toFixed(2)})`;
            withdrawSelect.appendChild(option);
        });
        withdrawSelect.onchange = updateMaxAvailable;
        updateMaxAvailable();
    }
}

function populateTransferSelects() {
    const fromSelect = document.getElementById('transferFrom');
    const toSelect = document.getElementById('transferTo');
    
    if (fromSelect && toSelect) {
        fromSelect.innerHTML = '';
        toSelect.innerHTML = '';
        
        envelopes.forEach(env => {
            const option1 = document.createElement('option');
            option1.value = env.id;
            option1.textContent = `${env.name} ($${env.amount.toFixed(2)})`;
            fromSelect.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = env.id;
            option2.textContent = `${env.name} ($${env.amount.toFixed(2)})`;
            toSelect.appendChild(option2);
        });
    }
}

function updateMaxAvailable() {
    const select = document.getElementById('withdrawEnvelope');
    const maxDiv = document.getElementById('maxAvailable');
    const goalInfo = document.getElementById('goalInfo');
    
    if (!select) return;
    
    const envelope = envelopes.find(e => e.id === select.value);
    if (envelope) {
        if (maxDiv) maxDiv.textContent = `Máximo disponible: $${envelope.amount.toFixed(2)}`;
        
        if (goalInfo) {
            if (envelope.goal && envelope.goal > 0) {
                goalInfo.textContent = `⚠️ Meta activa: $${envelope.goal.toFixed(2)}`;
                goalInfo.classList.remove('hidden');
            } else {
                goalInfo.classList.add('hidden');
            }
        }
    }
}

// ==================== TRANSACCIONES ====================

async function confirmAdd() {
    const amountInput = document.getElementById('addAmount');
    const isSavings = document.getElementById('addToSavings').checked;
    
    if (!amountInput) return;
    
    const amount = parseFloat(amountInput.value);
    
    if (!amount || amount <= 0) {
        showToast('Ingresa un monto válido');
        return;
    }
    
    if (isSavings) {
        // Agregar a Savings
        const envelopeSelect = document.getElementById('addSavingsSelect');
        const goalCheck = document.getElementById('savingGoalCheck');
        const goalAmountInput = document.getElementById('savingGoalAmount');
        
        if (!envelopeSelect) return;
        
        const envelopeId = envelopeSelect.value;
        const envelope = envelopes.find(e => e.id === envelopeId);
        
        if (!envelope) return;
        
        envelope.amount += amount;
        
        // Si tiene meta de ahorro
        if (goalCheck && goalCheck.checked && goalAmountInput) {
            const goalAmount = parseFloat(goalAmountInput.value);
            if (goalAmount && goalAmount > 0) {
                envelope.goal = goalAmount;
            }
        }
        
        try {
            await saveToStore('envelopes', envelope);
            await addNotification(
                'add',
                'Money Added',
                `Added $${amount.toFixed(2)} to ${envelope.name}`,
                amount
            );
            updateTotal();
            populateSelects();
            renderSavingsCards();
            closeModal();
            showToast(`Agregado $${amount.toFixed(2)} a ${envelope.name}`);
            updateActivity();
        } catch (error) {
            console.error('Error:', error);
            showToast('Error al guardar');
        }
    } else {
        // Agregar a Goals
        const goalSelect = document.getElementById('addGoalSelect');
        if (!goalSelect || goals.length === 0) {
            showToast('No goals available');
            return;
        }
        
        const goalId = goalSelect.value;
        const goal = goals.find(g => g.id === goalId);
        
        if (!goal) return;
        
        goal.saved += amount;
        
        try {
            await saveToStore('goals', goal);
            await addNotification(
                'goal',
                'Goal Progress!',
                `Added $${amount.toFixed(2)} to ${goal.name}. Total: $${goal.saved.toFixed(2)}`,
                amount
            );
            populateSelects();
            closeModal();
            showToast(`Agregado $${amount.toFixed(2)} a meta ${goal.name}`);
            updateActivity();
        } catch (error) {
            console.error('Error:', error);
            showToast('Error al guardar');
        }
    }
    closeModal();
}

async function confirmWithdraw() {
    const amountInput = document.getElementById('withdrawAmount');
    const envelopeSelect = document.getElementById('withdrawEnvelope');
    
    if (!amountInput || !envelopeSelect) return;
    
    const amount = parseFloat(amountInput.value);
    const envelopeId = envelopeSelect.value;
    
    if (!amount || amount <= 0) {
        showToast('Ingresa un monto válido');
        return;
    }
    
    const envelope = envelopes.find(e => e.id === envelopeId);
    if (!envelope) return;
    
    if (amount > envelope.amount) {
        showErrorModal(envelope.name, envelope.amount, amount);
        return;
    }
    
    if (envelope.goal && envelope.goal > 0 && envelope.amount < envelope.goal) {
        pendingWithdrawal = { envelope, amount };
        showGoalWarning(envelope);
        return;
    }
    
    await processWithdrawal(envelope, amount);
    closeModal();
}

function showGoalWarning(envelope) {
    const warningEl = document.getElementById('warningGoalAmount');
    if (warningEl) {
        warningEl.textContent = `$${envelope.goal.toFixed(2)}`;
    }
    const modal = document.getElementById('goalWarningModal');
    if (modal) modal.classList.remove('hidden');
}

function closeGoalWarning() {
    const modal = document.getElementById('goalWarningModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
    pendingWithdrawal = null;
}

async function confirmWithdrawAnyway() {
    if (pendingWithdrawal) {
        await processWithdrawal(pendingWithdrawal.envelope, pendingWithdrawal.amount);
        closeGoalWarning();
    }
}

async function processWithdrawal(envelope, amount) {
    envelope.amount -= amount;
    
    try {
        await saveToStore('envelopes', envelope);
        await addNotification(
            'withdraw',
            'Money Withdrawn',
            `Withdrew $${amount.toFixed(2)} from ${envelope.name}`,
            amount
        );
        updateTotal();
        populateSelects();
        renderSavingsCards();
        closeModal();
        showToast(`Retirado $${amount.toFixed(2)} de ${envelope.name}`);
        updateActivity();
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al guardar');
    }
}

async function confirmTransfer() {
    const fromSelect = document.getElementById('transferFrom');
    const toSelect = document.getElementById('transferTo');
    const amountInput = document.getElementById('transferAmount');
    
    if (!fromSelect || !toSelect || !amountInput) return;
    
    const fromId = fromSelect.value;
    const toId = toSelect.value;
    const amount = parseFloat(amountInput.value);
    
    if (fromId === toId) {
        showToast('Selecciona cuentas diferentes');
        return;
    }
    
    if (!amount || amount <= 0) {
        showToast('Ingresa un monto válido');
        return;
    }
    
    const fromEnvelope = envelopes.find(e => e.id === fromId);
    const toEnvelope = envelopes.find(e => e.id === toId);
    
    if (!fromEnvelope || !toEnvelope) return;
    
    if (amount > fromEnvelope.amount) {
        showToast('Fondos insuficientes');
        return;
    }
    
    fromEnvelope.amount -= amount;
    toEnvelope.amount += amount;
    
    try {
        await saveToStore('envelopes', fromEnvelope);
        await saveToStore('envelopes', toEnvelope);
        await addNotification(
            'transfer',
            'Transfer Completed',
            `Transferred $${amount.toFixed(2)} from ${fromEnvelope.name} to ${toEnvelope.name}`,
            amount
        );
        updateTotal();
        populateSelects();
        renderSavingsCards();
        closeModal();
        showToast(`Transferido $${amount.toFixed(2)}`);
        updateActivity();
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al transferir');
    }
    closeModal();
}

// ==================== NOTIFICACIONES ====================

async function addNotification(type, title, description, amount = null) {
    // Verificar que la DB esté lista
    if (!db) {
        console.error('DB no inicializada');
        return;
    }
    
    // Verificar que el object store exista
    if (!db.objectStoreNames.contains('notifications')) {
        console.error('Object store notifications no existe');
        return;
    }
    
    const notification = {
        type: type,
        title: title,
        description: description,
        amount: amount,
        date: new Date().toISOString(),
        read: false
    };
    
    try {
        await saveToStore('notifications', notification);
        console.log('Notificación guardada:', title);
    } catch (error) {
        console.error('Error guardando notificación:', error);
    }
}

// ==================== ERROR MODAL ====================

function showErrorModal(envelopeName, available, attempted) {
    const errorAvailable = document.getElementById('errorAvailable');
    const errorAttempted = document.getElementById('errorAttempted');
    const errorModal = document.getElementById('errorModal');
    
    if (errorAvailable) errorAvailable.textContent = `$${available.toFixed(2)}`;
    if (errorAttempted) errorAttempted.textContent = `$${attempted.toFixed(2)}`;
    if (errorModal) errorModal.classList.remove('hidden');
}

function closeErrorModal() {
    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
        errorModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
}

// ==================== UTILIDADES ====================

async function saveToStore(storeName, data) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('DB no inicializada'));
            return;
        }
        
        // Verificar que el object store exista
        if (!db.objectStoreNames.contains(storeName)) {
            reject(new Error(`Object store ${storeName} no existe`));
            return;
        }
        
        try {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        } catch (error) {
            reject(error);
        }
    });
}

async function getAllFromStore(storeName) {
    return new Promise((resolve) => {
        if (!db) {
            resolve([]);
            return;
        }
        
        // Verificar que el object store exista
        if (!db.objectStoreNames.contains(storeName)) {
            console.warn(`Object store ${storeName} no existe`);
            resolve([]);
            return;
        }
        
        try {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        } catch (error) {
            resolve([]);
        }
    });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) {
        alert(message);
        return;
    }
    
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Event listeners
document.addEventListener('click', updateActivity);
document.addEventListener('touchstart', updateActivity);

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'errorModal') {
            closeErrorModal();
        } else if (e.target.id === 'goalWarningModal') {
            closeGoalWarning();
        } else {
            e.target.classList.add('hidden');
        }
    }
});