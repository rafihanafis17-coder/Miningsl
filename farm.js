// ============================================================
// FARM / PETERNAKAN (js/farm.js) - VERSI LENGKAP
// ============================================================

let farmData = null;
let farmSettings = null;
let farmTimers = {};
let mineboomSettings = null;
let boxSettings = null;

const FARM_DEFAULTS = {
    slotPrices: [25000, 75000, 200000, 500000, 1000000, 2000000],
    hewan: {
        ayam: { pakan: 1000, waktuPanen: 14400, hasilPanen: 2500, umur: 604800, daging: 500 },
        bebek: { pakan: 2000, waktuPanen: 21600, hasilPanen: 5000, umur: 777600, daging: 1000 },
        kambing: { pakan: 5000, waktuPanen: 28800, hasilPanen: 10000, umur: 1036800, daging: 2500 },
        sapi: { pakan: 10000, waktuPanen: 43200, hasilPanen: 20000, umur: 1382400, daging: 5000 }
    },
    boxChance: { elit: 5, master: 12, epic: 20 },
    distribution: { ayam: 45, bebek: 30, kambing: 15, sapi: 10 }
};

const BOX_FALLBACK = {
    elit: {
        harga: 100000,
        paluMin: 1, paluMax: 5,
        stoneMin: 1, stoneMax: 5,
        bpChance: 5,
        bpType: 'blueprintKayu',
        deskripsi: 'Box pemula! Dapatkan material dasar dengan harga {harga} Gold.'
    },
    master: {
        harga: 500000,
        paluMin: 1, paluMax: 10,
        stoneMin: 1, stoneMax: 10,
        bpChance: 3,
        bpType: 'blueprintSilver',
        deskripsi: 'Box menengah! Dapatkan material lebih banyak dengan harga {harga} Gold.'
    },
    epic: {
        harga: 1000000,
        paluMin: 1, paluMax: 15,
        stoneMin: 1, stoneMax: 15,
        bpChance: 1,
        bpType: 'blueprintEmas',
        deskripsi: 'Box Epic! Hadiah terbesar dengan harga {harga} Gold.'
    }
};

// ============================================================
// LOAD FARM
// ============================================================
async function loadFarm() {
    if (!currentUser) return;
    await loadFarmSettings();
    await loadMineBoomSettings();
    await loadBoxSettings();
    await loadUserFarmData();
    renderFarmSlots();
    renderMineBoomRooms();
    renderBoxCards();
    updateFarmInventory();
    startFarmTimers();
}

async function loadFarmSettings() {
    try {
        const doc = await db.collection('gameSettings').doc('farm').get();
        if (doc.exists) {
            farmSettings = doc.data();
        } else {
            farmSettings = JSON.parse(JSON.stringify(FARM_DEFAULTS));
            await db.collection('gameSettings').doc('farm').set(farmSettings);
        }
    } catch (e) {
        console.error('Error loading farm settings:', e);
        farmSettings = JSON.parse(JSON.stringify(FARM_DEFAULTS));
    }
}

async function loadUserFarmData() {
    if (!currentUser) return;
    try {
        const doc = await db.collection('users').doc(currentUser.uid).collection('farm').doc('data').get();
        if (doc.exists) {
            farmData = doc.data();
        } else {
            farmData = {
                slots: Array.from({ length: 6 }, () => ({
                    unlocked: false,
                    hewan: null,
                    status: 'kosong',
                    pakanTerakhir: null,
                    panenSelesai: null,
                    lahir: null,
                    umurHari: 0,
                    hasilTersisa: 0
                }))
            };
            await db.collection('users').doc(currentUser.uid).collection('farm').doc('data').set(farmData);
        }
    } catch (e) {
        console.error('Error loading user farm data:', e);
        farmData = {
            slots: Array.from({ length: 6 }, () => ({
                unlocked: false,
                hewan: null,
                status: 'kosong',
                pakanTerakhir: null,
                panenSelesai: null,
                lahir: null,
                umurHari: 0,
                hasilTersisa: 0
            }))
        };
    }
}

// ============================================================
// RENDER FARM SLOTS
// ============================================================
function renderFarmSlots() {
    const container = document.getElementById('farmSlotsContainer');
    if (!container || !farmData) return;
    const hewanNames = {
        ayam: '🐔 Ayam',
        bebek: '🦆 Bebek',
        kambing: '🐐 Kambing',
        sapi: '🐄 Sapi'
    };
    const hewanIcon = {
        ayam: '🐔',
        bebek: '🦆',
        kambing: '🐐',
        sapi: '🐄'
    };

    container.innerHTML = farmData.slots.map((slot, index) => {
        const slotNum = index + 1;
        const price = farmSettings?.slotPrices?.[index] ?? FARM_DEFAULTS.slotPrices[index];
        let html = `<div class="farm-slot ${slot.unlocked ? 'unlocked' : 'locked'}">`;
        html += `<div class="slot-header"><span>Slot ${slotNum}</span>`;
        if (!slot.unlocked) {
            html += `<span>🔒 ${price.toLocaleString()} G</span>`;
        } else {
            html += `<span>🔓</span>`;
        }
        html += `</div>`;

        if (!slot.unlocked) {
            html += `<div class="slot-icon">🔒</div>`;
            html += `<div class="slot-name">Terkunci</div>`;
            html += `<div class="slot-actions">
                <button class="btn-farm-unlock" onclick="unlockFarmSlot(${index})">🔓 Buka (${price.toLocaleString()} G)</button>
            </div>`;
        } else if (slot.status === 'kosong') {
            html += `<div class="slot-icon">📥</div>`;
            html += `<div class="slot-name">Kosong</div>`;
            html += `<div class="slot-status empty">Kosong</div>`;
            html += `<div class="slot-actions">
                <button class="btn-farm-place" onclick="placeAnimal(${index})">📥 Taruh Hewan</button>
            </div>`;
        } else if (slot.status === 'aktif') {
            const icon = hewanIcon[slot.hewan] || '🐾';
            const name = hewanNames[slot.hewan] || 'Hewan';
            const maxUmur = Math.floor((farmSettings?.hewan?.[slot.hewan]?.umur ?? FARM_DEFAULTS.hewan[slot.hewan].umur) / 86400);
            html += `<div class="slot-icon">${icon}</div>`;
            html += `<div class="slot-name">${name}</div>`;
            html += `<div class="slot-status active">⏳ Produksi...</div>`;
            html += `<div class="slot-timer" id="farmTimer-${index}">⏱️ Menghitung...</div>`;
            html += `<div class="slot-reward">📅 Umur: ${slot.umurHari ?? 0}/${maxUmur} hari</div>`;
            html += `<div class="slot-actions">
                <button disabled style="background:#444;color:#888;cursor:not-allowed;padding:6px 14px;border:none;border-radius:6px;font-weight:bold;font-size:12px;">⏳ Menunggu...</button>
            </div>`;
        } else if (slot.status === 'panen') {
            const icon = hewanIcon[slot.hewan] || '🐾';
            const name = hewanNames[slot.hewan] || 'Hewan';
            const hasil = slot.hasilTersisa || farmSettings?.hewan?.[slot.hewan]?.hasilPanen || FARM_DEFAULTS.hewan[slot.hewan].hasilPanen;
            html += `<div class="slot-icon">${icon}</div>`;
            html += `<div class="slot-name">${name}</div>`;
            html += `<div class="slot-status ready">✅ Siap Panen!</div>`;
            html += `<div class="slot-reward">💰 ${hasil.toLocaleString()} Gold</div>`;
            html += `<div class="slot-actions">
                <button class="btn-farm-harvest" onclick="harvestAnimal(${index})">🔄 Panen</button>
            </div>`;
        } else if (slot.status === 'mati') {
            const name = hewanNames[slot.hewan] || 'Hewan';
            const icon = hewanIcon[slot.hewan] || '🐾';
            const hasilTersisa = slot.hasilTersisa || 0;
            html += `<div class="slot-icon">💀</div>`;
            html += `<div class="slot-name">${name} (Mati)</div>`;
            html += `<div class="slot-status dead">💀 Mati</div>`;
            if (hasilTersisa > 0) {
                html += `<div class="slot-reward">💰 ${hasilTersisa.toLocaleString()} Gold (tersisa)</div>`;
                html += `<div class="slot-actions">
                    <button class="btn-farm-harvest" onclick="harvestAnimal(${index})">🔄 Panen Terakhir</button>
                    <button class="btn-farm-clean" onclick="cleanSlot(${index})">🗑️ Bersihkan</button>
                </div>`;
            } else {
                html += `<div class="slot-actions">
                    <button class="btn-farm-clean" onclick="cleanSlot(${index})">🗑️ Bersihkan</button>
                </div>`;
            }
        }
        html += `</div>`;
        return html;
    }).join('');
}

function updateFarmInventory() {
    if (!userData) return;
    const inv = userData.inventory || {};
    document.getElementById('farmInvAyam').textContent = inv.telurAyam || 0;
    document.getElementById('farmInvBebek').textContent = inv.telurBebek || 0;
    document.getElementById('farmInvKambing').textContent = inv.anakKambing || 0;
    document.getElementById('farmInvSapi').textContent = inv.anakSapi || 0;
}

// ============================================================
// UNLOCK FARM SLOT
// ============================================================
async function unlockFarmSlot(index) {
    if (!currentUser || !userData) return alert('Login dulu!');
    const slot = farmData.slots[index];
    if (slot.unlocked) return alert('Sudah terbuka!');
    const price = farmSettings?.slotPrices?.[index] ?? FARM_DEFAULTS.slotPrices[index];
    if ((userData.gold || 0) < price) return alert(`Gold tidak cukup! Butuh ${price.toLocaleString()} Gold`);

    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(currentUser.uid);
            const farmRef = db.collection('users').doc(currentUser.uid).collection('farm').doc('data');
            const userDoc = await transaction.get(userRef);
            const farmDoc = await transaction.get(farmRef);
            if (!userDoc.exists) throw new Error('User tidak ditemukan!');
            const userGold = userDoc.data().gold || 0;
            if (userGold < price) throw new Error('Gold tidak cukup!');
            transaction.update(userRef, { gold: userGold - price });
            let data = farmDoc.data() || { slots: [] };
            if (!data.slots) data.slots = [];
            while (data.slots.length < 6) data.slots.push({ unlocked: false, hewan: null, status: 'kosong', pakanTerakhir: null, panenSelesai: null, lahir: null, umurHari: 0, hasilTersisa: 0 });
            data.slots[index].unlocked = true;
            transaction.set(farmRef, data);
        });
        await loadUserData();
        await loadUserFarmData();
        renderFarmSlots();
        showFarmResult('✅ Kandang berhasil dibuka!', 'success');
    } catch (e) {
        showFarmResult(`❌ ${e.message}`, 'error');
    }
}

// ============================================================
// PLACE ANIMAL
// ============================================================
async function placeAnimal(index) {
    if (!currentUser || !userData) return alert('Login dulu!');
    const slot = farmData.slots[index];
    if (!slot.unlocked) return alert('Kandang terkunci!');
    if (slot.status !== 'kosong') return alert('Kandang sudah terisi!');

    const inv = userData.inventory || {};
    const hewanMap = {
        telurAyam: { key: 'ayam', label: '🐔 Ayam' },
        telurBebek: { key: 'bebek', label: '🦆 Bebek' },
        anakKambing: { key: 'kambing', label: '🐐 Kambing' },
        anakSapi: { key: 'sapi', label: '🐄 Sapi' }
    };
    const available = Object.keys(hewanMap).filter(t => (inv[t] || 0) > 0);
    if (available.length === 0) return alert('Tidak ada hewan di inventory! Dapatkan dari game atau box.');

    let options = available.map((t, i) => `${i+1}. ${hewanMap[t].label} (${inv[t]} pcs)`).join('\n');
    const choice = prompt(`Pilih hewan untuk ditaruh:\n${options}\n\nMasukkan nomor:`);
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= available.length) return alert('Pilihan tidak valid!');
    const selectedType = available[idx];
    const selectedKey = hewanMap[selectedType].key;

    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(currentUser.uid);
            const farmRef = db.collection('users').doc(currentUser.uid).collection('farm').doc('data');
            const userDoc = await transaction.get(userRef);
            const farmDoc = await transaction.get(farmRef);
            if (!userDoc.exists) throw new Error('User tidak ditemukan!');
            const data = userDoc.data();
            const inv = data.inventory || {};
            if ((inv[selectedType] || 0) < 1) throw new Error('Hewan tidak cukup!');
            const newInv = { ...inv };
            newInv[selectedType] = (newInv[selectedType] || 0) - 1;
            transaction.update(userRef, { inventory: newInv });

            let farmDataDoc = farmDoc.data() || { slots: [] };
            if (!farmDataDoc.slots) farmDataDoc.slots = [];
            while (farmDataDoc.slots.length < 6) farmDataDoc.slots.push({ unlocked: false, hewan: null, status: 'kosong', pakanTerakhir: null, panenSelesai: null, lahir: null, umurHari: 0, hasilTersisa: 0 });
            const now = Date.now();
            farmDataDoc.slots[index] = {
                unlocked: true,
                hewan: selectedKey,
                status: 'aktif',
                pakanTerakhir: null,
                panenSelesai: null,
                lahir: now,
                umurHari: 0,
                hasilTersisa: 0
            };
            transaction.set(farmRef, farmDataDoc);
        });
        await loadUserData();
        await loadUserFarmData();
        renderFarmSlots();
        updateFarmInventory();
        showFarmResult(`✅ ${hewanMap[selectedType].label} berhasil ditaruh!`, 'success');
    } catch (e) {
        showFarmResult(`❌ ${e.message}`, 'error');
    }
}

// ============================================================
// FEED ANIMAL
// ============================================================
async function feedAnimal(index) {
    if (!currentUser || !userData) return alert('Login dulu!');
    const slot = farmData.slots[index];
    if (!slot.unlocked) return alert('Kandang terkunci!');
    if (slot.status === 'kosong') return alert('Kandang kosong!');
    if (slot.status === 'panen') return alert('Hewan siap panen! Klik Panen dulu.');
    if (slot.status === 'mati') return alert('Hewan sudah mati!');
    if (slot.pakanTerakhir) {
        const waktuPanen = farmSettings?.hewan?.[slot.hewan]?.waktuPanen ?? FARM_DEFAULTS.hewan[slot.hewan].waktuPanen;
        const selesai = slot.pakanTerakhir + (waktuPanen * 1000);
        if (Date.now() < selesai) return alert('Hewan masih produksi! Tunggu panen.');
    }

    const pakanPrice = farmSettings?.hewan?.[slot.hewan]?.pakan ?? FARM_DEFAULTS.hewan[slot.hewan].pakan;
    if ((userData.gold || 0) < pakanPrice) return alert(`Gold tidak cukup! Butuh ${pakanPrice.toLocaleString()} Gold untuk pakan`);

    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(currentUser.uid);
            const farmRef = db.collection('users').doc(currentUser.uid).collection('farm').doc('data');
            const userDoc = await transaction.get(userRef);
            const farmDoc = await transaction.get(farmRef);
            if (!userDoc.exists) throw new Error('User tidak ditemukan!');
            const userGold = userDoc.data().gold || 0;
            if (userGold < pakanPrice) throw new Error('Gold tidak cukup!');
            transaction.update(userRef, { gold: userGold - pakanPrice });

            let data = farmDoc.data() || { slots: [] };
            if (!data.slots) data.slots = [];
            while (data.slots.length < 6) data.slots.push({ unlocked: false, hewan: null, status: 'kosong', pakanTerakhir: null, panenSelesai: null, lahir: null, umurHari: 0, hasilTersisa: 0 });
            const now = Date.now();
            const waktuPanen = farmSettings?.hewan?.[slot.hewan]?.waktuPanen ?? FARM_DEFAULTS.hewan[slot.hewan].waktuPanen;
            data.slots[index].pakanTerakhir = now;
            data.slots[index].panenSelesai = now + (waktuPanen * 1000);
            data.slots[index].status = 'aktif';
            if (!data.slots[index].lahir) data.slots[index].lahir = now;
            transaction.set(farmRef, data);
        });
        await loadUserData();
        await loadUserFarmData();
        renderFarmSlots();
        showFarmResult('✅ Pakan diberikan! Tunggu panen.', 'success');
    } catch (e) {
        showFarmResult(`❌ ${e.message}`, 'error');
    }
}

// ============================================================
// HARVEST ANIMAL
// ============================================================
async function harvestAnimal(index) {
    if (!currentUser || !userData) return alert('Login dulu!');
    const slot = farmData.slots[index];
    if (!slot.unlocked) return alert('Kandang terkunci!');
    if (slot.status !== 'panen' && slot.status !== 'mati') return alert('Belum waktunya panen!');
    
    let goldEarned = 0;
    if (slot.status === 'panen') {
        goldEarned = slot.hasilTersisa || farmSettings?.hewan?.[slot.hewan]?.hasilPanen || FARM_DEFAULTS.hewan[slot.hewan].hasilPanen;
    } else if (slot.status === 'mati') {
        goldEarned = slot.hasilTersisa || 0;
        if (goldEarned <= 0) return alert('Tidak ada hasil tersisa!');
    }

    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(currentUser.uid);
            const farmRef = db.collection('users').doc(currentUser.uid).collection('farm').doc('data');
            const userDoc = await transaction.get(userRef);
            const farmDoc = await transaction.get(farmRef);
            if (!userDoc.exists) throw new Error('User tidak ditemukan!');
            const userGold = userDoc.data().gold || 0;
            transaction.update(userRef, { gold: userGold + goldEarned });

            let data = farmDoc.data() || { slots: [] };
            if (!data.slots) data.slots = [];
            while (data.slots.length < 6) data.slots.push({ unlocked: false, hewan: null, status: 'kosong', pakanTerakhir: null, panenSelesai: null, lahir: null, umurHari: 0, hasilTersisa: 0 });
            if (slot.status === 'mati') {
                data.slots[index].status = 'mati';
                data.slots[index].hasilTersisa = 0;
            } else {
                const umurHari = Math.floor((Date.now() - data.slots[index].lahir) / 86400000);
                const maxUmur = Math.floor((farmSettings?.hewan?.[slot.hewan]?.umur ?? FARM_DEFAULTS.hewan[slot.hewan].umur) / 86400);
                if (umurHari >= maxUmur) {
                    data.slots[index].status = 'mati';
                    data.slots[index].hasilTersisa = 0;
                } else {
                    data.slots[index].status = 'aktif';
                    data.slots[index].pakanTerakhir = null;
                    data.slots[index].panenSelesai = null;
                }
            }
            transaction.set(farmRef, data);
        });
        await loadUserData();
        await loadUserFarmData();
        renderFarmSlots();
        showFarmResult(`💰 +${goldEarned.toLocaleString()} Gold!`, 'success');
    } catch (e) {
        showFarmResult(`❌ ${e.message}`, 'error');
    }
}

// ============================================================
// CLEAN SLOT
// ============================================================
async function cleanSlot(index) {
    if (!currentUser || !userData) return alert('Login dulu!');
    const slot = farmData.slots[index];
    if (!slot.unlocked) return alert('Kandang terkunci!');
    if (slot.status !== 'mati') return alert('Kandang tidak perlu dibersihkan!');
    if (slot.hasilTersisa > 0) return alert('Ambil hasil panen dulu!');

    try {
        await db.runTransaction(async (transaction) => {
            const farmRef = db.collection('users').doc(currentUser.uid).collection('farm').doc('data');
            const farmDoc = await transaction.get(farmRef);
            let data = farmDoc.data() || { slots: [] };
            if (!data.slots) data.slots = [];
            while (data.slots.length < 6) data.slots.push({ unlocked: false, hewan: null, status: 'kosong', pakanTerakhir: null, panenSelesai: null, lahir: null, umurHari: 0, hasilTersisa: 0 });
            data.slots[index] = {
                ...data.slots[index],
                hewan: null,
                status: 'kosong',
                pakanTerakhir: null,
                panenSelesai: null,
                lahir: null,
                umurHari: 0,
                hasilTersisa: 0
            };
            transaction.set(farmRef, data);
        });
        await loadUserFarmData();
        renderFarmSlots();
        showFarmResult('🗑️ Kandang dibersihkan!', 'success');
    } catch (e) {
        showFarmResult(`❌ ${e.message}`, 'error');
    }
}

// ============================================================
// TIMERS
// ============================================================
function startFarmTimers() {
    Object.keys(farmTimers).forEach(key => {
        if (farmTimers[key]) clearInterval(farmTimers[key]);
    });
    farmTimers = {};

    farmTimers.main = setInterval(async () => {
        if (!farmData || !currentUser) return;
        let updated = false;
        for (let i = 0; i < farmData.slots.length; i++) {
            const slot = farmData.slots[i];
            if (!slot.unlocked || slot.status === 'kosong' || slot.status === 'mati' || slot.status === 'panen') continue;
            const now = Date.now();
            const waktuPanen = farmSettings?.hewan?.[slot.hewan]?.waktuPanen ?? FARM_DEFAULTS.hewan[slot.hewan].waktuPanen;
            const maxUmur = farmSettings?.hewan?.[slot.hewan]?.umur ?? FARM_DEFAULTS.hewan[slot.hewan].umur;
            if (slot.lahir) {
                const age = now - slot.lahir;
                if (age > maxUmur * 1000) {
                    slot.status = 'mati';
                    slot.hasilTersisa = slot.hasilTersisa || 0;
                    updated = true;
                    continue;
                }
            }
            if (slot.pakanTerakhir && slot.panenSelesai) {
                if (now >= slot.panenSelesai) {
                    slot.status = 'panen';
                    updated = true;
                }
            }
        }
        if (updated) {
            try {
                const farmRef = db.collection('users').doc(currentUser.uid).collection('farm').doc('data');
                await farmRef.set(farmData);
                renderFarmSlots();
            } catch (e) { console.error('Error saving farm timers:', e); }
        }
        updateFarmTimersDisplay();
    }, 10000);
}

function updateFarmTimersDisplay() {
    if (!farmData) return;
    for (let i = 0; i < farmData.slots.length; i++) {
        const slot = farmData.slots[i];
        const timerEl = document.getElementById(`farmTimer-${i}`);
        if (!timerEl) continue;
        if (!slot.unlocked || slot.status !== 'aktif' || !slot.panenSelesai) {
            timerEl.textContent = '⏱️ -';
            continue;
        }
        const remaining = Math.max(0, Math.floor((slot.panenSelesai - Date.now()) / 1000));
        if (remaining <= 0) {
            timerEl.textContent = '✅ Siap panen!';
        } else {
            const hours = Math.floor(remaining / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            const seconds = remaining % 60;
            timerEl.textContent = `⏱️ ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }
}

function showFarmResult(msg, type) {
    const el = document.getElementById('farmResult');
    if (!el) return;
    el.innerHTML = `<div class="result-${type}">${msg}</div>`;
    setTimeout(() => el.innerHTML = '', 5000);
}

// ============================================================
// ADMIN FUNCTIONS - FARM
// ============================================================
async function loadFarmSettingsAdmin() {
    await loadFarmSettings();
    if (!farmSettings) return;
    if (farmSettings.slotPrices) {
        farmSettings.slotPrices.forEach((price, i) => {
            const el = document.getElementById(`farmPriceSlot${i+1}`);
            if (el) el.value = price;
        });
    }
    const hewanList = ['ayam', 'bebek', 'kambing', 'sapi'];
    hewanList.forEach(h => {
        const cap = h.charAt(0).toUpperCase() + h.slice(1);
        const data = farmSettings.hewan?.[h] || FARM_DEFAULTS.hewan[h];
        document.getElementById(`farmPakan${cap}`).value = data.pakan || 0;
        document.getElementById(`farmWaktu${cap}`).value = data.waktuPanen || 0;
        document.getElementById(`farmHasil${cap}`).value = data.hasilPanen || 0;
        document.getElementById(`farmUmur${cap}`).value = data.umur || 0;
        document.getElementById(`farmDaging${cap}`).value = data.daging || 0;
    });
    document.getElementById('farmBoxElit').value = farmSettings.boxChance?.elit || FARM_DEFAULTS.boxChance.elit;
    document.getElementById('farmBoxMaster').value = farmSettings.boxChance?.master || FARM_DEFAULTS.boxChance.master;
    document.getElementById('farmBoxEpic').value = farmSettings.boxChance?.epic || FARM_DEFAULTS.boxChance.epic;
    document.getElementById('farmDistAyam').value = farmSettings.distribution?.ayam || FARM_DEFAULTS.distribution.ayam;
    document.getElementById('farmDistBebek').value = farmSettings.distribution?.bebek || FARM_DEFAULTS.distribution.bebek;
    document.getElementById('farmDistKambing').value = farmSettings.distribution?.kambing || FARM_DEFAULTS.distribution.kambing;
    document.getElementById('farmDistSapi').value = farmSettings.distribution?.sapi || FARM_DEFAULTS.distribution.sapi;
}

async function saveFarmSettings() {
    if (!userData || userData.role !== 'admin') return alert('Hanya admin!');
    try {
        const slotPrices = [];
        for (let i = 1; i <= 6; i++) {
            const el = document.getElementById(`farmPriceSlot${i}`);
            slotPrices.push(parseInt(el.value) || 0);
        }
        const hewan = {};
        const hewanList = ['ayam', 'bebek', 'kambing', 'sapi'];
        hewanList.forEach(h => {
            const cap = h.charAt(0).toUpperCase() + h.slice(1);
            hewan[h] = {
                pakan: parseInt(document.getElementById(`farmPakan${cap}`).value) || 0,
                waktuPanen: parseInt(document.getElementById(`farmWaktu${cap}`).value) || 0,
                hasilPanen: parseInt(document.getElementById(`farmHasil${cap}`).value) || 0,
                umur: parseInt(document.getElementById(`farmUmur${cap}`).value) || 0,
                daging: parseInt(document.getElementById(`farmDaging${cap}`).value) || 0
            };
        });
        const boxChance = {
            elit: parseFloat(document.getElementById('farmBoxElit').value) || 0,
            master: parseFloat(document.getElementById('farmBoxMaster').value) || 0,
            epic: parseFloat(document.getElementById('farmBoxEpic').value) || 0
        };
        const distribution = {
            ayam: parseFloat(document.getElementById('farmDistAyam').value) || 0,
            bebek: parseFloat(document.getElementById('farmDistBebek').value) || 0,
            kambing: parseFloat(document.getElementById('farmDistKambing').value) || 0,
            sapi: parseFloat(document.getElementById('farmDistSapi').value) || 0
        };
        const totalDist = distribution.ayam + distribution.bebek + distribution.kambing + distribution.sapi;
        if (Math.abs(totalDist - 100) > 0.01) {
            document.getElementById('farmAdminMessage').innerHTML = '<span class="error">❌ Total distribusi harus 100%!</span>';
            return;
        }
        const newSettings = { slotPrices, hewan, boxChance, distribution };
        await db.collection('gameSettings').doc('farm').set(newSettings, { merge: true });
        farmSettings = newSettings;
        document.getElementById('farmAdminMessage').innerHTML = '<span class="success">✅ Semua pengaturan farm disimpan!</span>';
        renderFarmSlots();
    } catch (e) {
        console.error('Save farm error:', e);
        document.getElementById('farmAdminMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

// ============================================================
// MINEBOOM SETTINGS (ADMIN)
// ============================================================
async function loadMineBoomSettings() {
    try {
        const doc = await db.collection('gameSettings').doc('mineboom').get();
        if (doc.exists) {
            mineboomSettings = doc.data();
        } else {
            mineboomSettings = {
                rooms: {
                    1: { cost: 1000, bombs: 3, min: 10, max: 500 },
                    2: { cost: 10000, bombs: 6, min: 500, max: 5000 },
                    3: { cost: 100000, bombs: 9, min: 5000, max: 50000 }
                }
            };
            await db.collection('gameSettings').doc('mineboom').set(mineboomSettings);
        }
        if (document.getElementById('mineboomCost1')) {
            document.getElementById('mineboomCost1').value = mineboomSettings.rooms[1]?.cost || 1000;
            document.getElementById('mineboomBombs1').value = mineboomSettings.rooms[1]?.bombs || 3;
            document.getElementById('mineboomMin1').value = mineboomSettings.rooms[1]?.min || 10;
            document.getElementById('mineboomMax1').value = mineboomSettings.rooms[1]?.max || 500;
            document.getElementById('mineboomCost2').value = mineboomSettings.rooms[2]?.cost || 10000;
            document.getElementById('mineboomBombs2').value = mineboomSettings.rooms[2]?.bombs || 6;
            document.getElementById('mineboomMin2').value = mineboomSettings.rooms[2]?.min || 500;
            document.getElementById('mineboomMax2').value = mineboomSettings.rooms[2]?.max || 5000;
            document.getElementById('mineboomCost3').value = mineboomSettings.rooms[3]?.cost || 100000;
            document.getElementById('mineboomBombs3').value = mineboomSettings.rooms[3]?.bombs || 9;
            document.getElementById('mineboomMin3').value = mineboomSettings.rooms[3]?.min || 5000;
            document.getElementById('mineboomMax3').value = mineboomSettings.rooms[3]?.max || 50000;
        }
    } catch (e) {
        console.error('Error loading mineboom settings:', e);
        mineboomSettings = {
            rooms: {
                1: { cost: 1000, bombs: 3, min: 10, max: 500 },
                2: { cost: 10000, bombs: 6, min: 500, max: 5000 },
                3: { cost: 100000, bombs: 9, min: 5000, max: 50000 }
            }
        };
    }
}

async function saveMineBoomSettings() {
    if (!userData || userData.role !== 'admin') return alert('Hanya admin!');
    try {
        const rooms = {};
        for (let i = 1; i <= 3; i++) {
            rooms[i] = {
                cost: parseInt(document.getElementById(`mineboomCost${i}`).value) || 0,
                bombs: parseInt(document.getElementById(`mineboomBombs${i}`).value) || 0,
                min: parseInt(document.getElementById(`mineboomMin${i}`).value) || 0,
                max: parseInt(document.getElementById(`mineboomMax${i}`).value) || 0
            };
        }
        const newSettings = { rooms };
        await db.collection('gameSettings').doc('mineboom').set(newSettings, { merge: true });
        mineboomSettings = newSettings;
        document.getElementById('mineboomAdminMessage').innerHTML = '<span class="success">✅ Pengaturan MineBoom disimpan!</span>';
        renderMineBoomRooms();
    } catch (e) {
        document.getElementById('mineboomAdminMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

function getMineBoomSettings() {
    return mineboomSettings || {
        rooms: {
            1: { cost: 1000, bombs: 3, min: 10, max: 500 },
            2: { cost: 10000, bombs: 6, min: 500, max: 5000 },
            3: { cost: 100000, bombs: 9, min: 5000, max: 50000 }
        }
    };
}

// ============================================================
// RENDER RUANGAN MINEBOOM (DINAMIS)
// ============================================================
function renderMineBoomRooms() {
    const container = document.getElementById('mineboomRoomsContainer');
    if (!container) return;
    const rooms = getMineBoomSettings().rooms;
    const roomNames = {
        1: { icon: '🟢', name: 'Ruangan 1' },
        2: { icon: '🟡', name: 'Ruangan 2' },
        3: { icon: '🔴', name: 'Ruangan 3' }
    };
    let html = '';
    for (let i = 1; i <= 3; i++) {
        const room = rooms[i];
        if (!room) continue;
        html += `
            <div class="room-card" onclick="selectMineBoomRoom(${i})">
                <h3>${roomNames[i].icon} ${roomNames[i].name}</h3>
                <p>Biaya: ${room.cost.toLocaleString()} Gold</p>
                <p>💣 Bom: ${room.bombs}</p>
                <p>🎁 Hadiah: +${room.min.toLocaleString()} s/d +${room.max.toLocaleString()}</p>
                <button class="btn-room">Pilih</button>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ============================================================
// BOX SETTINGS (ADMIN)
// ============================================================
async function loadBoxSettings() {
    try {
        const doc = await db.collection('gameSettings').doc('box').get();
        if (doc.exists) {
            boxSettings = doc.data();
        } else {
            boxSettings = JSON.parse(JSON.stringify(BOX_FALLBACK));
            await db.collection('gameSettings').doc('box').set(boxSettings);
        }
        if (document.getElementById('boxPriceElit')) {
            const tiers = ['elit', 'master', 'epic'];
            tiers.forEach(t => {
                const cap = t.charAt(0).toUpperCase() + t.slice(1);
                const data = boxSettings[t] || BOX_FALLBACK[t];
                document.getElementById(`boxPrice${cap}`).value = data.harga || 0;
                document.getElementById(`boxPaluMin${cap}`).value = data.paluMin || 0;
                document.getElementById(`boxPaluMax${cap}`).value = data.paluMax || 0;
                document.getElementById(`boxStoneMin${cap}`).value = data.stoneMin || 0;
                document.getElementById(`boxStoneMax${cap}`).value = data.stoneMax || 0;
                document.getElementById(`boxBpChance${cap}`).value = data.bpChance || 0;
                document.getElementById(`boxBpType${cap}`).value = data.bpType || 'blueprintKayu';
                document.getElementById(`boxDesc${cap}`).value = data.deskripsi || BOX_FALLBACK[t].deskripsi;
            });
        }
    } catch (e) {
        console.error('Error loading box settings:', e);
        boxSettings = JSON.parse(JSON.stringify(BOX_FALLBACK));
    }
}

async function saveBoxSettings() {
    if (!userData || userData.role !== 'admin') return alert('Hanya admin!');
    try {
        const tiers = ['elit', 'master', 'epic'];
        const newSettings = {};
        tiers.forEach(t => {
            const cap = t.charAt(0).toUpperCase() + t.slice(1);
            newSettings[t] = {
                harga: parseInt(document.getElementById(`boxPrice${cap}`).value) || 0,
                paluMin: parseInt(document.getElementById(`boxPaluMin${cap}`).value) || 0,
                paluMax: parseInt(document.getElementById(`boxPaluMax${cap}`).value) || 0,
                stoneMin: parseInt(document.getElementById(`boxStoneMin${cap}`).value) || 0,
                stoneMax: parseInt(document.getElementById(`boxStoneMax${cap}`).value) || 0,
                bpChance: parseFloat(document.getElementById(`boxBpChance${cap}`).value) || 0,
                bpType: document.getElementById(`boxBpType${cap}`).value,
                deskripsi: document.getElementById(`boxDesc${cap}`).value || ''
            };
        });
        await db.collection('gameSettings').doc('box').set(newSettings, { merge: true });
        boxSettings = newSettings;
        document.getElementById('boxAdminMessage').innerHTML = '<span class="success">✅ Pengaturan Box disimpan!</span>';
        renderBoxCards();
    } catch (e) {
        document.getElementById('boxAdminMessage').innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
}

function getBoxSettings() {
    return boxSettings || JSON.parse(JSON.stringify(BOX_FALLBACK));
}

// ============================================================
// RENDER BOX CARDS (TAMPILAN DI GAME)
// ============================================================
function renderBoxCards() {
    const container = document.getElementById('boxGridContainer');
    if (!container) return;
    const settings = getBoxSettings();
    const tiers = ['elit', 'master', 'epic'];
    const icons = { elit: '🟢', master: '🔵', epic: '🟣' };
    const names = { elit: 'Box Elit', master: 'Box Master', epic: 'Box Epic' };
    const bpLabels = {
        blueprintKayu: '📜 BP Kayu',
        blueprintSilver: '📜 BP Silver',
        blueprintEmas: '📜 BP Emas',
        blueprintDiamond: '💎 BP Diamond'
    };

    let html = '';
    tiers.forEach(tier => {
        const data = settings[tier] || {};
        const harga = data.harga || 0;
        const desc = (data.deskripsi || '').replace(/{harga}/g, harga.toLocaleString());
        const paluMin = data.paluMin || 0;
        const paluMax = data.paluMax || 0;
        const stoneMin = data.stoneMin || 0;
        const stoneMax = data.stoneMax || 0;
        const bpChance = data.bpChance || 0;
        const bpType = data.bpType || 'blueprintKayu';
        const bpLabel = bpLabels[bpType] || 'BP';

        html += `
            <div class="box-card" onclick="buyBox('${tier}')">
                <div class="box-icon">${icons[tier]}</div>
                <h3>${names[tier]}</h3>
                <p style="color:#ffd700;font-weight:bold;">${harga.toLocaleString()} Gold</p>
                <p style="font-size:12px;color:#8899aa;">${desc}</p>
                <p style="font-size:11px;color:#8899aa;margin-top:4px;">
                    🔨 ${paluMin}-${paluMax} Palu &nbsp;|&nbsp; 🪨 ${stoneMin}-${stoneMax} Stone
                    ${bpChance > 0 ? `&nbsp;|&nbsp; ${bpLabel} ${bpChance}%` : ''}
                </p>
                <button class="btn-buy">Beli</button>
            </div>
        `;
    });
    container.innerHTML = html;
}
// ============================================================
// RENDER BOX CARDS (HANYA DESKRIPSI + HARGA)
// ============================================================
function renderBoxCards() {
    const container = document.getElementById('boxGridContainer');
    if (!container) return;
    const settings = getBoxSettings();
    const tiers = ['elit', 'master', 'epic'];
    const icons = { elit: '🟢', master: '🔵', epic: '🟣' };
    const names = { elit: 'Box Elit', master: 'Box Master', epic: 'Box Epic' };

    let html = '';
    tiers.forEach(tier => {
        const data = settings[tier] || {};
        const harga = data.harga || 0;
        const desc = (data.deskripsi || '').replace(/{harga}/g, harga.toLocaleString());

        html += `
            <div class="box-card" onclick="buyBox('${tier}')">
                <div class="box-icon">${icons[tier]}</div>
                <h3>${names[tier]}</h3>
                <p style="color:#ffd700;font-weight:bold;">${harga.toLocaleString()} Gold</p>
                <p style="font-size:13px;color:#ccddee;margin-top:6px;">${desc}</p>
                <button class="btn-buy" style="margin-top:12px;">Beli</button>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ============================================================
// UTILITY FUNCTIONS (UNTUK DIPANGGIL DARI GAME LAIN)
// ============================================================
function getRandomHewan() {
    const dist = farmSettings?.distribution || FARM_DEFAULTS.distribution;
    const roll = Math.random() * 100;
    let cumulative = 0;
    const types = ['ayam', 'bebek', 'kambing', 'sapi'];
    for (const type of types) {
        cumulative += dist[type] || 0;
        if (roll < cumulative) return type;
    }
    return 'ayam';
}

async function giveRandomHewan(uid) {
    if (!uid) return null;
    const type = getRandomHewan();
    const invMap = {
        ayam: 'telurAyam',
        bebek: 'telurBebek',
        kambing: 'anakKambing',
        sapi: 'anakSapi'
    };
    const key = invMap[type];
    try {
        await db.collection('users').doc(uid).update({
            [`inventory.${key}`]: firebase.firestore.FieldValue.increment(1)
        });
        return type;
    } catch (e) {
        console.error('Error giving hewan:', e);
        return null;
    }
}

function getFarmSettings() {
    return farmSettings || FARM_DEFAULTS;
}

console.log('🌾 Farm module loaded!');