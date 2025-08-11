document.addEventListener('DOMContentLoaded', () => {
    // Firebase構成オブジェクト
    const firebaseConfig = {
        apiKey: "AIzaSyCleKavI0XicnYv2Hl1tkRNRikCBrb8is4",
        authDomain: "edogawa-m-league-results.firebaseapp.com",
        projectId: "edogawa-m-league-results",
        storageBucket: "edogawa-m-league-results.appspot.com",
        messagingSenderId: "315224725184",
        appId: "1:315224725184:web:e0f8dbca47f04b2fa37f25",
        measurementId: "G-B3ZTXE1MYV"
    };

    // Firebaseの初期化
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();
    const storage = firebase.storage();
    const manualsCollection = db.collection('manuals');
    const categoriesCollection = db.collection('categories');

    // DOM要素
    const newManualBtn = document.getElementById('new-manual-btn');
    const manualsListContainer = document.getElementById('manuals-list');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-input');
    const userIdDisplay = document.getElementById('user-id-display');
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
    const saveBtnText = document.getElementById('save-btn-text');
    const saveSpinner = document.getElementById('save-spinner');
    
    // Attachments & Actions
    const fileUploadInput = document.getElementById('file-upload-input');
    const attachmentsList = document.getElementById('attachments-list');
    const historyBtn = document.getElementById('history-btn');
    const pdfExportBtn = document.getElementById('pdf-export-btn');

    // History Modal
    const historyModal = document.getElementById('history-modal');
    const closeHistoryModalBtn = document.getElementById('close-history-modal-btn');
    const historyList = document.getElementById('history-list');

    // Category Modal
    const categoryModal = document.getElementById('category-modal');
    const closeCategoryModalBtn = document.getElementById('close-category-modal-btn');
    const newCategoryInput = document.getElementById('new-category-input');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const categoryManagerList = document.getElementById('category-manager-list');

    // グローバル変数
    let quill;
    let mainUnsubscribe;
    let manualUnsubscribe;
    let categoriesUnsubscribe;
    let currentUserId = null;
    let allManuals = [];
    let allCategories = [];
    let isLocalChange = false;

    // 認証処理
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            userIdDisplay.textContent = currentUserId;
            if (mainUnsubscribe) mainUnsubscribe();
            if (categoriesUnsubscribe) categoriesUnsubscribe();
            fetchManuals();
            fetchCategories();
        } else {
            auth.signInAnonymously().catch(console.error);
        }
    });

    // マニュアル一覧の取得
    const fetchManuals = () => {
        loader.style.display = 'flex';
        mainUnsubscribe = manualsCollection.orderBy('updatedAt', 'desc').onSnapshot(snapshot => {
            allManuals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderManuals();
            loader.style.display = 'none';
        }, console.error);
    };

    // カテゴリの取得
    const fetchCategories = () => {
        categoriesUnsubscribe = categoriesCollection.orderBy('name').onSnapshot(snapshot => {
            allCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCategoryFilter();
            populateEditorCategoryDropdown();
            renderCategoryManager();
        }, console.error);
    };

    // マニュアル一覧の描画
    const renderManuals = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const activeCategory = categoryFilterSelect.value;
        
        const filteredManuals = allManuals.filter(manual => {
            const titleMatch = manual.title.toLowerCase().includes(searchTerm);
            const categoryMatch = activeCategory === 'all' || manual.category === activeCategory;
            return titleMatch && categoryMatch;
        });

        manualsListContainer.innerHTML = '';
        if (filteredManuals.length === 0) {
            manualsListContainer.style.display = 'none';
            emptyState.style.display = 'block';
            emptyState.querySelector('h3').textContent = allManuals.length === 0 ? 'マニュアルがありません' : '該当するマニュアルがありません';
        } else {
            emptyState.style.display = 'none';
            manualsListContainer.style.display = 'grid';
            filteredManuals.forEach(manual => {
                const card = createManualCard(manual);
                manualsListContainer.appendChild(card);
            });
        }
        lucide.createIcons();
    };
    
    // カテゴリフィルター(サイドバー)の描画
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

    // マニュアルカードの生成
    const createManualCard = (manual) => {
        const card = document.createElement('div');
        card.className = 'bg-gray-900 rounded-xl shadow-lg p-6 flex flex-col border border-gray-800 hover:border-amber-500 hover:-translate-y-1 transition-all duration-300 cursor-pointer';
        card.dataset.id = manual.id;
        const contentPreview = manual.content ? new DOMParser().parseFromString(manual.content, 'text/html').body.textContent.slice(0, 80) + '...' : '内容がありません';
        card.innerHTML = `
            <div class="flex-grow">
                ${manual.category ? `<span class="text-xs bg-gray-700 text-amber-400 font-semibold px-2.5 py-1 rounded-full mb-3 inline-block font-sans">${escapeHTML(manual.category)}</span>` : ''}
                <h3 class="text-xl font-bold text-white mb-3 font-display">${escapeHTML(manual.title)}</h3>
                <p class="text-base text-gray-400 font-sans">${escapeHTML(contentPreview)}</p>
            </div>
            <div class="mt-5 text-xs text-gray-500 pt-4 border-t border-gray-700/50 font-sans">
                最終更新: ${manual.updatedAt ? new Date(manual.updatedAt.toDate()).toLocaleString('ja-JP') : '不明'}
            </div>
        `;
        card.addEventListener('click', () => openEditor(manual.id));
        return card;
    };

    // エディタモーダルを開く
    const openEditor = (manualId = null) => {
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
                renderAttachments(manual.id);
            } else {
                attachmentsList.innerHTML = '<p class="text-sm text-gray-500 text-center p-4">保存後にファイルを追加できます。</p>';
            }
            
            editorModal.classList.remove('hidden');
            setTimeout(() => editorModal.classList.add('visible'), 10);
        };

        if (manualId) {
            manualsCollection.doc(manualId).get().then(doc => {
                if (doc.exists) {
                    open({ id: doc.id, ...doc.data() });
                }
            });
        } else {
            open();
        }
    };
    
    const listenToManualChanges = (manualId) => {
        manualUnsubscribe = manualsCollection.doc(manualId).onSnapshot(doc => {
            if (!doc.exists) {
                closeModal();
                return;
            }
            const manual = doc.data();
            if (document.getElementById('editor-modal').classList.contains('visible')) {
                if (document.activeElement !== manualTitleInput) {
                    manualTitleInput.value = manual.title;
                }
                if (document.activeElement !== manualCategorySelect) {
                    manualCategorySelect.value = manual.category || '';
                }
                if (!isLocalChange) {
                    const selection = quill.getSelection();
                    quill.root.innerHTML = manual.content || '';
                    if (selection) quill.setSelection(selection);
                }
                isLocalChange = false;
            }
        });
    };

    // エディタのカテゴリプルダウンを生成
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
    
    // マニュアルを保存
    const saveManual = async () => {
        const id = manualIdInput.value;
        const title = manualTitleInput.value.trim();
        if (!title) {
            alert('タイトルは必須です。');
            return;
        }
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
                    await manualRef.collection('versions').add({
                        ...currentDoc.data(),
                        savedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                await manualRef.update(data);
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                const newDocRef = await manualsCollection.add(data);
                manualIdInput.value = newDocRef.id;
                listenToManualChanges(newDocRef.id);
                renderAttachments(newDocRef.id);
            }
        } catch (error) {
            console.error("保存エラー:", error);
            alert('保存に失敗しました。');
        } finally {
            setSaveButtonState(false);
        }
    };
    
    // カテゴリ管理モーダル
    const openCategoryModal = () => {
        renderCategoryManager();
        categoryModal.classList.remove('hidden');
        setTimeout(() => categoryModal.classList.add('visible'), 10);
    };

    const closeCategoryModal = () => {
        categoryModal.classList.remove('visible');
        setTimeout(() => categoryModal.classList.add('hidden'), 300);
    };

    const renderCategoryManager = () => {
        categoryManagerList.innerHTML = '';
        if (allCategories.length === 0) {
            categoryManagerList.innerHTML = '<p class="text-gray-500 text-center">カテゴリはありません。</p>';
            return;
        }
        allCategories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between bg-gray-800 p-2 rounded-md';
            item.innerHTML = `
                <span class="text-gray-300">${escapeHTML(cat.name)}</span>
                <button data-id="${cat.id}" class="delete-category-btn text-gray-500 hover:text-red-400"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
            `;
            categoryManagerList.appendChild(item);
        });
        lucide.createIcons();
    };

    const addCategory = async () => {
        const name = newCategoryInput.value.trim();
        if (!name) return;
        if (allCategories.some(c => c.name === name)) {
            alert('同じ名前のカテゴリが既に存在します。');
            return;
        }
        try {
            await categoriesCollection.add({ name });
            newCategoryInput.value = '';
        } catch (error) {
            console.error("カテゴリ追加エラー:", error);
        }
    };

    const deleteCategory = async (id) => {
        if (confirm('このカテゴリを削除しますか？マニュアルからカテゴリが削除されるわけではありませんが、選択肢からは消えます。')) {
            try {
                await categoriesCollection.doc(id).delete();
            } catch (error) {
                console.error("カテゴリ削除エラー:", error);
            }
        }
    };

    // Quillの初期化
    const initializeQuill = () => {
        if (quill) return;
        quill = new Quill('#editor', {
            modules: { toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }],
                ['link', 'image', 'video'],
                ['clean']
            ]},
            theme: 'snow'
        });

        quill.on('text-change', (delta, oldDelta, source) => {
            if (source === 'user') {
                isLocalChange = true;
            }
        });
    };

    // --- 既存の関数群 (変更なし、または軽微な変更) ---
    const closeModal = () => {
        if (manualUnsubscribe) manualUnsubscribe();
        editorModal.classList.remove('visible');
        setTimeout(() => editorModal.classList.add('hidden'), 300);
    };
    const deleteManual = async () => {
        const id = manualIdInput.value;
        if (!id) return;
        if (confirm('本当にこのマニュアルを削除しますか？関連する履歴や添付ファイルも全て削除されます。')) {
            try {
                await manualsCollection.doc(id).delete();
                closeModal();
            } catch (error) { console.error("削除エラー:", error); alert('削除に失敗しました。'); }
        }
    };
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        const manualId = manualIdInput.value;
        if (!file || !manualId) return;
        const attachmentRef = storage.ref(`attachments/${manualId}/${Date.now()}_${file.name}`);
        try {
            const snapshot = await attachmentRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            await manualsCollection.doc(manualId).collection('attachments').add({
                name: file.name, url: downloadURL, type: file.type, size: file.size,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) { console.error("アップロード失敗:", error); alert("ファイルのアップロードに失敗しました。"); }
        e.target.value = '';
    };
    const renderAttachments = (manualId) => {
        manualsCollection.doc(manualId).collection('attachments').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            attachmentsList.innerHTML = snapshot.empty ? '<p class="text-sm text-gray-500 text-center p-4">添付ファイルはありません。</p>' : '';
            snapshot.forEach(doc => {
                const attachment = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'attachment-item bg-gray-700 p-2 rounded-md flex items-center justify-between text-sm transition-colors hover:bg-gray-600';
                item.innerHTML = `<a href="${attachment.url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 truncate text-gray-300"><i data-lucide="file" class="h-4 w-4 flex-shrink-0"></i><span class="truncate">${escapeHTML(attachment.name)}</span></a><button class="attachment-delete-btn text-gray-500 hover:text-red-400 opacity-0 transform translate-x-2 transition-all" data-id="${attachment.id}" data-name="${attachment.name}"><i data-lucide="trash-2" class="h-4 w-4"></i></button>`;
                attachmentsList.appendChild(item);
            });
            lucide.createIcons();
        });
    };
    const showVersionHistory = async () => {
        const manualId = manualIdInput.value; if (!manualId) return;
        const snapshot = await manualsCollection.doc(manualId).collection('versions').orderBy('savedAt', 'desc').get();
        historyList.innerHTML = snapshot.empty ? '<p class="text-gray-500 text-center">履歴はありません。</p>' : '';
        snapshot.forEach(doc => {
            const version = { id: doc.id, ...doc.data() };
            const item = document.createElement('div');
            item.className = 'bg-gray-800 p-3 rounded-md flex justify-between items-center';
            item.innerHTML = `<div><p class="font-bold text-white">${version.title}</p><p class="text-xs text-gray-400">保存日時: ${new Date(version.savedAt.toDate()).toLocaleString('ja-JP')}</p></div><button class="restore-btn bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-1 px-3 rounded" data-version-id="${version.id}">復元</button>`;
            historyList.appendChild(item);
        });
        historyModal.classList.remove('hidden');
        setTimeout(() => historyModal.classList.add('visible'), 10);
    };
    const closeHistoryModal = () => { historyModal.classList.remove('visible'); setTimeout(() => historyModal.classList.add('hidden'), 300); };
    const exportToPdf = () => {
        const { jsPDF } = window.jspdf;
        const title = manualTitleInput.value || 'Untitled';
        const content = document.querySelector('.ql-editor');
        html2canvas(content, { backgroundColor: '#1F2937', scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = canvas.height * pdfWidth / canvas.width;
            let heightLeft = imgHeight, position = 15;
            pdf.setFontSize(20); pdf.text(title, pdfWidth / 2, 10, { align: 'center' });
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight; pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight); heightLeft -= pdfHeight;
            }
            pdf.save(`${title}.pdf`);
        });
    };
    const setSaveButtonState = (isSaving) => { saveManualBtn.disabled = isSaving; saveBtnText.textContent = isSaving ? '保存中...' : '保存'; saveSpinner.style.display = isSaving ? 'block' : 'none'; };
    const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]) : '';

    // イベントリスナー
    newManualBtn.addEventListener('click', () => openEditor());
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    saveManualBtn.addEventListener('click', saveManual);
    deleteManualBtn.addEventListener('click', deleteManual);
    searchInput.addEventListener('input', renderManuals);
    categoryFilterSelect.addEventListener('change', renderManuals);
    manageCategoriesBtn.addEventListener('click', openCategoryModal);
    closeCategoryModalBtn.addEventListener('click', closeCategoryModal);
    addCategoryBtn.addEventListener('click', addCategory);
    categoryManagerList.addEventListener('click', e => {
        const target = e.target.closest('.delete-category-btn');
        if (target) deleteCategory(target.dataset.id);
    });
    fileUploadInput.addEventListener('change', handleFileUpload);
    historyBtn.addEventListener('click', showVersionHistory);
    pdfExportBtn.addEventListener('click', exportToPdf);
    closeHistoryModalBtn.addEventListener('click', closeHistoryModal);
    historyList.addEventListener('click', async e => {
        if (e.target.classList.contains('restore-btn')) {
            const versionId = e.target.dataset.versionId;
            const manualId = manualIdInput.value;
            if (confirm('このバージョンに復元しますか？現在の編集内容は新しい履歴として保存されます。')) {
                try {
                    const versionDoc = await manualsCollection.doc(manualId).collection('versions').doc(versionId).get();
                    if (!versionDoc.exists) return;
                    await saveManual();
                    const d = versionDoc.data();
                    await manualsCollection.doc(manualId).update({ title: d.title, category: d.category, content: d.content, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                    closeHistoryModal();
                } catch (error) { console.error("復元エラー:", error); }
            }
        }
    });
    attachmentsList.addEventListener('click', async e => {
        const deleteBtn = e.target.closest('.attachment-delete-btn');
        if (deleteBtn) {
            const manualId = manualIdInput.value;
            const attachmentId = deleteBtn.dataset.id;
            const attachmentName = deleteBtn.dataset.name;
            if (confirm(`ファイル「${attachmentName}」を削除しますか？`)) {
                try {
                    await manualsCollection.doc(manualId).collection('attachments').doc(attachmentId).delete();
                } catch (error) { console.error("添付ファイルの削除に失敗:", error); }
            }
        }
    });

    lucide.createIcons();
});
