// ==================== CHALLENGES MODULE ====================
const DB_NAME = 'PessoDB';
const DB_VERSION = 5; // Incrementado para nuevo store

let db = null;
let challenges = [];
let currentChallengeType = 'streak';

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    const isDarkMode = localStorage.getItem('pesso_dark_mode') === 'true';
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    initChallenges();
});

async function initChallenges() {
    try {
        await initDB();
        await loadChallenges();
        updateStats();
        renderChallenges();
        setupEventListeners();
    } catch (error) {
        console.error('Error inicializando challenges:', error);
    }
}

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Crear store de challenges si no existe
            if (!db.objectStoreNames.contains('challenges')) {
                const challengeStore = db.createObjectStore('challenges', { keyPath: 'id' });
                challengeStore.createIndex('status', 'status', { unique: false });
                challengeStore.createIndex('type', 'type', { unique: false });
            }
            
            // Asegurar que existan los otros stores
            if (!db.objectStoreNames.contains('envelopes')) {
                db.createObjectStore('envelopes', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('goals')) {
                db.createObjectStore('goals', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('notifications')) {
                const notifStore = db.createObjectStore('notifications', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                notifStore.createIndex('date', 'date', { unique: false });
            }
        };
    });
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    const fab = document.getElementById('fabAddChallenge');
    console.log('FAB element:', fab);
    
    if (fab) {
        // Remover listeners previos por si acaso
        fab.replaceWith(fab.cloneNode(true));
        
        // Volver a obtener la referencia después del clone
        const newFab = document.getElementById('fabAddChallenge');
        
        newFab.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('FAB clicked!');
            openChallengeModal();
        });
        
        // También agregar onclick inline como backup
        newFab.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('FAB onclick!');
            openChallengeModal();
        };
    } else {
        console.error('FAB not found!');
    }
}

// ==================== CHALLENGE TYPES CONFIG ====================
const challengeConfigs = {
    streak: {
        emoji: '🔥',
        title: 'Savings Streak',
        description: 'Save something every day',
        color: 'streak',
        fields: [
            { name: 'duration', label: 'Duration (days)', type: 'select', options: [7, 14, 30, 60, 90] },
            { name: 'minAmount', label: 'Min. amount per day ($)', type: 'number', placeholder: '5' }
        ]
    },
    'no-spend': {
        emoji: '🚫',
        title: 'No-Spend Challenge',
        description: 'Avoid spending on specific category',
        color: 'no-spend',
        fields: [
            { name: 'category', label: 'Category to avoid', type: 'select', options: ['Coffee', 'Delivery', 'Shopping', 'Entertainment', 'Dining Out'] },
            { name: 'duration', label: 'Duration (days)', type: 'select', options: [3, 7, 14, 30] }
        ]
    },
    fixed: {
        emoji: '💵',
        title: 'Fixed Amount',
        description: 'Save fixed amount daily/weekly',
        color: 'fixed',
        fields: [
            { name: 'amount', label: 'Amount ($)', type: 'number', placeholder: '10' },
            { name: 'frequency', label: 'Frequency', type: 'select', options: ['Daily', 'Weekly'] },
            { name: 'duration', label: 'Duration (days)', type: 'select', options: [7, 14, 30, 60, 90, 365] }
        ]
    },
    roulette: {
        emoji: '🎲',
        title: 'Savings Roulette',
        description: 'Random amount when you spin',
        color: 'roulette',
        fields: [
            { name: 'minAmount', label: 'Min amount ($)', type: 'number', placeholder: '5' },
            { name: 'maxAmount', label: 'Max amount ($)', type: 'number', placeholder: '50' },
            { name: 'spins', label: 'Number of spins', type: 'select', options: [5, 10, 20, 30] }
        ]
    },
    weeks52: {
        emoji: '📅',
        title: '52 Weeks Challenge',
        description: 'Week 1: $1, Week 2: $2... Week 52: $52',
        color: 'weeks52',
        fields: [] // No config needed
    }
};

// ==================== MODAL FUNCTIONS ====================
function openChallengeModal() {
    console.log('Opening modal...');
    currentChallengeType = 'streak';
    renderChallengeConfig();
    
    const modal = document.getElementById('newChallengeModal');
    console.log('Modal element:', modal);
    
    if (modal) {
        modal.classList.add('active');
        console.log('Modal class added:', modal.classList.contains('active'));
    } else {
        console.error('Modal not found!');
    }
}

function closeChallengeModal() {
    document.getElementById('newChallengeModal').classList.remove('active');
    document.body.style.overflow = '';
}

function selectChallengeType(type) {
    currentChallengeType = type;
    
    // Update UI
    document.querySelectorAll('.challenge-type-option').forEach(el => {
        el.classList.remove('selected');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('selected');
    
    renderChallengeConfig();
}

function renderChallengeConfig() {
    const config = challengeConfigs[currentChallengeType];
    const container = document.getElementById('challengeConfig');
    
    if (config.fields.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                <p>No configuration needed!</p>
                <p style="font-size: 14px; margin-top: 8px;">Just start and save weekly</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = config.fields.map(field => {
        if (field.type === 'select') {
            return `
                <div class="form-group-challenge">
                    <label>${field.label}</label>
                    <select id="config_${field.name}" class="form-control">
                        ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>
                </div>
            `;
        }
        return `
            <div class="form-group-challenge">
                <label>${field.label}</label>
                <input type="${field.type}" id="config_${field.name}" 
                       placeholder="${field.placeholder || ''}" 
                       class="form-control" ${field.type === 'number' ? 'inputmode="numeric" pattern="[0-9]*"' : ''}>
            </div>
        `;
    }).join('');
}

// ==================== CREATE CHALLENGE ====================
async function createChallenge() {
    const config = challengeConfigs[currentChallengeType];
    const challengeData = {
        id: Date.now().toString(),
        type: currentChallengeType,
        title: config.title,
        description: config.description,
        emoji: config.emoji,
        color: config.color,
        status: 'active',
        createdAt: new Date().toISOString(),
        savedAmount: 0,
        history: []
    };
    
    // Get config values
    config.fields.forEach(field => {
        const el = document.getElementById(`config_${field.name}`);
        challengeData[field.name] = el ? (field.type === 'number' ? parseFloat(el.value) || 0 : el.value) : null;
    });
    
    // Calculate target and dates
    const duration = parseInt(challengeData.duration) || 30;
    challengeData.endDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();
    
    if (currentChallengeType === 'fixed') {
        const freq = challengeData.frequency === 'Daily' ? 1 : 7;
        challengeData.targetAmount = challengeData.amount * Math.ceil(duration / freq);
    } else if (currentChallengeType === 'weeks52') {
        challengeData.targetAmount = 1378; // 1+2+3...+52
        challengeData.currentWeek = 1;
        challengeData.endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    } else if (currentChallengeType === 'roulette') {
        challengeData.targetAmount = challengeData.spins * ((challengeData.minAmount + challengeData.maxAmount) / 2);
        challengeData.remainingSpins = challengeData.spins;
    } else {
        challengeData.targetAmount = duration * (challengeData.minAmount || 5);
    }
    
    try {
        await saveToStore('challenges', challengeData);
        challenges.push(challengeData);
        
        await addNotification(
            'challenge_created',
            'New Challenge Started! 🎯',
            `Started "${challengeData.title}" - Save $${challengeData.targetAmount.toFixed(2)} in ${duration} days`
        );
        
        updateStats();
        renderChallenges();
        closeChallengeModal();
        showToast('Challenge started! Good luck! 🚀');
        
    } catch (error) {
        console.error('Error creating challenge:', error);
        showToast('Error starting challenge');
    }
}

// ==================== RENDER CHALLENGES ====================
function renderChallenges() {
    const activeContainer = document.getElementById('activeChallenges');
    const pastContainer = document.getElementById('pastChallenges');
    
    const active = challenges.filter(c => c.status === 'active');
    const past = challenges.filter(c => c.status === 'completed' || c.status === 'failed');
    
    // Sort: active by end date, past by completion date
    active.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
    past.sort((a, b) => new Date(b.completedAt || b.endDate) - new Date(a.completedAt || a.endDate));
    
    activeContainer.innerHTML = active.length ? active.map(c => renderChallengeCard(c)).join('') : renderEmptyState('active');
    pastContainer.innerHTML = past.length ? past.map(c => renderChallengeCard(c)).join('') : renderEmptyState('past');
}

function renderChallengeCard(challenge) {
    const percent = Math.min(100, (challenge.savedAmount / (challenge.targetAmount || 1)) * 100);
    const daysLeft = Math.ceil((new Date(challenge.endDate) - new Date()) / (1000 * 60 * 60 * 24));
    
    let actionButtons = '';
    let progressText = '';
    
    if (challenge.status === 'active') {
        if (challenge.type === 'roulette' && challenge.remainingSpins > 0) {
            actionButtons = `
                <div class="challenge-actions">
                    <button class="btn-challenge btn-challenge-primary" onclick="spinRoulette('${challenge.id}')">
                        🎲 Spin (${challenge.remainingSpins} left)
                    </button>
                </div>
            `;
        } else {
            actionButtons = `
                <div class="challenge-actions">
                    <button class="btn-challenge btn-challenge-primary" onclick="addToChallenge('${challenge.id}')">
                        Add Savings
                    </button>
                    <button class="btn-challenge btn-challenge-secondary" onclick="completeChallenge('${challenge.id}')">
                        Complete
                    </button>
                </div>
            `;
        }
        
        progressText = `${daysLeft > 0 ? daysLeft + ' days left' : 'Last day!'}`;
    } else {
        progressText = challenge.status === 'completed' ? '✅ Completed!' : '❌ Not completed';
    }
    
    return `
        <div class="challenge-card ${challenge.status}" onclick="showChallengeDetail('${challenge.id}')">
            <div class="challenge-header">
                <div class="challenge-icon ${challenge.color}">
                    ${challenge.emoji}
                </div>
                <div class="challenge-status ${challenge.status}">
                    ${challenge.status}
                </div>
            </div>
            
            <div class="challenge-info">
                <h3>${challenge.title}</h3>
                <p>${challenge.description}</p>
            </div>
            
            <div class="challenge-progress">
                <div class="progress-header">
                    <span>$${challenge.savedAmount.toFixed(2)} of $${(challenge.targetAmount || 0).toFixed(2)}</span>
                    <span>${percent.toFixed(0)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${challenge.color}" style="width: ${percent}%"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 13px; color: var(--text-secondary);">
                    <span>${progressText}</span>
                    <span>${challenge.history.length} contributions</span>
                </div>
            </div>
            
            ${actionButtons}
        </div>
    `;
}

function renderEmptyState(type) {
    return `
        <div class="empty-challenges">
            <ion-icon name="${type === 'active' ? 'trophy-outline' : 'checkmark-done-outline'}"></ion-icon>
            <h3>${type === 'active' ? 'No active challenges' : 'No history yet'}</h3>
            <p>${type === 'active' ? 'Start a challenge to push your savings!' : 'Complete a challenge to see it here'}</p>
        </div>
    `;
}

// ==================== CHALLENGE ACTIONS ====================
async function spinRoulette(challengeId) {
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge || challenge.remainingSpins <= 0) return;
    
    const min = challenge.minAmount || 5;
    const max = challenge.maxAmount || 50;
    const amount = Math.floor(Math.random() * (max - min + 1)) + min;
    
    // Animation
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '🎲 Spinning...';
    
    setTimeout(async () => {
        challenge.savedAmount += amount;
        challenge.remainingSpins--;
        challenge.history.push({
            date: new Date().toISOString(),
            amount: amount,
            note: 'Roulette spin'
        });
        
        if (challenge.remainingSpins <= 0) {
            challenge.status = 'completed';
            challenge.completedAt = new Date().toISOString();
            showConfetti();
        }
        
        await saveToStore('challenges', challenge);
        updateStats();
        renderChallenges();
        showToast(`🎉 You saved $${amount}!`);
        
    }, 1000);
}

async function addToChallenge(challengeId) {
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return;
    
    const amount = prompt('How much did you save today? ($)');
    if (!amount || isNaN(amount) || amount <= 0) return;
    
    const numAmount = parseFloat(amount);
    challenge.savedAmount += numAmount;
    challenge.history.push({
        date: new Date().toISOString(),
        amount: numAmount,
        note: 'Manual contribution'
    });
    
    // Check if completed
    if (challenge.savedAmount >= challenge.targetAmount) {
        challenge.status = 'completed';
        challenge.completedAt = new Date().toISOString();
        showConfetti();
        await addNotification(
            'challenge_completed',
            'Challenge Completed! 🏆',
            `You completed "${challenge.title}" and saved $${challenge.savedAmount.toFixed(2)}!`
        );
        showToast('🎉 Challenge completed! Amazing job!');
    } else {
        showToast(`Added $${numAmount.toFixed(2)}! Keep going! 💪`);
    }
    
    await saveToStore('challenges', challenge);
    updateStats();
    renderChallenges();
}

async function completeChallenge(challengeId) {
    if (!confirm('Mark this challenge as complete?')) return;
    
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return;
    
    challenge.status = 'completed';
    challenge.completedAt = new Date().toISOString();
    
    await saveToStore('challenges', challenge);
    updateStats();
    renderChallenges();
    showConfetti();
    showToast('🎉 Challenge completed!');
}

function showChallengeDetail(challengeId) {
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return;
    
    const historyHtml = challenge.history.length ? 
        challenge.history.slice().reverse().map(h => `
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--glass-border);">
                <span>${new Date(h.date).toLocaleDateString()}</span>
                <span style="font-weight: 600; color: var(--success);">+$${h.amount.toFixed(2)}</span>
            </div>
        `).join('') : 
        '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No contributions yet</p>';
    
    // Create modal dynamically
    const modal = document.createElement('div');
    modal.className = 'modal-challenge active';
    modal.innerHTML = `
        <div class="modal-challenge-backdrop" onclick="this.parentElement.remove()"></div>
        <div class="modal-challenge-content">
            <div class="modal-challenge-header">
                <button class="modal-challenge-close" onclick="this.closest('.modal-challenge').remove()">
                    <ion-icon name="close-outline"></ion-icon>
                </button>
                <h3 class="modal-challenge-title">Challenge Details</h3>
                <div style="width: 36px;"></div>
            </div>
            <div class="modal-challenge-body">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="font-size: 48px; margin-bottom: 8px;">${challenge.emoji}</div>
                    <h2 style="margin: 0; font-size: 22px;">${challenge.title}</h2>
                    <p style="color: var(--text-secondary); margin: 8px 0 0 0;">${challenge.description}</p>
                </div>
                
                <div style="background: var(--bg); border-radius: 16px; padding: 20px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--text-secondary);">Total Saved</span>
                        <span style="font-weight: 700; font-size: 18px;">$${challenge.savedAmount.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--text-secondary);">Target</span>
                        <span style="font-weight: 600;">$${(challenge.targetAmount || 0).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Progress</span>
                        <span style="font-weight: 600; color: var(--primary);">${((challenge.savedAmount / (challenge.targetAmount || 1)) * 100).toFixed(0)}%</span>
                    </div>
                </div>
                
                <h4 style="margin: 0 0 12px 0; font-size: 16px;">History</h4>
                <div style="max-height: 200px; overflow-y: auto;">
                    ${historyHtml}
                </div>
            </div>
            <div class="modal-challenge-footer">
                <button class="btn-modal btn-modal-secondary" onclick="this.closest('.modal-challenge').remove()">Close</button>
                ${challenge.status === 'active' ? `
                    <button class="btn-modal btn-modal-primary" onclick="addToChallenge('${challenge.id}'); this.closest('.modal-challenge').remove();">Add Savings</button>
                ` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ==================== STATS ====================
function updateStats() {
    const active = challenges.filter(c => c.status === 'active').length;
    const completed = challenges.filter(c => c.status === 'completed').length;
    const totalSaved = challenges.reduce((sum, c) => sum + c.savedAmount, 0);
    
    document.getElementById('activeCount').textContent = active;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('totalSaved').textContent = '$' + totalSaved.toFixed(0);
}

// ==================== UTILITIES ====================
async function loadChallenges() {
    challenges = await getAllFromStore('challenges');
}

function showConfetti() {
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.background = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55'][Math.floor(Math.random() * 5)];
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 1000);
        }, i * 50);
    }
}

async function saveToStore(storeName, data) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('DB not initialized'));
            return;
        }
        
        if (!db.objectStoreNames.contains(storeName)) {
            reject(new Error(`Object store ${storeName} does not exist`));
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
        
        if (!db.objectStoreNames.contains(storeName)) {
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

async function addNotification(type, title, description, amount = null) {
    if (!db || !db.objectStoreNames.contains('notifications')) return;
    
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
    } catch (error) {
        console.error('Error saving notification:', error);
    }
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

// Menu ripple effect
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (rect.width/2 - size/2) + 'px';
        ripple.style.top = (rect.height/2 - size/2) + 'px';
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });
});

// Debug: exponer funciones globales
window.debugModal = function() {
    console.log('Testing modal...');
    openChallengeModal();
};

// Test automático después de 2 segundos
setTimeout(function() {
    console.log('Auto-testing modal...');
    const modal = document.getElementById('newChallengeModal');
    const fab = document.getElementById('fabAddChallenge');
    console.log('Modal exists:', !!modal);
    console.log('FAB exists:', !!fab);
}, 2000);