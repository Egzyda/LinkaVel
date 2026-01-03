/**
 * LinkaVel Card Game - Main Logic
 * * 役割:
 * 1. ゲーム状態の初期化
 * 2. 3Dフィールドへのカード描画
 * 3. タップ操作による詳細表示
 * 4. フェイズ進行管理
 */

// ==========================================
// 1. ゲーム状態管理 (Game State)
// ==========================================
const GAME_STATE = {
    turn: 1,
    phase: "DRAW",
    phases: ["DRAW", "MAIN1", "BATTLE", "MAIN2", "END"],
    hasNormalSummoned: false, // 今導したかのフラグ

    player: {
        lp: 4000,
        deck: [],
        hand: [],
        trash: [],
        field: {
            monsters: [null, null, null], // 3 slots
            magics: [null, null, null]    // 3 slots
        }
    },

    opponent: {
        lp: 4000,
        deckCount: 20,
        handCount: 5,
        field: {
            monsters: [null, null, null],
            magics: [null, null, null]
        }
    }
};

// ==========================================
// 2. 初期化処理
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("LinkaVel Game Engine Ready.");
    setupEventListeners();
});

/**
 * 画面遷移管理
 */
function showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none'; // CSSだけでなくJSでも明示的に閉じる
    });

    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        // activeクラスのdisplay: flex(またはblock)を適用させるためスタイルをリセット
        target.style.display = '';
    }
}

function startSinglePlay() {
    console.log("Starting Single Play Mode...");
    resetGameState();
    initDeck("starter_fire");

    // 初手5枚ドロー (ルール通り)
    drawCard(5);

    showScreen('game-screen');
    updateUI();
}

function backToMenu() {
    if (confirm("メニューに戻りますか？進行状況はリセットされます。")) {
        showScreen('menu-screen');
    }
}

function openDeckEditor() {
    showScreen('deck-screen');
}

function resetGameState() {
    GAME_STATE.turn = 1;
    GAME_STATE.phase = "DRAW";
    GAME_STATE.hasNormalSummoned = false;
    GAME_STATE.player.lp = 4000;
    GAME_STATE.player.hand = [];
    GAME_STATE.player.trash = [];
    GAME_STATE.player.field.monsters = [null, null, null];
    GAME_STATE.player.field.magics = [null, null, null];

    // UI表示のクリア
    document.getElementById('player-hand').innerHTML = "";
    [0, 1, 2].forEach(i => {
        document.getElementById(`ply-monster-${i}`).innerHTML = "";
        document.getElementById(`ply-magic-${i}`).innerHTML = "";
        document.getElementById(`opt-monster-${i}`).innerHTML = "";
        document.getElementById(`opt-magic-${i}`).innerHTML = "";
    });
}

function initDeck(recipeKey) {
    const recipe = DECK_RECIPES[recipeKey];
    if (!recipe) {
        console.error("Deck recipe not found:", recipeKey);
        return;
    }

    // IDリストからカードオブジェクトを生成してシャッフル
    let rawDeck = recipe.cards.map(id => getCardData(id)).filter(c => c !== null);
    GAME_STATE.player.deck = shuffleArray(rawDeck);

    console.log(`Deck loaded: ${recipe.name} (${GAME_STATE.player.deck.length} cards)`);
    const deckCountEl = document.getElementById('ply-deck-count-badge');
    if (deckCountEl) deckCountEl.innerText = GAME_STATE.player.deck.length;
}

// Fisher-Yates Shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ==========================================
// 3. アクション処理 (Draw, Summon)
// ==========================================
function drawCard(count) {
    for (let i = 0; i < count; i++) {
        if (GAME_STATE.player.deck.length === 0) {
            console.log("Deck empty! Refresh rule should trigger here.");
            return;
        }
        const card = GAME_STATE.player.deck.pop();
        GAME_STATE.player.hand.push(card);

        // UIに手札を追加
        renderHandCard(card);
    }
    updateDeckCount();
}

function summonCardToField(cardId, slotIndex) {
    const cardData = getCardData(cardId);
    if (!cardData) return;

    GAME_STATE.player.field.monsters[slotIndex] = cardData;

    // 該当するゾーンにカード要素を描画
    const zoneId = `ply-monster-${slotIndex}`;
    const zoneEl = document.getElementById(zoneId);
    if (zoneEl) {
        zoneEl.innerHTML = ""; // クリア
        const cardEl = createCardElement(cardData, "field");
        zoneEl.appendChild(cardEl);
    }
}

// ==========================================
// 4. UI描画・要素生成
// ==========================================

/**
 * カードのHTML要素を作成する
 * @param {Object} cardData - カードデータ
 * @param {String} mode - "hand" | "field" (表示サイズや情報の切り替え用)
 */
function createCardElement(cardData, mode) {
    const el = document.createElement('div');
    el.className = 'card-mini';
    el.dataset.id = cardData.id; // データ属性にIDを持たせる

    // 枠色の設定
    if (cardData.type === 'monster') {
        el.style.backgroundColor = cardData.subType === 'effect' ? 'var(--color-effect)' : 'var(--color-normal)';
    } else {
        el.style.backgroundColor = 'var(--color-magic)';
        el.style.border = '2px solid #00d2ff'; // 魔術は青枠などで区別
    }

    // 画像プレースホルダー (実際は cardData.imagePath などを使う)
    // ここでは属性に応じて色を変える簡易演出
    const colorMap = { "火": "#ff4b2b", "水": "#00d2ff", "草": "#4ade80" };
    const attrColor = colorMap[cardData.attribute] || "#999";

    el.style.backgroundImage = `linear-gradient(135deg, rgba(0,0,0,0.1), rgba(0,0,0,0.4)), linear-gradient(to bottom, ${attrColor}, #333)`;

    // 属性バッジ (文字で簡易表示)
    const attrBadge = document.createElement('div');
    attrBadge.innerText = cardData.attribute[0]; // 頭文字
    attrBadge.style.position = 'absolute';
    attrBadge.style.top = '2px';
    attrBadge.style.right = '2px';
    attrBadge.style.background = '#fff';
    attrBadge.style.color = '#000';
    attrBadge.style.borderRadius = '50%';
    attrBadge.style.width = '16px';
    attrBadge.style.height = '16px';
    attrBadge.style.fontSize = '10px';
    attrBadge.style.display = 'flex';
    attrBadge.style.alignItems = 'center';
    attrBadge.style.justifyContent = 'center';
    attrBadge.style.fontWeight = 'bold';
    el.appendChild(attrBadge);

    // タップイベント (詳細表示)
    el.onclick = (e) => {
        e.stopPropagation(); // 親要素への伝播を止める
        showCardDetail(cardData);
    };

    return el;
}

function renderHandCard(cardData) {
    const handContainer = document.getElementById('player-hand');
    const cardEl = createCardElement(cardData, "hand");

    // 手札でのスタイル調整 (必要なら)
    cardEl.style.marginRight = "-20px"; // 重ねて表示
    cardEl.style.transition = "transform 0.2s";

    // ホバー/タップ時の動き
    cardEl.onmouseenter = () => { cardEl.style.transform = "translateY(-20px)"; };
    cardEl.onmouseleave = () => { cardEl.style.transform = "translateY(0)"; };

    handContainer.appendChild(cardEl);
}

function updateDeckCount() {
    const deckCountEl = document.getElementById('ply-deck-count-badge');
    if (deckCountEl) deckCountEl.innerText = GAME_STATE.player.deck.length;
}

// ==========================================
// 5. 詳細表示ロジック (Overlay)
// ==========================================
function showCardDetail(cardData) {
    const overlay = document.getElementById('card-detail-overlay');

    // 情報を流し込む
    document.getElementById('detail-name').innerText = cardData.name;
    document.getElementById('detail-attribute').innerText = `[${cardData.attribute}]`;
    document.getElementById('detail-text').innerText = cardData.text;

    const levelDisplay = document.getElementById('detail-level');
    if (cardData.type === 'monster') {
        levelDisplay.innerText = `Level ${cardData.level}`;
        document.getElementById('detail-power').innerText = `ATK: ${cardData.power}`;

        // 召喚コストの表示
        const req = cardData.summonRequirement;
        let costText = "召喚条件: なし";
        if (req && req.costCount > 0) {
            costText = `COST: Lv${req.costFilter?.minLevel || 1}+ × ${req.costCount}`;
        }
        document.getElementById('detail-cost').innerText = costText;

    } else {
        levelDisplay.innerText = "MAGIC CARD";
        document.getElementById('detail-power').innerText = "";
        document.getElementById('detail-cost').innerText = "";
    }

    // 表示アニメーション
    overlay.style.opacity = '1';

    // 背景クリックで閉じる処理のために、一旦Global変数に状態を持つか、
    // Bodyに閉じる用リスナーをつけるなどの工夫が可能。
    // 今回は「別の場所をタップしたら消える」簡易実装を body.onclick で行う。
}

function hideCardDetail() {
    document.getElementById('card-detail-overlay').style.opacity = '0';
}

// ==========================================
// 6. フェイズ管理 & イベント
// ==========================================
function setupEventListeners() {
    // フェイズ進行ボタン
    document.getElementById('next-phase-btn').addEventListener('click', () => {
        advancePhase();
    });

    // 画面の何もないところをタップしたら詳細を閉じる
    document.body.addEventListener('click', () => {
        hideCardDetail();
    });
}

function advancePhase() {
    const currentIdx = GAME_STATE.phases.indexOf(GAME_STATE.phase);
    let nextIdx = currentIdx + 1;

    if (nextIdx >= GAME_STATE.phases.length) {
        nextIdx = 0; // END -> DRAW
        GAME_STATE.turn++;
        GAME_STATE.hasNormalSummoned = false; // 新しいターンで召喚権復活
        console.log(`--- Turn ${GAME_STATE.turn} Start ---`);
        drawCard(1);
    }

    GAME_STATE.phase = GAME_STATE.phases[nextIdx];
    updateUI();
}

function updateUI() {
    document.getElementById('current-phase-display').innerText = GAME_STATE.phase;
    document.getElementById('player-lp').innerText = GAME_STATE.player.lp;
    document.getElementById('opponent-lp').innerText = GAME_STATE.opponent.lp;
    document.getElementById('opt-deck-count').innerText = GAME_STATE.opponent.deckCount;
    updateDeckCount();
}
