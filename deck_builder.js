/**
 * LinkaVel Deck Builder Logic
 * 役割: デッキの作成、編集、保存、バリデーション
 */

const DeckBuilder = {
    // State
    currentDeck: {
        id: null, // 新規作成時はnull
        name: "New Deck",
        cards: [] // { id: "m001", count: 2 } 形式
    },
    selectedCardId: null,
    allCards: [],
    filters: {
        attribute: "all",
        level: "all",
        type: "all"
    },

    // Constants
    MAX_DECK_SIZE: 30,
    MAX_COPIES: 3,
    STORAGE_KEY: "linkavel_user_decks",

    /** 初期化 */
    async init() {
        console.log("DeckBuilder Initializing...");
        // リスナー登録を最優先で実行
        this.setupEventListeners();
        this.allCards = Object.values(MASTER_CARDS);
        this.renderLibrary();
        this.updateUI();

        // Firebase Auth 匿名ログイン
        if (window.auth) {
            try {
                const userCredential = await window.auth.signInAnonymously();
                console.log("Signed in as:", userCredential.user.uid);
            } catch (error) {
                console.error("Auth Error:", error);
                this.showToast("ログインエラー");
            }
        }
    },

    setupEventListeners() {
        // 戻るボタン (優先的に登録)
        const backBtn = document.getElementById('builder-back-btn');
        if (backBtn) {
            // 多重登録防止のためクローンして置換
            const newBtn = backBtn.cloneNode(true);
            backBtn.parentNode.replaceChild(newBtn, backBtn);

            newBtn.addEventListener('click', async () => {
                if (await showCustomConfirm("保存されていない変更は破棄されます。戻りますか？")) {
                    if (typeof window.openDeckEditor === 'function') {
                        window.openDeckEditor();
                    } else {
                        console.error("Error: openDeckEditor is not defined.");
                        if(typeof openDeckEditor === 'function') openDeckEditor();
                    }
                }
            });
        }

        // 保存ボタン
        const saveBtn = document.getElementById('builder-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveDeck());
        }

        // フィルタ変更
        ['filter-attr', 'filter-level', 'filter-type'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.applyFilters());
        });

        // デッキ名入力
        const nameInput = document.getElementById('builder-deck-name');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.currentDeck.name = e.target.value;
            });
        }
    },

    /** 新規作成・編集の開始 */
    async startSession(deckId = null) {
        this.showToast("読み込み中...");

        if (deckId) {
            // Firestoreからデッキ取得
            try {
                const deckData = await this.fetchDeckById(deckId);
                if (deckData) {
                    this.currentDeck = {
                        id: deckId,
                        name: deckData.name,
                        cards: this.convertIdListToObjList(deckData.cards)
                    };
                } else {
                    this.showToast("デッキが見つかりません");
                    return;
                }
            } catch (e) {
                console.error(e);
                this.showToast("読み込みエラー");
                return;
            }
        } else {
            // 新規作成
            this.currentDeck = {
                id: null,
                name: "新規デッキ",
                cards: []
            };
        }

        // UIリセット
        this.selectedCardId = null;
        document.getElementById('builder-deck-name').value = this.currentDeck.name;
        this.updateUI();
        this.renderDetail(null);
    },

    /** 指定IDのデッキをFirestoreから取得 */
    async fetchDeckById(deckId) {
        if (!window.db || !window.auth || !window.auth.currentUser) return null;
        const uid = window.auth.currentUser.uid;
        const docRef = window.db.collection('linkavel_users').doc(uid).collection('decks').doc(deckId);
        const doc = await docRef.get();
        return doc.exists ? doc.data() : null;
    },

    /** IDリスト ["m001", "m001"] を [{id:"m001", count:2}] に変換 */
    convertIdListToObjList(idList) {
        const map = {};
        idList.forEach(id => {
            if (!map[id]) map[id] = 0;
            map[id]++;
        });
        return Object.keys(map).map(id => ({ id, count: map[id] }));
    },

    /** フィルタ適用とライブラリ再描画 */
    applyFilters() {
        this.filters.attribute = document.getElementById('filter-attr').value;
        this.filters.level = document.getElementById('filter-level').value;
        this.filters.type = document.getElementById('filter-type').value;
        this.renderLibrary();
    },

    /** ライブラリ（カードプール）の描画 */
    renderLibrary() {
        const grid = document.getElementById('builder-library-grid');
        grid.innerHTML = "";

        const filtered = this.allCards.filter(c => {
            if (this.filters.attribute !== "all" && c.attribute !== this.filters.attribute) return false;
            if (this.filters.level !== "all" && String(c.level) !== this.filters.level) return false;
            if (this.filters.type !== "all") {
                if (this.filters.type === "monster" && c.type !== "monster") return false;
                if (this.filters.type === "magic" && c.type !== "magic") return false;
            }
            return true;
        });

        // ソート: モンスター > 魔術、レベル順、ID順
        filtered.sort((a, b) => {
            if (a.type !== b.type) return a.type === "monster" ? -1 : 1;
            if (a.level !== b.level) return (a.level || 0) - (b.level || 0);
            return a.id.localeCompare(b.id);
        });

        filtered.forEach(card => {
            const el = document.createElement('div');
            el.className = 'lib-item';
            if (this.selectedCardId === card.id) el.classList.add('selected');

            // デッキ内の所持数チェック
            const inDeck = this.currentDeck.cards.find(c => c.id === card.id);
            const count = inDeck ? inDeck.count : 0;
            if (count >= this.MAX_COPIES) el.classList.add('max-copy');

            // カード要素の生成 (画像ではなくリッチなカードコンポーネント)
            const cardEl = this.createBuilderCard(card);
            el.appendChild(cardEl);

            if (count > 0) {
                const badge = document.createElement('div');
                badge.className = 'lib-count-badge';
                badge.innerText = count;
                el.appendChild(badge);
            }

            el.onclick = () => this.selectCard(card.id);
            grid.appendChild(el);
        });
    },

    /** カード選択時の処理（中段更新） */
    selectCard(cardId) {
        this.selectedCardId = cardId;
        const card = this.allCards.find(c => c.id === cardId);
        this.renderDetail(card);
        this.renderLibrary(); // 選択枠の更新のため
    },

    /** 中段詳細エリアの描画 */
    renderDetail(card) {
        const imgBox = document.getElementById('detail-img-box');
        const infoBox = document.getElementById('detail-info-box');
        const actions = document.getElementById('detail-actions');

        if (!card) {
            imgBox.innerHTML = "";
            infoBox.innerHTML = `<div style="color:#666; display:flex; align-items:center; justify-content:center; height:100%;">カードを選択してください</div>`;
            actions.style.display = "none";
            return;
        }

        actions.style.display = "flex";
        imgBox.innerHTML = `<img src="${card.image}">`;

        const isMonster = card.type === "monster";
        const statsHtml = isMonster
            ? `Lv.${card.level} / ATK ${card.power}`
            : `${card.subType === 'permanent' ? '永続魔術' : '通常魔術'}`;

        infoBox.innerHTML = `
            <div class="detail-header">
                <span class="detail-name">${card.name}</span>
                <span class="detail-attr">[${card.attribute}]</span>
            </div>
            <div class="detail-stats">${statsHtml}</div>
            <div class="detail-text">${card.text}</div>
        `;

        // ボタンイベント設定
        const addBtn = document.getElementById('btn-add-card');
        const removeBtn = document.getElementById('btn-remove-card');

        addBtn.onclick = () => this.modifyDeck(card.id, 1);
        removeBtn.onclick = () => this.modifyDeck(card.id, -1);
    },

    /** デッキ操作 (追加/削除) */
    modifyDeck(cardId, delta) {
        const deck = this.currentDeck.cards;
        const existingIdx = deck.findIndex(c => c.id === cardId);
        const currentCount = existingIdx !== -1 ? deck[existingIdx].count : 0;
        const totalCards = this.getCurrentTotalCount();

        if (delta > 0) {
            // 追加制限チェック
            if (totalCards >= this.MAX_DECK_SIZE) {
                this.showToast("デッキは30枚までです");
                return;
            }
            if (currentCount >= this.MAX_COPIES) {
                this.showToast(`同名カードは${this.MAX_COPIES}枚までです`);
                return;
            }

            if (existingIdx !== -1) {
                deck[existingIdx].count++;
            } else {
                deck.push({ id: cardId, count: 1 });
            }
        } else {
            // 削除
            if (existingIdx !== -1) {
                deck[existingIdx].count--;
                if (deck[existingIdx].count <= 0) {
                    deck.splice(existingIdx, 1);
                }
            }
        }

        this.updateUI();
        this.renderLibrary(); // バッジ更新
    },

    /** 現在のデッキ枚数取得 */
    getCurrentTotalCount() {
        return this.currentDeck.cards.reduce((sum, c) => sum + c.count, 0);
    },

    /** 上段（構築中デッキ）とヘッダーの更新 */
    updateUI() {
        const total = this.getCurrentTotalCount();
        const indicator = document.getElementById('deck-count-indicator');
        indicator.innerText = `${total} / ${this.MAX_DECK_SIZE}`;
        indicator.className = `deck-count-indicator ${total === this.MAX_DECK_SIZE ? 'valid' : 'invalid'}`;
        document.getElementById('builder-save-btn').disabled = (total !== this.MAX_DECK_SIZE);

        const grid = document.getElementById('builder-deck-grid');
        grid.innerHTML = "";

        let displayList = [];
        this.currentDeck.cards.forEach(c => {
            const cardData = this.allCards.find(m => m.id === c.id);
            if (cardData) displayList.push({ ...cardData, count: c.count });
        });

        displayList.sort((a, b) => {
            if (a.type !== b.type) return a.type === "monster" ? -1 : 1;
            return (a.level || 0) - (b.level || 0);
        });

        let monsterCount = 0;
        let magicCount = 0;

        displayList.forEach(card => {
            if (card.type === "monster") monsterCount += card.count;
            else magicCount += card.count;

            const el = document.createElement('div');
            el.className = 'deck-thumb';

            // リッチなカード表示を使用
            const cardEl = this.createBuilderCard(card);
            el.appendChild(cardEl);

            const badge = document.createElement('div');
            badge.className = 'count-badge';
            badge.innerText = card.count;
            el.appendChild(badge);

            el.onclick = () => this.selectCard(card.id);
            grid.appendChild(el);
        });

        document.getElementById('stat-monster').innerText = monsterCount;
        document.getElementById('stat-magic').innerText = magicCount;
    },

    /** デッキ保存 (Firestore) */
    async saveDeck() {
        const total = this.getCurrentTotalCount();
        if (total !== this.MAX_DECK_SIZE) {
            this.showToast("デッキは30枚にする必要があります");
            return;
        }
        if (!window.db || !window.auth || !window.auth.currentUser) {
            this.showToast("ログインしていません");
            return;
        }

        this.showToast("保存中...");
        const uid = window.auth.currentUser.uid;
        const decksRef = window.db.collection('linkavel_users').doc(uid).collection('decks');

        const idList = [];
        this.currentDeck.cards.forEach(c => {
            for(let i=0; i<c.count; i++) idList.push(c.id);
        });

        const saveData = {
            name: this.currentDeck.name || "無題のデッキ",
            cards: idList,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (this.currentDeck.id) {
                await decksRef.doc(this.currentDeck.id).update(saveData);
            } else {
                await decksRef.add(saveData);
            }
            this.showToast("デッキを保存しました");
            setTimeout(() => openDeckEditor(), 800); // 管理画面へ戻る
        } catch (e) {
            console.error(e);
            this.showToast("保存エラー");
        }
    },

    /** Firestoreからユーザーデッキ一覧を取得 */
    async fetchUserDecks() {
        if (!window.db || !window.auth || !window.auth.currentUser) return [];
        const uid = window.auth.currentUser.uid;
        try {
            const snapshot = await window.db.collection('linkavel_users').doc(uid).collection('decks').orderBy('updatedAt', 'desc').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    /** デッキ削除 */
    async deleteDeck(deckId) {
        if (!await showCustomConfirm("このデッキを削除しますか？")) return false;
        if (!window.db || !window.auth || !window.auth.currentUser) return false;
        const uid = window.auth.currentUser.uid;
        try {
            await window.db.collection('linkavel_users').doc(uid).collection('decks').doc(deckId).delete();
            this.showToast("削除しました");
            return true;
        } catch (e) {
            console.error(e);
            this.showToast("削除エラー");
            return false;
        }
    },

    /** デッキコピー */
    async copyDeck(deckId) {
        const deck = await this.fetchDeckById(deckId);
        if (!deck) return;

        this.currentDeck = {
            id: null,
            name: deck.name + " のコピー",
            cards: this.convertIdListToObjList(deck.cards)
        };
        // 編集画面へ遷移
        showScreen('deck-screen');
        this.selectedCardId = null;
        document.getElementById('builder-deck-name').value = this.currentDeck.name;
        this.updateUI();
        this.renderDetail(null);
    },

    /** トースト表示 */
    showToast(msg) {
        const toast = document.getElementById('builder-toast');
        toast.innerText = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    },

    /** ビルダー用カード要素生成 (main.jsのcreateCardElementを簡易再現) */
    createBuilderCard(cardData) {
        const el = document.createElement('div');
        el.className = 'card-mini builder-card';

        const isMonster = cardData.type === 'monster';
        const isEffect = cardData.subType === 'effect';
        let bgClass = isMonster ? (isEffect ? 'bg-effect' : 'bg-normal') : 'bg-magic';

        const attrMap = { "火": "fire", "水": "water", "草": "leaf", "光": "light", "闇": "dark", "無": "neutral" };
        const attrEn = attrMap[cardData.attribute] || "neutral";

        el.innerHTML = `
            <div class="card-face card-front ${bgClass}">
                <div class="card-name-box">
                    <span class="card-name-text">${cardData.name}</span>
                </div>
                <div class="card-img-frame">
                    <img src="${cardData.image}" class="card-img-content" loading="lazy" draggable="false">
                </div>
                <div class="card-attribute-icon">
                    <img src="img/${attrEn}.webp" alt="${cardData.attribute}">
                </div>
                <div class="card-status-cluster">
                    ${isMonster ? `
                        <div class="card-lv-text">Lv.${cardData.level}</div>
                        <div class="card-atk-text">${cardData.power}</div>
                    ` : `
                        <div class="card-magic-type">${cardData.subType === 'permanent' ? '永続魔術' : '通常魔術'}</div>
                    `}
                </div>
            </div>
            <div class="card-face card-back"></div>
        `;

        // 名称圧縮ロジック (簡易版)
        requestAnimationFrame(() => {
            const nameBox = el.querySelector('.card-name-box');
            const nameText = el.querySelector('.card-name-text');
            if (nameBox && nameText) {
                const maxWidth = nameBox.clientWidth * 0.9;
                const currentWidth = nameText.scrollWidth;
                if (currentWidth > maxWidth) {
                    nameText.style.display = 'inline-block';
                    nameText.style.transform = `scaleX(${maxWidth / currentWidth})`;
                    nameText.style.transformOrigin = 'center';
                }
            }
        });

        return el;
    }
};

// グローバル公開
window.DeckBuilder = DeckBuilder;