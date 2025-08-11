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

const markdownConverter = new showdown.Converter();

// --- DOM要素の取得 ---
const categoryList = document.getElementById('category-list');
const manualList = document.getElementById('manual-list');
const manualListTitle = document.getElementById('manual-list-title');
const initialMessage = document.getElementById('initial-message');
const manualContentWrapper = document.getElementById('manual-content-wrapper');
const manualTitle = document.getElementById('manual-title');
const manualLastUpdated = document.getElementById('manual-last-updated');
const manualContent = document.getElementById('manual-content');
const manualModal = document.getElementById('manual-modal');
const modalTitle = document.getElementById('modal-title');
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


// --- Firebaseの初期化と認証 ---
async function initializeFirebase() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                await setupInitialCategories();
                setupListeners();
            } else {
                await signInAnonymously(auth);
            }
        });
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        alert("アプリケーションの初期化に失敗しました。");
    }
}

// --- データ監視リスナー ---
function setupListeners() {
    if (!userId) return;
    
    // カテゴリの監視
    const categoriesColRef = collection(db, `categories/${userId}/items`);
    if (categoriesUnsubscribe) categoriesUnsubscribe();
    categoriesUnsubscribe = onSnapshot(query(categoriesColRef), (snapshot) => {
        currentCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCategories();
        renderCategoryDropdown();
    });

    // マニュアルの監視
    const manualsColRef = collection(db, `manuals/${userId}/items`);
    if (manualsUnsubscribe) manualsUnsubscribe();
    manualsUnsubscribe = onSnapshot(query(manualsColRef), (snapshot) => {
        currentManuals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderManualList();
    });
}

// --- 初期データ設定 ---
async function setupInitialCategories() {
    const defaultCategories = ["対局", "順位表", "トロフィー", "データ分析", "個人成績", "対局履歴", "直接対決", "詳細履歴", "雀士管理"];
    const categoriesColRef = collection(db, `categories/${userId}/items`);
    const snapshot = await getDocs(categoriesColRef);
    if (snapshot.empty) {
        const batch = writeBatch(db);
        defaultCategories.forEach(name => {
            const docRef = doc(categoriesColRef);
            batch.set(docRef, { name });
        });
        await batch.commit();
    }
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
    // 編集時に元のカテゴリが選択された状態を維持
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


// --- モーダル関連 ---
function openModal(manual = null) {
    manualForm.reset();
    newCategoryWrapper.classList.add('hidden');
    renderCategoryDropdown();

    if (manual) {
        modalTitle.textContent = 'マニュアル編集';
        manualIdInput.value = manual.id;
        titleInput.value = manual.title;
        categorySelect.value = manual.category;
        contentInput.value = manual.content;
    } else {
        modalTitle.textContent = '新規マニュアル作成';
        manualIdInput.value = '';
        categorySelect.value = ''; // 新規作成時は未選択に
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
            await addDoc(categoriesColRef, { name: newCategoryName });
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
            data.version = increment(1); // バージョンをインクリメント
            await setDoc(docRef, data, { merge: true });
        } else {
            data.createdAt = serverTimestamp();
            data.version = 1; // 初期バージョン
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
        toggleSelectMode(); // 選択モードを解除
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
        // 1. カテゴリ名を更新
        const categoryDocRef = doc(db, `categories/${userId}/items`, categoryId);
        batch.update(categoryDocRef, { name: newName });

        // 2. 関連するマニュアルのカテゴリ名をすべて更新
        const manualsColRef = collection(db, `manuals/${userId}/items`);
        const q = query(manualsColRef, where("category", "==", oldName));
        const snapshot = await getDocs(q);
        snapshot.forEach(manualDoc => {
            batch.update(manualDoc.ref, { category: newName });
        });

        await batch.commit();
        
        // 表示を更新
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
    renderManualList(); // チェックボックスの表示/非表示を切り替える
}

// --- イベントリスナーの設定 ---
function setupEventListeners() {
    // カテゴリ選択
    categoryList.addEventListener('click', (e) => {
        e.preventDefault();
        const categoryLink = e.target.closest('.category-item');
        const editIcon = e.target.closest('.edit-category-icon');

        if (editIcon) {
            editCategoryName(editIcon.dataset.id, editIcon.dataset.name);
        } else if (categoryLink) {
            selectedCategory = categoryLink.dataset.category;
            searchInput.value = ''; // 検索をクリア
            renderCategories();
            renderManualList();
        }
    });
    
    // マニュアル選択
    manualList.addEventListener('click', (e) => {
        const card = e.target.closest('.manual-item-card');
        const checkbox = e.target.closest('.manual-checkbox');
        if (isSelectMode && checkbox) {
            // チェックボックスのクリックはデフォルトの動作に任せる
            return;
        }
        if (card && !isSelectMode) {
            showManualDetail(card.dataset.id);
        }
    });

    // 新規マニュアルボタン
    addManualBtn.addEventListener('click', () => openModal());

    // モーダル閉じるボタン
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);

    // 保存ボタン
    document.getElementById('save-manual-btn').addEventListener('click', saveManual);
    
    // 編集ボタン
    document.getElementById('edit-manual-btn').addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const manual = currentManuals.find(m => m.id === id);
        if(manual) openModal(manual);
    });

    // 削除ボタン
    document.getElementById('delete-manual-btn').addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if(id) deleteManual(id);
    });
    
    // カテゴリプルダウンの変更
    categorySelect.addEventListener('change', () => {
        if (categorySelect.value === 'add_new_category') {
            newCategoryWrapper.classList.remove('hidden');
            newCategoryInput.focus();
        } else {
            newCategoryWrapper.classList.add('hidden');
        }
    });
    
    // 複数選択モード切替
    toggleSelectModeBtn.addEventListener('click', toggleSelectMode);
    
    // 複数選択削除ボタン
    deleteSelectedBtn.addEventListener('click', deleteSelectedManuals);

    // 検索入力
    searchInput.addEventListener('input', () => {
        // 検索中はカテゴリ選択を解除したように見せる
        selectedCategory = 'all'; 
        renderCategories(); // サイドバーのハイライトを解除
        renderManualList(); // 検索結果でリストを更新
    });
}

// --- アプリケーションの開始 ---
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupEventListeners();
});
