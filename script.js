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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- グローバル変数と定数 ---
// ユーザー提供のFirebase設定
const firebaseConfig = {
  apiKey: "AIzaSyCleKavI0XicnYv2Hl1tkRNRikCBrb8is4",
  authDomain: "edogawa-m-league-results.firebaseapp.com",
  projectId: "edogawa-m-league-results",
  storageBucket: "edogawa-m-league-results.firebasestorage.app",
  messagingSenderId: "315224725184",
  appId: "1:315224725184:web:e0f8dbca47f04b2fa37f25",
  measurementId: "G-B3ZTXE1MYV"
};
const appId = firebaseConfig.appId; // 設定からappIdを取得

let db, auth, userId;
let manualsUnsubscribe = null; // リアルタイムリスナーの解除用
let currentManuals = []; // マニュアルデータを保持する配列
let selectedCategory = 'all'; // 現在選択されているカテゴリ

const markdownConverter = new showdown.Converter();

// --- DOM要素の取得 ---
const categoryList = document.getElementById('category-list');
const manualList = document.getElementById('manual-list');
const manualListTitle = document.getElementById('manual-list-title');
const manualDetailView = document.getElementById('manual-detail-view');
const initialMessage = document.getElementById('initial-message');
const manualContentWrapper = document.getElementById('manual-content-wrapper');
const manualTitle = document.getElementById('manual-title');
const manualContent = document.getElementById('manual-content');

const manualModal = document.getElementById('manual-modal');
const modalTitle = document.getElementById('modal-title');
const manualForm = document.getElementById('manual-form');
const manualIdInput = document.getElementById('manual-id');
const titleInput = document.getElementById('title-input');
const categoryInput = document.getElementById('category-input');
const contentInput = document.getElementById('content-input');


// --- Firebaseの初期化と認証 ---
async function initializeFirebase() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("Authenticated user:", user.uid);
                userId = user.uid;
                // 認証が完了したらデータの監視を開始
                setupManualsListener();
            } else {
                console.log("No user signed in. Attempting to sign in anonymously.");
                // 匿名認証でサインイン
                await signInAnonymously(auth);
            }
        });
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        alert("アプリケーションの初期化に失敗しました。");
    }
}

// --- データ監視 ---
function setupManualsListener() {
    if (manualsUnsubscribe) manualsUnsubscribe(); // 既存のリスナーを解除
    if (!userId) return;

    // Firestoreのパスを一般的なものに変更（プロジェクト固有のデータ構造を反映）
    const manualsColRef = collection(db, `manuals/${userId}/items`);

    manualsUnsubscribe = onSnapshot(query(manualsColRef), (snapshot) => {
        currentManuals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // 日付でソート (新しいものが上)
        currentManuals.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
        
        renderCategories();
        renderManualList();
    }, (error) => {
        console.error("Error listening to manuals:", error);
    });
}

// --- UI描画関連 ---

// カテゴリリストの描画
function renderCategories() {
    const categories = ['all', ...new Set(currentManuals.map(m => m.category))];
    categoryList.innerHTML = categories.map(category => `
        <li>
            <a href="#" data-category="${category}" class="category-item block p-2 rounded-lg transition-colors ${selectedCategory === category ? 'bg-cyan-500/30 text-cyan-300' : 'hover:bg-gray-700/50'}">
                ${category === 'all' ? 'すべてのマニュアル' : category}
            </a>
        </li>
    `).join('');
}

// マニュアルリストの描画
function renderManualList() {
    const manualsToShow = selectedCategory === 'all' 
        ? currentManuals 
        : currentManuals.filter(m => m.category === selectedCategory);
    
    manualListTitle.textContent = selectedCategory === 'all' ? 'すべてのマニュアル' : `カテゴリ: ${selectedCategory}`;

    if (manualsToShow.length === 0) {
        manualList.innerHTML = `<p class="text-gray-500">このカテゴリにはマニュアルがありません。</p>`;
        return;
    }

    manualList.innerHTML = manualsToShow.map(manual => `
        <div data-id="${manual.id}" class="manual-item-card p-3 mb-2 rounded-lg border border-transparent hover:border-cyan-500 hover:bg-gray-800/50 cursor-pointer transition-all">
            <h3 class="font-bold text-cyan-400 truncate">${manual.title}</h3>
            <p class="text-sm text-gray-400">${manual.category}</p>
        </div>
    `).join('');
}

// マニュアル詳細の表示
function showManualDetail(manualId) {
    const manual = currentManuals.find(m => m.id === manualId);
    if (!manual) return;

    initialMessage.classList.add('hidden');
    manualContentWrapper.classList.remove('hidden');

    manualTitle.textContent = manual.title;
    // MarkdownをHTMLに変換して表示
    manualContent.innerHTML = markdownConverter.makeHtml(manual.content);
    
    // 編集・削除ボタンにIDを設定
    document.getElementById('edit-manual-btn').dataset.id = manual.id;
    document.getElementById('delete-manual-btn').dataset.id = manual.id;
}

// --- モーダル関連 ---
function openModal(manual = null) {
    manualForm.reset();
    if (manual) {
        // 編集モード
        modalTitle.textContent = 'マニュアル編集';
        manualIdInput.value = manual.id;
        titleInput.value = manual.title;
        categoryInput.value = manual.category;
        contentInput.value = manual.content;
    } else {
        // 新規作成モード
        modalTitle.textContent = '新規マニュアル作成';
        manualIdInput.value = '';
    }
    manualModal.classList.remove('hidden');
}

function closeModal() {
    manualModal.classList.add('hidden');
}

// --- CRUD操作 ---
async function saveManual() {
    if (!userId) {
        alert("ユーザー情報が取得できません。");
        return;
    }

    const id = manualIdInput.value;
    const data = {
        title: titleInput.value.trim(),
        category: categoryInput.value.trim(),
        content: contentInput.value.trim(),
        updatedAt: serverTimestamp(),
    };

    if (!data.title || !data.category || !data.content) {
        alert("すべてのフィールドを入力してください。");
        return;
    }

    try {
        const colRef = collection(db, `manuals/${userId}/items`);
        if (id) {
            // 更新
            const docRef = doc(colRef, id);
            await setDoc(docRef, data, { merge: true });
        } else {
            // 新規作成
            data.createdAt = serverTimestamp();
            await addDoc(colRef, data);
        }
        closeModal();
    } catch (error) {
        console.error("Error saving manual:", error);
        alert("保存に失敗しました。");
    }
}

async function deleteManual(manualId) {
    if (!userId) {
        alert("ユーザー情報が取得できません。");
        return;
    }
    // カスタム確認ダイアログの方が望ましいが、サンプルとしてconfirmを使用
    if (!confirm("本当にこのマニュアルを削除しますか？この操作は元に戻せません。")) {
        return;
    }

    try {
        const docRef = doc(db, `manuals/${userId}/items`, manualId);
        await deleteDoc(docRef);
        
        // 詳細表示をリセット
        initialMessage.classList.remove('hidden');
        manualContentWrapper.classList.add('hidden');

    } catch (error) {
        console.error("Error deleting manual:", error);
        alert("削除に失敗しました。");
    }
}


// --- イベントリスナーの設定 ---
function setupEventListeners() {
    // カテゴリ選択
    categoryList.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.target.closest('.category-item');
        if (target) {
            selectedCategory = target.dataset.category;
            renderCategories(); // 選択状態を更新
            renderManualList();
        }
    });
    
    // マニュアル選択
    manualList.addEventListener('click', (e) => {
        const card = e.target.closest('.manual-item-card');
        if (card) {
            showManualDetail(card.dataset.id);
        }
    });

    // 新規マニュアルボタン
    document.getElementById('add-manual-btn').addEventListener('click', () => openModal());

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
}

// --- アプリケーションの開始 ---
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupEventListeners();
});
