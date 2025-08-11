document.addEventListener('DOMContentLoaded', () => {
    // Firebase構成オブジェクト
    const firebaseConfig = {
        apiKey: "AIzaSyCleKavI0XicnYv2Hl1tkRNRikCBrb8is4",
        authDomain: "edogawa-m-league-results.firebaseapp.com",
        projectId: "edogawa-m-league-results",
        storageBucket: "edogawa-m-league-results.appspot.com", // .firebasestorage.app から変更
        messagingSenderId: "315224725184",
        appId: "1:315224725184:web:e0f8dbca47f04b2fa37f25",
        measurementId: "G-B3ZTXE1MYV"
    };

    // Firebaseの初期化
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();
    const manualsCollection = db.collection('manuals');

    // DOM要素の取得
    const newManualBtn = document.getElementById('new-manual-btn');
    const manualsListContainer = document.getElementById('manuals-list');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-input');
    const categoryFilterList = document.getElementById('category-filter-list');
    
    // モーダル関連のDOM要素
    const editorModal = document.getElementById('editor-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const saveManualBtn = document.getElementById('save-manual-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const deleteManualBtn = document.getElementById('delete-manual-btn');
    const manualIdInput = document.getElementById('manual-id');
    const manualTitleInput = document.getElementById('manual-title');
    const manualCategoryInput = document.getElementById('manual-category');
    const saveBtnText = document.getElementById('save-btn-text');
    const saveSpinner = document.getElementById('save-spinner');
    const userIdDisplay = document.getElementById('user-id-display');

    let quill;
    let unsubscribe; // Firestoreのリスナーを解除するための変数
    let currentUserId = null;
    let allManuals = [];
    let activeCategory = 'all';

    // Quill Editorの初期化
    const initializeQuill = () => {
        if (quill) return;
        const toolbarOptions = [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'script': 'sub'}, { 'script': 'super' }],
            [{ 'indent': '-1'}, { 'indent': '+1' }],
            [{ 'direction': 'rtl' }],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'font': [] }],
            [{ 'align': [] }],
            ['link', 'image', 'video'],
            ['clean']
        ];
        quill = new Quill('#editor', {
            modules: {
                toolbar: toolbarOptions
            },
            theme: 'snow'
        });
    };

    // 認証処理
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            userIdDisplay.textContent = currentUserId;
            // 既存のリスナーがあれば解除
            if (unsubscribe) {
                unsubscribe();
            }
            fetchManuals();
        } else {
            // 匿名でサインイン
            auth.signInAnonymously().catch(error => {
                console.error("匿名認証に失敗しました:", error);
            });
        }
    });

    // マニュアルをFirestoreからリアルタイムで取得
    const fetchManuals = () => {
        loader.style.display = 'flex';
        manualsListContainer.style.display = 'none';
        emptyState.style.display = 'none';

        unsubscribe = manualsCollection.orderBy('updatedAt', 'desc').onSnapshot(snapshot => {
            allManuals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAll();
            loader.style.display = 'none';
        }, error => {
            console.error("マニュアルの取得に失敗しました:", error);
            loader.style.display = 'none';
            manualsListContainer.innerHTML = `<p class="text-red-500">データの読み込みに失敗しました。</p>`;
        });
    };
    
    const renderAll = () => {
        renderCategories();
        renderManuals();
    };

    // マニュアル一覧の描画
    const renderManuals = () => {
        const searchTerm = searchInput.value.toLowerCase();
        
        const filteredManuals = allManuals.filter(manual => {
            const titleMatch = manual.title.toLowerCase().includes(searchTerm);
            const contentMatch = (typeof manual.content === 'string' ? manual.content.toLowerCase() : '').includes(searchTerm);
            const categoryMatch = activeCategory === 'all' || manual.category === activeCategory;
            return (titleMatch || contentMatch) && categoryMatch;
        });

        manualsListContainer.innerHTML = '';
        if (filteredManuals.length === 0) {
            manualsListContainer.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            manualsListContainer.style.display = 'grid';
            emptyState.style.display = 'none';
            filteredManuals.forEach(manual => {
                const card = createManualCard(manual);
                manualsListContainer.appendChild(card);
            });
        }
    };

    // カテゴリフィルターの描画
    const renderCategories = () => {
        const categories = [...new Set(allManuals.map(m => m.category).filter(Boolean))];
        categoryFilterList.innerHTML = `
            <button class="category-btn w-full text-left px-3 py-2 rounded-md transition-colors ${activeCategory === 'all' ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-gray-700'}" data-category="all">
                <i data-lucide="layout-grid" class="inline-block mr-2 h-4 w-4"></i>全て
            </button>
        `;
        categories.sort().forEach(category => {
            const btn = document.createElement('button');
            btn.className = `category-btn w-full text-left px-3 py-2 rounded-md transition-colors ${activeCategory === category ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-gray-700'}`;
            btn.dataset.category = category;
            btn.innerHTML = `<i data-lucide="tag" class="inline-block mr-2 h-4 w-4"></i>${escapeHTML(category)}`;
            categoryFilterList.appendChild(btn);
        });
        lucide.createIcons();
    };

    // マニュアルカードのHTMLを生成
    const createManualCard = (manual) => {
        const card = document.createElement('div');
        card.className = 'bg-gray-800 rounded-lg shadow-lg p-5 flex flex-col hover:shadow-indigo-500/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer';
        card.dataset.id = manual.id;

        const contentPreview = manual.content ? new DOMParser().parseFromString(manual.content, 'text/html').body.textContent.slice(0, 100) + '...' : '内容がありません';

        card.innerHTML = `
            <div class="flex-grow">
                ${manual.category ? `<span class="text-xs bg-gray-700 text-indigo-300 font-semibold px-2 py-1 rounded-full mb-2 inline-block">${escapeHTML(manual.category)}</span>` : ''}
                <h3 class="text-lg font-bold text-white mb-2">${escapeHTML(manual.title)}</h3>
                <p class="text-sm text-gray-400">${escapeHTML(contentPreview)}</p>
            </div>
            <div class="mt-4 text-xs text-gray-500 pt-3 border-t border-gray-700">
                最終更新: ${new Date(manual.updatedAt.toDate()).toLocaleString('ja-JP')}
            </div>
        `;
        card.addEventListener('click', () => openEditor(manual));
        return card;
    };
    
    // エディタモーダルを開く
    const openEditor = (manual = null) => {
        initializeQuill();
        if (manual) {
            manualIdInput.value = manual.id;
            manualTitleInput.value = manual.title;
            manualCategoryInput.value = manual.category || '';
            quill.root.innerHTML = manual.content || '';
            deleteManualBtn.style.display = 'flex';
        } else {
            manualIdInput.value = '';
            manualTitleInput.value = '';
            manualCategoryInput.value = '';
            quill.root.innerHTML = '';
            deleteManualBtn.style.display = 'none';
        }
        editorModal.classList.remove('hidden');
        setTimeout(() => editorModal.classList.add('visible'), 10);
    };

    // エディタモーダルを閉じる
    const closeModal = () => {
        editorModal.classList.remove('visible');
        setTimeout(() => editorModal.classList.add('hidden'), 300);
    };

    // マニュアルを保存
    const saveManual = async () => {
        const id = manualIdInput.value;
        const title = manualTitleInput.value.trim();
        const category = manualCategoryInput.value.trim();
        const content = quill.root.innerHTML;
        
        if (!title) {
            alert('タイトルは必須です。');
            return;
        }

        setSaveButtonState(true);

        const data = {
            title,
            category,
            content,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        try {
            if (id) {
                // 更新
                await manualsCollection.doc(id).update(data);
            } else {
                // 新規作成
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await manualsCollection.add(data);
            }
            closeModal();
        } catch (error) {
            console.error("保存に失敗しました:", error);
            alert('保存に失敗しました。');
        } finally {
            setSaveButtonState(false);
        }
    };

    // マニュアルを削除
    const deleteManual = async () => {
        const id = manualIdInput.value;
        if (!id) return;

        if (confirm('本当にこのマニュアルを削除しますか？この操作は元に戻せません。')) {
            try {
                await manualsCollection.doc(id).delete();
                closeModal();
            } catch (error) {
                console.error("削除に失敗しました:", error);
                alert('削除に失敗しました。');
            }
        }
    };

    // 保存ボタンの状態を切り替え
    const setSaveButtonState = (isSaving) => {
        if (isSaving) {
            saveManualBtn.disabled = true;
            saveBtnText.textContent = '保存中...';
            saveSpinner.style.display = 'block';
        } else {
            saveManualBtn.disabled = false;
            saveBtnText.textContent = '保存';
            saveSpinner.style.display = 'none';
        }
    };
    
    // HTMLエスケープ関数
    const escapeHTML = (str) => {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    };

    // イベントリスナーの設定
    newManualBtn.addEventListener('click', () => openEditor());
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    saveManualBtn.addEventListener('click', saveManual);
    deleteManualBtn.addEventListener('click', deleteManual);
    searchInput.addEventListener('input', renderManuals);
    
    categoryFilterList.addEventListener('click', (e) => {
        const target = e.target.closest('.category-btn');
        if (target) {
            activeCategory = target.dataset.category;
            renderAll();
        }
    });

    // 初期アイコンの描画
    lucide.createIcons();
});
