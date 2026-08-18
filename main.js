/**
 * LinkaVel Card Game - Main Logic (Rebuilt for Stability)
 * * 役割: ゲームのコアサイクル（ドロー、召喚、戦闘、ターン進行）の確実な実行
 * * 特記事項:
 * - 初期LP 5000
 * - 召喚コストなし（テスト用簡易実装）
 * - 先行1ターン目のドロー・攻撃制限実装済み
 * - デッキ切れ時のリフレッシュ（トラッシュ回収）実装済み
 */

// ==========================================
// 1. ゲーム状態管理 (Game State)
// ==========================================
const GAME_STATE = {
    // ターン管理
    turnCount: 1,           // 経過ターン数
    isFirstTurnOfGame: true,// ゲーム開始直後のフラグ（先行1ターン目判定用）
    phase: "DRAW",
    phases: ["DRAW", "MAIN1", "BATTLE", "MAIN2", "END"],

    // 手番管理
    turnPlayer: "player",   // "player" | "opponent"
    hasNormalSummoned: false, // ターン中の召喚済みフラグ
    isGameOver: false,        // 決着済みフラグ（以降の処理を一切行わない）

    // プレイヤー状態
    player: {
        lp: 5000, // ルール準拠
        deck: [],
        hand: [],
        trash: [],
        banished: [], // 除外ゾーン（このゲーム中は一切干渉できない）
        refreshCount: 0,
        field: {
            monsters: [null, null, null],
            magics: [null, null, null]
        }
    },

    // 相手状態
    opponent: {
        lp: 5000, // ルール準拠
        deck: [],
        hand: [], // CPUは簡易管理のため配列で持つが、基本は数のみ参照でも可
        trash: [],
        banished: [],
        refreshCount: 0,
        field: {
            monsters: [null, null, null],
            magics: [null, null, null]
        }
    },

    // UI操作用
    selectedCard: null,
    selectedCardLocation: null,
    isSelectingSlot: false, // 召喚先選択モード中か
    isSelectingTarget: false, // 攻撃対象選択モード中か
    pendingCard: null,       // 召喚待機中のカード
    attackerPending: null,   // 攻撃待機中の情報 {card, slotIdx}
    isSelectingCost: false,  // コスト選択中か
    selectedCosts: [],       // 選択されたコスト対象 [{card, slotIdx, from:"field"|"hand"}]
    isAnimating: false       // アニメーション中（UIロック用）
};

/**
 * カードが場を離れる際に、個体に付いた一時状態をすべて消す。
 * これを通さないと、蘇生したモンスターが「攻撃済み」のままだったり
 * 古いデバフを引きずったままトラッシュ／デッキに戻ってしまう。
 */
function resetCardState(card) {
    if (!card) return card;
    delete card._hasAttacked;
    delete card._tempBuffs;
    delete card._combatEffects;
    delete card._usedLimits;
    delete card._usedProtections;
    delete card._usedTurn;
    return card;
}

/** カードをトラッシュへ送る（個体状態のリセットを保証する共通経路） */
function sendCardToTrash(side, card) {
    if (!card) return;
    GAME_STATE[side].trash.push(resetCardState(card));
}

/** カードを除外する（このゲーム中は復帰・参照ともに不可） */
function banishCard(side, card) {
    if (!card) return;
    GAME_STATE[side].banished.push(resetCardState(card));
    console.log(`${side} banished ${card.name}`);
}

// ==========================================
// 2. 初期化・起動シーケンス
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("LinkaVel Game Engine Initializing...");

    // 安全装置: データロード確認
    if (typeof MASTER_CARDS === 'undefined' || typeof DECK_RECIPES === 'undefined') {
        console.error("エラー: カードデータ(cards.js)が読み込まれていません。");
        return;
    }

    setupEventListeners();
    updateViewportScale();
    window.addEventListener('resize', updateViewportScale);
    window.addEventListener('orientationchange', updateViewportScale);

    // 匿名ログインは起動時に一度だけ済ませておく。
    // デッキビルダーを開かずにデュエルへ入ると保存デッキが読めない問題への対処。
    ensureAuth();

    console.log("LinkaVel Game Engine Ready.");
});

/**
 * Firebase匿名ログインを保証する（多重呼び出しは同じPromiseを共有）
 */
let authPromise = null;
function ensureAuth() {
    if (!window.auth) return Promise.resolve(null);
    if (window.auth.currentUser) return Promise.resolve(window.auth.currentUser);
    if (!authPromise) {
        authPromise = window.auth.signInAnonymously()
            .then(cred => {
                console.log("Signed in as:", cred.user.uid);
                return cred.user;
            })
            .catch(err => {
                console.error("Auth Error:", err);
                authPromise = null; // 次回リトライできるようにする
                return null;
            });
    }
    return authPromise;
}
window.ensureAuth = ensureAuth;

/**
 * PC等の広い画面では、スマホ設計のレイアウトを保ったまま拡大する。
 * 幅だけ広げるとカードが豆粒のまま余白だけ増えてしまうため、
 * 設計サイズ(480x900)を基準に等倍スケールを掛ける方式にしている。
 */
const DESIGN_WIDTH = 480;
const DESIGN_HEIGHT = 900;

function updateViewportScale() {
    const viewport = document.getElementById('game-viewport');
    if (!viewport) return;

    // スマホ幅では従来通りの流動レイアウト（CSS側のメディアクエリと揃える）
    if (window.innerWidth <= 480) {
        viewport.style.transform = "";
        return;
    }

    const scale = Math.min(
        window.innerWidth / DESIGN_WIDTH,
        window.innerHeight / DESIGN_HEIGHT,
        1.7 // 拡大しすぎて粗くならないよう上限を設ける
    );
    viewport.style.transform = `scale(${scale})`;
}

function setupEventListeners() {
    // 降参ボタン
    const surrenderBtn = document.getElementById('surrender-btn');
    if (surrenderBtn) {
        surrenderBtn.addEventListener('click', async () => {
            if (await window.showCustomConfirm("本当に降参しますか？")) {
                endGameSequence("opponent");
            }
        });
    }

    // フェイズ進行ボタン
    const nextPhaseBtn = document.getElementById('next-phase-btn');
    if (nextPhaseBtn) {
        nextPhaseBtn.addEventListener('click', () => {
            // プレイヤーのターンかつ、CPU処理中でない場合のみ進行可能
            if (GAME_STATE.turnPlayer === "player") {
                advancePhase();
            }
        });
    }

    // 詳細表示を閉じる（背景タップ）
    document.body.addEventListener('click', (e) => {
        // カード要素やボタンなどをクリックした場合は閉じない
        if (!e.target.closest('.card-mini') && !e.target.closest('#card-detail-overlay') && !e.target.closest('.btn-action-float') && !e.target.closest('.floating-actions')) {
            hideCardDetail();
        }
    });
}

// 画面遷移
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
    });
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
    }
}

// ゲーム開始処理（ここがエントリーポイント）
function startSinglePlay() {
    showScreen('deck-select-screen');
    renderDeckSelection();
}

/**
 * デッキ選択リストを動的に生成 (デュエル開始用)
 */
async function renderDeckSelection() {
    const container = document.getElementById('deck-list-container');
    container.innerHTML = "<div style='color:#fff;text-align:center;'>Loading...</div>";

    // 1. スターターデッキ
    let html = "";
    Object.keys(DECK_RECIPES).forEach(key => {
        const recipe = DECK_RECIPES[key];
        html += createDeckItemHtml(key, recipe.name, "starter", true);
    });

    // 2. ユーザーデッキ (Firestore)
    if (typeof DeckBuilder !== 'undefined') {
        await ensureAuth();
        const userDecks = await DeckBuilder.fetchUserDecks();
        userDecks.forEach(deck => {
            html += createDeckItemHtml(deck.id, deck.name, "user", true);
        });
    }

    container.innerHTML = html;
}

/**
 * デッキ管理画面の描画 (編集・削除・コピー)
 */
async function renderDeckManager() {
    const container = document.getElementById('deck-list-container');
    container.innerHTML = "<div style='color:#fff;text-align:center;'>Loading...</div>";

    // 新規作成ボタン
    let html = `
        <button class="menu-btn" onclick="DeckBuilder.startSession(null); showScreen('deck-screen');">
            <span class="btn-icon">＋</span>
            <span class="btn-text">新規デッキ作成</span>
        </button>
        <hr style="border:0; border-top:1px solid #333; margin:10px 0; width:100%;">
    `;

    // ユーザーデッキ一覧
    await ensureAuth();
    const userDecks = await DeckBuilder.fetchUserDecks();
    if (userDecks.length === 0) {
        html += `<div style="color:#666;text-align:center;padding:20px;">保存されたデッキはありません</div>`;
    } else {
        userDecks.forEach(deck => {
            html += createDeckItemHtml(deck.id, deck.name, "user", false);
        });
    }

    container.innerHTML = html;
}

function createDeckItemHtml(id, name, type, isDuelMode) {
    const tagClass = type === 'starter' ? 'starter' : 'user';
    const tagName = type === 'starter' ? 'STARTER' : 'USER';

    if (isDuelMode) {
        // デュエル開始モード: シンプルなボタン
        return `
            <button class="menu-btn custom-deck-item" onclick="confirmDeckSelection('${id}', '${type}')">
                <span class="btn-text">${name} <small class="deck-manage-tag ${tagClass}">${tagName}</small></span>
            </button>
        `;
    } else {
        // 管理モード: 編集・コピー・削除ボタン付き
        return `
            <div class="deck-manage-item">
                <div class="deck-manage-header">
                    <span class="deck-manage-title">${name}</span>
                    <span class="deck-manage-tag ${tagClass}">${tagName}</span>
                </div>
                <div class="deck-manage-actions">
                    <button class="dm-btn primary" onclick="DeckBuilder.startSession('${id}'); showScreen('deck-screen');">編集</button>
                    <button class="dm-btn" onclick="DeckBuilder.copyDeck('${id}')">コピー</button>
                    <button class="dm-btn danger" onclick="deleteDeckAndReload('${id}')">削除</button>
                </div>
            </div>
        `;
    }
}

async function deleteDeckAndReload(id) {
    const success = await DeckBuilder.deleteDeck(id);
    if (success) renderDeckManager();
}

/**
 * デッキ確定後の初期化プロセス
 */
async function confirmDeckSelection(deckId, type) {
    // 前回の対戦結果（LP・決着フラグ等）を確実に初期化してから組み直す
    resetGameState();

    // プレイヤーのデッキを初期化
    await initDeck("player", deckId, type);

    // 相手のデッキをランダムに決定 (CPUはスターターから選ぶ)
    const allKeys = Object.keys(DECK_RECIPES);
    const randomKey = allKeys[Math.floor(Math.random() * allKeys.length)];
    await initDeck("opponent", randomKey, "starter");

    // 先行・後攻決定 (50%でランダム)
    const isPlayerFirst = Math.random() < 0.5;
    GAME_STATE.turnPlayer = isPlayerFirst ? "player" : "opponent";

    // 画面表示を先行させる
    showScreen('game-screen');

    // スタートモーダルの準備
    const overlay = document.getElementById('game-start-overlay');
    const msg = document.getElementById('start-message');

    overlay.style.display = "flex";
    if (isPlayerFirst) {
        msg.innerText = "あなたが先行です";
        msg.style.color = "var(--accent-blue)";
    } else {
        msg.innerText = "あなたが後攻です";
        msg.style.color = "var(--accent-red)";
    }
}

function resetGameState() {
    GAME_STATE.turnCount = 1;
    GAME_STATE.isFirstTurnOfGame = true;
    GAME_STATE.phase = "DRAW";
    GAME_STATE.hasNormalSummoned = false;
    GAME_STATE.isGameOver = false;

    // プレイヤーリセット
    GAME_STATE.player.lp = 5000;
    GAME_STATE.player.refreshCount = 0;
    GAME_STATE.player.deck = [];
    GAME_STATE.player.hand = [];
    GAME_STATE.player.trash = [];
    GAME_STATE.player.banished = [];
    GAME_STATE.player.field.monsters = [null, null, null];
    GAME_STATE.player.field.magics = [null, null, null];

    // 相手リセット
    GAME_STATE.opponent.lp = 5000;
    GAME_STATE.opponent.refreshCount = 0;
    GAME_STATE.opponent.deck = [];
    GAME_STATE.opponent.hand = [];
    GAME_STATE.opponent.trash = [];
    GAME_STATE.opponent.banished = [];
    GAME_STATE.opponent.field.monsters = [null, null, null];
    GAME_STATE.opponent.field.magics = [null, null, null];

    // UIクリーンアップ
    document.getElementById('player-hand').innerHTML = "";

    // UIレイヤーのポインター操作を削除（副作用防止）
    // CSSのデフォルト設定に委ねる

    // 演出・選択モードのフラグをすべて強制リセット
    GAME_STATE.isAnimating = false;
    GAME_STATE.isSelectingSlot = false;
    GAME_STATE.isSelectingTarget = false;
    GAME_STATE.isSelectingCost = false;
    GAME_STATE.pendingCard = null;
    GAME_STATE.attackerPending = null;
    GAME_STATE.selectedCosts = [];

    // 選択モード用CSSクラスのクリーンアップ
    document.getElementById('game-viewport').classList.remove('field-selecting');
    document.getElementById('field-surface').classList.remove('selecting-mode');

    // リザルトオーバーレイの状態を完全にリセット（インラインスタイルとクラスを消去）
    const overlay = document.getElementById('game-result-overlay');
    if (overlay) {
        overlay.removeAttribute('style');
        overlay.classList.remove("active", "result-win", "result-lose");
        // 強制リフロー（アニメーションのリセットを保証）
        void overlay.offsetWidth;
    }

    cleanFieldZones();
}

function cleanFieldZones() {
    [0, 1, 2].forEach(i => {
        const ids = [`ply-monster-${i}`, `opt-monster-${i}`, `ply-magic-${i}`, `opt-magic-${i}`];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = "";
        });
    });

    // デッキ・トラッシュ・除外ゾーンは枚数バッジを残したままカードだけ取り除く
    ["player", "opponent"].forEach(side => {
        ["deck", "trash", "banish"].forEach(type => {
            const zone = document.getElementById(`${side}-${type}-zone`);
            if (!zone) return;
            zone.querySelectorAll('.card-mini').forEach(el => el.remove());
            zone.classList.remove('stack-stage-1', 'stack-stage-2', 'stack-stage-3');
        });
    });
}

async function initDeck(side, deckId, type) {
    let cardIds = [];

    if (type === "starter") {
        const recipe = DECK_RECIPES[deckId];
        if (recipe) cardIds = recipe.cards;
    } else if (type === "user") {
        // Firestoreから取得
        const deckData = await DeckBuilder.fetchDeckById(deckId);
        if (deckData) cardIds = deckData.cards;
    }

    if (cardIds.length === 0) {
        console.error(`Deck not found or empty: ${deckId}`);
        return;
    }

    // カードIDから実データを生成してシャッフル
    const rawDeck = cardIds.map(id => getCardData(id)).filter(c => c !== null);

    if (side === "player") {
        GAME_STATE.player.deck = shuffleArray(rawDeck);
    } else {
        GAME_STATE.opponent.deck = shuffleArray(rawDeck);
    }
}

// Fisher-Yates Shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function backToMenu() {
    resetGameState();
    showScreen('menu-screen');
}

let isDeckBuilderInitialized = false;

function openDeckEditor() {
    // デッキ管理画面（選択画面）を表示
    showScreen('deck-select-screen');
    if (typeof DeckBuilder !== 'undefined') {
        if (!isDeckBuilderInitialized) {
            DeckBuilder.init();
            isDeckBuilderInitialized = true;
        }
        // デッキ一覧を描画 (管理モード)
        renderDeckManager();
    }
}

// ==========================================
// 3. ターン進行ロジック
// ==========================================

function startTurnProcess() {
    if (GAME_STATE.isGameOver) return;
    GAME_STATE.phase = "DRAW";
    GAME_STATE.hasNormalSummoned = false;
    // ターン開始時に全モンスターの攻撃済みフラグをリセット (ルール5.3)
    const allFieldMonsters = [...GAME_STATE.player.field.monsters, ...GAME_STATE.opponent.field.monsters];
    allFieldMonsters.forEach(m => { if (m) m._hasAttacked = false; });

    // ターン開始時に各プレイヤーのリフレッシュ回数をリセット (ルール1.1)
    GAME_STATE.player.refreshCount = 0;
    GAME_STATE.opponent.refreshCount = 0;

    // 期限切れの一時バフをクリーニング
    EffectLogic.cleanAllBuffs();

    updateUI();

    console.log(`Turn Start: ${GAME_STATE.turnPlayer} (Game Turn: ${GAME_STATE.turnCount})`);

    // DRAW PHASE処理
    // ルール: 先行1ターン目はドローしない
    if (GAME_STATE.isFirstTurnOfGame) {
        console.log("First Turn: Skip Draw Phase.");
        setTimeout(() => { if (GAME_STATE.phase === "DRAW") advancePhase(); }, 1000);
    } else {
        drawCard(GAME_STATE.turnPlayer, 1);
        updateUI();

        // プレイヤー・CPU問わずドロー後は自動でMAIN1へ進行
        setTimeout(() => { if (GAME_STATE.phase === "DRAW") advancePhase(); }, 1000);

    }
}

function advancePhase() {
    if (GAME_STATE.isGameOver) return;

    const pOrder = GAME_STATE.phases;
    const currentIdx = pOrder.indexOf(GAME_STATE.phase);

    // ENDフェイズから先には進まない（ターン終了処理は startEndPhaseProcess が担当）
    if (currentIdx === -1 || currentIdx >= pOrder.length - 1) {
        console.warn(`advancePhase: ignored (phase=${GAME_STATE.phase})`);
        return;
    }

    // 次のフェイズを決定
    let nextPhase = pOrder[currentIdx + 1];

    // ENDフェイズへの移行処理
    if (nextPhase === "END") {
        GAME_STATE.phase = "END";
        updateUI();
        startEndPhaseProcess();
        return;
    }

    // 先行1ターン目のバトルフェイズスキップ判定
    if (GAME_STATE.isFirstTurnOfGame && nextPhase === "BATTLE") {
        console.log("First Turn: Skip Battle Phase.");
        nextPhase = "MAIN2";
    }

    GAME_STATE.phase = nextPhase;
    updateUI();

    console.log(`Phase Changed to: ${GAME_STATE.phase}`);

    // CPUターンなら継続して思考
    if (GAME_STATE.turnPlayer === "opponent") {
        setTimeout(executeCpuTurn, 1000);
    }
}

function endTurn() {
    if (GAME_STATE.isGameOver) return;

    // ターン交代
    GAME_STATE.turnPlayer = (GAME_STATE.turnPlayer === "player") ? "opponent" : "player";

    // 先行1ターン目フラグの解除（後攻に回った時点で解除）
    if (GAME_STATE.isFirstTurnOfGame) {
        GAME_STATE.isFirstTurnOfGame = false;
    } else {
        GAME_STATE.turnCount++;
    }

    startTurnProcess();
}

// ==========================================
// 4. アクション: ドロー & リフレッシュ
// ==========================================

async function drawCard(side, count) {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    let remainingToDraw = count;
    let drawQueue = [];

    if (side === "player") GAME_STATE.isAnimating = true;

    while (remainingToDraw > 0) {
        if (p.deck.length === 0) {
            // デッキ切れ時のリフレッシュ規定 (ルール Ver.1.1)
            if (p.trash.length > 0 && p.refreshCount < 1) {
                console.log(`${side} performs Deck Refresh!`);
                p.deck = shuffleArray(p.trash.map(resetCardState));
                p.trash = [];
                p.refreshCount++;
                // リフレッシュ成功時、本来のドローに追加してさらに 1 枚ドローする
                remainingToDraw += 1;
                updateUI();
            } else {
                break;
            }
        }

        const card = p.deck.pop();
        remainingToDraw--;

        if (side === "player") {
            card.isNew = true;
            p.hand.push(card);
            drawQueue.push(card);
        } else {
            p.hand.push(card);
        }
    }

    if (side === "player") {
        renderHand();
        const animPromises = drawQueue.map(async (card, idx) => {
            await new Promise(r => setTimeout(r, idx * 80));
            await animateDrawCard(card, idx);
            delete card.isNew;
            renderHand();
        });
        await Promise.all(animPromises);
        GAME_STATE.isAnimating = false;
    }

    updateUI();
}

/**
 * ドロー演出：デッキから手札へ
 */
function animateDrawCard(cardData, sequenceIdx = 0) {
    return new Promise(resolve => {
        const deckEl = document.getElementById('player-deck-zone');
        const handContainer = document.getElementById('player-hand');

        // DOM上の「透明な実体」を探す
        const realCards = handContainer.querySelectorAll('.card-mini');
        const targetEl = Array.from(realCards).find(el => el.dataset.id === cardData.id && el.classList.contains('entering'));

        if (!targetEl) {
            resolve();
            return;
        }

        const startRect = deckEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        // アニメーション用要素作成
        const animCard = createCardElement(cardData, 'animation');
        animCard.classList.add('anim-drawing-card');

        // 重なり順の制御：後から引くカードを上にする
        animCard.style.zIndex = 5000 + sequenceIdx;

        // 初期状態：デッキ位置、裏向き
        animCard.style.left = `${startRect.left}px`;
        animCard.style.top = `${startRect.top}px`;
        animCard.style.transform = 'rotateY(180deg)';

        document.body.appendChild(animCard);

        // アニメーション開始（リフロー待ち）
        requestAnimationFrame(() => {
            animCard.style.left = `${targetRect.left}px`;
            animCard.style.top = `${targetRect.top}px`;
            animCard.style.transform = 'rotateY(0deg)';
        });

        // 0.5秒後に終了（テンポアップのためわずかに短縮）
        setTimeout(() => {
            animCard.remove();
            resolve();
        }, 500);
    });
}

// ==========================================
// 5. アクション: 召喚 (Summon)
// ==========================================

/**
 * 召喚が可能かどうかを論理的に判定する
 */
function checkCanSummon(cardData) {
    if (GAME_STATE.isGameOver) return false;
    if (GAME_STATE.phase !== "MAIN1" && GAME_STATE.phase !== "MAIN2") return false;
    if (GAME_STATE.hasNormalSummoned) return false;

    const req = cardData.summonRequirement;
    const costCount = (req && req.type === 'normal') ? req.costCount : 0;
    const hasEmptySlot = GAME_STATE.player.field.monsters.some(c => c === null);

    if (costCount === 0) return hasEmptySlot;

    const filter = req.costFilter;
    const fieldCosters = getValidCosterMonsters(filter);
    const handCosters = getValidHandCosters(filter, cardData);

    // 素材の総数が足りているか（フィールドと手札は自由に組み合わせられる）
    if (fieldCosters.length + handCosters.length < costCount) return false;

    // 場が埋まっている場合、フィールドから最低1体はリリースしないと置き場所がない
    return hasEmptySlot || fieldCosters.length >= 1;
}

/**
 * 召喚試行 (UIから呼ばれる)
 */
function trySummon(cardData) {
    if (!checkCanSummon(cardData)) return;

    const req = cardData.summonRequirement;
    const costCount = (req && req.type === 'normal') ? req.costCount : 0;

    if (costCount > 0) {
        startCostSelection(cardData);
    } else {
        startSlotSelection(cardData);
    }
}

/**
 * 召喚の実行
 * @param {Array} costs - [{card, slotIdx, from:"field"|"hand"}]
 *   from:"field" はトラッシュへ、from:"hand" は除外される（除外は墓地誘発を起こさない）
 */
async function executeSummon(side, cardData, slotIndex, costs = []) {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    const trashedCosts = [];

    // 1. コストの支払いを実行 (ルール Ver.1.1: 効果発動は後回し)
    for (const cost of costs) {
        if (cost.from === "hand") {
            const hIdx = p.hand.indexOf(cost.card);
            if (hIdx !== -1) {
                p.hand.splice(hIdx, 1);
                banishCard(side, cost.card);
            }
        } else {
            const cCard = p.field.monsters[cost.slotIdx];
            if (cCard) {
                p.field.monsters[cost.slotIdx] = null;
                sendCardToTrash(side, cCard);
                trashedCosts.push(cCard);
            }
        }
    }

    // 2. 手札から削除（同名カードを取り違えないようオブジェクト同一性で検索）
    const handIndex = p.hand.indexOf(cardData);
    if (handIndex !== -1) {
        p.hand.splice(handIndex, 1);
    }

    // 3. フィールドへ配置
    p.field.monsters[slotIndex] = cardData;

    // 4. トラッシュ送り時および召喚成功時の効果解決
    //    （除外したカードはここに含まれない＝墓地誘発は発動しない）
    for (const cCard of trashedCosts) {
        await EffectLogic.notifyCardSentToTrash(cCard, side);
    }
    await EffectLogic.resolveEffects(cardData, side, "on_summon");

    // フラグ更新
    if (side === GAME_STATE.turnPlayer) {
        GAME_STATE.hasNormalSummoned = true;
    }

    // UI更新
    if (side === "player") hideCardDetail();
    updateUI();

    console.log(`${side} Summoned ${cardData.name} to Slot ${slotIndex}`);
    return Promise.resolve();
}

// ==========================================
// 5.5 アクション: 魔術発動 (Magic)
// ==========================================

/** 魔術が発動可能か判定 */
function checkCanActivateMagic(cardData) {
    if (GAME_STATE.isGameOver) return false;
    if (GAME_STATE.phase !== "MAIN1" && GAME_STATE.phase !== "MAIN2") return false;
    const hasSpace = GAME_STATE.player.field.magics.some(m => m === null);
    if (!hasSpace) return false;
    return EffectLogic.isEffectActivatable(cardData, "player", "on_activate");
}

/** 魔術発動試行 */
function tryActivateMagic(cardData) {
    if (!checkCanActivateMagic(cardData)) return;
    startMagicSlotSelection(cardData);
}

/** 魔術発動先の選択開始 */
function startMagicSlotSelection(cardData) {
    document.getElementById('floating-action-container').innerHTML = "";
    document.getElementById('field-surface').classList.add('selecting-mode');
    document.getElementById('game-viewport').classList.add('field-selecting');
    GAME_STATE.isSelectingSlot = true;
    GAME_STATE.pendingCard = cardData;

    // イベントデリゲーション: 個別のonclickは設定せず、全体で監視する
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-magic-${i}`);
        if (GAME_STATE.player.field.magics[i] === null) {
            zone.classList.add('highlight');
            // zone.onclick = ... (削除)
        }
    });
}

/**
 * 共通ヒットテスト関数 (幾何学的判定含む)
 * @param {MouseEvent} e - クリックイベント
 * @param {string} idPrefix - 判定対象のID接頭辞 (例: 'ply-monster', 'opt-monster')
 * @param {number} count - スロット数
 * @param {boolean} requireHighlight - '.highlight' クラスを必須とするか
 * @returns {number} ヒットしたインデックス (-1はヒットなし)
 */
function detectHitSlot(e, idPrefix, count = 3, requireHighlight = true) {
    let hitSlotIdx = -1;

    // 1. DOM探索 (e.target.closest)
    const targetZone = e.target.closest('.zone');
    if (targetZone) {
        if (!requireHighlight || targetZone.classList.contains('highlight')) {
            // IDチェック (指定されたprefixを含んでいるか)
            if (targetZone.id.startsWith(idPrefix)) {
                const parts = targetZone.id.split('-');
                hitSlotIdx = parseInt(parts[parts.length - 1], 10);
            }
        }
    }

    // 2. 幾何学的判定 (バックアップ)
    //    候補が複数ヒットする場合は「中心が最も近いゾーン」を採用する。
    //    先着順で決めると常にスロット0側へ判定が偏ってしまうため。
    if (hitSlotIdx === -1) {
        const margin = 8; // 指の太さぶんの許容（隣のゾーンと食い合わない範囲に留める）
        let bestDistance = Infinity;

        for (let i = 0; i < count; i++) {
            const el = document.getElementById(`${idPrefix}-${i}`);
            if (!el) continue;
            if (requireHighlight && !el.classList.contains('highlight')) continue;

            const rect = el.getBoundingClientRect();
            if (e.clientX >= rect.left - margin && e.clientX <= rect.right + margin &&
                e.clientY >= rect.top - margin && e.clientY <= rect.bottom + margin) {
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const distance = Math.hypot(e.clientX - cx, e.clientY - cy);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    hitSlotIdx = i;
                }
            }
        }
    }

    return hitSlotIdx;
}

/**
 * グローバルクリックハンドラ
 * 全てのクリックイベントをここで受け取り、状態に応じて振り分ける
 */
function handleGlobalInteract(e) {
    if (GAME_STATE.isGameOver) return;

    // UI要素やオーバーレイへのクリックはパススルー（それぞれの制御に任せる）
    if (e.target.closest('#card-detail-overlay') ||
        e.target.closest('.floating-actions') ||
        e.target.closest('#floating-action-container') ||
        e.target.closest('.modal-content') ||
        e.target.closest('.card-mini.entering') ||
        e.target.closest('.btn-sub') || // フェイズボタン等
        e.target.closest('#next-phase-btn')) {
        return;
    }

    // モード別ディスパッチ（選択モード中は手札の詳細表示より選択操作を優先する）
    if (GAME_STATE.isSelectingCost) {
        handleCostSelectionClick(e);
        return;
    }
    if (GAME_STATE.isSelectingSlot) {
        handleSelectionClick(e);
        return;
    }
    if (GAME_STATE.isSelectingTarget) {
        handleAttackSelectionClick(e);
        return;
    }

    // 手札のクリック判定（同名カードを取り違えないよう表示位置で特定する）
    const handCard = e.target.closest('#player-hand .card-mini');
    if (handCard) {
        const handIdx = parseInt(handCard.dataset.handIndex, 10);
        const cardData = GAME_STATE.player.hand[handIdx];
        if (cardData) {
            showCardDetail(cardData, 'hand', e, null);
            return;
        }
    }

    // 通常モード（詳細表示 / アクションメニュー）
    handleNormalInteraction(e);
}

/** コスト選択中のクリックハンドラ（フィールド・手札の両方が対象） */
function handleCostSelectionClick(e) {
    if (!GAME_STATE.isSelectingCost || !GAME_STATE.pendingCard) return;

    const req = GAME_STATE.pendingCard.summonRequirement;
    const filter = req ? req.costFilter : null;

    // 1. 手札のモンスターをコスト（＝除外）に選ぶ
    const handEl = e.target.closest('#player-hand .card-mini');
    if (handEl) {
        e.stopPropagation();
        const handIdx = parseInt(handEl.dataset.handIndex, 10);
        const card = GAME_STATE.player.hand[handIdx];
        if (card && card !== GAME_STATE.pendingCard && matchesCostFilter(card, filter)) {
            toggleCostSelection({ card: card, handIdx: handIdx, from: "hand" });
        }
        return;
    }
    // 手札エリアの余白タップは何もしない（誤キャンセル防止）
    if (e.target.closest('#player-hand-container')) return;

    // 2. フィールドのモンスターをコスト（＝トラッシュ）に選ぶ
    const hitIdx = detectHitSlot(e, 'ply-monster', 3, false);
    if (hitIdx !== -1) {
        const monster = GAME_STATE.player.field.monsters[hitIdx];
        if (monster && matchesCostFilter(monster, filter)) {
            e.stopPropagation();
            toggleCostSelection({ card: monster, slotIdx: hitIdx, from: "field" });
        }
        return;
    }

    // 3. 背景タップでキャンセル
    if (checkGlobalCancel(e)) {
        cancelCostSelection();
    }
}

/**
 * 通常時のインタラクション (幾何学的判定付き)
 */
function handleNormalInteraction(e) {
    // 自分のモンスターゾーン
    let idx = detectHitSlot(e, 'ply-monster', 3, false);
    if (idx !== -1) {
        const card = GAME_STATE.player.field.monsters[idx];
        if (card) showCardDetail(card, 'ply-field', e, idx);
        return;
    }

    // 自分の魔術ゾーン
    idx = detectHitSlot(e, 'ply-magic', 3, false);
    if (idx !== -1) {
        const card = GAME_STATE.player.field.magics[idx];
        if (card) showCardDetail(card, 'ply-field', e, idx); // locationはply-fieldで統合
        return;
    }

    // 相手のモンスターゾーン
    idx = detectHitSlot(e, 'opt-monster', 3, false);
    if (idx !== -1) {
        const card = GAME_STATE.opponent.field.monsters[idx];
        if (card) showCardDetail(card, 'opt-field', e, idx);
        return;
    }

    // 相手の魔術ゾーン
    idx = detectHitSlot(e, 'opt-magic', 3, false);
    if (idx !== -1) {
        const card = GAME_STATE.opponent.field.magics[idx];
        if (card) showCardDetail(card, 'opt-field', e, idx);
        return;
    }

    // トラッシュ・除外ゾーンの幾何判定
    // フィールドは3D変形しているため、DOMのヒットテストが親要素(.field-row)に吸われて
    // ゾーンのinline onclickが発火しないことがある。座標で救済する。
    const pileZones = [
        { id: 'player-trash-zone', side: 'player', pile: 'trash' },
        { id: 'opponent-trash-zone', side: 'opponent', pile: 'trash' },
        { id: 'player-banish-zone', side: 'player', pile: 'banish' },
        { id: 'opponent-banish-zone', side: 'opponent', pile: 'banish' }
    ];

    for (const pz of pileZones) {
        const el = document.getElementById(pz.id);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        const margin = 6; // 判定のあそび（隣のゾーンと食い合わない範囲）
        if (e.clientX >= rect.left - margin && e.clientX <= rect.right + margin &&
            e.clientY >= rect.top - margin && e.clientY <= rect.bottom + margin) {
            openCardPileViewer(pz.side, pz.pile);
            return;
        }
    }

    // 何もない場所をクリック -> メニューなどを閉じる
    // ただし、誤タップで閉じすぎるのも良くないので、明示的な背景クリックのみ？
    // いったんfloating-action等は冒頭のガードで除外されているので、ここに来るのはフィールド背景のみ
    hideCardDetail();
}

/** 背景クリック等による共通キャンセル判定 */
function checkGlobalCancel(e) {
    // ビューポート、フィールド表面、遠近ラッパーをクリックでキャンセル
    const cancelTargets = ['game-viewport', 'field-perspective-wrapper', 'field-surface'];
    if (cancelTargets.includes(e.target.id)) return true;
    return false;
}

function handleSelectionClick(e) {
    if (!GAME_STATE.isSelectingSlot || !GAME_STATE.pendingCard) return;

    // 誤って手札をタップした場合 -> キャンセルしてその手札を選択したことにする
    if (e.target.closest('#player-hand')) {
        console.log("Switching selection to hand card");
        if (GAME_STATE.pendingCard.type === 'monster') cancelSlotSelection();
        else cancelMagicSlotSelection();
        return;
        // 備考: ここでreturnすると今回のイベントは消費される。
        // ユーザーは「キャンセルされた」状態になるので、もう一度タップすれば詳細が開く。
        // それで十分親切（反応しないよりマシ）。
    }

    const typePrefix = GAME_STATE.pendingCard.type === 'monster' ? 'ply-monster' : 'ply-magic';
    const hitIdx = detectHitSlot(e, typePrefix, 3, true);

    if (hitIdx !== -1) {
        e.stopPropagation();
        if (GAME_STATE.pendingCard.type === 'monster') finishSlotSelection(hitIdx);
        else finishMagicSlotSelection(hitIdx);
        return;
    }

    if (checkGlobalCancel(e)) {
        console.log("Selection Cancelled by background click");
        if (GAME_STATE.pendingCard.type === 'monster') cancelSlotSelection();
        else cancelMagicSlotSelection();
    }
}

/** 攻撃対象選択中のクリックハンドラ */
function handleAttackSelectionClick(e) {
    if (!GAME_STATE.isSelectingTarget) return;

    const hitIdx = detectHitSlot(e, 'opt-monster', 3, true);

    if (hitIdx !== -1) {
        e.stopPropagation();
        finishAttackTargetSelection(hitIdx);
        return;
    }

    if (checkGlobalCancel(e)) {
        cancelAttackTargetSelection();
    }
}

/** 魔術発動の完了 */
async function finishMagicSlotSelection(slotIdx) {
    if (!GAME_STATE.pendingCard) return;
    const cardData = GAME_STATE.pendingCard;
    const p = GAME_STATE.player;

    // 効果解決（await）の前に選択モードを完全に終了させる
    cancelMagicSlotSelection();

    // 1. 手札から削除（同名カードを取り違えないようオブジェクト同一性で検索）
    const handIndex = p.hand.indexOf(cardData);
    if (handIndex !== -1) p.hand.splice(handIndex, 1);

    // 2. 一旦魔術ゾーンに配置して描画（効果解決中であることを示す）
    p.field.magics[slotIdx] = cardData;
    renderFieldCard("player", "magic", slotIdx, cardData);

    // 3. 効果の解決を実行 (非同期待機)
    await EffectLogic.resolveEffects(cardData, "player", "on_activate");

    // 4. 種別による後処理
    if (cardData.subType === 'normal') {
        // 通常魔術は少し待ってからトラッシュへ (演出用)
        setTimeout(() => {
            if (p.field.magics[slotIdx] !== cardData) return;
            p.field.magics[slotIdx] = null;
            renderFieldCard("player", "magic", slotIdx, null);
            sendCardToTrash("player", cardData);
            updateUI();
        }, 500);
    } else {
        // 永続魔術はそのまま残る
        updateUI();
    }

    console.log(`Magic Played: ${cardData.name}`);
}

/** 魔術選択のキャンセル */
function cancelMagicSlotSelection() {
    document.getElementById('field-surface').classList.remove('selecting-mode');
    document.getElementById('game-viewport').classList.remove('field-selecting');
    GAME_STATE.isSelectingSlot = false;
    GAME_STATE.pendingCard = null;

    // イベントリスナ削除
    document.removeEventListener('click', handleSelectionClick);

    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-magic-${i}`);
        zone.classList.remove('highlight');
        // zone.onclick = null; (不要)
    });
    // body.onclick = ... (不要)
}

// ==========================================
// 6. アクション: 攻撃 (Battle)
// ==========================================

function tryAttack(attackerCard, attackerSlotIdx) {
    if (GAME_STATE.isGameOver) return;
    if (GAME_STATE.phase !== "BATTLE" || attackerCard._hasAttacked) {
        return;
    }

    const optMonsters = GAME_STATE.opponent.field.monsters;
    const livingTargets = optMonsters.map((m, i) => ({ m, i })).filter(obj => obj.m !== null);

    if (livingTargets.length === 0) {
        resolveBattle(attackerCard, null, attackerSlotIdx, -1);
    } else {
        startAttackTargetSelection(attackerCard, attackerSlotIdx);
    }
}

async function resolveBattle(attacker, defender, atkIdx, defIdx) {
    if (GAME_STATE.isGameOver) return;

    console.log(`Battle: ${attacker.name} vs ${defender ? defender.name : "Direct"}`);
    attacker._hasAttacked = true;
    GAME_STATE.isAnimating = true; // CPUの連続処理を防止

    const attackerSide = GAME_STATE.turnPlayer;
    const defenderSide = (attackerSide === "player") ? "opponent" : "player";

    if (!defender) {
        const pAtk = EffectLogic.getCurrentPower(attacker, attackerSide, atkIdx);
        damagePlayer(defenderSide, pAtk);
    } else {
        const pAtk = EffectLogic.getCurrentPower(attacker, GAME_STATE.turnPlayer, atkIdx);
        const opponentSide = (GAME_STATE.turnPlayer === "player") ? "opponent" : "player";
        const pDef = EffectLogic.getCurrentPower(defender, opponentSide, defIdx);

        if (pAtk > pDef) {
            const damage = pAtk - pDef;
            damagePlayer(defenderSide, damage);
            await destroyMonster(defenderSide, defIdx, "battle");
        } else if (pAtk === pDef) {
            await Promise.all([
                destroyMonster(attackerSide, atkIdx, "battle"),
                destroyMonster(defenderSide, defIdx, "battle")
            ]);
        } else {
            const damage = pDef - pAtk;
            damagePlayer(attackerSide, damage);
            await destroyMonster(attackerSide, atkIdx, "battle");
        }

        // 戦闘後の予約効果（海の突撃など）。
        // 「戦闘を行った相手モンスター」が対象なので、攻撃側・防御側どちらが持っていても機能する。
        const hasAfterCombatDestroy = (c) =>
            !!c && !!c._combatEffects && c._combatEffects.some(e => e.type === "destroy_opponent_after_combat");

        if (hasAfterCombatDestroy(attacker) && GAME_STATE[defenderSide].field.monsters[defIdx] === defender) {
            await destroyMonster(defenderSide, defIdx, "effect");
        }
        if (hasAfterCombatDestroy(defender) && GAME_STATE[attackerSide].field.monsters[atkIdx] === attacker) {
            await destroyMonster(attackerSide, atkIdx, "effect");
        }
    }

    GAME_STATE.isAnimating = false;
    updateUI();
    return Promise.resolve();
}

function damagePlayer(side, amount) {
    if (GAME_STATE.isGameOver) return;

    // ダメージ軽減ロジックの適用
    const finalDamage = EffectLogic.calculateFinalDamage(side, amount);

    if (side === "player") {
        GAME_STATE.player.lp = Math.max(0, GAME_STATE.player.lp - finalDamage);
    } else {
        GAME_STATE.opponent.lp = Math.max(0, GAME_STATE.opponent.lp - finalDamage);
    }

    checkGameEnd();
}

/** LPによる決着判定（同時に0なら引き分け / ルール1準拠） */
function checkGameEnd() {
    if (GAME_STATE.isGameOver) return false;

    const playerDead = GAME_STATE.player.lp === 0;
    const opponentDead = GAME_STATE.opponent.lp === 0;

    if (playerDead && opponentDead) {
        endGameSequence("draw");
        return true;
    }
    if (playerDead) {
        endGameSequence("opponent");
        return true;
    }
    if (opponentDead) {
        endGameSequence("player");
        return true;
    }
    return false;
}

/**
 * ゲーム終了シーケンス
 * @param {string} winner - "player" | "opponent" | "draw"
 */
function endGameSequence(winner) {
    // 二重呼び出し防止：以降のターン進行・効果解決をすべて停止する
    if (GAME_STATE.isGameOver) return;
    GAME_STATE.isGameOver = true;

    // 選択モードが残っていると操作不能に見えるため強制解除
    GAME_STATE.isSelectingSlot = false;
    GAME_STATE.isSelectingTarget = false;
    GAME_STATE.isSelectingCost = false;
    GAME_STATE.pendingCard = null;
    GAME_STATE.attackerPending = null;
    GAME_STATE.selectedCosts = [];
    document.getElementById('floating-action-container').innerHTML = "";
    document.getElementById('game-viewport').classList.remove('field-selecting', 'cost-selecting');
    document.getElementById('field-surface').classList.remove('selecting-mode');

    // 1秒の「間（演出）」の後にモーダルを表示
    setTimeout(() => {
        const overlay = document.getElementById('game-result-overlay');
        const title = document.getElementById('result-title');
        const msg = document.getElementById('result-message');

        overlay.classList.remove("result-win", "result-lose");
        overlay.classList.add('active');

        if (winner === "player") {
            overlay.classList.add("result-win");
            title.innerText = "VICTORY";
            msg.innerText = "相手のLPを0にしました！";
        } else if (winner === "opponent") {
            overlay.classList.add("result-lose");
            title.innerText = "DEFEAT";
            msg.innerText = "自分のLPが0になりました...";
        } else {
            title.innerText = "DRAW";
            msg.innerText = "お互いのLPが同時に0になりました";
        }
    }, 1000);
}

async function destroyMonster(side, slotIdx, reason = "effect") {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    const card = p.field.monsters[slotIdx];

    if (card) {
        // 戦闘破壊耐性のチェック
        if (reason === "battle" && EffectLogic.checkBattleProtection(card, side, slotIdx)) {
            console.log(`Protection Active: ${card.name} survived destruction.`);
            return;
        }

        p.field.monsters[slotIdx] = null;
        sendCardToTrash(side, card);

        // UIクリア
        const prefix = (side === "player") ? "ply" : "opt";
        const el = document.getElementById(`${prefix}-monster-${slotIdx}`);
        if (el) el.innerHTML = "";

        // トラッシュ送りに伴う誘発（自身の on_sent_to_trash と、他カードの on_other_sent_to_trash）
        await EffectLogic.notifyCardSentToTrash(card, side);
    }
}

// ==========================================
// 7. UI描画 (Rendering)
// ==========================================

function updateUI() {
    document.getElementById('player-lp-hud').innerText = GAME_STATE.player.lp;
    document.getElementById('opponent-lp-hud').innerText = GAME_STATE.opponent.lp;
    document.getElementById('opt-hand-hud').innerText = GAME_STATE.opponent.hand.length;
    updateZoneVisuals("player", "deck");
    updateZoneVisuals("player", "trash");
    updateZoneVisuals("player", "banish");
    updateZoneVisuals("opponent", "deck");
    updateZoneVisuals("opponent", "trash");
    updateZoneVisuals("opponent", "banish");

    // フィールド上の全カードを最新データで再描画 (バフ・オーラ反映)
    ["player", "opponent"].forEach(side => {
        GAME_STATE[side].field.monsters.forEach((card, i) => renderFieldCard(side, "monster", i, card));
        GAME_STATE[side].field.magics.forEach((card, i) => renderFieldCard(side, "magic", i, card));
    });

    // フェイズ中央表示
    const phaseLabel = document.getElementById('phase-center-label');
    if (phaseLabel) phaseLabel.innerText = `${GAME_STATE.phase} PHASE`;

    // 次のフェイズ予測表示
    const nextPhaseDisplay = document.getElementById('next-phase-display');
    if (nextPhaseDisplay) {
        const pOrder = GAME_STATE.phases;
        const currentIdx = pOrder.indexOf(GAME_STATE.phase);
        let nextIdx = (currentIdx + 1) % pOrder.length;
        if (GAME_STATE.isFirstTurnOfGame && pOrder[nextIdx] === "BATTLE") nextIdx++;
        nextPhaseDisplay.innerText = (GAME_STATE.phase === "END") ? "NEXT TURN" : pOrder[nextIdx];
    }

    // 相手ターン、または自動進行すべきフェイズ(DRAW/END)は操作不能にする
    const phaseContainer = document.getElementById('next-phase-btn');
    const isAutoPhase = (GAME_STATE.phase === "DRAW" || GAME_STATE.phase === "END");

    if (GAME_STATE.turnPlayer === "opponent" || isAutoPhase || GAME_STATE.isAnimating) {
        phaseContainer.style.opacity = "0.2";
        phaseContainer.style.pointerEvents = "none";
    } else {
        phaseContainer.style.opacity = "1.0";
        phaseContainer.style.pointerEvents = "auto";
    }

    renderHand();
}

function renderHand() {
    const container = document.getElementById('player-hand');
    container.innerHTML = "";

    const hand = GAME_STATE.player.hand;
    if (hand.length === 0) return;

    const costFilter = (GAME_STATE.isSelectingCost && GAME_STATE.pendingCard)
        ? (GAME_STATE.pendingCard.summonRequirement || {}).costFilter
        : null;

    const elements = hand.map((card, idx) => {
        const el = createCardElement(card, "hand");
        el.dataset.handIndex = idx; // 同名カードを位置で識別する
        el.style.zIndex = idx;
        if (card.isNew) el.classList.add('entering');

        // コスト選択中：除外コストに使える手札を光らせる
        if (GAME_STATE.isSelectingCost && card !== GAME_STATE.pendingCard) {
            if (matchesCostFilter(card, costFilter)) el.classList.add('cost-highlight');
            if (isCostSelected(card)) el.classList.add('cost-selected');
        }

        container.appendChild(el);
        return el;
    });

    // 実際に描画されたカード幅を測ってから重なり量を決める
    // (--card-width は vw 基準なので端末ごとに実寸が変わる)
    const cardWidth = elements[0].offsetWidth || 65;
    const maxDisplayWidth = (container.parentElement.clientWidth || window.innerWidth) * 0.9;
    const idealGap = 8;

    if (hand.length > 1) {
        const totalRawWidth = (cardWidth * hand.length) + (idealGap * (hand.length - 1));
        let currentGap = idealGap;
        if (totalRawWidth > maxDisplayWidth) {
            currentGap = (maxDisplayWidth - cardWidth) / (hand.length - 1) - cardWidth;
        }
        elements.forEach((el, idx) => {
            if (idx > 0) el.style.marginLeft = `${currentGap}px`;
        });
    }
}

function renderFieldCard(side, type, index, cardData) {
    const prefix = (side === "player") ? "ply" : "opt";
    const zoneId = `${prefix}-${type}-${index}`;
    const zoneEl = document.getElementById(zoneId);

    if (zoneEl) {
        zoneEl.innerHTML = "";
        if (cardData) {
            const location = (side === "player") ? "ply-field" : "opt-field";
            // スロット番号(index)を渡すように修正
            const el = createCardElement(cardData, location, index);
            zoneEl.appendChild(el);
        }
    }
}

function createCardElement(cardData, location, slotIdx = null) {
    const el = document.createElement('div');
    el.className = 'card-mini';
    el.dataset.id = cardData.id;

    const isMonster = cardData.type === 'monster';

    // 現在のパワーを計算（バフ・デバフ・オーラ反映）
    let currentPower = cardData.power;
    if (isMonster && (location === "ply-field" || location === "opt-field")) {
        const side = (location === "ply-field") ? "player" : "opponent";
        // 渡されたslotIdxを優先し、なければindexOf(ユニークオブジェクト)で特定
        const targetIdx = slotIdx !== null ? slotIdx : GAME_STATE[side].field.monsters.indexOf(cardData);
        currentPower = EffectLogic.getCurrentPower(cardData, side, targetIdx);
    }
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
                <img src="${cardData.image}" class="card-img-content" draggable="false">
            </div>
            <div class="card-attribute-icon">
                <img src="img/${attrEn}.webp" alt="${cardData.attribute}">
            </div>
            <div class="card-status-cluster">
                ${isMonster ? `
                    <div class="card-lv-text">Lv.${cardData.level}</div>
                    <div class="card-atk-text">${currentPower}</div>
                ` : `
                    <div class="card-magic-type">${getMagicTypeLabel(cardData.subType)}</div>
                `}
            </div>
        </div>
        <div class="card-face card-back"></div>
    `;

    // 自動検知による名称圧縮ロジック
    const nameBox = el.querySelector('.card-name-box');
    const nameText = el.querySelector('.card-name-text');

    // 描画後に物理幅を測定して計算
    requestAnimationFrame(() => {
        const maxWidth = nameBox.clientWidth * 0.9; // 左右余白を考慮
        const currentWidth = nameText.scrollWidth;

        if (currentWidth > maxWidth) {
            nameText.style.display = 'inline-block';
            nameText.style.transform = `scaleX(${maxWidth / currentWidth})`;
            nameText.style.transformOrigin = 'center';
        }
    });



    return el;
}

// ==========================================
// 8. 詳細画面 & 操作パネル
// ==========================================

function showCardDetail(cardData, location, event, slotIdx = null) {
    updateInfoPanel(cardData, location);

    // 対象要素の解決
    let targetEl = null;
    if (location === "hand") {
        // 手札の場合はDOMからID等で探すか、選択状態クラスの制御のみなら
        // infoPanel更新だけで十分かも知れないが、ハイライト処理は必要
        // 手札の場合はevent.targetから遡れる (.card-mini)
        targetEl = event ? event.target.closest('.card-mini') : null;
    } else {
        // フィールドの場合はIDから特定
        const prefix = (location === "ply-field" || location === "opt-field")
            ? (location === "ply-field" ? "ply" : "opt")
            : null;
        if (prefix && slotIdx !== null) {
            const type = cardData.type === 'monster' ? 'monster' : 'magic';
            targetEl = document.getElementById(`${prefix}-${type}-${slotIdx}`);
        }
    }

    // 手札の強調表示（浮き上がり）制御
    const handCards = document.querySelectorAll('#player-hand .card-mini');
    handCards.forEach(c => c.classList.remove('selected'));
    if (location === "hand" && targetEl) {
        targetEl.classList.add('selected');
    }

    // ターゲット選択モード中の処理
    if (GAME_STATE.isSelectingTarget && location === "opt-field") {
        // 相手モンスター選択時もslotIdxを優先
        const targetIdx = slotIdx !== null ? slotIdx : GAME_STATE.opponent.field.monsters.indexOf(cardData);
        if (targetIdx !== -1) {
            finishAttackTargetSelection(targetIdx);
            return;
        }
    }

    // コスト選択モード中の処理
    if (GAME_STATE.isSelectingCost && location === "ply-field") {
        const targetIdx = slotIdx !== null ? slotIdx : GAME_STATE.player.field.monsters.indexOf(cardData);
        if (targetIdx !== -1) {
            toggleCostSelection({ card: cardData, slotIdx: targetIdx });
            return;
        }
    }

    // 召喚先選択モード中の処理（既存カードをタップして置換する場合など）
    if (GAME_STATE.isSelectingSlot && location === "ply-field") {
        const targetIdx = slotIdx !== null ? slotIdx : GAME_STATE.player.field.monsters.indexOf(cardData);
        if (targetIdx !== -1) {
            if (GAME_STATE.pendingCard.type === 'monster') finishSlotSelection(targetIdx);
            else finishMagicSlotSelection(targetIdx);
            return;
        }
    }

    // 選択モード中、または相手のターンならアクションは出さない
    if (GAME_STATE.isSelectingSlot || GAME_STATE.isSelectingTarget || GAME_STATE.turnPlayer !== "player") return;

    // 既存のアクションメニューをクリア
    const container = document.getElementById('floating-action-container');
    container.innerHTML = "";

    // ボタンが必要な状況か判定
    const isMain = (GAME_STATE.phase === "MAIN1" || GAME_STATE.phase === "MAIN2");
    const isBattle = (GAME_STATE.phase === "BATTLE");

    // アクションボタン表示判定
    const canShowSummon = (location === "hand" && isMain && cardData.type === "monster");
    const canShowMagic = (location === "hand" && isMain && cardData.type === "magic");
    const canShowAttack = (location === "ply-field" && isBattle && cardData.type === "monster" && !cardData._hasAttacked);
    // 起動効果はメインフェイズとバトルフェイズの両方で使える（ルール3準拠）
    const canShowEffect = (location === "ply-field" && (isMain || isBattle)
        && cardData.logic && cardData.logic.some(l => l.trigger === "ignition"));

    const buttons = [];

    if (canShowSummon) {
        const btn = document.createElement('button');
        btn.className = 'btn-action-float';
        btn.innerText = "召喚";
        btn.disabled = !checkCanSummon(cardData);
        btn.onclick = () => trySummon(cardData);
        buttons.push(btn);
    } else if (canShowMagic) {
        const btn = document.createElement('button');
        btn.className = 'btn-action-float';
        btn.innerText = "発動";
        btn.disabled = !checkCanActivateMagic(cardData);
        btn.onclick = () => tryActivateMagic(cardData);
        buttons.push(btn);
    }

    if (canShowAttack) {
        const btn = document.createElement('button');
        btn.className = 'btn-action-float attack';
        btn.innerText = "攻撃";
        // 直接slotIdxを使用することで同名カードの誤認を回避
        const effectiveIdx = slotIdx !== null ? slotIdx : GAME_STATE.player.field.monsters.indexOf(cardData);
        btn.onclick = () => { container.innerHTML = ""; tryAttack(cardData, effectiveIdx); };
        buttons.push(btn);
    }

    if (canShowEffect) {
        const btn = document.createElement('button');
        btn.className = 'btn-action-float';
        btn.innerText = "効果発動";

        const isUsed = EffectLogic.isIgnitionUsed(cardData);
        const isActivatable = EffectLogic.isEffectActivatable(cardData, "player", "ignition");

        if (isUsed) {
            btn.disabled = true;
            btn.innerText = "使用済み";
        } else if (!isActivatable) {
            btn.disabled = true;
            btn.innerText = "対象なし";
        }

        btn.onclick = async () => {
            container.innerHTML = "";
            // 使用済み判定は EffectLogic 側の countLimit 管理に一本化している
            await EffectLogic.resolveEffects(cardData, "player", "ignition");
        };
        buttons.push(btn);
    }

    if (buttons.length > 0) {
        const menu = document.createElement('div');
        menu.className = 'floating-actions';

        if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            menu.style.left = `${rect.left + rect.width / 2}px`;
            menu.style.top = `${rect.top - 20}px`;
            menu.style.transform = 'translateX(-50%) translateY(-100%)';
            menu.style.opacity = "1";
        }

        buttons.forEach(b => menu.appendChild(b));
        container.appendChild(menu);
    }
}

// Old Action Menu Logic Removed (Now using showCardDetail with floating-actions)

/**
 * cpu_logic.js のエントリポイントを呼び出す
 */
function executeCpuTurn() {
    if (typeof CpuLogic !== 'undefined') {
        CpuLogic.execute();
    } else {
        console.warn("CpuLogic is not loaded yet.");
    }
}

/**
 * 左上のカード情報パネルを更新する
 */
function updateInfoPanel(cardData, location = null) {
    if (!cardData) return;

    const visualContainer = document.getElementById('info-visual-container');
    const nameEl = document.getElementById('info-name');
    const attrEl = document.getElementById('info-attr');
    const levelEl = document.getElementById('info-level');
    const powerEl = document.getElementById('info-power');
    const extraEl = document.getElementById('info-extra-stats');
    const textEl = document.getElementById('info-text');

    // 左側: ビジュアル更新 (createCardElementを再利用)
    visualContainer.innerHTML = "";
    const previewCard = createCardElement(cardData, 'preview');
    visualContainer.appendChild(previewCard);

    // 右側: 基本テキスト更新
    nameEl.innerText = cardData.name;
    attrEl.innerText = `[${cardData.attribute}]`;
    textEl.innerText = cardData.text;
    textEl.scrollTop = 0;

    if (cardData.type === 'monster') {
        levelEl.innerText = `Lv.${cardData.level}`;

        // 詳細パネルでもバフを反映（場所が特定できる場合のみ）
        let displayPower = cardData.power;
        if (location === "ply-field" || location === "opt-field") {
            const side = (location === "ply-field") ? "player" : "opponent";
            const slotIdx = GAME_STATE[side].field.monsters.indexOf(cardData);
            displayPower = EffectLogic.getCurrentPower(cardData, side, slotIdx);
        }
        powerEl.innerText = `ATK: ${displayPower}`;

        // 召喚条件の日本語変換
        const req = cardData.summonRequirement;
        if (req && req.type === 'normal') {
            if (req.costCount === 0) {
                extraEl.innerText = "召喚: コストなし";
            } else {
                const minLv = req.costFilter ? req.costFilter.minLevel : 1;
                extraEl.innerText = `召喚: Lv.${minLv}以上 × ${req.costCount}体`;
            }
        } else {
            extraEl.innerText = "";
        }
    } else {
        // 魔術種別の日本語化
        levelEl.innerText = getMagicTypeLabel(cardData.subType);
        powerEl.innerText = "";
        extraEl.innerText = "";
    }

    // パネル内の名称圧縮ロジック（右側の幅に合わせて再計算）
    requestAnimationFrame(() => {
        const containerWidth = document.getElementById('info-text-container').clientWidth;
        const maxWidth = containerWidth - attrEl.offsetWidth - 15;
        const currentWidth = nameEl.scrollWidth;

        if (currentWidth > maxWidth) {
            nameEl.style.display = 'inline-block';
            nameEl.style.transform = `scaleX(${maxWidth / currentWidth})`;
            nameEl.style.transformOrigin = 'left center';
        } else {
            nameEl.style.transform = 'none';
        }
    });
}

/** 召喚先選択モードの開始 */
function startSlotSelection(cardData) {
    document.getElementById('floating-action-container').innerHTML = "";
    document.getElementById('field-surface').classList.add('selecting-mode');
    document.getElementById('game-viewport').classList.add('field-selecting');
    GAME_STATE.isSelectingSlot = true;
    GAME_STATE.pendingCard = cardData;

    // フィールドからリリースする枠は「空き地」として扱う（手札コストは枠を空けない）
    const costIndices = GAME_STATE.selectedCosts
        .filter(c => c.from === "field")
        .map(c => c.slotIdx);

    // モンスターゾーンを光らせる
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-monster-${i}`);
        // 「元々空」または「コストでいなくなる」場所をハイライト
        if (GAME_STATE.player.field.monsters[i] === null || costIndices.includes(i)) {
            zone.classList.add('highlight');
        }
    });
}

async function finishSlotSelection(slotIdx) {
    if (!GAME_STATE.pendingCard) return;

    const card = GAME_STATE.pendingCard;
    const costs = GAME_STATE.selectedCosts.slice();

    // 二重実行を防ぐため、解決前に選択状態を畳む
    GAME_STATE.selectedCosts = [];
    cancelSlotSelection();

    await executeSummon("player", card, slotIdx, costs);
}

function cancelSlotSelection() {
    document.getElementById('field-surface').classList.remove('selecting-mode');
    document.getElementById('game-viewport').classList.remove('field-selecting');
    GAME_STATE.isSelectingSlot = false;
    GAME_STATE.pendingCard = null;
    GAME_STATE.selectedCosts = [];

    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-monster-${i}`);
        zone.classList.remove('highlight', 'cost-highlight', 'cost-selected');
    });
}

function hideCardDetail() {
    // コスト選択中のガイドバーは閉じない（背景タップで消えてしまうのを防ぐ）
    if (GAME_STATE.isSelectingCost) return;

    document.getElementById('floating-action-container').innerHTML = "";
    // 全ての手札の選択状態（浮き上がり）を解除
    const handCards = document.querySelectorAll('#player-hand .card-mini');
    handCards.forEach(c => c.classList.remove('selected'));
}

/** 攻撃対象選択モードの開始 */
function startAttackTargetSelection(attackerCard, attackerSlotIdx) {
    document.getElementById('floating-action-container').innerHTML = "";
    document.getElementById('game-viewport').classList.add('field-selecting');
    GAME_STATE.isSelectingTarget = true;
    GAME_STATE.attackerPending = { card: attackerCard, slotIdx: attackerSlotIdx };

    // 相手モンスターがいるスロットを光らせる
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`opt-monster-${i}`);
        if (GAME_STATE.opponent.field.monsters[i] !== null) {
            zone.classList.add('highlight');
        }
    });
}

function finishAttackTargetSelection(targetSlotIdx) {
    if (!GAME_STATE.attackerPending) return;
    const { card, slotIdx } = GAME_STATE.attackerPending;
    const targetMonster = GAME_STATE.opponent.field.monsters[targetSlotIdx];

    resolveBattle(card, targetMonster, slotIdx, targetSlotIdx);
    cancelAttackTargetSelection();
}

function cancelAttackTargetSelection() {
    document.getElementById('game-viewport').classList.remove('field-selecting');
    GAME_STATE.isSelectingTarget = false;
    GAME_STATE.attackerPending = null;
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`opt-monster-${i}`);
        zone.classList.remove('highlight');
    });
    hideCardDetail();
}

/**
 * デッキとトラッシュの視覚的更新（厚みと一番上のカード）
 */
function updateZoneVisuals(side, type) {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    const prefix = (side === "player") ? "player" : "opponent";
    const zoneId = `${prefix}-${type}-zone`;
    const zoneEl = document.getElementById(zoneId);
    if (!zoneEl) return;

    const pile = (type === "deck") ? p.deck : (type === "trash") ? p.trash : p.banished;
    const count = pile.length;

    // 追加: トラッシュ・除外タップイベントの視覚制御
    if (type === "trash" || type === "banish") {
        zoneEl.style.cursor = count > 0 ? "pointer" : "default";
        // 判定を確実にするため、z-indexを動的に確保
        zoneEl.style.zIndex = "100";
    }

    // 1. 厚みクラスの更新
    zoneEl.classList.remove('stack-stage-1', 'stack-stage-2', 'stack-stage-3');
    if (count > 0) {
        if (count >= 14) zoneEl.classList.add('stack-stage-3');
        else if (count >= 7) zoneEl.classList.add('stack-stage-2');
        else zoneEl.classList.add('stack-stage-1');
    }

    // 2. カード描画の更新
    let cardEl = zoneEl.querySelector('.card-mini');
    if (count === 0) {
        if (cardEl) cardEl.remove();
    } else {
        // カードが必要だが存在しない場合は新規作成
        if (!cardEl) {
            cardEl = document.createElement('div');
            zoneEl.appendChild(cardEl);
        }

        if (type === "deck") {
            cardEl.className = 'card-mini card-back';
            cardEl.innerHTML = ''; // デッキは背面画像のみを表示
        } else {
            const topCard = pile.at(-1);
            // 既存の createCardElement を流用して最新のカードを表向きで表示
            const newCard = createCardElement(topCard, `${side}-${type}`);
            zoneEl.replaceChild(newCard, cardEl);
        }
    }

    // 3. 枚数表示の更新（Deck / Trash / Banish）
    const badgeIds = {
        deck: { player: 'ply-deck-count-badge', opponent: 'opt-deck-count' },
        trash: { player: 'ply-trash-count-badge', opponent: 'opt-trash-count-badge' },
        banish: { player: 'ply-banish-count-badge', opponent: 'opt-banish-count-badge' }
    };
    const badgeId = badgeIds[type][side];

    const badge = document.getElementById(badgeId);
    if (badge) {
        badge.innerText = count;
        // 0枚の時はバッジを隠す、あるいは薄くする演出
        badge.style.opacity = count > 0 ? "1" : "0";
    }
}

/**
 * モーダルを閉じて実際にデュエルを開始する
 */
async function beginDuel() {
    const overlay = document.getElementById('game-start-overlay');
    overlay.style.display = "none";

    // 初期手札の配布が終わってからターンを開始する
    // (await しないとドロー演出とターン開始処理が競合し isAnimating が壊れる)
    await drawCard("player", 6);
    await drawCard("opponent", 6);
    updateUI();
    startTurnProcess();
}

/** コストフィルタに合致するか */
function matchesCostFilter(card, filter) {
    if (!card || card.type !== "monster") return false;
    if (!filter) return true;
    if (filter.minLevel && card.level < filter.minLevel) return false;
    if (filter.maxLevel && card.level > filter.maxLevel) return false;
    if (filter.attribute && card.attribute !== filter.attribute) return false;
    if (filter.category && (!card.categories || !card.categories.includes(filter.category))) return false;
    return true;
}

/** 召喚コスト対象の取得（自分フィールド） */
function getValidCosterMonsters(filter) {
    return GAME_STATE.player.field.monsters
        .map((m, i) => ({ card: m, slotIdx: i, from: "field" }))
        .filter(obj => matchesCostFilter(obj.card, filter));
}

/** 召喚コスト対象の取得（自分の手札 / 支払うと除外される） */
function getValidHandCosters(filter, excludeCard = null) {
    return GAME_STATE.player.hand
        .map((c, i) => ({ card: c, handIdx: i, from: "hand" }))
        .filter(obj => obj.card !== excludeCard && matchesCostFilter(obj.card, filter));
}

/** 選択済みコストに含まれるか（オブジェクト同一性で判定） */
function isCostSelected(card) {
    return GAME_STATE.selectedCosts.some(c => c.card === card);
}

/** コスト選択モードの開始 */
function startCostSelection(cardData) {
    hideCardDetail();
    document.getElementById('field-surface').classList.add('selecting-mode');
    document.getElementById('game-viewport').classList.add('field-selecting', 'cost-selecting');
    GAME_STATE.isSelectingCost = true;
    GAME_STATE.pendingCard = cardData;
    GAME_STATE.selectedCosts = [];

    const filter = cardData.summonRequirement.costFilter;
    getValidCosterMonsters(filter).forEach(obj => {
        document.getElementById(`ply-monster-${obj.slotIdx}`).classList.add('cost-highlight');
    });

    renderHand(); // 手札側のコスト候補ハイライトを反映
    renderCostSelectionBar();
}

/** コスト選択中のガイド＆確定バーを描画 */
function renderCostSelectionBar() {
    const container = document.getElementById('floating-action-container');
    container.innerHTML = "";
    if (!GAME_STATE.isSelectingCost || !GAME_STATE.pendingCard) return;

    const req = GAME_STATE.pendingCard.summonRequirement;
    const selected = GAME_STATE.selectedCosts;
    const fieldPicks = selected.filter(c => c.from === "field").length;
    const handPicks = selected.filter(c => c.from === "hand").length;
    const emptySlots = GAME_STATE.player.field.monsters.filter(m => m === null).length;

    const enough = selected.length === req.costCount;
    const hasRoom = (emptySlots + fieldPicks) >= 1;

    const bar = document.createElement('div');
    bar.className = 'cost-select-bar';

    const info = document.createElement('div');
    info.className = 'cost-select-info';
    info.innerHTML = `<strong>${GAME_STATE.pendingCard.name}</strong> の召喚コスト
        <span class="cost-progress">${selected.length} / ${req.costCount}</span>
        <span class="cost-hint">場のモンスターはトラッシュへ / 手札のモンスターは除外されます${handPicks > 0 ? `（除外 ${handPicks}枚）` : ""}</span>
        ${enough && !hasRoom ? `<span class="cost-warn">場に置き場所がありません。フィールドから1体以上リリースしてください</span>` : ""}`;

    const btns = document.createElement('div');
    btns.className = 'cost-select-buttons';

    const okBtn = document.createElement('button');
    okBtn.className = 'btn-action-float';
    okBtn.innerText = "確定";
    okBtn.disabled = !(enough && hasRoom);
    okBtn.onclick = (e) => { e.stopPropagation(); proceedToSlotSelectionFromCost(); };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-action-float cancel';
    cancelBtn.innerText = "やめる";
    cancelBtn.onclick = (e) => { e.stopPropagation(); cancelCostSelection(); };

    btns.appendChild(cancelBtn);
    btns.appendChild(okBtn);
    bar.appendChild(info);
    bar.appendChild(btns);
    container.appendChild(bar);
}

function toggleCostSelection(costObj) {
    if (!GAME_STATE.isSelectingCost) return;

    const idx = GAME_STATE.selectedCosts.findIndex(c => c.card === costObj.card);
    const req = GAME_STATE.pendingCard.summonRequirement;

    if (idx > -1) {
        GAME_STATE.selectedCosts.splice(idx, 1);
    } else {
        // 必要数を超える選択は受け付けない（選び直しは解除してから）
        if (GAME_STATE.selectedCosts.length >= req.costCount) return;
        GAME_STATE.selectedCosts.push(costObj);
    }

    // フィールド側の見た目を更新
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-monster-${i}`);
        const card = GAME_STATE.player.field.monsters[i];
        zone.classList.toggle('cost-selected', !!card && isCostSelected(card));
    });

    renderHand();
    renderCostSelectionBar();
}

function proceedToSlotSelectionFromCost() {
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-monster-${i}`);
        zone.classList.remove('cost-highlight', 'cost-selected');
        zone.onclick = null;
    });
    GAME_STATE.isSelectingCost = false;
    document.getElementById('game-viewport').classList.remove('cost-selecting');
    document.getElementById('floating-action-container').innerHTML = "";
    renderHand();
    startSlotSelection(GAME_STATE.pendingCard);
}

function cancelCostSelection() {
    GAME_STATE.isSelectingCost = false;
    document.getElementById('game-viewport').classList.remove('cost-selecting');
    document.getElementById('floating-action-container').innerHTML = "";
    cancelSlotSelection();
    renderHand();
}

/** 対象選択中の案内テキストを表示／消去する */
function showSelectionPrompt(text) {
    const el = document.getElementById('selection-prompt');
    if (!el) return;
    if (!text) {
        el.classList.remove('active');
        el.innerHTML = "";
        return;
    }
    el.innerHTML = `<span>${text}</span><small>背景をタップでキャンセル</small>`;
    el.classList.add('active');
}

/**
 * 汎用ターゲット選択Promise
 * @param {Array<number>} validSlots - 選択を許可するスロット番号（効果のフィルタ適用済み）
 * @param {string} promptText - プレイヤーへの案内文
 * @returns {Promise<number|null>} 選ばれたスロット番号。キャンセル時は null
 */
async function selectTargetUI(side, type, validSlots = null, promptText = "対象を選択してください") {
    const zoneList = GAME_STATE[side].field[type + "s"];

    // 対象指定がない場合は「そのゾーンにあるカードすべて」を候補とする
    let candidates = validSlots;
    if (!Array.isArray(candidates)) {
        candidates = zoneList.map((card, i) => (card ? i : null)).filter(i => i !== null);
    }
    candidates = candidates.filter(i => zoneList[i]);

    if (candidates.length === 0) return null;

    // 相手ターン（CPU）または非ターンプレイヤーが選択する場合はランダム
    if (GAME_STATE.turnPlayer !== "player") {
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    return new Promise((resolve) => {
        const prefix = (side === "player") ? "ply" : "opt";
        document.getElementById('field-surface').classList.add('selecting-mode');
        document.getElementById('game-viewport').classList.add('field-selecting');
        showSelectionPrompt(promptText);

        const zones = [0, 1, 2].map(i => document.getElementById(`${prefix}-${type}-${i}`));
        let resolved = false;

        candidates.forEach(i => {
            const zone = zones[i];
            if (!zone) return;
            zone.classList.add('highlight');
            // ゾーンとカード本体、どちらのクリックも拾えるようにする（速い経路）
            const selectHandler = (e) => {
                e.stopPropagation();
                cleanup(i);
            };
            zone.onclick = selectHandler;
            const cardEl = zone.querySelector('.card-mini');
            if (cardEl) cardEl.onclick = selectHandler;
        });

        // フィールドは3D変形しており、DOMのヒットテストが親要素に吸われてゾーンの
        // onclick が発火しないことがある。他の選択モードと同じ幾何判定で拾う。
        const handleClick = (e) => {
            const hit = detectHitSlot(e, `${prefix}-${type}`, 3, true);
            if (hit !== -1 && candidates.includes(hit)) {
                e.stopPropagation();
                cleanup(hit);
                return;
            }
            // 誤タップでいきなり不発にならないよう、明示的な背景タップのみキャンセル扱いにする
            if (checkGlobalCancel(e)) cleanup(null);
        };
        setTimeout(() => { document.addEventListener('click', handleClick, true); }, 10);

        function cleanup(result) {
            if (resolved) return;
            resolved = true;
            document.removeEventListener('click', handleClick, true);
            zones.forEach(z => {
                if (!z) return;
                z.classList.remove('highlight');
                z.onclick = null;
            });
            document.getElementById('field-surface').classList.remove('selecting-mode');
            document.getElementById('game-viewport').classList.remove('field-selecting');
            showSelectionPrompt(null);
            resolve(result);
        }
    });
}

/**
 * トラッシュ閲覧モーダルを開く
 * @param {string} side - "player" | "opponent"
 */
function openTrashViewer(side) {
    openCardPileViewer(side, "trash");
}

/**
 * 除外ゾーン閲覧モーダルを開く
 * 除外されたカードはゲーム中に復帰しないが、何を切ったかは確認できるようにする
 */
function openBanishViewer(side) {
    openCardPileViewer(side, "banish");
}

/**
 * カードの山（トラッシュ／除外）を一覧表示する
 * @param {string} side - "player" | "opponent"
 * @param {string} pileType - "trash" | "banish"
 */
function openCardPileViewer(side, pileType) {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    const pile = (pileType === "trash") ? p.trash : p.banished;
    if (pile.length === 0) return;

    const modal = document.getElementById('trash-viewer-modal');
    const title = document.getElementById('trash-viewer-title');
    const list = document.getElementById('trash-card-list');

    const owner = (side === "player") ? "自分" : "相手";
    const label = (pileType === "trash") ? "トラッシュ" : "除外ゾーン";
    title.innerText = `${owner}の${label} (${pile.length}枚)`;
    list.innerHTML = "";

    // 詳細パネルでバフ込みの数値を出さないよう、素の情報として表示する
    pile.forEach(card => {
        const el = createCardElement(card, "preview");
        el.onclick = (e) => {
            e.stopPropagation();
            updateInfoPanel(card, "preview");
        };
        list.appendChild(el);
    });

    modal.style.display = "flex";

    setTimeout(() => {
        list.scrollLeft = list.scrollWidth;
    }, 10);
}

/**
 * トラッシュ閲覧モーダルを閉じる
 */
function closeTrashViewer() {
    const modal = document.getElementById('trash-viewer-modal');
    if (modal) modal.style.display = "none";
}

/**
 * モーダルを使用して手札からカードを選択させる
 * @param {number} count - 選択が必要な枚数
 */
async function selectHandCardsUI(count) {
    return new Promise((resolve) => {
        const modal = document.getElementById('selection-modal');
        const list = document.getElementById('selection-card-list');
        const btn = document.getElementById('selection-confirm-btn');
        const countBadge = document.getElementById('selection-needed-count');
        const selectedIndices = [];

        list.innerHTML = "";
        modal.style.display = "flex";
        countBadge.innerText = count;

        // 手札をクローンしてモーダルに表示
        GAME_STATE.player.hand.forEach((card, idx) => {
            const el = createCardElement(card, "selection-preview");
            el.onclick = () => {
                // 詳細パネルを更新
                updateInfoPanel(card, "selection-preview");

                const sIdx = selectedIndices.indexOf(idx);
                if (sIdx > -1) {
                    selectedIndices.splice(sIdx, 1);
                    el.classList.remove('selected');
                } else if (selectedIndices.length < count) {
                    selectedIndices.push(idx);
                    el.classList.add('selected');
                }

                // ボタン状態の更新
                const remaining = count - selectedIndices.length;
                countBadge.innerText = Math.max(0, remaining);
                if (remaining === 0) {
                    btn.classList.remove('disabled');
                    btn.classList.add('active');
                } else {
                    btn.classList.add('disabled');
                    btn.classList.remove('active');
                }
            };
            list.appendChild(el);
        });

        btn.onclick = () => {
            if (selectedIndices.length === count) {
                modal.style.display = "none";
                resolve(selectedIndices);
            }
        };
    });
}

/**
 * エンドフェイズの開始処理（手札制限チェック）
 */
async function startEndPhaseProcess() {
    if (GAME_STATE.isGameOver) return;
    console.log(`End Phase started for ${GAME_STATE.turnPlayer}`);

    if (GAME_STATE.turnPlayer === "player") {
        const hand = GAME_STATE.player.hand;
        if (hand.length > 10) {
            const discardCount = hand.length - 10;
            // すでに main.js に実装されている selectHandCardsUI を利用
            const targetIndices = await selectHandCardsUI(discardCount);

            // 選択されたカードをトラッシュへ（インデックスのズレを防ぐため降順で処理）
            const discarded = targetIndices.sort((a, b) => b - a).map(idx => hand.splice(idx, 1)[0]);
            for (const card of discarded) {
                sendCardToTrash("player", card);
                await EffectLogic.notifyCardSentToTrash(card, "player");
            }

            updateUI();
            console.log(`Player discarded ${discardCount} cards to meet limit.`);
        }
        // 少し余韻を置いてからターン終了
        setTimeout(endTurn, 500);
    } else {
        // CPUの場合は cpu_logic.js の既存ロジックを呼び出す
        if (typeof handleCpuEndPhase === "function") {
            handleCpuEndPhase();
        } else {
            endTurn();
        }
    }
}

/**
 * 汎用確認モーダルを表示 (Promiseベース)
 * @param {string} message - 表示するメッセージ
 * @returns {Promise<boolean>} - はい: true, いいえ: false
 */
window.showCustomConfirm = function (message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('common-confirm-modal');
        const msgEl = document.getElementById('common-confirm-message');
        const btnOk = document.getElementById('common-confirm-ok');
        const btnCancel = document.getElementById('common-confirm-cancel');

        if (!modal || !msgEl || !btnOk || !btnCancel) {
            console.error("Confirm modal elements missing.");
            // エラー時は安全側に倒してfalse、または緊急用alertを出すなど検討
            resolve(false);
            return;
        }

        msgEl.innerText = message;
        modal.style.display = 'flex';

        // ハンドラ定義 (一度実行したらクリーンアップ)
        const cleanup = (result) => {
            modal.style.display = 'none';
            resolve(result);
        };

        // { once: true } で自動的にリスナー解除されるが、
        // キャンセル時にOKボタンのリスナーが残る(逆も然り)のを防ぐため、
        // クローン要素への置換でリスナーを一掃するのが最も安全かつ手軽
        const newBtnOk = btnOk.cloneNode(true);
        const newBtnCancel = btnCancel.cloneNode(true);

        btnOk.parentNode.replaceChild(newBtnOk, btnOk);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

        newBtnOk.addEventListener('click', () => cleanup(true));
        newBtnCancel.addEventListener('click', () => cleanup(false));
    });
};

// グローバルクリックハンドラの登録 (初期化時)
setTimeout(() => {
    document.addEventListener('click', handleGlobalInteract);
    console.log("Global Interaction Handler Attached.");
}, 100);