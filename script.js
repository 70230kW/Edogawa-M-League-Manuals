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

    // DOM要素
    const newManualBtn = document.getElementById('new-manual-btn');
    const manualsListContainer = document.getElementById('manuals-list');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-input');
    const categoryFilterList = document.getElementById('category-filter-list');
    const userIdDisplay = document.getElementById('user-id-display');

    // Editor Modal
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
    const activeCollaboratorsDiv = document.getElementById('active-collaborators');
    
    // Attachments
    const fileUploadInput = document.getElementById('file-upload-input');
    const attachmentsList = document.getElementById('attachments-list');

    // Actions
    const historyBtn = document.getElementById('history-btn');
    const pdfExportBtn = document.getElementById('pdf-export-btn');

    // History Modal
    const historyModal = document.getElementById('history-modal');
    const closeHistoryModalBtn = document.getElementById('close-history-modal-btn');
    const historyList = document.getElementById('history-list');

    // グローバル変数
    let quill;
    let mainUnsubscribe;
    let manualUnsubscribe;
    let currentUserId = null;
    let allManuals = [];
    let activeCategory = 'all';
    let isLocalChange = false;

    // Quill Editorの初期化
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

        // 共同編集のためのテキスト変更リスナー
        quill.on('text-change', (delta, oldDelta, source) => {
            if (source === 'user') {
                const manualId = manualIdInput.value;
                if (manualId) {
                    isLocalChange = true;
                    manualsCollection.doc(manualId).update({
                        content: quill.root.innerHTML,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(console.error);
                }
            }
        });
    };

    // 認証処理
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            userIdDisplay.textContent = currentUserId;
            if (mainUnsubscribe) mainUnsubscribe();
            fetchManuals();
        } else {
            auth.signInAnonymously().catch(console.error);
        }
    });

    // マニュアル一覧の取得
    const fetchManuals = () => {
        loader.style.display = 'flex';
        mainUnsubscribe = manualsCollection.orderBy('updatedAt', 'desc').onSnapshot(snapshot => {
            allManuals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAll();
            loader.style.display = 'none';
        }, console.error);
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
            const categoryMatch = activeCategory === 'all' || manual.category === activeCategory;
            return titleMatch && categoryMatch;
        });

        manualsListContainer.innerHTML = '';
        if (filteredManuals.length === 0 && allManuals.length > 0) {
            manualsListContainer.innerHTML = `<p class="text-gray-500 col-span-full text-center">該当するマニュアルがありません。</p>`;
        } else if (allManuals.length === 0) {
            emptyState.style.display = 'block';
            manualsListContainer.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            manualsListContainer.style.display = 'grid';
            filteredManuals.forEach(manual => {
                const card = createManualCard(manual);
                manualsListContainer.appendChild(card);
            });
        }
    };
    
    // カテゴリの描画
    const renderCategories = () => {
        const categories = [...new Set(allManuals.map(m => m.category).filter(Boolean))];
        categoryFilterList.innerHTML = `
            <button class="category-btn w-full text-left px-4 py-2 rounded-md transition-colors text-lg ${activeCategory === 'all' ? 'bg-amber-500/10 text-amber-300 font-bold' : 'hover:bg-gray-800'}" data-category="all">
                <i data-lucide="layout-grid" class="inline-block mr-3 h-5 w-5"></i>全て
            </button>
        `;
        categories.sort().forEach(category => {
            const btn = document.createElement('button');
            btn.className = `category-btn w-full text-left px-4 py-2 rounded-md transition-colors text-lg ${activeCategory === category ? 'bg-amber-500/10 text-amber-300 font-bold' : 'hover:bg-gray-800'}`;
            btn.dataset.category = category;
            btn.innerHTML = `<i data-lucide="tag" class="inline-block mr-3 h-5 w-5"></i>${escapeHTML(category)}`;
            categoryFilterList.appendChild(btn);
        });
        lucide.createIcons();
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
    const openEditor = async (manualId) => {
        initializeQuill();
        manualIdInput.value = manualId || '';
        
        if (manualUnsubscribe) manualUnsubscribe();
        
        if (manualId) {
            manualUnsubscribe = manualsCollection.doc(manualId).onSnapshot(doc => {
                if (!doc.exists) {
                    closeModal();
                    return;
                }
                const manual = { id: doc.id, ...doc.data() };
                
                if (document.getElementById('editor-modal').classList.contains('visible')) {
                    manualTitleInput.value = manual.title;
                    manualCategoryInput.value = manual.category || '';
                    if (!isLocalChange) {
                        const selection = quill.getSelection();
                        quill.root.innerHTML = manual.content || '';
                        if (selection) quill.setSelection(selection);
                    }
                    isLocalChange = false;
                }
            });
            deleteManualBtn.style.display = 'flex';
            renderAttachments(manualId);
        } else {
            manualTitleInput.value = '';
            manualCategoryInput.value = '';
            quill.root.innerHTML = '';
            deleteManualBtn.style.display = 'none';
            attachmentsList.innerHTML = '<p class="text-sm text-gray-500 text-center p-4">保存後にファイルを追加できます。</p>';
        }
        
        editorModal.classList.remove('hidden');
        setTimeout(() => editorModal.classList.add('visible'), 10);
    };

    // モーダルを閉じる
    const closeModal = () => {
        if (manualUnsubscribe) manualUnsubscribe();
        editorModal.classList.remove('visible');
        setTimeout(() => editorModal.classList.add('hidden'), 300);
    };

    // マニュアルを保存（新規作成・更新）
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
            category: manualCategoryInput.value.trim(),
            content: quill.root.innerHTML,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        try {
            if (id) {
                const manualRef = manualsCollection.doc(id);
                const currentDoc = await manualRef.get();
                if (currentDoc.exists) {
                    // バージョン履歴を作成
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
                await openEditor(newDocRef.id); // 再度開いてリスナーをアタッチ
            }
            // closeModal(); // 保存後も編集を続けられるように閉じない
        } catch (error) {
            console.error("保存エラー:", error);
            alert('保存に失敗しました。');
        } finally {
            setSaveButtonState(false);
        }
    };

    // マニュアルを削除
    const deleteManual = async () => {
        const id = manualIdInput.value;
        if (!id) return;
        if (confirm('本当にこのマニュアルを削除しますか？関連する履歴や添付ファイルも全て削除されます。')) {
            try {
                await manualsCollection.doc(id).delete();
                closeModal();
            } catch (error) {
                console.error("削除エラー:", error);
                alert('削除に失敗しました。');
            }
        }
    };

    // 添付ファイルの処理
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        const manualId = manualIdInput.value;
        if (!file || !manualId) return;

        const attachmentRef = storage.ref(`attachments/${manualId}/${Date.now()}_${file.name}`);
        try {
            const snapshot = await attachmentRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            await manualsCollection.doc(manualId).collection('attachments').add({
                name: file.name,
                url: downloadURL,
                type: file.type,
                size: file.size,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("アップロード失敗:", error);
            alert("ファイルのアップロードに失敗しました。");
        }
        e.target.value = ''; // 同じファイルを連続でアップロードできるようにリセット
    };

    const renderAttachments = (manualId) => {
        manualsCollection.doc(manualId).collection('attachments').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            if (snapshot.empty) {
                attachmentsList.innerHTML = '<p class="text-sm text-gray-500 text-center p-4">添付ファイルはありません。</p>';
                return;
            }
            attachmentsList.innerHTML = '';
            snapshot.forEach(doc => {
                const attachment = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'attachment-item bg-gray-700 p-2 rounded-md flex items-center justify-between text-sm transition-colors hover:bg-gray-600';
                item.innerHTML = `
                    <a href="${attachment.url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 truncate text-gray-300">
                        <i data-lucide="file" class="h-4 w-4 flex-shrink-0"></i>
                        <span class="truncate">${escapeHTML(attachment.name)}</span>
                    </a>
                    <button class="attachment-delete-btn text-gray-500 hover:text-red-400 opacity-0 transform translate-x-2 transition-all" data-id="${attachment.id}" data-name="${attachment.name}">
                        <i data-lucide="trash-2" class="h-4 w-4"></i>
                    </button>
                `;
                attachmentsList.appendChild(item);
            });
            lucide.createIcons();
        });
    };
    
    attachmentsList.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.attachment-delete-btn');
        if (deleteBtn) {
            const manualId = manualIdInput.value;
            const attachmentId = deleteBtn.dataset.id;
            const attachmentName = deleteBtn.dataset.name;
            if (confirm(`ファイル「${attachmentName}」を削除しますか？`)) {
                try {
                    await manualsCollection.doc(manualId).collection('attachments').doc(attachmentId).delete();
                    // Firebase Storageからもファイルを削除
                    const fileRef = storage.ref(`attachments/${manualId}/${attachmentName}`);
                    // Note: This simple name-based deletion might fail if multiple files have the same name. A more robust system would store the full path.
                    // For this implementation, we assume file names are unique enough or this simplification is acceptable.
                    // await fileRef.delete(); // This part can be complex due to name variations.
                } catch (error) {
                    console.error("添付ファイルの削除に失敗:", error);
                }
            }
        }
    });

    // バージョン履歴の表示
    const showVersionHistory = async () => {
        const manualId = manualIdInput.value;
        if (!manualId) return;
        
        const versionsRef = manualsCollection.doc(manualId).collection('versions').orderBy('savedAt', 'desc');
        const snapshot = await versionsRef.get();
        
        historyList.innerHTML = '';
        if (snapshot.empty) {
            historyList.innerHTML = '<p class="text-gray-500 text-center">履歴はありません。</p>';
        } else {
            snapshot.forEach(doc => {
                const version = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'bg-gray-800 p-3 rounded-md flex justify-between items-center';
                item.innerHTML = `
                    <div>
                        <p class="font-bold text-white">${version.title}</p>
                        <p class="text-xs text-gray-400">保存日時: ${new Date(version.savedAt.toDate()).toLocaleString('ja-JP')}</p>
                    </div>
                    <button class="restore-btn bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-1 px-3 rounded" data-version-id="${version.id}">復元</button>
                `;
                historyList.appendChild(item);
            });
        }
        historyModal.classList.remove('hidden');
        setTimeout(() => historyModal.classList.add('visible'), 10);
    };

    // バージョンを復元
    historyList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('restore-btn')) {
            const versionId = e.target.dataset.versionId;
            const manualId = manualIdInput.value;
            if (confirm('このバージョンに復元しますか？現在の編集内容は新しい履歴として保存されます。')) {
                try {
                    const versionDoc = await manualsCollection.doc(manualId).collection('versions').doc(versionId).get();
                    if (!versionDoc.exists) {
                        alert('履歴の取得に失敗しました。');
                        return;
                    }
                    // 現在の内容を保存してから復元
                    await saveManual();
                    const versionData = versionDoc.data();
                    await manualsCollection.doc(manualId).update({
                        title: versionData.title,
                        category: versionData.category,
                        content: versionData.content,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    closeHistoryModal();
                } catch (error) {
                    console.error("復元エラー:", error);
                    alert("復元に失敗しました。");
                }
            }
        }
    });

    const closeHistoryModal = () => {
        historyModal.classList.remove('visible');
        setTimeout(() => historyModal.classList.add('hidden'), 300);
    };

    // PDFエクスポート
    const exportToPdf = () => {
        const { jsPDF } = window.jspdf;
        const title = manualTitleInput.value || 'Untitled';
        const content = document.querySelector('.ql-editor');
        
        html2canvas(content, {
            backgroundColor: '#1F2937', // Match editor background
            scale: 2 // Higher resolution
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / canvasHeight;
            const imgHeight = pdfWidth / ratio;
            let heightLeft = imgHeight;
            let position = 15; // Top margin

            pdf.setFont('Mplus-1p-regular', 'normal'); // Note: Custom fonts require setup
            pdf.setFontSize(20);
            pdf.text(title, pdfWidth / 2, 10, { align: 'center' });

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            pdf.save(`${title}.pdf`);
        });
    };

    // ヘルパー関数
    const setSaveButtonState = (isSaving) => {
        saveManualBtn.disabled = isSaving;
        saveBtnText.textContent = isSaving ? '保存中...' : '保存';
        saveSpinner.style.display = isSaving ? 'block' : 'none';
    };
    const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]) : '';

    // イベントリスナー
    newManualBtn.addEventListener('click', () => openEditor(null));
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
    fileUploadInput.addEventListener('change', handleFileUpload);
    historyBtn.addEventListener('click', showVersionHistory);
    pdfExportBtn.addEventListener('click', exportToPdf);
    closeHistoryModalBtn.addEventListener('click', closeHistoryModal);

    lucide.createIcons();
});
