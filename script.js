// Firebase SDK のモジュールをインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    setDoc, 
    deleteDoc, 
    onSnapshot, 
    query, 
    serverTimestamp,
    writeBatch,
    getDocs,
    where,
    increment
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- グローバル変数と定数 ---
const firebaseConfig = {
  apiKey: "AIzaSyCleKavI0XicnYv2Hl1tkRNRikCBrb8is4",
  authDomain: "edogawa-m-league-results.firebaseapp.com",
  projectId: "edogawa-m-league-results",
  storageBucket: "edogawa-m-league-results.firebasestorage.app",
  messagingSenderId: "315224725184",
  appId: "1:315224725184:web:e0f8dbca47f04b2fa37f25",
  measurementId: "G-B3ZTXE1MYV"
};

let db, auth, userId;
let manualsUnsubscribe = null;
let categoriesUnsubscribe = null;
let currentManuals = [];
let currentCategories = [];
let selectedCategory = 'all';
let isSelectMode = false;
let isInitialized = false; // 初期化処理の実行を管理するフラグ

const markdownConverter = new showdown.Converter();

// --- DOM要素の取得 ---
const loadingOverlay = document.getElementById('loading-overlay');
const appContainer = document.getElementById('app');
const categoryList = document.getElementById('category-list');
const manualList = document.getElementById('manual-list');
const manualListTitle = document.getElementById('manual-list-title');
const initialMessage = document.getElementById('initial-message');
const manualContentWrapper = document.getElementById('manual-content-wrapper');
const manualTitle = document.getElementById('manual-title');
const manualLastUpdated = document.getElementById('manual-last-updated');
const manualContent = document.getElementById('manual-content');
const manualModal = document.getElementById('manual-modal');
const modalTitleEl = document.getElementById('modal-title');
const manualForm = document.getElementById('manual-form');
const manualIdInput = document.getElementById('manual-id');
const titleInput = document.getElementById('title-input');
const categorySelect = document.getElementById('category-select');
const newCategoryWrapper = document.getElementById('new-category-wrapper');
const newCategoryInput = document.getElementById('new-category-input');
const contentInput = document.getElementById('content-input');
const addManualBtn = document.getElementById('add-manual-btn');
const toggleSelectModeBtn = document.getElementById('toggle-select-mode-btn');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const searchInput = document.getElementById('search-input');


// --- Firebaseの初期化と認証 (修正版) ---
async function initializeFirebase() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (user && !isInitialized) {
                isInitialized = true; // 初期化処理は一度だけ実行
                userId = user.uid;
                await initializeAppData();
            } else if (!user) {
                isInitialized = false; // ユーザーがサインアウトした場合に備える
                await signInAnonymously(auth);
            }
        });
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showInitializationError("Firebaseの初期化に失敗しました。");
    }
}

// --- アプリケーションデータ初期化 (修正版) ---
async function initializeAppData() {
    try {
        // 1. 最初にデフォルトカテゴリの存在を確認し、なければ作成する
        await ensureDefaultCategories();
        // 2. その後、データのリアルタイム監視を開始する
        setupListeners();
        // 3. 全ての準備が整ったら、ローディング画面を非表示にする
        loadingOverlay.style.display = 'none';
        appContainer.style.opacity = '1';
    } catch (error) {
        console.error("FATAL: Application initialization failed.", error);
        showInitializationError("アプリケーションの初期化に失敗しました。コンソールを確認してください。");
    }
}

// --- 初期データ設定 (修正版) ---
async function ensureDefaultCategories() {
    if (!userId) return;
    const defaultCategoryNames = ["対局", "順位表", "トロフィー", "データ分析", "個人成績", "対局履歴", "直接対決", "詳細履歴", "雀士管理"];
    const categoriesColRef = collection(db, `categories/${userId}/items`);

    const snapshot = await getDocs(categoriesColRef);
    const existingCategoryNames = new Set(snapshot.docs.map(doc => doc.data().name));
    const missingCategories = defaultCategoryNames.filter(name => !existingCategoryNames.has(name));

    if (missingCategories.length > 0) {
        const batch = writeBatch(db);
        missingCategories.forEach(name => {
            const docRef = doc(categoriesColRef);
            batch.set(docRef, { name: name, createdAt: serverTimestamp() });
        });
        try {
            await batch.commit();
        } catch (e) {
            console.error("FATAL: Failed to add default categories.", e);
            // エラーを上に投げて、initializeAppDataのcatchブロックで処理させる
            throw new Error("Could not create default categories.");
        }
    }
}


// --- データ監視リスナー ---
function setupListeners() {
    if (!userId) return;
    setupCategoryListener();
    setupManualListener();
}

// カテゴリ用のリスナー
function setupCategoryListener() {
    if (categoriesUnsubscribe) categoriesUnsubscribe();
    const categoriesColRef = collection(db, `categories/${userId}/items`);
    const qCategories = query(categoriesColRef);
    categoriesUnsubscribe = onSnapshot(qCategories, (snapshot) => {
        currentCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        currentCategories.sort((a, b) => (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0));
        renderCategories();
        renderCategoryDropdown();
    }, (error) => {
        console.error("Category listener error:", error);
        showInitializationError("カテゴリの読み込みに失敗しました。");
    });
}

// マニュアル用のリスナー
function setupManualListener() {
    if (manualsUnsubscribe) manualsUnsubscribe();
    const manualsColRef = collection(db, `manuals/${userId}/items`);
    manualsUnsubscribe = onSnapshot(query(manualsColRef), (snapshot) => {
        currentManuals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderManualList();
    }, (error) => {
        console.error("Manual listener error:", error);
        showInitializationError("マニュアルの読み込みに失敗しました。");
    });
}


// --- UI描画関連 ---

// カテゴリサイドバーの描画
function renderCategories() {
    const allCategoriesItem = `
        <li>
            <a href="#" data-category="all" class="category-item flex items-center justify-between p-2 rounded-lg transition-colors ${selectedCategory === 'all' ? 'bg-cyan-500/30 text-cyan-300' : 'hover:bg-gray-700/50'}">
                <span>すべてのマニュアル</span>
            </a>
        </li>`;
    
    categoryList.innerHTML = allCategoriesItem + currentCategories.map(cat => `
        <li>
            <a href="#" data-category="${cat.name}" class="category-item flex items-center justify-between p-2 rounded-lg transition-colors ${selectedCategory === cat.name ? 'bg-cyan-500/30 text-cyan-300' : 'hover:bg-gray-700/50'}">
                <span class="category-name">${cat.name}</span>
                <svg data-id="${cat.id}" data-name="${cat.name}" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil edit-category-icon"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </a>
        </li>
    `).join('');
}

// モーダル内のカテゴリプルダウンを描画
function renderCategoryDropdown() {
    const currentCategoryValue = categorySelect.value;
    categorySelect.innerHTML = `
        <option value="" disabled>カテゴリを選択してください</option>
        ${currentCategories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('')}
        <option value="add_new_category">＋カテゴリを追加</option>
    `;
    if (currentCategories.some(c => c.name === currentCategoryValue)) {
        categorySelect.value = currentCategoryValue;
    } else {
        categorySelect.value = "";
    }
}

// マニュアルリストの描画
function renderManualList() {
    let manualsToShow = [...currentManuals];
    const searchTerm = searchInput.value.trim().toLowerCase();

    if (searchTerm) {
        manualListTitle.textContent = `'${searchTerm}' の検索結果`;
        manualsToShow = manualsToShow.filter(m =>
            m.title.toLowerCase().includes(searchTerm) ||
            m.content.toLowerCase().includes(searchTerm)
        );
    } else {
        manualListTitle.textContent = selectedCategory === 'all' ? 'すべてのマニュアル' : `カテゴリ: ${selectedCategory}`;
        if (selectedCategory !== 'all') {
            manualsToShow = manualsToShow.filter(m => m.category === selectedCategory);
        }
    }
    
    manualsToShow.sort((a, b) => (b.updatedAt?.toDate() || 0) - (a.updatedAt?.toDate() || 0));

    if (manualsToShow.length === 0) {
        manualList.innerHTML = `<p class="text-gray-500">マニュアルがありません。</p>`;
        return;
    }

    manualList.innerHTML = manualsToShow.map(manual => `
        <div data-id="${manual.id}" class="manual-item-card flex items-center p-3 mb-2 rounded-lg border border-transparent hover:border-cyan-500 hover:bg-gray-800/50 cursor-pointer transition-all">
            ${isSelectMode ? `<input type="checkbox" data-id="${manual.id}" class="manual-checkbox">` : ''}
            <div class="flex-1 overflow-hidden">
                <h3 class="font-bold text-cyan-400 truncate">${manual.title} - v${manual.version || 1}</h3>
                <p class="text-sm text-gray-400">${manual.category}</p>
            </div>
        </div>
    `).join('');
}

// マニュアル詳細の表示
function showManualDetail(manualId) {
    const manual = currentManuals.find(m => m.id === manualId);
    if (!manual) return;

    initialMessage.classList.add('hidden');
    manualContentWrapper.classList.remove('hidden');

    manualTitle.textContent = `${manual.title} - v${manual.version || 1}`;
    manualLastUpdated.textContent = manual.updatedAt ? `最終更新日：${formatDate(manual.updatedAt.toDate())}` : '';
    manualContent.innerHTML = markdownConverter.makeHtml(manual.content);
    
    document.getElementById('edit-manual-btn').dataset.id = manual.id;
    document.getElementById('delete-manual-btn').dataset.id = manual.id;
}

// 日付フォーマット関数
function formatDate(date) {
    const week = ['日', '月', '火', '水', '木', '金', '土'];
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const day = week[date.getDay()];
    return `${y}年${m}月${d}日(${day})`;
}

// エラー表示関数
function showInitializationError(message) {
    const loadingText = loadingOverlay.querySelector('p');
    const spinner = loadingOverlay.querySelector('svg');
    if (loadingText) loadingText.textContent = message;
    if (spinner) spinner.style.display = 'none';
    loadingOverlay.style.display = 'flex'; // エラー表示のため表示を強制
}


// --- モーダル関連 ---
function openModal(manual = null) {
    manualForm.reset();
    newCategoryWrapper.classList.add('hidden');
    renderCategoryDropdown();

    if (manual) {
        modalTitleEl.textContent = 'マニュアル編集';
        manualIdInput.value = manual.id;
        titleInput.value = manual.title;
        categorySelect.value = manual.category;
        contentInput.value = manual.content;
    } else {
        modalTitleEl.textContent = '新規マニュアル作成';
        manualIdInput.value = '';
        categorySelect.value = '';
    }
    manualModal.classList.remove('hidden');
}

function closeModal() {
    manualModal.classList.add('hidden');
}

// --- CRUD操作 ---

// マニュアルの保存/更新
async function saveManual() {
    if (!userId) return alert("ユーザー情報が取得できません。");

    let category = categorySelect.value;
    if (category === 'add_new_category') {
        const newCategoryName = newCategoryInput.value.trim();
        if (!newCategoryName) return alert("新しいカテゴリ名を入力してください。");
        
        const existingCategory = currentCategories.find(c => c.name === newCategoryName);
        if (!existingCategory) {
            const categoriesColRef = collection(db, `categories/${userId}/items`);
            await addDoc(categoriesColRef, { name: newCategoryName, createdAt: serverTimestamp() });
        }
        category = newCategoryName;
    }

    if (!category) return alert("カテゴリを選択してください。");

    const id = manualIdInput.value;
    const data = {
        title: titleInput.value.trim(),
        category: category,
        content: contentInput.value.trim(),
        updatedAt: serverTimestamp(),
    };

    if (!data.title || !data.content) return alert("タイトルと内容を入力してください。");

    try {
        const manualsColRef = collection(db, `manuals/${userId}/items`);
        if (id) {
            const docRef = doc(manualsColRef, id);
            data.version = increment(1);
            await setDoc(docRef, data, { merge: true });
        } else {
            data.createdAt = serverTimestamp();
            data.version = 1;
            await addDoc(manualsColRef, data);
        }
        closeModal();
    } catch (error) {
        console.error("Error saving manual:", error);
        alert("保存に失敗しました。");
    }
}

// 単一マニュアルの削除
async function deleteManual(manualId) {
    if (!userId) return alert("ユーザー情報が取得できません。");
    if (!confirm("本当にこのマニュアルを削除しますか？")) return;

    try {
        await deleteDoc(doc(db, `manuals/${userId}/items`, manualId));
        initialMessage.classList.remove('hidden');
        manualContentWrapper.classList.add('hidden');
    } catch (error) {
        console.error("Error deleting manual:", error);
        alert("削除に失敗しました。");
    }
}

// 複数マニュアルの削除
async function deleteSelectedManuals() {
    const selectedIds = Array.from(document.querySelectorAll('.manual-checkbox:checked')).map(cb => cb.dataset.id);
    if (selectedIds.length === 0) return alert("削除するマニュアルを選択してください。");
    if (!confirm(`${selectedIds.length}件のマニュアルを本当に削除しますか？`)) return;

    try {
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
            const docRef = doc(db, `manuals/${userId}/items`, id);
            batch.delete(docRef);
        });
        await batch.commit();
        toggleSelectMode();
    } catch (error) {
        console.error("Error deleting selected manuals:", error);
        alert("複数削除に失敗しました。");
    }
}

// カテゴリ名の編集
async function editCategoryName(categoryId, oldName) {
    const newName = prompt("新しいカテゴリ名を入力してください:", oldName);
    if (!newName || newName.trim() === '' || newName === oldName) return;

    try {
        const batch = writeBatch(db);
        const categoryDocRef = doc(db, `categories/${userId}/items`, categoryId);
        batch.update(categoryDocRef, { name: newName });

        const manualsColRef = collection(db, `manuals/${userId}/items`);
        const q = query(manualsColRef, where("category", "==", oldName));
        const snapshot = await getDocs(q);
        snapshot.forEach(manualDoc => {
            batch.update(manualDoc.ref, { category: newName });
        });

        await batch.commit();
        
        if (selectedCategory === oldName) {
            selectedCategory = newName;
        }

        alert("カテゴリ名を更新しました。");
    } catch (error) {
        console.error("Error updating category name:", error);
        alert("カテゴリ名の更新に失敗しました。");
    }
}

// --- モード切替 ---
function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    addManualBtn.classList.toggle('hidden', isSelectMode);
    deleteSelectedBtn.classList.toggle('hidden', !isSelectMode);
    toggleSelectModeBtn.textContent = isSelectMode ? 'キャンセル' : '選択';
    renderManualList();
}

// --- イベントリスナーの設定 ---
function setupEventListeners() {
    categoryList.addEventListener('click', (e) => {
        e.preventDefault();
        const categoryLink = e.target.closest('.category-item');
        const editIcon = e.target.closest('.edit-category-icon');

        if (editIcon) {
            editCategoryName(editIcon.dataset.id, editIcon.dataset.name);
        } else if (categoryLink) {
            selectedCategory = categoryLink.dataset.category;
            searchInput.value = '';
            renderCategories();
            renderManualList();
        }
    });
    
    manualList.addEventListener('click', (e) => {
        const card = e.target.closest('.manual-item-card');
        const checkbox = e.target.closest('.manual-checkbox');
        if (isSelectMode && checkbox) {
            return;
        }
        if (card && !isSelectMode) {
            showManualDetail(card.dataset.id);
        }
    });

    addManualBtn.addEventListener('click', () => openModal());
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('save-manual-btn').addEventListener('click', saveManual);
    
    document.getElementById('edit-manual-btn').addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const manual = currentManuals.find(m => m.id === id);
        if(manual) openModal(manual);
    });

    document.getElementById('delete-manual-btn').addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if(id) deleteManual(id);
    });
    
    categorySelect.addEventListener('change', () => {
        if (categorySelect.value === 'add_new_category') {
            newCategoryWrapper.classList.remove('hidden');
            newCategoryInput.focus();
        } else {
            newCategoryWrapper.classList.add('hidden');
        }
    });
    
    toggleSelectModeBtn.addEventListener('click', toggleSelectMode);
    deleteSelectedBtn.addEventListener('click', deleteSelectedManuals);

    searchInput.addEventListener('input', () => {
        selectedCategory = 'all'; 
        renderCategories();
        renderManualList();
    });
}

// --- アプリケーションの開始 ---
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupEventListeners();
});
