// ============================================================
// BAGIAN 1: FIREBASE CONFIG + AUTH + GLOBAL
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyD9mnz_qLyPQErypAvBCDlPcDUg9Ci_xdY",
    authDomain: "minersl.firebaseapp.com",
    projectId: "minersl",
    storageBucket: "minersl.firebasestorage.app",
    messagingSenderId: "28474875844",
    appId: "1:28474875844:web:c91d15afa9610c6e238e91"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

console.log('🔥 Firebase siap!');

// ============================================================
// GLOBAL VARIABLES
// ============================================================
let currentUser = null;
let userData = null;
let mineIntervals = {};
let targetUser = null;
let autoSpinRemaining = 0;
let isAutoSpinning = false;
let isClaiming = false;
let privateChatTarget = null;
let privateChatTargetUsername = '';
let pvpTimerInterval = null;
let pvpTimeLeft = 120;
let pvpBets = [];
let pvpLocked = false;
let auctionTimerInterval = null;
let currentAuctionId = null;


// ============================================================
// MINEBOOM - AMBIL SETTING DARI FIRESTORE
// ============================================================
function getMineBoomRooms() {
    if (typeof getMineBoomSettings === 'function') {
        const settings = getMineBoomSettings();
        if (settings && settings.rooms) {
            return settings.rooms;
        }
    }
    // Fallback default
    return {
        1: { cost: 1000, bombs: 3, min: 10, max: 500 },
        2: { cost: 10000, bombs: 6, min: 500, max: 5000 },
        3: { cost: 100000, bombs: 9, min: 5000, max: 50000 }
    };
}
// ============================================================
// AUTH STATE
// ============================================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        await loadAllMines();
        loadChat();
        renderPlinko();
        loadAuctions();
        loadNotifications();
        loadMarketListings();
        loadTaxSetting();
        loadPlinkoMode();
        loadSpinMode();
        loadFarm();
        checkAdminMenu();
        showPage('game');
    } else {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    }
});

// ============================================================
// SHOW TAB (LOGIN/REGISTER)
// ============================================================
function showTab(tab) {
    document.querySelectorAll('.form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (tab === 'login') {
        document.getElementById('loginForm').classList.add('active');
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
    } else {
        document.getElementById('registerForm').classList.add('active');
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
    }
}

// ============================================================
// TOGGLE PASSWORD
// ============================================================
function togglePassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = '🙈';
    } else {
        input.type = 'password';
        icon.textContent = '👁️';
    }
}

// ============================================================
// REGISTER
// ============================================================
async function handleRegister() {
    console.log('🔥 Register dipanggil!');
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const msg = document.getElementById('registerMessage');

    if (!username || !email || !password) {
        msg.innerHTML = '<span class="error">❌ Semua field wajib diisi!</span>';
        return;
    }
    if (password.length < 6) {
        msg.innerHTML = '<span class="error">❌ Password minimal 6 karakter!</span>';
        return;
    }

    try {
        const usersRef = db.collection('users');
        const q = usersRef.where('username', '==', username);
        const snap = await q.get();
        if (!snap.empty) {
            msg.innerHTML = '<span class="error">❌ Username sudah dipakai!</span>';
            return;
        }

        const emailCheck = await auth.fetchSignInMethodsForEmail(email);
        if (emailCheck.length > 0) {
            msg.innerHTML = '<span class="error">❌ Email sudah terdaftar!</span>';
            return;
        }

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            username: username,
            email: email,
            role: 'user',
            isBanned: false,
            banReason: null,
            level: 1,
            gold: 1000,
            totalGoldMined: 0,
            description: 'Miner baru! ⛏️',
            diceWins: 0,
            diceLosses: 0,
            inventory: {
                palu: 0,
                stone: 0,
                blueprintKayu: 0,
                blueprintSilver: 0,
                blueprintEmas: 0,
                blueprintDiamond: 0
            },
            mines: {
                kayu: { level: 0 },
                silver: { level: 0 },
                emas: { level: 0 },
                diamond: { level: 0 }
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        msg.innerHTML = '<span class="success">✅ Registrasi berhasil!</span>';
        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        console.error('Register error:', error);
        msg.innerHTML = `<span class="error">❌ ${error.message}</span>`;
    }
}

// ============================================================
// LOGIN (USERNAME ATAU EMAIL)
// ============================================================
async function handleLogin() {
    console.log('🔥 Login dipanggil!');
    const input = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMessage');

    if (!input || !password) {
        msg.innerHTML = '<span class="error">❌ Masukkan username/email dan password!</span>';
        return;
    }

    try {
        let email = input;
        if (!input.includes('@')) {
            const usersRef = db.collection('users');
            const q = usersRef.where('username', '==', input);
            const snap = await q.get();
            if (snap.empty) {
                msg.innerHTML = '<span class="error">❌ Username tidak ditemukan!</span>';
                return;
            }
            email = snap.docs[0].data().email;
        }
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error('Login error:', error);
        msg.innerHTML = `<span class="error">❌ ${error.message}</span>`;
    }
}

// ============================================================
// FORGOT PASSWORD
// ============================================================
async function resetPassword() {
    const input = document.getElementById('loginEmail').value.trim();
    if (!input) {
        alert('Masukkan email atau username!');
        return;
    }
    try {
        let email = input;
        if (!input.includes('@')) {
            const usersRef = db.collection('users');
            const q = usersRef.where('username', '==', input);
            const snap = await q.get();
            if (snap.empty) {
                alert('Username tidak ditemukan!');
                return;
            }
            email = snap.docs[0].data().email;
        }
        await auth.sendPasswordResetEmail(email);
        alert('✅ Link reset password telah dikirim ke email Anda!');
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
}

// ============================================================
// CHANGE PASSWORD
// ============================================================
async function changePassword() {
    if (!currentUser) return alert('Login dulu!');
    const newPass = prompt('Masukkan password baru (minimal 6 karakter):');
    if (!newPass) return;
    if (newPass.length < 6) return alert('Password minimal 6 karakter!');
    try {
        await currentUser.updatePassword(newPass);
        alert('✅ Password berhasil diubah!');
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
}

// ============================================================
// LOGOUT
// ============================================================
async function handleLogout() {
    if (confirm('Yakin logout?')) {
        await auth.signOut();
        window.location.reload();
    }
}

// ============================================================
// BAGIAN 2: LOAD USER DATA + UI + CHECK ADMIN + LEVEL UP + VIEW PROFILE + GIVE MATERIAL
// ============================================================

// ============================================================
// LOAD USER DATA
// ============================================================
async function loadUserData() {
    if (!currentUser) return;
    try {
        const docSnap = await db.collection('users').doc(currentUser.uid).get();
        if (docSnap.exists) {
            userData = docSnap.data();
            updateUI();
            renderMines();
            renderPlinko();
            loadDiceStats();
            checkLevelUp();
            checkAdminMenu();
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

// ============================================================
// UPDATE UI
// ============================================================
function updateUI() {
    if (!userData) return;
    document.getElementById('goldDisplay').textContent = `💰 ${userData.gold || 0}`;
    document.getElementById('usernameDisplay').textContent = userData.username || 'Player';
    
    document.getElementById('profileUsername').textContent = userData.username || '-';
    document.getElementById('profileLevel').textContent = userData.level || 1;
    document.getElementById('profileGold').textContent = userData.gold || 0;
    document.getElementById('profileTotalMined').textContent = userData.totalGoldMined || 0;
    document.getElementById('profileDesc').value = userData.description || '';

    if (userData.inventory) {
        document.getElementById('invPalu').textContent = userData.inventory.palu || 0;
        document.getElementById('invStone').textContent = userData.inventory.stone || 0;
        document.getElementById('invBPKayu').textContent = userData.inventory.blueprintKayu || 0;
        document.getElementById('invBPSilver').textContent = userData.inventory.blueprintSilver || 0;
        document.getElementById('invBPEmas').textContent = userData.inventory.blueprintEmas || 0;
        document.getElementById('invBPDiamond').textContent = userData.inventory.blueprintDiamond || 0;
    }
}

// ============================================================
// SHOW PAGE
// ============================================================
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
    const menu = document.querySelector(`.menu-item[onclick="showPage('${page}')"]`);
    if (menu) menu.classList.add('active');
}

// ============================================================
// CHECK ADMIN MENU
// ============================================================
function checkAdminMenu() {
    if (userData && userData.role === 'admin') {
        document.getElementById('adminMenu').style.display = 'block';
    } else {
        document.getElementById('adminMenu').style.display = 'none';
    }
}

// ============================================================
// CHECK LEVEL UP (NAIK SETIAP 25 JUTA GOLD)
// ============================================================
function checkLevelUp() {
    if (!userData) return;
    const totalGold = userData.totalGoldMined || 0;
    const newLevel = Math.floor(totalGold / 25000000) + 1;
    if (newLevel !== userData.level) {
        db.collection('users').doc(currentUser.uid).update({ level: newLevel });
        userData.level = newLevel;
        document.getElementById('profileLevel').textContent = newLevel;
        alert(`🎉 Selamat! Level naik ke ${newLevel}!`);
    }
}

// ============================================================
// VIEW PROFILE ORANG LAIN
// ============================================================
async function viewProfile(uid) {
    if (!currentUser) return alert('Login dulu!');
    if (uid === currentUser.uid) {
        showPage('profile');
        return;
    }
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) return alert('Player tidak ditemukan!');
        const data = doc.data();
        const action = confirm(
            `👤 ${data.username}\n` +
            `Level: ${data.level}\n` +
            `💰 Gold: ${data.gold || 0}\n` +
            `⛏️ Total Mined: ${data.totalGoldMined || 0}\n` +
            `📝 ${data.description || ''}\n\n` +
            `Klik OK untuk chat privat, Batal untuk tutup.`
        );
        if (action) {
            openPrivateChat(uid, data.username);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// ============================================================
// GIVE RANDOM MATERIAL (UNIVERSAL)
// ============================================================
async function giveRandomMaterial() {
    if (!currentUser) return null;
    const chance = Math.random() * 100;
    let resultMsg = null;
    try {
        if (chance < 10) {
            const type = Math.random() < 0.5 ? 'palu' : 'stone';
            await db.collection('users').doc(currentUser.uid).update({
                [`inventory.${type}`]: firebase.firestore.FieldValue.increment(1)
            });
            resultMsg = `🎁 Dapat 1 ${type === 'palu' ? '🔨 Palu' : '🪨 Stone'}!`;
        } else if (chance < 10.1) {
            const types = ['blueprintKayu', 'blueprintSilver', 'blueprintEmas'];
            const type = types[Math.floor(Math.random() * types.length)];
            await db.collection('users').doc(currentUser.uid).update({
                [`inventory.${type}`]: firebase.firestore.FieldValue.increment(1)
            });
            const bpName = type.replace('blueprint', 'BP ');
            resultMsg = `📜 Dapat 1 ${bpName}! (Langka!)`;
        }
    } catch (e) { console.error('Material error:', e); }
    return resultMsg;
}

// ============================================================
// BAGIAN 3: MINING + SPIN + AUTO SPIN
// ============================================================

const MINE_REWARDS = { kayu: 15, silver: 38, emas: 75, diamond: 150 };
const MINE_NAMES = { kayu: 'Kayu', silver: 'Silver', emas: 'Emas', diamond: 'Diamond' };
const MINE_ICONS = { kayu: '🪵', silver: '🥈', emas: '🥇', diamond: '💎' };
const MINE_BP = { kayu: 'blueprintKayu', silver: 'blueprintSilver', emas: 'blueprintEmas', diamond: 'blueprintDiamond' };

function getMineReward(type, level) {
    return MINE_REWARDS[type] * level;
}

function renderMines() {
    const mines = ['kayu', 'silver', 'emas', 'diamond'];
    const container = document.getElementById('minesGrid');
    if (!container) return;
    
    container.innerHTML = mines.map(type => {
        const level = userData.mines?.[type]?.level || 0;
        const reward = level > 0 ? getMineReward(type, level) : 0;
        const isLocked = level === 0;
        return `
            <div class="mine-card" id="mine${type}">
                <div class="mine-icon">${MINE_ICONS[type]}</div>
                <h3>${MINE_NAMES[type]}</h3>
                <div class="mine-level">${isLocked ? '🔒 Terkunci' : 'Level: ' + level}</div>
                <div class="mine-reward">${isLocked ? 'Unlock: 25 Palu + 25 Stone + 1 BP' : reward + ' Gold/menit'}</div>
                <div class="mine-timer" id="${type}Timer">${isLocked ? '⏳ -' : '⏱️ 0:00 / 5:00'}</div>
                <div class="mine-claim" id="${type}Claim">${isLocked ? '🔒' : '💰 0 Gold'}</div>
                <button class="btn-mine" id="${type}Btn" onclick="${isLocked ? `unlockMine('${type}')` : `startMine('${type}')`}">
                    ${isLocked ? '🔓 Unlock' : '▶️ Mulai'}
                </button>
                ${!isLocked ? `<button class="btn-upgrade" onclick="upgradeMine('${type}')">⬆️ Upgrade</button>` : ''}
            </div>
        `;
    }).join('');
    
    mines.forEach(type => {
        if (userData.mines?.[type]?.level > 0) {
            loadMineState(type);
        }
    });
}

async function unlockMine(type) {
    if (!userData) return;
    const inv = userData.inventory;
    const bpType = MINE_BP[type];
    
    if ((inv.palu || 0) < 25) return alert('❌ Palu tidak cukup! Butuh 25');
    if ((inv.stone || 0) < 25) return alert('❌ Stone tidak cukup! Butuh 25');
    if ((inv[bpType] || 0) < 1) return alert(`❌ ${MINE_NAMES[type]} Blueprint tidak cukup! Butuh 1`);

    if (!confirm(`Unlock ${MINE_NAMES[type]} dengan 25 Palu + 25 Stone + 1 Blueprint?`)) return;

    try {
        await db.runTransaction(async (transaction) => {
            const ref = db.collection('users').doc(currentUser.uid);
            const doc = await transaction.get(ref);
            const data = doc.data();
            transaction.update(ref, {
                'inventory.palu': (data.inventory.palu || 0) - 25,
                'inventory.stone': (data.inventory.stone || 0) - 25,
                [`inventory.${bpType}`]: (data.inventory[bpType] || 0) - 1,
                [`mines.${type}.level`]: 1
            });
        });
        await loadUserData();
        alert(`✅ ${MINE_NAMES[type]} berhasil di-unlock!`);
    } catch (error) {
        alert('❌ Gagal unlock: ' + error.message);
    }
}

async function upgradeMine(type) {
    if (!userData) return;
    const currentLevel = userData.mines?.[type]?.level || 0;
    if (currentLevel >= 15) return alert('⚠️ Sudah level MAX!');
    
    const nextLevel = currentLevel + 1;
    const paluNeeded = nextLevel * 25;
    const stoneNeeded = nextLevel * 25;
    const bpNeeded = nextLevel;
    const bpType = MINE_BP[type];
    const inv = userData.inventory;

    if ((inv.palu || 0) < paluNeeded) return alert(`❌ Butuh ${paluNeeded} Palu`);
    if ((inv.stone || 0) < stoneNeeded) return alert(`❌ Butuh ${stoneNeeded} Stone`);
    if ((inv[bpType] || 0) < bpNeeded) return alert(`❌ Butuh ${bpNeeded} Blueprint ${MINE_NAMES[type]}`);

    if (!confirm(`Upgrade ${MINE_NAMES[type]} ke Level ${nextLevel}? Butuh ${paluNeeded} Palu + ${stoneNeeded} Stone + ${bpNeeded} BP`)) return;

    try {
        await db.runTransaction(async (transaction) => {
            const ref = db.collection('users').doc(currentUser.uid);
            const doc = await transaction.get(ref);
            const data = doc.data();
            transaction.update(ref, {
                'inventory.palu': (data.inventory.palu || 0) - paluNeeded,
                'inventory.stone': (data.inventory.stone || 0) - stoneNeeded,
                [`inventory.${bpType}`]: (data.inventory[bpType] || 0) - bpNeeded,
                [`mines.${type}.level`]: nextLevel
            });
        });
        await loadUserData();
        alert(`✅ ${MINE_NAMES[type]} naik ke Level ${nextLevel}!`);
    } catch (error) {
        alert('❌ Gagal upgrade: ' + error.message);
    }
}

async function startMine(type) {
    if (!currentUser || !userData) return;
    const level = userData.mines?.[type]?.level || 0;
    if (level === 0) return alert('🔒 Tambang terkunci!');
    
    const docRef = db.collection('mineStates').doc(`${currentUser.uid}_${type}`);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
        const data = docSnap.data();
        if (data.active) return alert(`⏳ ${MINE_NAMES[type]} sedang berjalan!`);
        if (data.claimable > 0) return alert('💰 Claim dulu!');
    }

    const rewardPerMinute = getMineReward(type, level);
    
    await docRef.set({
        uid: currentUser.uid,
        mineType: type,
        active: true,
        startTime: firebase.firestore.FieldValue.serverTimestamp(),
        duration: 300,
        claimable: 0,
        rewardPerMinute: rewardPerMinute
    });

    const btn = document.getElementById(`${type}Btn`);
    btn.textContent = '⏳ Proses...';
    btn.disabled = true;
    btn.onclick = null;

    showMineResult(`⛏️ ${MINE_NAMES[type]} dimulai!`, 'success');
    await loadMineState(type);
}

async function loadMineState(type) {
    if (!currentUser) return;
    const docRef = db.collection('mineStates').doc(`${currentUser.uid}_${type}`);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;
    
    const data = docSnap.data();
    const timerEl = document.getElementById(`${type}Timer`);
    const claimEl = document.getElementById(`${type}Claim`);
    const btn = document.getElementById(`${type}Btn`);
    const level = userData.mines?.[type]?.level || 0;
    if (level === 0) return;
    
    if (data.active) {
        const startTime = data.startTime.toMillis();
        const now = Date.now();
        const elapsed = (now - startTime) / 1000;
        const remaining = Math.max(0, data.duration - elapsed);
        
        if (remaining <= 0) {
            await finishMine(type, data);
            return;
        }
        
        btn.textContent = '⏳ Proses...';
        btn.disabled = true;
        
        if (mineIntervals[type]) clearInterval(mineIntervals[type]);
        mineIntervals[type] = setInterval(() => updateMineTimer(type), 1000);
        updateMineTimer(type);
    } else if (data.claimable > 0) {
        timerEl.textContent = '✅ 5:00 / 5:00 Selesai!';
        claimEl.textContent = `💰 ${data.claimable} Gold siap claim`;
        btn.textContent = '🟢 Claim Gold';
        btn.disabled = false;
        btn.onclick = () => claimMine(type);
    }
}

async function updateMineTimer(type) {
    const docRef = db.collection('mineStates').doc(`${currentUser.uid}_${type}`);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;
    
    const data = docSnap.data();
    if (!data.active) {
        clearInterval(mineIntervals[type]);
        return;
    }
    
    const startTime = data.startTime.toMillis();
    const now = Date.now();
    const elapsed = (now - startTime) / 1000;
    const remaining = Math.max(0, data.duration - elapsed);
    const minutesPassed = Math.floor(elapsed / 60);
    const claimable = minutesPassed * data.rewardPerMinute;
    
    const timerEl = document.getElementById(`${type}Timer`);
    const claimEl = document.getElementById(`${type}Claim`);
    
    if (remaining <= 0) {
        clearInterval(mineIntervals[type]);
        await finishMine(type, data);
        return;
    }
    
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    timerEl.textContent = `⏱️ ${minutes}:${String(seconds).padStart(2, '0')} / 5:00`;
    claimEl.textContent = `💰 ${claimable} Gold terkumpul`;
    
    if (claimable > data.claimable) {
        await docRef.update({ claimable: claimable });
    }
}

async function finishMine(type, data) {
    const docRef = db.collection('mineStates').doc(`${currentUser.uid}_${type}`);
    const timerEl = document.getElementById(`${type}Timer`);
    const claimEl = document.getElementById(`${type}Claim`);
    const btn = document.getElementById(`${type}Btn`);
    
    const startTime = data.startTime.toMillis();
    const elapsed = (Date.now() - startTime) / 1000;
    const minutesPassed = Math.min(5, Math.floor(elapsed / 60));
    const claimable = minutesPassed * data.rewardPerMinute;
    
    await docRef.update({
        active: false,
        claimable: claimable
    });
    
    timerEl.textContent = '✅ 5:00 / 5:00 Selesai!';
    claimEl.textContent = `💰 ${claimable} Gold siap claim`;
    btn.textContent = '🟢 Claim Gold';
    btn.disabled = false;
    btn.onclick = () => claimMine(type);
}

async function claimMine(type) {
    if (isClaiming) return;
    if (!currentUser) return;
    
    isClaiming = true;
    try {
        const docRef = db.collection('mineStates').doc(`${currentUser.uid}_${type}`);
        const docSnap = await docRef.get();
        if (!docSnap.exists) return alert('Tidak ada data!');
        
        const data = docSnap.data();
        if (data.active) return alert('Tunggu selesai!');
        if (data.claimable <= 0) return alert('Tidak ada gold!');
        
        const goldEarned = data.claimable;
        
        await db.runTransaction(async (transaction) => {
            const ref = db.collection('users').doc(currentUser.uid);
            const doc = await transaction.get(ref);
            const currData = doc.data();
            transaction.update(ref, {
                gold: (currData.gold || 0) + goldEarned,
                totalGoldMined: (currData.totalGoldMined || 0) + goldEarned
            });
            transaction.delete(docRef);
        });
        
        const btn = document.getElementById(`${type}Btn`);
        btn.textContent = '▶️ Mulai';
        btn.disabled = false;
        btn.onclick = () => startMine(type);
        
        document.getElementById(`${type}Timer`).textContent = '⏱️ 0:00 / 5:00';
        document.getElementById(`${type}Claim`).textContent = '💰 0 Gold';
        
        showMineResult(`✅ +${goldEarned} Gold dari ${MINE_NAMES[type]}!`, 'success');
        await loadUserData();
    } catch (error) {
        alert('❌ Gagal claim: ' + error.message);
    } finally {
        isClaiming = false;
    }
}

async function loadAllMines() {
    if (!currentUser) return;
    const mines = ['kayu', 'silver', 'emas', 'diamond'];
    for (const type of mines) {
        if (userData.mines?.[type]?.level > 0) {
            await loadMineState(type);
        }
    }
}

function showMineResult(msg, type) {
    const el = document.getElementById('mineResult');
    if (!el) return;
    el.innerHTML = `<div class="result-${type}">${msg}</div>`;
    setTimeout(() => el.innerHTML = '', 5000);
}

// ============================================================
// SPIN SLOT + AUTO SPIN
// ============================================================
const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '⭐', '🎰'];
const SYM_MULTIPLIER = {
    '🍒': { two: 1.6, three: 4 },
    '🍋': { two: 1.4, three: 3 },
    '🍊': { two: 1.8, three: 5 },
    '🍇': { two: 2, three: 6 },
    '💎': { two: 5, three: 50 },
    '⭐': { two: 3, three: 15 },
    '🎰': { two: 10, three: 100 }
};

let isSpinning = false;

function getWeightedSymbol(mode) {
    const normalSymbols = ['🍒', '🍋', '🍊', '🍇', '💎', '⭐', '🎰'];
    if (mode === 'normal') {
        return normalSymbols[Math.floor(Math.random() * normalSymbols.length)];
    }
    if (mode === 'easy') {
        const pool = [];
        for (let s of normalSymbols) {
            const weight = (s === '💎' || s === '🎰') ? 2 : 1;
            for (let i = 0; i < weight; i++) pool.push(s);
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }
    if (mode === 'hard') {
        const pool = [];
        for (let s of normalSymbols) {
            const weight = (s === '💎' || s === '🎰') ? 0.5 : 1;
            for (let i = 0; i < Math.ceil(weight); i++) pool.push(s);
        }
        while (pool.length < 3) pool.push('🍒');
        return pool[Math.floor(Math.random() * pool.length)];
    }
    return normalSymbols[Math.floor(Math.random() * normalSymbols.length)];
}

async function spinSlot() {
    if (isSpinning) return;
    if (!currentUser || !userData) return alert('Login dulu!');
    
    const bet = parseInt(document.getElementById('spinBet').value);
    if (!bet || bet < 1) return alert('Masukkan taruhan valid!');
    if (bet > (userData.gold || 0)) return alert('Gold tidak cukup!');
    
    isSpinning = true;
    const btn = document.querySelector('.btn-spin');
    btn.disabled = true;
    btn.textContent = '⏳ Spinning...';
    document.getElementById('spinResult').textContent = '';
    document.getElementById('spinResult').className = 'spin-result';
    
    await db.collection('users').doc(currentUser.uid).update({
        gold: firebase.firestore.FieldValue.increment(-bet)
    });
    
    let spinMode = 'normal';
    try {
        const doc = await db.collection('gameSettings').doc('spin').get();
        if (doc.exists) spinMode = doc.data().mode || 'normal';
    } catch (e) {}
    
    const reel1 = document.getElementById('reel1');
    const reel2 = document.getElementById('reel2');
    const reel3 = document.getElementById('reel3');
    
    reel1.classList.add('spinning');
    reel2.classList.add('spinning');
    reel3.classList.add('spinning');
    
    let count = 0;
    const interval = setInterval(async () => {
        reel1.textContent = getWeightedSymbol(spinMode);
        reel2.textContent = getWeightedSymbol(spinMode);
        reel3.textContent = getWeightedSymbol(spinMode);
        count++;
        if (count > 15) {
            clearInterval(interval);
            
            const result1 = getWeightedSymbol(spinMode);
            const result2 = getWeightedSymbol(spinMode);
            const result3 = getWeightedSymbol(spinMode);
            
            reel1.textContent = result1;
            reel2.textContent = result2;
            reel3.textContent = result3;
            reel1.classList.remove('spinning');
            reel2.classList.remove('spinning');
            reel3.classList.remove('spinning');
            
            let winAmount = 0;
            let resultMsg = '';
            if (result1 === result2 && result2 === result3) {
                winAmount = bet * SYM_MULTIPLIER[result1].three;
                resultMsg = `🎉 ${result1}${result1}${result1} - Jackpot! +${winAmount} Gold!`;
                document.getElementById('spinResult').className = 'spin-result jackpot';
            } else if (result1 === result2 || result2 === result3 || result1 === result3) {
                const matched = result1 === result2 ? result1 : result2 === result3 ? result2 : result1;
                winAmount = bet * SYM_MULTIPLIER[matched].two;
                resultMsg = `✅ ${matched}${matched} - Menang! +${winAmount} Gold!`;
                document.getElementById('spinResult').className = 'spin-result win';
            } else {
                winAmount = 0;
                resultMsg = `❌ ${result1}${result2}${result3} - Kalah! -${bet} Gold`;
                document.getElementById('spinResult').className = 'spin-result lose';
            }
            
            if (winAmount > 0) {
                await db.collection('users').doc(currentUser.uid).update({
                    gold: firebase.firestore.FieldValue.increment(winAmount)
                });
            }
            
            const materialMsg = await giveRandomMaterial();
            if (materialMsg) resultMsg += '\n' + materialMsg;
            // HEWAN DARI SPIN (3%)
if (typeof giveRandomHewan === 'function') {
    const roll = Math.random() * 100;
    if (roll < 2) {
        const hewanType = await giveRandomHewan(currentUser.uid);
        if (hewanType) {
            const hewanNames = { ayam: '🐔 Ayam', bebek: '🦆 Bebek', kambing: '🐐 Kambing', sapi: '🐄 Sapi' };
            resultMsg += '\n🎉 Dapat ' + hewanNames[hewanType] + ' dari spin!';
        }
    }
}
            document.getElementById('spinResult').textContent = resultMsg;
            await loadUserData();
            
            isSpinning = false;
            btn.disabled = false;
            btn.textContent = '🎰 SPIN!';
            
            if (isAutoSpinning && autoSpinRemaining > 0) {
                autoSpinRemaining--;
                updateAutoSpinStatus();
                if (autoSpinRemaining > 0) {
                    setTimeout(() => spinSlot(), 500);
                } else {
                    stopAutoSpin();
                }
            }
        }
    }, 100);
}

function startAutoSpin() {
    if (isAutoSpinning) return;
    if (!currentUser || !userData) return alert('Login dulu!');
    
    const rounds = parseInt(document.getElementById('autoSpinRounds').value);
    if (!rounds || rounds < 1) return alert('Pilih jumlah putaran!');
    
    const bet = parseInt(document.getElementById('spinBet').value);
    if (!bet || bet < 1) return alert('Masukkan taruhan valid!');
    if (bet > (userData.gold || 0)) return alert('Gold tidak cukup untuk 1 putaran!');
    
    const totalCost = bet * rounds;
    if (totalCost > (userData.gold || 0)) {
        if (!confirm(`Gold tidak cukup untuk ${rounds}x putaran (butuh ${totalCost.toLocaleString()} Gold). Lanjutkan dengan sisa gold?`)) return;
    }
    
    isAutoSpinning = true;
    autoSpinRemaining = rounds;
    
    document.querySelector('.btn-auto').style.display = 'none';
    document.querySelector('.btn-auto-stop').style.display = 'inline-block';
    document.querySelector('.btn-spin').disabled = true;
    
    updateAutoSpinStatus();
    spinSlot();
}

function stopAutoSpin() {
    if (!isAutoSpinning) return;
    isAutoSpinning = false;
    autoSpinRemaining = 0;
    
    document.querySelector('.btn-auto').style.display = 'inline-block';
    document.querySelector('.btn-auto-stop').style.display = 'none';
    document.querySelector('.btn-spin').disabled = false;
    document.getElementById('autoSpinStatus').textContent = '⏹️ Dihentikan';
}

function updateAutoSpinStatus() {
    document.getElementById('autoSpinStatus').textContent = `🔄 Sisa: ${autoSpinRemaining}x`;
}

// ============================================================
// BAGIAN 4: PLINKO + LUCKY DICE + BOX + TRANSFER
// ============================================================

// ============================================================
// PLINKO
// ============================================================
const PLINKO_ROWS = 22;
const PLINKO_SLOTS = [
    { label: '×0', value: 0 },
    { label: '×0.5', value: 0.5 },
    { label: '×1', value: 1 },
    { label: '×2', value: 2 },
    { label: '×5', value: 5 },
    { label: '×100', value: 100 },
    { label: '×5', value: 5 },
    { label: '×2', value: 2 },
    { label: '×1', value: 1 },
    { label: '×0.5', value: 0.5 },
    { label: '×0', value: 0 }
];

let isPlinkoDropping = false;

function renderPlinko() {
    const board = document.getElementById('plinkoBoard');
    if (!board) return;
    board.innerHTML = '';

    for (let row = 0; row < PLINKO_ROWS; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'plinko-row';
        const count = row + 1;
        for (let col = 0; col < count; col++) {
            const peg = document.createElement('div');
            peg.className = 'plinko-peg';
            peg.id = `peg-${row}-${col}`;
            rowDiv.appendChild(peg);
        }
        board.appendChild(rowDiv);
    }

    const slotsDiv = document.createElement('div');
    slotsDiv.className = 'plinko-slots';
    PLINKO_SLOTS.forEach((slot, idx) => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'plinko-slot';
        slotDiv.id = `slot-${idx}`;
        slotDiv.innerHTML = `
            <div class="slot-value">${slot.label}</div>
            <div class="slot-label">${idx+1}</div>
        `;
        slotsDiv.appendChild(slotDiv);
    });
    board.appendChild(slotsDiv);
}

async function dropPlinko() {
    if (isPlinkoDropping) return;
    if (!currentUser || !userData) return alert('Login dulu!');

    const bet = parseInt(document.getElementById('plinkoBet').value);
    if (!bet || bet < 500) return alert('Minimal bet 500 Gold!');
    if (bet > (userData.gold || 0)) return alert('Gold tidak cukup!');

    isPlinkoDropping = true;
    document.querySelector('.btn-plinko').disabled = true;
    document.getElementById('plinkoResult').textContent = '⏳ Jatuh...';

    let bias = 0.50;
    try {
        const doc = await db.collection('gameSettings').doc('plinko').get();
        if (doc.exists) bias = doc.data().biasOutward || 0.50;
    } catch (e) {}

    let col = Math.floor(Math.random() * 2);
    const path = [];
    for (let row = 0; row < PLINKO_ROWS; row++) {
        const rowLen = row + 1;
        const middle = Math.floor(rowLen / 2);
        let direction;
        
        if (col < middle) {
            direction = Math.random() < bias ? -1 : 1;
        } else if (col > middle) {
            direction = Math.random() < bias ? 1 : -1;
        } else {
            direction = Math.random() < 0.5 ? -1 : 1;
        }
        
        col += direction;
        if (col < 0) col = 0;
        if (col > row) col = row;
        path.push({ row, col });
    }

    for (let i = 0; i < path.length; i++) {
        const { row, col } = path[i];
        const peg = document.getElementById(`peg-${row}-${col}`);
        if (peg) {
            peg.classList.add('active');
            await new Promise(r => setTimeout(r, 80));
            peg.classList.remove('active');
        }
    }

    const finalCol = path[path.length - 1].col;
    const slotIndex = Math.min(finalCol, PLINKO_SLOTS.length - 1);
    const winMultiplier = PLINKO_SLOTS[slotIndex].value;

    document.querySelectorAll('.plinko-slot').forEach(el => el.classList.remove('highlight'));
    const slotEl = document.getElementById(`slot-${slotIndex}`);
    if (slotEl) slotEl.classList.add('highlight');

    const winAmount = bet * winMultiplier;
    const profit = winAmount - bet;

    await db.collection('users').doc(currentUser.uid).update({
        gold: firebase.firestore.FieldValue.increment(profit),
        totalGoldMined: firebase.firestore.FieldValue.increment(profit > 0 ? profit : 0)
    });

    let resultText = '';
    if (profit > 0) {
        resultText = `🎉 Menang! +${profit.toLocaleString()} Gold (×${winMultiplier})`;
    } else if (profit === 0) {
        resultText = `😐 Balik modal (×${winMultiplier})`;
    } else {
        resultText = `😢 Kalah! -${bet.toLocaleString()} Gold`;
    }
    
    const materialMsg = await giveRandomMaterial();
    if (materialMsg) resultText += ' | ' + materialMsg;
    // HEWAN DARI PLINKO (2%)
if (typeof giveRandomHewan === 'function') {
    const roll = Math.random() * 100;
    if (roll < 2) {
        const hewanType = await giveRandomHewan(currentUser.uid);
        if (hewanType) {
            const hewanNames = { ayam: '🐔 Ayam', bebek: '🦆 Bebek', kambing: '🐐 Kambing', sapi: '🐄 Sapi' };
            resultText += ' | 🎉 Dapat ' + hewanNames[hewanType] + '!';
        }
    }
}
    document.getElementById('plinkoResult').textContent = resultText;

    await loadUserData();
    isPlinkoDropping = false;
    document.querySelector('.btn-plinko').disabled = false;
}

// ============================================================
// LUCKY DICE
// ============================================================
async function loadDiceStats() {
    if (!userData) return;
    document.getElementById('diceWins').textContent = userData.diceWins || 0;
    document.getElementById('diceLosses').textContent = userData.diceLosses || 0;
}

async function playDice(guess) {
    if (!currentUser || !userData) return alert('Login dulu!');
    const bet = parseInt(document.getElementById('diceBet').value);
    if (!bet || bet < 100) return alert('Minimal bet 100 Gold!');
    if (bet > (userData.gold || 0)) return alert('Gold tidak cukup!');

    const dice = Math.floor(Math.random() * 6) + 1;
    const isOdd = dice % 2 === 1;
    const win = (guess === 'odd' && isOdd) || (guess === 'even' && !isOdd);

    const display = document.getElementById('diceResult');
    display.classList.add('rolling');
    display.textContent = '🎲';
    await new Promise(r => setTimeout(r, 500));
    display.classList.remove('rolling');
    display.textContent = getDiceEmoji(dice);

    const messageEl = document.getElementById('diceMessage');
    let materialMsg = '';
    if (win) {
        const winAmount = bet * 2;
        await db.collection('users').doc(currentUser.uid).update({
            gold: firebase.firestore.FieldValue.increment(winAmount),
            totalGoldMined: firebase.firestore.FieldValue.increment(winAmount),
            diceWins: firebase.firestore.FieldValue.increment(1)
        });
        messageEl.textContent = `🎉 Menang! +${winAmount} Gold (${dice} - ${isOdd ? 'Ganjil' : 'Genap'})`;
        messageEl.style.color = '#44ff88';
    } else {
        await db.collection('users').doc(currentUser.uid).update({
            gold: firebase.firestore.FieldValue.increment(-bet),
            diceLosses: firebase.firestore.FieldValue.increment(1)
        });
        messageEl.textContent = `😢 Kalah! -${bet} Gold (${dice} - ${isOdd ? 'Ganjil' : 'Genap'})`;
        messageEl.style.color = '#ff4444';
    }
    
    materialMsg = await giveRandomMaterial();
    if (materialMsg) messageEl.textContent += ' | ' + materialMsg;
// HEWAN DARI DICE (3% SAAT MENANG)
if (win && typeof giveRandomHewan === 'function') {
    const roll = Math.random() * 100;
    if (roll < 3) {
        const hewanType = await giveRandomHewan(currentUser.uid);
        if (hewanType) {
            const hewanNames = { ayam: '🐔 Ayam', bebek: '🦆 Bebek', kambing: '🐐 Kambing', sapi: '🐄 Sapi' };
            messageEl.textContent += ' | 🎉 Dapat ' + hewanNames[hewanType] + '!';
        }
    }
}
    await loadUserData();
    await loadDiceStats();
}

function getDiceEmoji(val) {
    const emojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return emojis[val - 1] || '🎲';
}

// ============================================================
// BOX MYSTERI
// ============================================================
const BOX_DATA = {
    elit: {
        harga: 100000,
        palu: [1, 2],
        stone: [1, 2],
        bp: { name: 'blueprintKayu', chance: 5 }
    },
    master: {
        harga: 500000,
        palu: [1, 5],
        stone: [1, 5],
        bp: { name: 'blueprintSilver', chance: 3 }
    },
    epic: {
        harga: 1000000,
        palu: [1, 10],
        stone: [1, 10],
        bp: { name: 'blueprintEmas', chance: 1 }
    }
};

async function buyBox(tier) {
    if (!currentUser || !userData) return alert('Login dulu!');
    
    // Ambil setting dari farm.js atau fallback
    let boxData = null;
    if (typeof getBoxSettings === 'function') {
        const settings = getBoxSettings();
        boxData = settings[tier];
    }
    if (!boxData) {
        // Fallback hardcoded
        const fallback = {
            elit: { harga: 100000, paluMin: 1, paluMax: 5, stoneMin: 1, stoneMax: 5, bpChance: 5, bpType: 'blueprintKayu' },
            master: { harga: 500000, paluMin: 1, paluMax: 10, stoneMin: 1, stoneMax: 10, bpChance: 3, bpType: 'blueprintSilver' },
            epic: { harga: 1000000, paluMin: 1, paluMax: 15, stoneMin: 1, stoneMax: 15, bpChance: 1, bpType: 'blueprintEmas' }
        };
        boxData = fallback[tier];
    }
    
    if ((userData.gold || 0) < boxData.harga) {
        return alert(`Gold tidak cukup! Butuh ${boxData.harga.toLocaleString()} Gold`);
    }
    if (!confirm(`Beli Box ${tier.charAt(0).toUpperCase() + tier.slice(1)} seharga ${boxData.harga.toLocaleString()} Gold?`)) return;

    try {
        await db.collection('users').doc(currentUser.uid).update({
            gold: firebase.firestore.FieldValue.increment(-boxData.harga)
        });
        
        const paluCount = Math.floor(Math.random() * (boxData.paluMax - boxData.paluMin + 1)) + boxData.paluMin;
        const stoneCount = Math.floor(Math.random() * (boxData.stoneMax - boxData.stoneMin + 1)) + boxData.stoneMin;
        const invUpdate = {
            'inventory.palu': firebase.firestore.FieldValue.increment(paluCount),
            'inventory.stone': firebase.firestore.FieldValue.increment(stoneCount)
        };
        
        let bpMsg = '';
        const bpRoll = Math.random() * 100;
        if (bpRoll < boxData.bpChance) {
            invUpdate[`inventory.${boxData.bpType}`] = firebase.firestore.FieldValue.increment(1);
            const bpLabels = {
                blueprintKayu: '📜 BP Kayu',
                blueprintSilver: '📜 BP Silver',
                blueprintEmas: '📜 BP Emas',
                blueprintDiamond: '💎 BP Diamond'
            };
            bpMsg = `\n${bpLabels[boxData.bpType] || 'BP'}!`;
        }
        
        await db.collection('users').doc(currentUser.uid).update(invUpdate);
        
        // CEK HEWAN
        let hewanMsg = '';
        if (typeof getFarmSettings === 'function' && typeof giveRandomHewan === 'function') {
            const farmSettings = getFarmSettings();
            const boxChance = farmSettings?.boxChance?.[tier] || 0;
            const roll = Math.random() * 100;
            if (roll < boxChance) {
                const hewanType = await giveRandomHewan(currentUser.uid);
                if (hewanType) {
                    const hewanNames = { ayam: '🐔 Ayam', bebek: '🦆 Bebek', kambing: '🐐 Kambing', sapi: '🐄 Sapi' };
                    hewanMsg = `\n🎉 Dapat ${hewanNames[hewanType]} dari box!`;
                }
            }
        }
        
        document.getElementById('boxResult').innerHTML = `
            <div class="result-success">
                🎉 Box ${tier} terbuka!<br>
                🔨 +${paluCount} Palu<br>
                🪨 +${stoneCount} Stone${bpMsg}${hewanMsg}
            </div>
        `;
        
        await loadUserData();
    } catch (error) {
        alert('❌ Gagal buka box: ' + error.message);
    }
}

// ============================================================
// TRANSFER & GIFT
// ============================================================
async function cariPlayer() {
    const username = document.getElementById('transferUsername').value.trim();
    if (!username) return alert('Masukkan username!');
    try {
        const q = db.collection('users').where('username', '==', username);
        const snap = await q.get();
        if (snap.empty) {
            alert('❌ Player tidak ditemukan!');
            targetUser = null;
            document.getElementById('transferTarget').style.display = 'none';
            return;
        }
        const doc = snap.docs[0];
        targetUser = { uid: doc.id, ...doc.data() };
        if (targetUser.uid === currentUser.uid) {
            alert('❌ Tidak bisa transfer ke diri sendiri!');
            targetUser = null;
            document.getElementById('transferTarget').style.display = 'none';
            return;
        }
        document.getElementById('transferTarget').style.display = 'block';
        document.getElementById('targetName').textContent = targetUser.username;
        document.getElementById('targetGold').textContent = targetUser.gold || 0;
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function transferGold() {
    if (!targetUser) return alert('Cari player dulu!');
    if (targetUser.uid === currentUser.uid) return alert('❌ Tidak bisa transfer ke diri sendiri!');
    const amount = parseInt(document.getElementById('transferGoldAmount').value);
    if (!amount || amount < 1000000) return alert('Minimal transfer 1.000.000 Gold!');
    if (amount > 1000000000) return alert('Maksimal transfer 1.000.000.000 Gold!');
    if (amount > (userData.gold || 0)) return alert('Gold tidak cukup!');
    const tax = Math.floor(amount * 0.05);
    const net = amount - tax;
    
    if (!confirm(`Kirim ${amount.toLocaleString()} Gold ke ${targetUser.username}? Pajak 5% (${tax.toLocaleString()}), penerima dapat ${net.toLocaleString()}`)) return;
    
    try {
        await db.runTransaction(async (transaction) => {
            const fromRef = db.collection('users').doc(currentUser.uid);
            const toRef = db.collection('users').doc(targetUser.uid);
            const fromDoc = await transaction.get(fromRef);
            const toDoc = await transaction.get(toRef);
            if (!toDoc.exists) throw new Error('Player tujuan tidak ditemukan!');
            transaction.update(fromRef, { gold: (fromDoc.data().gold || 0) - amount });
            transaction.update(toRef, { gold: (toDoc.data().gold || 0) + net });
        });
        document.getElementById('transferMessage').innerHTML = `<span class="success">✅ Transfer ${amount.toLocaleString()} Gold ke ${targetUser.username} berhasil! (Pajak ${tax.toLocaleString()})</span>`;
        await loadUserData();
    } catch (error) {
        document.getElementById('transferMessage').innerHTML = `<span class="error">❌ ${error.message}</span>`;
    }
}

async function giftMaterial() {
    if (!targetUser) return alert('Cari player dulu!');
    if (targetUser.uid === currentUser.uid) return alert('❌ Tidak bisa gift ke diri sendiri!');
    const type = document.getElementById('giftMaterialType').value;
    const amount = parseInt(document.getElementById('giftMaterialAmount').value);
    if (!amount || amount < 1) return alert('Masukkan jumlah!');
    const inv = userData.inventory;
    if ((inv[type] || 0) < amount) return alert(`Material tidak cukup! Punya: ${inv[type] || 0}`);
    
    if (!confirm(`Kirim ${amount} ${type} ke ${targetUser.username}?`)) return;
    
    try {
        await db.runTransaction(async (transaction) => {
            const fromRef = db.collection('users').doc(currentUser.uid);
            const toRef = db.collection('users').doc(targetUser.uid);
            const fromDoc = await transaction.get(fromRef);
            const toDoc = await transaction.get(toRef);
            if (!toDoc.exists) throw new Error('Player tujuan tidak ditemukan!');
            const fromData = fromDoc.data();
            const toData = toDoc.data();
            transaction.update(fromRef, { [`inventory.${type}`]: (fromData.inventory[type] || 0) - amount });
            transaction.update(toRef, { [`inventory.${type}`]: (toData.inventory[type] || 0) + amount });
        });
        document.getElementById('transferMessage').innerHTML = `<span class="success">✅ ${amount} ${type} berhasil dikirim ke ${targetUser.username}!</span>`;
        await loadUserData();
    } catch (error) {
        document.getElementById('transferMessage').innerHTML = `<span class="error">❌ ${error.message}</span>`;
    }
}

// ============================================================
// BAGIAN 5: CHAT (PUBLIC + PRIVATE)
// ============================================================

let chatTab = 'public';

function switchChatTab(tab) {
    chatTab = tab;
    document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.chat-section').forEach(s => s.classList.remove('active'));
    if (tab === 'public') {
        document.querySelector('.chat-tab[onclick="switchChatTab(\'public\')"]').classList.add('active');
        document.getElementById('publicChat').classList.add('active');
    } else {
        document.querySelector('.chat-tab[onclick="switchChatTab(\'private\')"]').classList.add('active');
        document.getElementById('privateChat').classList.add('active');
        loadPrivateChatList();
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message || !currentUser || !userData) return;
    try {
        await db.collection('chatMessages').add({
            senderId: currentUser.uid,
            senderUsername: userData.username,
            message: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        input.value = '';
    } catch (error) {
        console.error('Chat error:', error);
    }
}

function loadChat() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    db.collection('chatMessages')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot((snapshot) => {
            const messages = snapshot.docs.map(doc => doc.data()).reverse();
            container.innerHTML = messages.map(msg => `
                <div class="chat-message">
                    <strong onclick="viewProfile('${msg.senderId}')">${msg.senderUsername || 'Unknown'}</strong>
                    <span>${msg.message}</span>
                    <small>${msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString() : ''}</small>
                </div>
            `).join('');
            container.scrollTop = container.scrollHeight;
        });
}

// ============================================================
// PRIVATE CHAT (DM)
// ============================================================
function openPrivateChat(uid, username) {
    if (!currentUser) return;
    privateChatTarget = uid;
    privateChatTargetUsername = username || 'Unknown';
    document.getElementById('privateChatTarget').textContent = privateChatTargetUsername;
    document.getElementById('privateChatBox').style.display = 'block';
    document.getElementById('privateChatList').style.display = 'none';
    loadPrivateMessages(uid);
    switchChatTab('private');
}

function closePrivateChat() {
    privateChatTarget = null;
    privateChatTargetUsername = '';
    document.getElementById('privateChatBox').style.display = 'none';
    document.getElementById('privateChatList').style.display = 'block';
}

async function loadPrivateChatList() {
    const container = document.getElementById('privateChatList');
    if (!container) return;
    try {
        const snap1 = await db.collection('privateMessages')
            .where('fromUid', '==', currentUser.uid)
            .get();
        const snap2 = await db.collection('privateMessages')
            .where('toUid', '==', currentUser.uid)
            .get();
        const users = new Map();
        snap1.forEach(doc => {
            const data = doc.data();
            const uid = data.toUid;
            const username = data.toUsername || 'Unknown';
            if (!users.has(uid)) users.set(uid, { username: username, last: data.timestamp });
        });
        snap2.forEach(doc => {
            const data = doc.data();
            const uid = data.fromUid;
            const username = data.fromUsername || 'Unknown';
            if (!users.has(uid)) users.set(uid, { username: username, last: data.timestamp });
        });
        if (users.size === 0) {
            container.innerHTML = '<p style="color:#8899aa;text-align:center;">Belum ada chat privat.</p>';
            return;
        }
        let html = '';
        for (let [uid, data] of users) {
            let displayName = data.username;
            if (displayName === 'Unknown') {
                try {
                    const doc = await db.collection('users').doc(uid).get();
                    if (doc.exists) displayName = doc.data().username || 'Unknown';
                } catch (e) {}
            }
            const unread = await checkUnread(uid);
            html += `
                <div class="private-chat-item" onclick="openPrivateChat('${uid}', '${displayName}')">
                    <span class="pc-name">${displayName}</span>
                    ${unread > 0 ? `<span class="pc-unread">${unread}</span>` : ''}
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (e) { console.error('Error loading private chat list:', e); }
}

async function checkUnread(uid) {
    try {
        const snap = await db.collection('privateMessages')
            .where('toUid', '==', currentUser.uid)
            .where('fromUid', '==', uid)
            .where('read', '==', false)
            .get();
        return snap.size;
    } catch (e) { return 0; }
}

async function loadPrivateMessages(uid) {
    const container = document.getElementById('privateMessages');
    if (!container) return;
    try {
        const snap1 = await db.collection('privateMessages')
            .where('fromUid', '==', currentUser.uid)
            .where('toUid', '==', uid)
            .get();
        const snap2 = await db.collection('privateMessages')
            .where('fromUid', '==', uid)
            .where('toUid', '==', currentUser.uid)
            .get();
        let allMessages = [];
        snap1.forEach(doc => allMessages.push({ id: doc.id, ...doc.data() }));
        snap2.forEach(doc => allMessages.push({ id: doc.id, ...doc.data() }));
        allMessages.sort((a, b) => {
            const tA = a.timestamp?.toMillis?.() || 0;
            const tB = b.timestamp?.toMillis?.() || 0;
            return tA - tB;
        });
        const batch = db.batch();
        allMessages.forEach(msg => {
            if (msg.toUid === currentUser.uid && msg.read === false) {
                batch.update(db.collection('privateMessages').doc(msg.id), { read: true });
            }
        });
        await batch.commit();
        container.innerHTML = allMessages.map(msg => {
            const isMe = msg.fromUid === currentUser.uid;
            return `
                <div class="chat-message" style="${isMe ? 'text-align:right;' : ''}">
                    <strong>${isMe ? 'Kamu' : (msg.fromUsername || 'Unknown')}:</strong>
                    <span>${msg.message}</span>
                    <small>${msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString() : ''}</small>
                </div>
            `;
        }).join('');
        container.scrollTop = container.scrollHeight;
    } catch (e) { console.error('Error load private messages:', e); }
}

async function sendPrivateMessage() {
    if (!currentUser || !userData || !privateChatTarget) return;
    const input = document.getElementById('privateChatInput');
    const message = input.value.trim();
    if (!message) return;
    try {
        await db.collection('privateMessages').add({
            fromUid: currentUser.uid,
            fromUsername: userData.username,
            toUid: privateChatTarget,
            toUsername: privateChatTargetUsername,
            message: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        input.value = '';
        await loadPrivateMessages(privateChatTarget);
    } catch (e) { console.error(e); }
}



// ============================================================
// TAX SETTINGS (ADMIN)
// ============================================================
async function loadTaxSetting() {
    try {
        const doc = await db.collection('gameSettings').doc('tax').get();
        if (doc.exists) {
            const percent = doc.data().percent || 5;
            document.getElementById('taxPercentInput').value = percent;
            document.getElementById('currentTaxDisplay').textContent = percent;
        }
    } catch (e) {}
}

async function saveTaxSetting() {
    if (!userData || userData.role !== 'admin') return alert('Hanya admin!');
    const percent = parseFloat(document.getElementById('taxPercentInput').value);
    if (isNaN(percent) || percent < 0 || percent > 50) {
        document.getElementById('taxMessage').innerHTML = '<span class="error">❌ Masukkan angka 0-50!</span>';
        return;
    }
    try {
        await db.collection('gameSettings').doc('tax').set({
            percent: percent,
            updatedBy: currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        document.getElementById('currentTaxDisplay').textContent = percent;
        document.getElementById('taxMessage').innerHTML = `<span class="success">✅ Pajak diubah ke ${percent}%</span>`;
    } catch (e) {
        document.getElementById('taxMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}


// ============================================================
// BAGIAN 7: PROFILE + LEADERBOARD + INIT
// ============================================================

// ============================================================
// PROFILE
// ============================================================
async function updateDescription() {
    if (!currentUser) return;
    const desc = document.getElementById('profileDesc').value;
    try {
        await db.collection('users').doc(currentUser.uid).update({ description: desc });
        alert('✅ Deskripsi berhasil diupdate!');
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
}


// ============================================================
// MINEBOOM 3 RUANGAN
// ============================================================

let currentMineBoomRoom = null;
let mineBoomBoard = [];
let mineBoomRevealed = [];
let mineBoomBombs = [];
let mineBoomTotalReward = 0;
let mineBoomActive = false;

async function selectMineBoomRoom(room) {
    if (!currentUser || !userData) return alert('Login dulu!');
    const rooms = getMineBoomRooms();
    const roomData = rooms[room];
    if (!roomData) return alert('Ruangan tidak valid!');
    if ((userData.gold || 0) < roomData.cost) {
        alert(`Gold tidak cukup! Butuh ${roomData.cost.toLocaleString()} Gold`);
        return;
    }
    if (!confirm(`Masuk Ruangan ${room}? Biaya ${roomData.cost.toLocaleString()} Gold akan dipotong.`)) return;

    db.collection('users').doc(currentUser.uid).update({
        gold: firebase.firestore.FieldValue.increment(-roomData.cost)
    }).then(() => {
        loadUserData();
        currentMineBoomRoom = room;
        initMineBoom(room);
        document.getElementById('mineboomGameArea').style.display = 'block';
        document.getElementById('mineboomResult').textContent = '';
        document.getElementById('mineboomStatus').textContent = `🔍 Ruangan ${room} - Buka kotak! (${roomData.bombs} bom)`;
        document.querySelector('.btn-cashout').style.display = 'none';
        mineBoomTotalReward = 0;
        setTimeout(() => {
            document.getElementById('mineboomGameArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }).catch(err => alert('Gagal: ' + err.message));
}

function initMineBoom(room) {
    const rooms = getMineBoomRooms();  // 🔥 PAKAI GETTER
    const roomData = rooms[room];
    if (!roomData) return;
    const totalCells = 16;
    mineBoomRevealed = Array(totalCells).fill(false);
    mineBoomBombs = [];
    mineBoomBoard = [];

    while (mineBoomBombs.length < roomData.bombs) {
        const idx = Math.floor(Math.random() * totalCells);
        if (!mineBoomBombs.includes(idx)) mineBoomBombs.push(idx);
    }

    for (let i = 0; i < totalCells; i++) {
        if (mineBoomBombs.includes(i)) {
            mineBoomBoard[i] = '💥';
        } else {
            // 🔥 PAKAI min & max (bukan rewardMin/rewardMax)
            const reward = Math.floor(Math.random() * (roomData.max - roomData.min + 1)) + roomData.min;
            mineBoomBoard[i] = reward;
        }
    }

    renderMineBoomBoard();
    mineBoomActive = true;
}
function renderMineBoomBoard() {
    const board = document.getElementById('mineboomBoard');
    board.innerHTML = '';
    for (let i = 0; i < 16; i++) {
        const cell = document.createElement('div');
        cell.className = 'mineboom-cell hidden';
        cell.id = `mb-${i}`;
        cell.textContent = '❓';
        cell.onclick = () => revealMineBoomCell(i);
        board.appendChild(cell);
    }
}

async function revealMineBoomCell(index) {
    if (!mineBoomActive) return;
    if (mineBoomRevealed[index]) return;

    const cell = document.getElementById(`mb-${index}`);
    const val = mineBoomBoard[index];

    if (val === '💥') {
        cell.className = 'mineboom-cell revealed boom';
        cell.textContent = '💥';
        mineBoomActive = false;
        document.querySelector('.btn-cashout').style.display = 'none';
        document.getElementById('mineboomResult').textContent = `💥 BOOM! Game over. Total hadiah: ${mineBoomTotalReward.toLocaleString()} Gold`;
        document.getElementById('mineboomStatus').textContent = '💥 Kena bom!';
        return;
    }

    mineBoomRevealed[index] = true;
    cell.className = 'mineboom-cell revealed';
    cell.textContent = `+${val}`;
    cell.classList.add('reward');
    mineBoomTotalReward += val;

    document.getElementById('mineboomResult').textContent = `🎁 Dapat +${val} Gold | Total: ${mineBoomTotalReward.toLocaleString()} Gold`;
    document.getElementById('mineboomStatus').textContent = `💰 Total hadiah: ${mineBoomTotalReward.toLocaleString()} Gold`;

    if (mineBoomTotalReward > 0) {
        document.querySelector('.btn-cashout').style.display = 'inline-block';
    }

    const revealedCount = mineBoomRevealed.filter(r => r).length;
    const safeCells = 16 - mineBoomBombs.length;
    if (revealedCount >= safeCells) {
        await cashOutMineBoom();
    }
}

async function cashOutMineBoom() {
    if (!mineBoomActive) return;
    if (mineBoomTotalReward <= 0) {
        alert('Tidak ada hadiah untuk diambil!');
        return;
    }
    mineBoomActive = false;
    const profit = mineBoomTotalReward;
    await db.collection('users').doc(currentUser.uid).update({
        gold: firebase.firestore.FieldValue.increment(profit),
        totalGoldMined: firebase.firestore.FieldValue.increment(profit)
    });
    const materialMsg = await giveRandomMaterial();
    let resultMsg = `💰 Cashout! +${profit.toLocaleString()} Gold`;
    if (materialMsg) resultMsg += ' | ' + materialMsg;
    document.getElementById('mineboomResult').textContent = resultMsg;
    document.getElementById('mineboomStatus').textContent = '✅ Selesai!';
    document.querySelector('.btn-cashout').style.display = 'none';
    await loadUserData();
}

function resetMineBoom() {
    currentMineBoomRoom = null;
    mineBoomActive = false;
    document.getElementById('mineboomGameArea').style.display = 'none';
    document.getElementById('mineboomBoard').innerHTML = '';
    document.getElementById('mineboomResult').textContent = '';
    document.getElementById('mineboomStatus').textContent = '';
    document.querySelector('.btn-cashout').style.display = 'none';
}

// ============================================================
// PVP 2 RUANGAN
// ============================================================
const PVP_ROOMS = {
    1: { minBet: 10000, maxBet: 1000000 },
    2: { minBet: 5000000, maxBet: 50000000 }
};

let currentPvpRoom = null;

function selectPvpRoom(room) {
    if (!currentUser || !userData) return alert('Login dulu!');
    currentPvpRoom = room;
    document.getElementById('pvpGameArea').style.display = 'block';
    document.getElementById('pvpResult').textContent = '';
    document.getElementById('pvpBetMessage').textContent = '';
    pvpBets = [];
    pvpTimeLeft = 120;
    pvpLocked = false;
    if (pvpTimerInterval) clearInterval(pvpTimerInterval);
    document.getElementById('pvpTimer').textContent = '--:--';
    document.getElementById('pvpPlayerCount').textContent = '0';
    document.getElementById('pvpPot').textContent = '0';
    document.getElementById('pvpPercent').textContent = '0%';
    document.querySelector('.btn-pvp-bet').disabled = false;
    loadLastPvpWinner(room);
    loadPvpBets(room);
    setTimeout(() => {
        document.getElementById('pvpGameArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

async function loadLastPvpWinner(room) {
    try {
        const doc = await db.collection('pvpHistory').doc(`room${room}`).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('pvpLastWinner').textContent = data.winner || '-';
            document.getElementById('pvpLastWin').textContent = data.winAmount || 0;
        }
    } catch (e) {}
}

async function loadPvpBets(room) {
    try {
        const snapshot = await db.collection('pvpBets').where('room', '==', room).get();
        pvpBets = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            pvpBets.push({ uid: data.uid, username: data.username, bet: data.bet });
        });
        updatePvpUI();
        if (pvpBets.length >= 2 && !pvpLocked) {
            startPvpTimer(room);
        } else {
            document.getElementById('pvpTimer').textContent = '--:--';
        }
    } catch (e) { console.error(e); }
}

function updatePvpUI() {
    const totalPot = pvpBets.reduce((sum, b) => sum + b.bet, 0);
    document.getElementById('pvpPlayerCount').textContent = pvpBets.length;
    document.getElementById('pvpPot').textContent = totalPot.toLocaleString();
    const myBet = pvpBets.find(b => b.uid === currentUser.uid)?.bet || 0;
    const percent = totalPot > 0 ? ((myBet / totalPot) * 100) : 0;
    document.getElementById('pvpPercent').textContent = percent.toFixed(1) + '%';
}

function startPvpTimer(room) {
    if (pvpTimerInterval) clearInterval(pvpTimerInterval);
    pvpTimeLeft = 120;
    pvpLocked = false;
    document.querySelector('.btn-pvp-bet').disabled = false;
    pvpTimerInterval = setInterval(() => {
        pvpTimeLeft--;
        if (pvpTimeLeft <= 15) {
            document.querySelector('.btn-pvp-bet').disabled = true;
            pvpLocked = true;
        }
        if (pvpTimeLeft <= 0) {
            clearInterval(pvpTimerInterval);
            determinePvpWinner(room);
            return;
        }
        const minutes = Math.floor(pvpTimeLeft / 60);
        const seconds = pvpTimeLeft % 60;
        document.getElementById('pvpTimer').textContent = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        updatePvpUI();
    }, 1000);
}

function determinePvpWinner(room) {
    if (pvpBets.length < 2) {
        document.getElementById('pvpResult').textContent = '❌ Tidak cukup player, bet dikembalikan.';
        pvpBets.forEach(async (b) => {
            await db.collection('users').doc(b.uid).update({
                gold: firebase.firestore.FieldValue.increment(b.bet)
            });
        });
        pvpBets = [];
        updatePvpUI();
        return;
    }
    const totalPot = pvpBets.reduce((sum, b) => sum + b.bet, 0);
    const rand = Math.floor(Math.random() * totalPot) + 1;
    let cumulative = 0;
    let winner = null;
    for (let b of pvpBets) {
        cumulative += b.bet;
        if (rand <= cumulative) {
            winner = b;
            break;
        }
    }
    if (!winner) winner = pvpBets[pvpBets.length - 1];
    const tax = Math.floor(totalPot * 0.1);
    const winAmount = totalPot - tax;

    db.collection('users').doc(winner.uid).update({
        gold: firebase.firestore.FieldValue.increment(winAmount),
        totalGoldMined: firebase.firestore.FieldValue.increment(winAmount)
    }).then(async () => {
        const materialMsg = await giveRandomMaterial();
        await db.collection('pvpHistory').doc(`room${room}`).set({
            winner: winner.username,
            winAmount: winAmount,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        let resultText = `🏆 ${winner.username} menang! +${winAmount.toLocaleString()} Gold (pajak ${tax.toLocaleString()})`;
        if (materialMsg) resultText += ' | ' + materialMsg;
        // HEWAN DARI PVP (8% UNTUK PEMENANG)
if (typeof giveRandomHewan === 'function') {
    const roll = Math.random() * 100;
    if (roll < 8) {
        const hewanType = await giveRandomHewan(winner.uid);
        if (hewanType) {
            const hewanNames = { ayam: '🐔 Ayam', bebek: '🦆 Bebek', kambing: '🐐 Kambing', sapi: '🐄 Sapi' };
            resultText += ' | 🎉 Dapat ' + hewanNames[hewanType] + '!';
        }
    }
}
        document.getElementById('pvpResult').innerHTML = resultText;
        document.getElementById('pvpLastWinner').textContent = winner.username;
        document.getElementById('pvpLastWin').textContent = winAmount.toLocaleString();
        await db.collection('pvpBets').where('room', '==', room).get().then(snap => {
            snap.forEach(doc => doc.ref.delete());
        });
        pvpBets = [];
        updatePvpUI();
        document.querySelector('.btn-pvp-bet').disabled = false;
        document.getElementById('pvpTimer').textContent = '--:--';
    }).catch(err => alert('Gagal: ' + err.message));
}

async function placePvpBet() {
    if (!currentUser || !userData) return alert('Login dulu!');
    if (!currentPvpRoom) return alert('Pilih ruangan dulu!');
    const roomData = PVP_ROOMS[currentPvpRoom];
    const bet = parseInt(document.getElementById('pvpBetInput').value);
    if (!bet || bet < roomData.minBet) return alert(`Minimal bet ${roomData.minBet.toLocaleString()} Gold!`);
    if (bet > roomData.maxBet) return alert(`Maksimal bet ${roomData.maxBet.toLocaleString()} Gold!`);
    if (bet > (userData.gold || 0)) return alert('Gold tidak cukup!');
    if (pvpLocked) return alert('Taruhan sudah ditutup!');
    const existing = pvpBets.find(b => b.uid === currentUser.uid);
    if (existing) return alert('Kamu sudah pasang bet!');

    await db.collection('users').doc(currentUser.uid).update({
        gold: firebase.firestore.FieldValue.increment(-bet)
    });
    await db.collection('pvpBets').add({
        room: currentPvpRoom,
        uid: currentUser.uid,
        username: userData.username,
        bet: bet,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    pvpBets.push({ uid: currentUser.uid, username: userData.username, bet: bet });
    updatePvpUI();
    document.getElementById('pvpBetMessage').textContent = '✅ Bet terpasang!';
    document.getElementById('pvpBetMessage').style.color = '#44ff88';
    document.getElementById('pvpBetInput').value = '';
    await loadUserData();

    if (pvpBets.length >= 2 && !pvpTimerInterval) {
        startPvpTimer(currentPvpRoom);
    }
}

// ============================================================
// AUCTION (LELANG)
// ============================================================
async function loadAuctions() {
    const container = document.getElementById('auctionList');
    if (!container) return;
    try {
        const snap = await db.collection('auctions').where('status', '==', 'active').get();
        if (snap.empty) {
            container.innerHTML = '<p style="color:#8899aa;text-align:center;">Belum ada lelang aktif.</p>';
            return;
        }
        let html = '';
        snap.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            const timeLeft = data.endTime ? Math.max(0, Math.floor((data.endTime.toMillis() - Date.now()) / 1000)) : 0;
            html += `
                <div class="auction-item" onclick="openAuctionDetail('${id}')">
                    <div class="ai-header">
                        <span class="ai-name">${data.itemName || 'Item'}</span>
                        <span class="ai-price">💰 ${data.currentBid || data.startingPrice || 0} Gold</span>
                        <span class="ai-status active">${timeLeft > 0 ? '⏱️ ' + formatTime(timeLeft) : '🟢 Aktif'}</span>
                    </div>
                    <div class="ai-desc">${data.description || ''}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) { console.error(e); }
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function openAuctionDetail(auctionId) {
    currentAuctionId = auctionId;
    const doc = await db.collection('auctions').doc(auctionId).get();
    if (!doc.exists) return alert('Lelang tidak ditemukan!');
    const data = doc.data();
    document.getElementById('auctionDetail').style.display = 'block';
    document.getElementById('auctionItemName').textContent = data.itemName || 'Item';
    document.getElementById('auctionDesc').textContent = data.description || '';
    document.getElementById('auctionCurrentBid').textContent = (data.currentBid || data.startingPrice || 0).toLocaleString();
    document.getElementById('auctionTopBidder').textContent = data.currentBidder || '-';
    document.getElementById('auctionMinIncrement').textContent = data.minBidIncrement || 0;
    document.getElementById('auctionBidMessage').textContent = '';
    document.getElementById('auctionBidInput').value = '';
    if (auctionTimerInterval) clearInterval(auctionTimerInterval);
    updateAuctionTimer(data);
    auctionTimerInterval = setInterval(async () => {
        const doc2 = await db.collection('auctions').doc(auctionId).get();
        if (doc2.exists) updateAuctionTimer(doc2.data());
    }, 1000);
    setTimeout(() => {
        document.getElementById('auctionDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

function updateAuctionTimer(data) {
    const endTime = data.endTime;
    if (!endTime) return;
    const remaining = Math.max(0, Math.floor((endTime.toMillis() - Date.now()) / 1000));
    document.getElementById('auctionTimeLeft').textContent = formatTime(remaining);
    if (remaining <= 0) {
        clearInterval(auctionTimerInterval);
        endAuction(currentAuctionId);
    }
}

async function endAuction(auctionId) {
    const doc = await db.collection('auctions').doc(auctionId).get();
    if (!doc.exists) return;
    const data = doc.data();
    if (data.status !== 'active') return;
    await db.collection('auctions').doc(auctionId).update({
        status: 'ended',
        winner: data.currentBidder || null
    });
    if (data.currentBidder) {
        const itemType = data.itemType || 'palu';
        await db.collection('users').doc(data.currentBidder).update({
            [`inventory.${itemType}`]: firebase.firestore.FieldValue.increment(1)
        });
    }
    document.getElementById('auctionTimeLeft').textContent = 'Selesai!';
    document.getElementById('auctionBidMessage').textContent = '✅ Lelang berakhir!';
    document.getElementById('auctionBidMessage').style.color = '#44ff88';
    loadAuctions();
}

async function placeBid() {
    if (!currentUser || !userData) return alert('Login dulu!');
    if (!currentAuctionId) return alert('Pilih lelang dulu!');
    const doc = await db.collection('auctions').doc(currentAuctionId).get();
    if (!doc.exists) return alert('Lelang tidak ditemukan!');
    const data = doc.data();
    if (data.status !== 'active') return alert('Lelang sudah berakhir!');
    const currentBid = data.currentBid || data.startingPrice || 0;
    const minIncrement = data.minBidIncrement || 0;
    const bidInput = document.getElementById('auctionBidInput');
    const bid = parseInt(bidInput.value);
    if (!bid || bid < currentBid + minIncrement) {
        return alert(`Minimal bid ${(currentBid + minIncrement).toLocaleString()} Gold!`);
    }
    if (bid > (userData.gold || 0)) return alert('Gold tidak cukup!');

    await db.collection('users').doc(currentUser.uid).update({
        gold: firebase.firestore.FieldValue.increment(-bid)
    });
    if (data.currentBidder) {
        await db.collection('users').doc(data.currentBidder).update({
            gold: firebase.firestore.FieldValue.increment(data.currentBid || 0)
        });
    }
    await db.collection('auctions').doc(currentAuctionId).update({
        currentBid: bid,
        currentBidder: currentUser.uid,
        currentBidderName: userData.username
    });
    document.getElementById('auctionBidMessage').textContent = `✅ Bid ${bid.toLocaleString()} Gold terpasang!`;
    document.getElementById('auctionBidMessage').style.color = '#44ff88';
    bidInput.value = '';
    await loadUserData();
    await openAuctionDetail(currentAuctionId);
}

// ============================================================
// NOTIFICATION (RUNNING TEXT)
// ============================================================
async function loadNotifications() {
    try {
        const snap = await db.collection('notifications').where('active', '==', true).get();
        const el = document.getElementById('runningText');
        const content = document.getElementById('runningTextContent');
        if (snap.empty) {
            el.style.display = 'none';
            return;
        }
        const data = snap.docs[0].data();
        el.style.display = 'block';
        content.textContent = data.message || '';
    } catch (e) { console.error(e); }
}

// ============================================================
// BAGIAN 6: SPIN MODE (FIX) + MARKET (JUAL)
// ============================================================

// ============================================================
// SPIN MODE (FIX - SAMBUNGAN DARI YANG KEPOTONG)
// ============================================================
async function setSpinMode(mode) {
    if (!userData || userData.role !== 'admin') return alert('Hanya admin!');
    if (!SPIN_MODES[mode]) return alert('Mode tidak valid');
    try {
        await db.collection('gameSettings').doc('spin').set({
            mode: mode,
            multiplier: SPIN_MODES[mode].multiplier,
            updatedBy: currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        document.getElementById('currentSpinMode').textContent = SPIN_MODES[mode].label;
        document.getElementById('spinModeMessage').innerHTML = `<span class="success">✅ Mode Spin berubah: ${SPIN_MODES[mode].label}</span>`;
    } catch (e) {
        document.getElementById('spinModeMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

// ============================================================
// MARKET (JUAL-BELI) - BAGIAN 1: LOAD + JUAL
// ============================================================
async function loadMarketListings() {
    const container = document.getElementById('marketListingContainer');
    if (!container) return;
    try {
        const snap = await db.collection('marketListings').where('status', '==', 'active').orderBy('createdAt', 'desc').get();
        if (snap.empty) {
            container.innerHTML = '<p style="color:#8899aa;text-align:center;">Belum ada listing.</p>';
            return;
        }
        let html = '';
        snap.forEach(doc => {
            const data = doc.data();
            const materialLabels = {
    palu: '🔨 Palu',
    stone: '🪨 Stone',
    blueprintKayu: '📜 BP Kayu',
    blueprintSilver: '📜 BP Silver',
    blueprintEmas: '📜 BP Emas',
    blueprintDiamond: '💎 BP Diamond',
    // TAMBAH HEWAN
    telurAyam: '🐔 Telur Ayam',
    telurBebek: '🦆 Telur Bebek',
    anakKambing: '🐐 Anak Kambing',
    anakSapi: '🐄 Anak Sapi'
};
            html += `
                <div class="market-listing-item" data-id="${doc.id}">
                    <span class="ml-material">${materialLabels[data.materialType] || data.materialType}</span>
                    <span class="ml-amount">x${data.amount}</span>
                    <span class="ml-price">💰 ${data.totalPrice.toLocaleString()} Gold</span>
                    <span class="ml-seller">dari ${data.sellerName || 'Unknown'}</span>
                    ${data.sellerId !== currentUser.uid ? `<button class="btn-buy-listing" onclick="buyListing('${doc.id}')">Beli</button>` : `<span style="color:#8899aa;font-size:12px;">Milikmu</span>`}
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error('Error loading market:', e);
        container.innerHTML = '<p style="color:#8899aa;text-align:center;">Error loading market.</p>';
    }
}

async function placeListing() {
    if (!currentUser || !userData) return alert('Login dulu!');
    const materialType = document.getElementById('sellMaterialType').value;
    const amount = parseInt(document.getElementById('sellAmount').value);
    const totalPrice = parseInt(document.getElementById('sellPrice').value);
    if (!amount || amount < 1) return alert('Masukkan jumlah yang valid!');
    if (!totalPrice || totalPrice < 1) return alert('Masukkan harga total yang valid!');
    const inv = userData.inventory;
    if ((inv[materialType] || 0) < amount) return alert(`Material tidak cukup! Punya: ${inv[materialType] || 0}`);

    try {
        await db.collection('users').doc(currentUser.uid).update({
            [`inventory.${materialType}`]: firebase.firestore.FieldValue.increment(-amount)
        });
        await db.collection('marketListings').add({
            sellerId: currentUser.uid,
            sellerName: userData.username,
            materialType: materialType,
            amount: amount,
            totalPrice: totalPrice,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        });
        document.getElementById('marketSellMessage').innerHTML = '<span class="success">✅ Listing berhasil dipasang!</span>';
        document.getElementById('sellAmount').value = '';
        document.getElementById('sellPrice').value = '';
        await loadUserData();
        await loadMarketListings();
    } catch (e) {
        document.getElementById('marketSellMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

// ============================================================
// BAGIAN 7: MARKET (BELI) + TAX SETTINGS
// ============================================================

// ============================================================
// MARKET - BELI LISTING
// ============================================================
async function buyListing(listingId) {
    if (!currentUser || !userData) return alert('Login dulu!');
    const docRef = db.collection('marketListings').doc(listingId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return alert('Listing tidak ditemukan!');
    const data = docSnap.data();
    if (data.status !== 'active') return alert('Listing sudah terjual atau dibatalkan!');
    if (data.sellerId === currentUser.uid) return alert('Tidak bisa membeli listing sendiri!');
    if ((userData.gold || 0) < data.totalPrice) return alert(`Gold tidak cukup! Butuh ${data.totalPrice.toLocaleString()} Gold`);

    let taxPercent = 5;
    try {
        const taxDoc = await db.collection('gameSettings').doc('tax').get();
        if (taxDoc.exists) taxPercent = taxDoc.data().percent || 5;
    } catch (e) {}

    const tax = Math.floor(data.totalPrice * (taxPercent / 100));
    const sellerEarn = data.totalPrice - tax;

    try {
        await db.runTransaction(async (transaction) => {
            const buyerRef = db.collection('users').doc(currentUser.uid);
            const sellerRef = db.collection('users').doc(data.sellerId);
            const listingRef = docRef;

            const buyerDoc = await transaction.get(buyerRef);
            const sellerDoc = await transaction.get(sellerRef);
            if (!buyerDoc.exists || !sellerDoc.exists) throw new Error('User tidak ditemukan!');

            transaction.update(buyerRef, {
                gold: (buyerDoc.data().gold || 0) - data.totalPrice
            });
            transaction.update(sellerRef, {
                gold: (sellerDoc.data().gold || 0) + sellerEarn
            });
            transaction.update(buyerRef, {
                [`inventory.${data.materialType}`]: (buyerDoc.data().inventory?.[data.materialType] || 0) + data.amount
            });
            transaction.update(listingRef, {
                status: 'sold'
            });
        });
        document.getElementById('marketSellMessage').innerHTML = `<span class="success">✅ Berhasil membeli! Pajak ${taxPercent}% (${tax.toLocaleString()} Gold)</span>`;
        await loadUserData();
        await loadMarketListings();
    } catch (e) {
        document.getElementById('marketSellMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

// ============================================================
// TAX SETTINGS (ADMIN)
// ============================================================
async function loadTaxSetting() {
    try {
        const doc = await db.collection('gameSettings').doc('tax').get();
        if (doc.exists) {
            const percent = doc.data().percent || 5;
            document.getElementById('taxPercentInput').value = percent;
            document.getElementById('currentTaxDisplay').textContent = percent;
        }
    } catch (e) {}
}

async function saveTaxSetting() {
    if (!userData || userData.role !== 'admin') return alert('Hanya admin!');
    const percent = parseFloat(document.getElementById('taxPercentInput').value);
    if (isNaN(percent) || percent < 0 || percent > 50) {
        document.getElementById('taxMessage').innerHTML = '<span class="error">❌ Masukkan angka 0-50!</span>';
        return;
    }
    try {
        await db.collection('gameSettings').doc('tax').set({
            percent: percent,
            updatedBy: currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        document.getElementById('currentTaxDisplay').textContent = percent;
        document.getElementById('taxMessage').innerHTML = `<span class="success">✅ Pajak diubah ke ${percent}%</span>`;
    } catch (e) {
        document.getElementById('taxMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

// ============================================================
// BAGIAN 8: PROFILE + LEADERBOARD + INIT
// ============================================================

// ============================================================
// PROFILE
// ============================================================
async function updateDescription() {
    if (!currentUser) return;
    const desc = document.getElementById('profileDesc').value;
    try {
        await db.collection('users').doc(currentUser.uid).update({ description: desc });
        alert('✅ Deskripsi berhasil diupdate!');
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
}

// ============================================================
// ===== FIX: ADMIN + MARKET + PLINKO + SPIN + LEADERBOARD =====
// ============================================================

// ============================================================
// ADMIN FUNCTIONS
// ============================================================
function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    
    if (tab === 'players') {
        document.querySelector('.admin-tab[onclick="switchAdminTab(\'players\')"]').classList.add('active');
        document.getElementById('adminTabPlayers').classList.add('active');
        loadAdminPlayers();
    } else if (tab === 'auction') {
        document.querySelector('.admin-tab[onclick="switchAdminTab(\'auction\')"]').classList.add('active');
        document.getElementById('adminTabAuction').classList.add('active');
    } else if (tab === 'notif') {
        document.querySelector('.admin-tab[onclick="switchAdminTab(\'notif\')"]').classList.add('active');
        document.getElementById('adminTabNotif').classList.add('active');
    } else if (tab === 'plinko') {
        document.querySelector('.admin-tab[onclick="switchAdminTab(\'plinko\')"]').classList.add('active');
        document.getElementById('adminTabPlinko').classList.add('active');
    } else if (tab === 'spin') {
        document.querySelector('.admin-tab[onclick="switchAdminTab(\'spin\')"]').classList.add('active');
        document.getElementById('adminTabSpin').classList.add('active');
    } else if (tab === 'tax') {
        document.querySelector('.admin-tab[onclick="switchAdminTab(\'tax\')"]').classList.add('active');
        document.getElementById('adminTabTax').classList.add('active');
    
    } else if (tab === 'farm') {
    document.querySelector('.admin-tab[onclick="switchAdminTab(\'farm\')"]').classList.add('active');
    document.getElementById('adminTabFarm').classList.add('active');
    } else if (tab === 'mineboom') {
    document.querySelector('.admin-tab[onclick="switchAdminTab(\'mineboom\')"]').classList.add('active');
    document.getElementById('adminTabMineBoom').classList.add('active');
    
    loadFarmSettingsAdmin();  
    } else if (tab === 'box') {
    document.querySelector('.admin-tab[onclick="switchAdminTab(\'box\')"]').classList.add('active');
    document.getElementById('adminTabBox').classList.add('active');
    if (typeof loadBoxSettings === 'function') loadBoxSettings();
}
}


async function loadAdminPlayers() {
    if (userData?.role !== 'admin') return;
    const container = document.getElementById('adminPlayerList');
    if (!container) return;
    try {
        const snap = await db.collection('users').orderBy('username').get();
        container.innerHTML = snap.docs.map(doc => {
            const data = doc.data();
            return `
                <div class="admin-player-item" data-uid="${doc.id}">
                    <span class="ap-name">${data.username || 'Unknown'}</span>
                    <span class="ap-gold">💰 ${(data.gold || 0).toLocaleString()}</span>
                    <span style="font-size:11px;color:#8899aa;">Lv.${data.level || 1}</span>
                    <span style="font-size:11px;color:#8899aa;">${data.isBanned ? '🚫 Banned' : '✅'}</span>
                    <div class="ap-actions">
                        <button class="btn-admin-add" onclick="adminAddGold('${doc.id}')">+</button>
                        <button class="btn-admin-remove" onclick="adminRemoveGold('${doc.id}')">-</button>
                        <button class="btn-admin-ban" onclick="adminBanPlayer('${doc.id}')">🚫</button>
                        <button class="btn-admin-unban" onclick="adminUnbanPlayer('${doc.id}')">✅</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Error loading admin players:', e);
        container.innerHTML = '<p style="color:#ff4444;">Error loading players.</p>';
    }
}

function adminSearchPlayers() {
    const keyword = document.getElementById('adminSearchPlayer').value.toLowerCase();
    document.querySelectorAll('.admin-player-item').forEach(item => {
        const name = item.querySelector('.ap-name')?.textContent?.toLowerCase() || '';
        item.style.display = name.includes(keyword) ? 'flex' : 'none';
    });
}

async function adminAddGold(uid) {
    if (userData?.role !== 'admin') return alert('Anda bukan admin!');
    const amount = prompt('Tambah gold berapa?');
    if (!amount || isNaN(amount) || parseInt(amount) <= 0) return;
    try {
        await db.collection('users').doc(uid).update({
            gold: firebase.firestore.FieldValue.increment(parseInt(amount))
        });
        loadAdminPlayers();
    } catch (e) { alert('Gagal: ' + e.message); }
}

async function adminRemoveGold(uid) {
    if (userData?.role !== 'admin') return alert('Anda bukan admin!');
    const amount = prompt('Kurang gold berapa?');
    if (!amount || isNaN(amount) || parseInt(amount) <= 0) return;
    try {
        await db.collection('users').doc(uid).update({
            gold: firebase.firestore.FieldValue.increment(-parseInt(amount))
        });
        loadAdminPlayers();
    } catch (e) { alert('Gagal: ' + e.message); }
}

async function adminBanPlayer(uid) {
    if (userData?.role !== 'admin') return alert('Anda bukan admin!');
    if (!confirm('Ban player ini?')) return;
    try {
        await db.collection('users').doc(uid).update({ isBanned: true });
        loadAdminPlayers();
    } catch (e) { alert('Gagal: ' + e.message); }
}

async function adminUnbanPlayer(uid) {
    if (userData?.role !== 'admin') return alert('Anda bukan admin!');
    if (!confirm('Unban player ini?')) return;
    try {
        await db.collection('users').doc(uid).update({ isBanned: false });
        loadAdminPlayers();
    } catch (e) { alert('Gagal: ' + e.message); }
}

// ============================================================
// ADMIN: CREATE AUCTION
// ============================================================
async function createAuction() {
    if (userData?.role !== 'admin') return alert('Anda bukan admin!');
    const itemName = document.getElementById('auctionItemNameInput').value.trim();
    const desc = document.getElementById('auctionDescInput').value.trim();
    const startPrice = parseInt(document.getElementById('auctionStartPrice').value);
    const minBid = parseInt(document.getElementById('auctionMinBid').value);
    const duration = parseInt(document.getElementById('auctionDuration').value);
    const itemType = document.getElementById('auctionItemType').value;
    if (!itemName || !startPrice || !minBid || !duration) {
        document.getElementById('adminAuctionMessage').innerHTML = '<span class="error">❌ Semua field wajib diisi!</span>';
        return;
    }
    try {
        await db.collection('auctions').add({
            itemName: itemName,
            description: desc || '',
            startingPrice: startPrice,
            currentBid: startPrice,
            minBidIncrement: minBid,
            endTime: firebase.firestore.Timestamp.fromMillis(Date.now() + duration * 1000),
            status: 'active',
            itemType: itemType,
            createdBy: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('adminAuctionMessage').innerHTML = '<span class="success">✅ Lelang berhasil dibuat!</span>';
        document.getElementById('auctionItemNameInput').value = '';
        document.getElementById('auctionDescInput').value = '';
        document.getElementById('auctionStartPrice').value = '';
        document.getElementById('auctionMinBid').value = '';
        document.getElementById('auctionDuration').value = '';
        loadAuctions();
    } catch (e) {
        document.getElementById('adminAuctionMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

// ============================================================
// ADMIN: NOTIFICATION
// ============================================================
async function createNotification() {
    if (userData?.role !== 'admin') return alert('Anda bukan admin!');
    const message = document.getElementById('notifMessageInput').value.trim();
    if (!message) {
        document.getElementById('adminNotifMessage').innerHTML = '<span class="error">❌ Masukkan pesan!</span>';
        return;
    }
    try {
        const old = await db.collection('notifications').where('active', '==', true).get();
        old.forEach(doc => doc.ref.delete());
        await db.collection('notifications').add({
            message: message,
            active: true,
            createdBy: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('adminNotifMessage').innerHTML = '<span class="success">✅ Notifikasi terkirim!</span>';
        document.getElementById('notifMessageInput').value = '';
        loadNotifications();
    } catch (e) {
        document.getElementById('adminNotifMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

async function clearNotification() {
    if (userData?.role !== 'admin') return alert('Anda bukan admin!');
    if (!confirm('Hapus notifikasi berjalan?')) return;
    try {
        const snap = await db.collection('notifications').where('active', '==', true).get();
        snap.forEach(doc => doc.ref.delete());
        document.getElementById('adminNotifMessage').innerHTML = '<span class="success">✅ Notifikasi dihapus!</span>';
        loadNotifications();
    } catch (e) {
        document.getElementById('adminNotifMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

// ============================================================
// PLINKO MODE
// ============================================================
const PLINKO_MODES = {
    random: { label: 'Random', bias: 0.50 },
    pinggir: { label: 'Bias Pinggir', bias: 0.75 },
    tengah: { label: 'Bias Tengah', bias: 0.25 }
};

async function loadPlinkoMode() {
    try {
        const doc = await db.collection('gameSettings').doc('plinko').get();
        if (doc.exists) {
            const mode = doc.data().mode || 'random';
            document.getElementById('currentPlinkoMode').textContent = PLINKO_MODES[mode]?.label || 'Random';
            return mode;
        }
    } catch (e) {}
    return 'random';
}

async function setPlinkoMode(mode) {
    if (!userData || userData.role !== 'admin') return alert('Hanya admin!');
    const bias = PLINKO_MODES[mode]?.bias;
    if (bias === undefined) return alert('Mode tidak valid');
    try {
        await db.collection('gameSettings').doc('plinko').set({
            mode: mode,
            biasOutward: bias,
            updatedBy: currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        document.getElementById('currentPlinkoMode').textContent = PLINKO_MODES[mode].label;
        document.getElementById('plinkoModeMessage').innerHTML = `<span class="success">✅ Mode Plinko berubah: ${PLINKO_MODES[mode].label}</span>`;
    } catch (e) {
        document.getElementById('plinkoModeMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

// ============================================================
// SPIN MODE
// ============================================================
const SPIN_MODES = {
    normal: { label: 'Normal', multiplier: 1 },
    easy: { label: 'Easy', multiplier: 2 },
    hard: { label: 'Hard', multiplier: 0.5 }
};

async function loadSpinMode() {
    try {
        const doc = await db.collection('gameSettings').doc('spin').get();
        if (doc.exists) {
            const mode = doc.data().mode || 'normal';
            document.getElementById('currentSpinMode').textContent = SPIN_MODES[mode]?.label || 'Normal';
            return mode;
        }
    } catch (e) {}
    return 'normal';
}

async function setSpinMode(mode) {
    if (!userData || userData.role !== 'admin') return alert('Hanya admin!');
    if (!SPIN_MODES[mode]) return alert('Mode tidak valid');
    try {
        await db.collection('gameSettings').doc('spin').set({
            mode: mode,
            multiplier: SPIN_MODES[mode].multiplier,
            updatedBy: currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        document.getElementById('currentSpinMode').textContent = SPIN_MODES[mode].label;
        document.getElementById('spinModeMessage').innerHTML = `<span class="success">✅ Mode Spin berubah: ${SPIN_MODES[mode].label}</span>`;
    } catch (e) {
        document.getElementById('spinModeMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

// ============================================================
// MARKET (JUAL-BELI)
// ============================================================
async function loadMarketListings() {
    const container = document.getElementById('marketListingContainer');
    if (!container) return;
    try {
        const snap = await db.collection('marketListings').where('status', '==', 'active').orderBy('createdAt', 'desc').get();
        if (snap.empty) {
            container.innerHTML = '<p style="color:#8899aa;text-align:center;">Belum ada listing.</p>';
            return;
        }
        let html = '';
        snap.forEach(doc => {
            const data = doc.data();
            const materialLabels = {
    palu: '🔨 Palu',
    stone: '🪨 Stone',
    blueprintKayu: '📜 BP Kayu',
    blueprintSilver: '📜 BP Silver',
    blueprintEmas: '📜 BP Emas',
    blueprintDiamond: '💎 BP Diamond',
    // TAMBAH HEWAN
    telurAyam: '🐔 Telur Ayam',
    telurBebek: '🦆 Telur Bebek',
    anakKambing: '🐐 Anak Kambing',
    anakSapi: '🐄 Anak Sapi'
};
            html += `
                <div class="market-listing-item" data-id="${doc.id}">
                    <span class="ml-material">${materialLabels[data.materialType] || data.materialType}</span>
                    <span class="ml-amount">x${data.amount}</span>
                    <span class="ml-price">💰 ${data.totalPrice.toLocaleString()} Gold</span>
                    <span class="ml-seller">dari ${data.sellerName || 'Unknown'}</span>
                    ${data.sellerId !== currentUser?.uid ? `<button class="btn-buy-listing" onclick="buyListing('${doc.id}')">Beli</button>` : `<span style="color:#8899aa;font-size:12px;">Milikmu</span>`}
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error('Error loading market:', e);
        container.innerHTML = '<p style="color:#8899aa;text-align:center;">Error loading market. (Butuh index?)</p>';
    }
}

async function placeListing() {
    if (!currentUser || !userData) return alert('Login dulu!');
    const materialType = document.getElementById('sellMaterialType').value;
    const amount = parseInt(document.getElementById('sellAmount').value);
    const totalPrice = parseInt(document.getElementById('sellPrice').value);
    if (!amount || amount < 1) return alert('Masukkan jumlah yang valid!');
    if (!totalPrice || totalPrice < 1) return alert('Masukkan harga total yang valid!');
    const inv = userData.inventory;
    if ((inv[materialType] || 0) < amount) return alert(`Material tidak cukup! Punya: ${inv[materialType] || 0}`);

    try {
        await db.collection('users').doc(currentUser.uid).update({
            [`inventory.${materialType}`]: firebase.firestore.FieldValue.increment(-amount)
        });
        await db.collection('marketListings').add({
            sellerId: currentUser.uid,
            sellerName: userData.username,
            materialType: materialType,
            amount: amount,
            totalPrice: totalPrice,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        });
        document.getElementById('marketSellMessage').innerHTML = '<span class="success">✅ Listing berhasil dipasang!</span>';
        document.getElementById('sellAmount').value = '';
        document.getElementById('sellPrice').value = '';
        await loadUserData();
        await loadMarketListings();
    } catch (e) {
        document.getElementById('marketSellMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

async function buyListing(listingId) {
    if (!currentUser || !userData) return alert('Login dulu!');
    const docRef = db.collection('marketListings').doc(listingId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return alert('Listing tidak ditemukan!');
    const data = docSnap.data();
    if (data.status !== 'active') return alert('Listing sudah terjual atau dibatalkan!');
    if (data.sellerId === currentUser.uid) return alert('Tidak bisa membeli listing sendiri!');
    if ((userData.gold || 0) < data.totalPrice) return alert(`Gold tidak cukup! Butuh ${data.totalPrice.toLocaleString()} Gold`);

    let taxPercent = 5;
    try {
        const taxDoc = await db.collection('gameSettings').doc('tax').get();
        if (taxDoc.exists) taxPercent = taxDoc.data().percent || 5;
    } catch (e) {}

    const tax = Math.floor(data.totalPrice * (taxPercent / 100));
    const sellerEarn = data.totalPrice - tax;

    try {
        await db.runTransaction(async (transaction) => {
            const buyerRef = db.collection('users').doc(currentUser.uid);
            const sellerRef = db.collection('users').doc(data.sellerId);
            const listingRef = docRef;

            const buyerDoc = await transaction.get(buyerRef);
            const sellerDoc = await transaction.get(sellerRef);
            if (!buyerDoc.exists || !sellerDoc.exists) throw new Error('User tidak ditemukan!');

            transaction.update(buyerRef, {
                gold: (buyerDoc.data().gold || 0) - data.totalPrice
            });
            transaction.update(sellerRef, {
                gold: (sellerDoc.data().gold || 0) + sellerEarn
            });
            transaction.update(buyerRef, {
                [`inventory.${data.materialType}`]: (buyerDoc.data().inventory?.[data.materialType] || 0) + data.amount
            });
            transaction.update(listingRef, {
                status: 'sold'
            });
        });
        document.getElementById('marketSellMessage').innerHTML = `<span class="success">✅ Berhasil membeli! Pajak ${taxPercent}% (${tax.toLocaleString()} Gold)</span>`;
        await loadUserData();
        await loadMarketListings();
    } catch (e) {
        document.getElementById('marketSellMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

// ============================================================
// TAX SETTINGS (ADMIN)
// ============================================================
async function loadTaxSetting() {
    try {
        const doc = await db.collection('gameSettings').doc('tax').get();
        if (doc.exists) {
            const percent = doc.data().percent || 5;
            document.getElementById('taxPercentInput').value = percent;
            document.getElementById('currentTaxDisplay').textContent = percent;
        }
    } catch (e) {}
}

async function saveTaxSetting() {
    if (!userData || userData.role !== 'admin') return alert('Hanya admin!');
    const percent = parseFloat(document.getElementById('taxPercentInput').value);
    if (isNaN(percent) || percent < 0 || percent > 50) {
        document.getElementById('taxMessage').innerHTML = '<span class="error">❌ Masukkan angka 0-50!</span>';
        return;
    }
    try {
        await db.collection('gameSettings').doc('tax').set({
            percent: percent,
            updatedBy: currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        document.getElementById('currentTaxDisplay').textContent = percent;
        document.getElementById('taxMessage').innerHTML = `<span class="success">✅ Pajak diubah ke ${percent}%</span>`;
    } catch (e) {
        document.getElementById('taxMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

// ============================================================
// LEADERBOARD (FIX - HANYA 1 DEKLARASI)
// ============================================================
// Pastikan hanya ada 1 deklarasi lbType
let lbType = 'level';

async function loadLeaderboard(type) {
    lbType = type;
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.lb-tab[onclick="loadLeaderboard('${type}')"]`).classList.add('active');
    
    try {
        const snapshot = await db.collection('users').orderBy(type, 'desc').limit(20).get();
        const container = document.getElementById('leaderboardList');
        if (snapshot.empty) {
            container.innerHTML = '<p style="color:#8899aa;text-align:center;">Belum ada data.</p>';
            return;
        }
        let rank = 1;
        container.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            let value = data[type] || 0;
            if (type === 'gold' || type === 'totalGoldMined') value = value.toLocaleString();
            return `
                <div class="lb-item">
                    <span class="rank">#${rank++}</span>
                    <span class="name clickable" onclick="viewProfile('${doc.id}')">${data.username || 'Unknown'}</span>
                    <span class="value">${type === 'level' ? 'Level ' + value : '💰 ' + value}</span>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Leaderboard error:', error);
    }
}

console.log('✅ FIX: Admin + Market + Plinko + Spin + Leaderboard loaded!');

// ============================================================
// INIT
// ============================================================
console.log('🚀 Gold Mine siap!');