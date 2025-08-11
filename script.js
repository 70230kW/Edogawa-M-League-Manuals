document.addEventListener('DOMContentLoaded', () => {
    // Firebase構成
    const firebaseConfig = {
        apiKey: "AIzaSyCleKavI0XicnYv2Hl1tkRNRikCBrb8is4",
        authDomain: "edogawa-m-league-results.firebaseapp.com",
        projectId: "edogawa-m-league-results",
        storageBucket: "edogawa-m-league-results.appspot.com",
        messagingSenderId: "315224725184",
        appId: "1:315224725184:web:e0f8dbca47f04b2fa37f25",
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();
    const storage = firebase.storage();
    const manualsCollection = db.collection('manuals');
    const categoriesCollection = db.collection('categories');

    // DOM要素
    const userIdDisplay = document.getElementById('user-id-display');
    const newManualBtn = document.getElementById('new-manual-btn');
    const manualsListContainer = document.getElementById('manuals-list');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-input');
    const categoryFilterSelect = document.getElementById('category-filter-select');
    const manageCategoriesBtn = document.getElementById('manage-categories-btn');
    
    // Editor Modal
    const editorModal = document.getElementById('editor-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const saveManualBtn = document.getElementById('save-manual-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const deleteManualBtn = document.getElementById('delete-manual-btn');
    const manualIdInput = document.getElementById('manual-id');
    const manualTitleInput = document.getElementById('manual-title');
    const manualCategorySelect = document.getElementById('manual-category-select');
    const lastUpdatedDisplay = document.getElementById('last-updated-display');
    const reactionsContainer = document.getElementById('reactions-container');

    // History Modal
    const historyModal = document.getElementById('history-modal');
    const closeHistoryModalBtn = document.getElementById('close-history-modal-btn');
    const historyList = document.getElementById('history-list');

    // Category Modal
    const categoryModal = document.getElementById('category-modal');
    const closeCategoryModalBtn = document.getElementById('close-category-modal-btn');
    const newCategoryNameInput = document.getElementById('new-category-name');
    const newCategoryFuriganaInput = document.getElementById('new-category-furigana');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const categoryManagerList = document.getElementById('category-manager-list');

    // グローバル変数
    let quill, currentUser = null, allManuals = [], allCategories = [], isLocalChange = false;
    let mainUnsubscribe, manualUnsubscribe, categoriesUnsubscribe;
    const AVAILABLE_REACTIONS = ['👍', '🎉', '🤔', '👀'];

    // --- 匿名認証 ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            initApp();
        } else {
            auth.signInAnonymously().catch(error => console.error("Anonymous sign-in failed:", error));
        }
    });

    // --- アプリケーション初期化 ---
    const initApp = () => {
        if (mainUnsubscribe) mainUnsubscribe();
        if (categoriesUnsubscribe) categoriesUnsubscribe();
        
        userIdDisplay.textContent = currentUser.uid;
        fetchManuals();
        fetchCategories();
        lucide.createIcons();
    };
    
    // --- データ取得 ---
    const fetchManuals = () => {
        loader.style.display = 'flex';
        mainUnsubscribe = manualsCollection.orderBy('updatedAt', 'desc').onSnapshot(snapshot => {
            allManuals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), plainText: new DOMParser().parseFromString(doc.data().content || '', 'text/html').body.textContent }));
            renderManuals();
            loader.style.display = 'none';
        }, console.error);
    };

    const fetchCategories = () => {
        categoriesUnsubscribe = categoriesCollection.orderBy('furigana').onSnapshot(snapshot => {
            allCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCategoryFilter();
            populateEditorCategoryDropdown();
            renderCategoryManager();
        }, console.error);
    };

    // --- メイン画面描画 ---
    const renderManuals = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const activeCategory = categoryFilterSelect.value;
        
        const filteredManuals = allManuals.filter(manual => {
            const titleMatch = manual.title.toLowerCase().includes(searchTerm);
            const contentMatch = manual.plainText.toLowerCase().includes(searchTerm);
            const categoryMatch = activeCategory === 'all' || manual.category === activeCategory;
            return (titleMatch || contentMatch) && categoryMatch;
        });

        manualsListContainer.innerHTML = '';
        if (filteredManuals.length === 0) {
            manualsListContainer.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            manualsListContainer.style.display = 'grid';
            filteredManuals.forEach(manual => manualsListContainer.appendChild(createManualCard(manual)));
        }
        lucide.createIcons();
    };

    const createManualCard = (manual) => {
        const card = document.createElement('div');
        card.className = 'bg-gray-900 rounded-xl shadow-lg p-6 flex flex-col border border-gray-800 hover:border-amber-500 hover:-translate-y-1 transition-all duration-300 cursor-pointer';
        card.dataset.id = manual.id;
        card.innerHTML = `
            <div class="flex-grow">
                ${manual.category ? `<span class="text-xs bg-gray-700 text-amber-400 font-semibold px-2.5 py-1 rounded-full mb-3 inline-block font-sans">${escapeHTML(manual.category)}</span>` : ''}
                <h3 class="text-xl font-bold text-white mb-3 font-display">${escapeHTML(manual.title)}</h3>
                <p class="text-base text-gray-400 font-sans">${escapeHTML(manual.plainText.slice(0, 80))}...</p>
            </div>
            <div class="mt-5 text-xs text-gray-500 pt-4 border-t border-gray-700/50 font-sans">
                最終更新: ${manual.updatedAt ? new Date(manual.updatedAt.toDate()).toLocaleString('ja-JP') : '不明'}
            </div>
        `;
        card.addEventListener('click', () => openEditor(manual.id));
        return card;
    };

    // --- カテゴリ管理 ---
    const renderCategoryFilter = () => {
        const selectedValue = categoryFilterSelect.value || 'all';
        categoryFilterSelect.innerHTML = `<option value="all">全てのカテゴリ</option>`;
        allCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            categoryFilterSelect.appendChild(option);
        });
        categoryFilterSelect.value = selectedValue;
    };

    const openCategoryModal = () => categoryModal.classList.add('visible');
    const closeCategoryModal = () => categoryModal.classList.remove('visible');

    const addCategory = async () => {
        const name = newCategoryNameInput.value.trim();
        const furigana = newCategoryFuriganaInput.value.trim();
        if (!name || !furigana) return alert('カテゴリ名とふりがなを入力してください。');
        try {
            await categoriesCollection.add({ name, furigana });
            newCategoryNameInput.value = '';
            newCategoryFuriganaInput.value = '';
        } catch (error) { console.error(error); }
    };
    
    const renderCategoryManager = () => {
        categoryManagerList.innerHTML = '';
        allCategories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'category-item bg-gray-800 p-2 rounded-md';
            item.dataset.id = cat.id;
            item.innerHTML = `
                <div class="category-display-view flex items-center justify-between">
                    <div>
                        <p class="text-gray-300">${escapeHTML(cat.name)}</p>
                        <p class="text-xs text-gray-500">${escapeHTML(cat.furigana)}</p>
                    </div>
                    <div>
                        <button class="edit-category-btn text-gray-500 hover:text-amber-400 p-1"><i data-lucide="edit" class="h-4 w-4"></i></button>
                        <button class="delete-category-btn text-gray-500 hover:text-red-400 p-1"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                    </div>
                </div>
                <div class="category-edit-view gap-2">
                    <input type="text" value="${escapeHTML(cat.name)}" class="edit-name-input flex-grow bg-gray-700 border border-gray-600 rounded p-1 text-white">
                    <input type="text" value="${escapeHTML(cat.furigana)}" class="edit-furigana-input flex-grow bg-gray-700 border border-gray-600 rounded p-1 text-white">
                    <button class="save-edit-btn text-gray-500 hover:text-green-400 p-1"><i data-lucide="check" class="h-5 w-5"></i></button>
                    <button class="cancel-edit-btn text-gray-500 hover:text-red-400 p-1"><i data-lucide="x" class="h-5 w-5"></i></button>
                </div>
            `;
            categoryManagerList.appendChild(item);
        });
        lucide.createIcons();
    };

    const handleCategoryManagerClick = async (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        const item = target.closest('.category-item');
        const id = item.dataset.id;

        if (target.matches('.delete-category-btn, .delete-category-btn *')) {
            if (confirm('このカテゴリを削除しますか？')) await categoriesCollection.doc(id).delete();
        } else if (target.matches('.edit-category-btn, .edit-category-btn *')) {
            item.classList.add('is-editing');
        } else if (target.matches('.cancel-edit-btn, .cancel-edit-btn *')) {
            item.classList.remove('is-editing');
        } else if (target.matches('.save-edit-btn, .save-edit-btn *')) {
            const newName = item.querySelector('.edit-name-input').value.trim();
            const newFurigana = item.querySelector('.edit-furigana-input').value.trim();
            if (newName && newFurigana) {
                const oldDoc = await categoriesCollection.doc(id).get();
                const oldName = oldDoc.data().name;
                await categoriesCollection.doc(id).update({ name: newName, furigana: newFurigana });
                if (oldName !== newName) {
                    const batch = db.batch();
                    const manualsToUpdate = await manualsCollection.where("category", "==", oldName).get();
                    manualsToUpdate.forEach(doc => batch.update(doc.ref, { category: newName }));
                    await batch.commit();
                }
                item.classList.remove('is-editing');
            }
        }
    };
    
    // --- エディタモーダル ---
    const openEditor = async (manualId = null) => {
        if (!quill) initializeQuill();
        if (manualUnsubscribe) manualUnsubscribe();
        
        const open = (manual = {}) => {
            manualIdInput.value = manual.id || '';
            manualTitleInput.value = manual.title || '';
            populateEditorCategoryDropdown(manual.category);
            quill.root.innerHTML = manual.content || '';
            deleteManualBtn.style.display = manual.id ? 'flex' : 'none';
            
            if (manual.id) {
                listenToManualChanges(manual.id);
            } else {
                lastUpdatedDisplay.textContent = '';
                reactionsContainer.innerHTML = '';
            }
            editorModal.classList.add('visible');
        };

        if (manualId) {
            const doc = await manualsCollection.doc(manualId).get();
            if (doc.exists) open({ id: doc.id, ...doc.data() });
        } else {
            open();
        }
    };

    const listenToManualChanges = (manualId) => {
        manualUnsubscribe = manualsCollection.doc(manualId).onSnapshot(doc => {
            if (!doc.exists || !editorModal.classList.contains('visible')) return;
            const manual = doc.data();
            manualTitleInput.value = manual.title;
            manualCategorySelect.value = manual.category || '';
            lastUpdatedDisplay.textContent = `最終更新: ${manual.updatedAt.toDate().toLocaleString('ja-JP')}`;
            if (!isLocalChange) {
                const selection = quill.getSelection();
                quill.root.innerHTML = manual.content || '';
                if (selection) quill.setSelection(selection);
            }
            renderReactions(manual.reactions);
            isLocalChange = false;
        });
    };

    const closeModal = () => {
        if (manualUnsubscribe) manualUnsubscribe();
        editorModal.classList.remove('visible');
    };
    
    const saveManual = async () => {
        const id = manualIdInput.value;
        const title = manualTitleInput.value.trim();
        if (!title) return alert('タイトルは必須です。');
        setSaveButtonState(true);

        const data = {
            title,
            category: manualCategorySelect.value,
            content: quill.root.innerHTML,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        try {
            if (id) {
                const manualRef = manualsCollection.doc(id);
                const currentDoc = await manualRef.get();
                if (currentDoc.exists) {
                    await manualRef.collection('versions').add({ ...currentDoc.data(), savedAt: firebase.firestore.FieldValue.serverTimestamp() });
                }
                await manualRef.update(data);
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                data.reactions = {};
                const newDocRef = await manualsCollection.add(data);
                manualIdInput.value = newDocRef.id;
                listenToManualChanges(newDocRef.id);
            }
        } catch (error) { console.error(error); } finally { setSaveButtonState(false); }
    };
    
    const populateEditorCategoryDropdown = (selectedValue) => {
        const currentValue = selectedValue || manualCategorySelect.value;
        manualCategorySelect.innerHTML = `<option value="">カテゴリなし</option>`;
        allCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            manualCategorySelect.appendChild(option);
        });
        manualCategorySelect.value = currentValue;
    };
    
    // --- リアクション ---
    const toggleReaction = (manualId, emoji) => {
        const manualRef = manualsCollection.doc(manualId);
        db.runTransaction(async (transaction) => {
            const doc = await transaction.get(manualRef);
            if (!doc.exists) return;
            const reactions = doc.data().reactions || {};
            const userList = reactions[emoji] || [];
            if (userList.includes(currentUser.uid)) {
                transaction.update(manualRef, { [`reactions.${emoji}`]: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
            } else {
                transaction.update(manualRef, { [`reactions.${emoji}`]: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
            }
        });
    };

    const renderReactions = (reactions = {}) => {
        reactionsContainer.innerHTML = '';
        AVAILABLE_REACTIONS.forEach(emoji => {
            const userList = reactions[emoji] || [];
            const count = userList.length;
            const hasReacted = userList.includes(currentUser.uid);
            
            const btn = document.createElement('button');
            btn.className = `reaction-btn border border-gray-700 rounded-full px-3 py-1 text-lg ${hasReacted ? 'reacted bg-amber-500/20 border-amber-500' : 'bg-gray-700'}`;
            btn.textContent = `${emoji} ${count}`;
            btn.onclick = () => toggleReaction(manualIdInput.value, emoji);
            reactionsContainer.appendChild(btn);
        });
    };

    // --- その他 & ヘルパー ---
    const initializeQuill = () => {
        if (quill) return;
        quill = new Quill('#editor', { theme: 'snow', modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link', 'image']] } });
        quill.on('text-change', (d, o, source) => { if (source === 'user') isLocalChange = true; });
    };
    const setSaveButtonState = (isSaving) => { saveManualBtn.disabled = isSaving; saveBtnText.textContent = isSaving ? '保存中...' : '保存'; saveSpinner.style.display = isSaving ? 'block' : 'none'; };
    const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]) : '';

    // --- イベントリスナー ---
    newManualBtn.addEventListener('click', () => openEditor());
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    saveManualBtn.addEventListener('click', saveManual);
    searchInput.addEventListener('input', renderManuals);
    categoryFilterSelect.addEventListener('change', renderManuals);
    manageCategoriesBtn.addEventListener('click', openCategoryModal);
    closeCategoryModalBtn.addEventListener('click', closeCategoryModal);
    addCategoryBtn.addEventListener('click', addCategory);
    categoryManagerList.addEventListener('click', handleCategoryManagerClick);
    
    const historyBtn = document.getElementById('history-btn');
    const pdfExportBtn = document.getElementById('pdf-export-btn');
    const deleteManualBtn = document.getElementById('delete-manual-btn');
    historyBtn.addEventListener('click', () => historyModal.classList.add('visible'));
    closeHistoryModalBtn.addEventListener('click', () => historyModal.classList.remove('visible'));
    pdfExportBtn.addEventListener('click', () => alert('PDF export logic here.'));
    deleteManualBtn.addEventListener('click', () => alert('Delete logic here.'));
});
