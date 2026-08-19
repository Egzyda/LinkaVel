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
    turnSerial: 1,          // 手番の通し番号（罠の「伏せたターンは発動不可」判定用）
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
    delete card._isSet;
    delete card._setTurnSerial;
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
const DESIGN_HEIGHT = 720;

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
    _pendingPlayerDeck = null;
    showScreen('deck-select-screen');
    renderDeckSelection("player");
}

/**
 * デッキ選択の進行状態。
 * 自分のデッキを選んだあと、続けて相手のデッキを選ばせる。
 */
let _pendingPlayerDeck = null;

/**
 * デッキ選択リストを動的に生成 (デュエル開始用)
 * @param {"player"|"opponent"} target どちらのデッキを選んでいるか
 */
async function renderDeckSelection(target = "player") {
    const container = document.getElementById('deck-list-container');
    const title = document.getElementById('deck-select-title');
    const subtitle = document.getElementById('deck-select-subtitle');
    container.innerHTML = "<div style='color:#fff;text-align:center;'>Loading...</div>";

    const isOpponent = (target === "opponent");
    if (title) title.innerText = isOpponent ? "Opponent Deck" : "Deck Select";
    if (subtitle) {
        subtitle.innerText = isOpponent
            ? "相手が使うデッキを選択してください"
            : "使用するデッキを選択してください";
    }

    let html = "";

    // 相手デッキ選択のときは、まずランダムを選べるようにする
    if (isOpponent) {
        html += `
            <button class="menu-btn custom-deck-item" onclick="selectOpponentDeck('random', 'random')">
                <span class="btn-text">おまかせ（ランダム） <small class="deck-manage-tag starter">RANDOM</small></span>
            </button>
            <hr style="border:0; border-top:1px solid #333; margin:10px 0; width:100%;">
        `;
    }

    // 1. ユーザーデッキ (Firestore) を先に、更新が新しい順で出す。
    //    自作デッキのほうが使う頻度が高いので、スクロールせずに選べるようにする。
    if (typeof DeckBuilder !== 'undefined') {
        await ensureAuth();
        const userDecks = await DeckBuilder.fetchUserDecks();
        userDecks.forEach(deck => {
            html += createDeckItemHtml(deck.id, deck.name, "user", true, target);
        });
    }

    // 2. あらかじめ用意されたデッキ
    Object.keys(DECK_RECIPES).forEach(key => {
        const recipe = DECK_RECIPES[key];
        html += createDeckItemHtml(key, recipe.name, "starter", true, target);
    });

    container.innerHTML = html;
    container.scrollTop = 0;
}

/** 自分のデッキを選んだあと、相手のデッキ選択へ進む */
function selectPlayerDeck(deckId, type) {
    _pendingPlayerDeck = { deckId, type };
    renderDeckSelection("opponent");
}

/** 相手のデッキが決まったらデュエル開始 */
function selectOpponentDeck(deckId, type) {
    if (!_pendingPlayerDeck) return;
    const mine = _pendingPlayerDeck;
    _pendingPlayerDeck = null;
    confirmDeckSelection(mine.deckId, mine.type, deckId, type);
}

/** デッキ選択画面のBACK。相手デッキ選択中なら自分のデッキ選択へ戻る */
function backFromDeckSelect() {
    if (_pendingPlayerDeck) {
        _pendingPlayerDeck = null;
        renderDeckSelection("player");
        return;
    }
    backToMenu();
}

/**
 * デッキ管理画面の描画 (編集・削除・コピー)
 */
async function renderDeckManager() {
    const container = document.getElementById('deck-list-container');
    container.innerHTML = "<div style='color:#fff;text-align:center;'>Loading...</div>";

    // デュエル用のデッキ選択と画面を共用しているので、見出しを管理用に戻す
    _pendingPlayerDeck = null;
    const title = document.getElementById('deck-select-title');
    const subtitle = document.getElementById('deck-select-subtitle');
    if (title) title.innerText = "Deck Build";
    if (subtitle) subtitle.innerText = "デッキを作成・編集できます";

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

function createDeckItemHtml(id, name, type, isDuelMode, target = "player") {
    const tagClass = type === 'starter' ? 'starter' : 'user';
    const tagName = type === 'starter' ? 'STARTER' : 'USER';

    if (isDuelMode) {
        // デュエル開始モード: シンプルなボタン
        const handler = (target === "opponent") ? "selectOpponentDeck" : "selectPlayerDeck";
        return `
            <button class="menu-btn custom-deck-item" onclick="${handler}('${id}', '${type}')">
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
async function confirmDeckSelection(deckId, type, oppDeckId = "random", oppType = "random") {
    // 前回の対戦結果（LP・決着フラグ等）を確実に初期化してから組み直す
    resetGameState();

    // プレイヤーのデッキを初期化
    await initDeck("player", deckId, type);

    // 相手のデッキ。指定がなければスターターからランダムに決める
    if (oppType === "random" || !oppDeckId) {
        const allKeys = Object.keys(DECK_RECIPES);
        const randomKey = allKeys[Math.floor(Math.random() * allKeys.length)];
        await initDeck("opponent", randomKey, "starter");
    } else {
        await initDeck("opponent", oppDeckId, oppType);
    }

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
    GAME_STATE.turnSerial = 1;
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
    _renderedHandCards = [];
    document.getElementById('opponent-hand').innerHTML = "";
    _renderedOppHandCount = -1;
    _pendingLpDisplay.player = null;
    _pendingLpDisplay.opponent = null;
    clearToastMessage();

    // 前の対戦で見ていたカードが残らないよう、詳細パネルも初期状態に戻す
    clearInfoPanel();

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

    // HUDも初期値に描き直す。
    // ここで更新しないと、次の対戦が始まるまで前の対戦のLPが表示に残る。
    updateUI();
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
        setTimeout(() => { if (GAME_STATE.phase === "DRAW") advancePhase(); }, 400);
    } else {
        drawCard(GAME_STATE.turnPlayer, 1);
        updateUI();

        // プレイヤー・CPU問わずドロー後は自動でMAIN1へ進行
        // ドロー演出が見える程度には待つ
        setTimeout(() => { if (GAME_STATE.phase === "DRAW") advancePhase(); }, 700);

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
        setTimeout(executeCpuTurn, 350);
    }
}

function endTurn() {
    if (GAME_STATE.isGameOver) return;

    // ターン交代
    GAME_STATE.turnPlayer = (GAME_STATE.turnPlayer === "player") ? "opponent" : "player";
    GAME_STATE.turnSerial++;

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

        // 飛び先の座標は描画直後にまとめて確定させる。
        // 演出の途中で手札を作り直すと座標がぶれるうえ、
        // 遅れて始まるアニメーションが参照する要素が差し替わってしまう。
        const targetRects = drawQueue.map(card => {
            const el = findHandCardElement(p, card);
            return el ? el.getBoundingClientRect() : null;
        });

        const animPromises = drawQueue.map(async (card, idx) => {
            await new Promise(r => setTimeout(r, idx * 80));
            await animateDrawCard(card, targetRects[idx], idx);

            // 着地したカードだけを表に出す。
            // ここで renderHand() をすると手札全体が作り直され、
            // カードが左右に揺れて見えるため、対象1枚のクラスだけ外す。
            delete card.isNew;
            const el = findHandCardElement(p, card);
            if (el) el.classList.remove('entering');
        });
        await Promise.all(animPromises);
        GAME_STATE.isAnimating = false;
    }

    updateUI();
}

/**
 * 手札のDOM要素を「手札内の位置」で特定する。
 * 同名カードを3枚積めるゲームなので、カードIDで探すと別の1枚に当たってしまう。
 */
function findHandCardElement(playerState, card) {
    const handIdx = playerState.hand.indexOf(card);
    if (handIdx === -1) return null;
    return document.querySelector(`#player-hand .card-mini[data-hand-index="${handIdx}"]`);
}

/**
 * ドロー演出：デッキから手札へ
 */
function animateDrawCard(cardData, targetRect, sequenceIdx = 0) {
    return new Promise(resolve => {
        const deckEl = document.getElementById('player-deck-zone');

        if (!targetRect || !deckEl) {
            resolve();
            return;
        }

        const startRect = deckEl.getBoundingClientRect();

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
    //    先に描画しておかないと、召喚時効果の演出のほうがカードより先に見えてしまう
    //    順序は 召喚演出 → 効果発動 → 効果演出
    p.field.monsters[slotIndex] = cardData;
    if (side === "player") hideCardDetail();
    updateUI();
    await playSummonEffect(side, slotIndex);

    // 4. トラッシュ送り時および召喚成功時の効果解決
    //    （除外したカードはここに含まれない＝墓地誘発は発動しない）
    for (const cCard of trashedCosts) {
        await EffectLogic.notifyCardSentToTrash(cCard, side);
    }
    await EffectLogic.resolveEffects(cardData, side, "on_summon");

    // 「相手がモンスターを召喚した時」に反応する罠の判定
    await EffectLogic.notifySummon(side, [cardData]);

    // フラグ更新
    if (side === GAME_STATE.turnPlayer) {
        GAME_STATE.hasNormalSummoned = true;
    }

    // 効果解決後の盤面を反映（詳細パネルは配置時に閉じている）
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
    // 罠魔術は伏せてからでないと発動できない
    if (cardData.subType === "trap") return false;
    const hasSpace = GAME_STATE.player.field.magics.some(m => m === null);
    if (!hasSpace) return false;
    return EffectLogic.isEffectActivatable(cardData, "player", "on_activate");
}

/** 魔術をセット（裏側で設置）できるか判定 */
function checkCanSetMagic(cardData) {
    if (GAME_STATE.isGameOver) return false;
    if (GAME_STATE.phase !== "MAIN1" && GAME_STATE.phase !== "MAIN2") return false;
    if (!cardData || cardData.type !== "magic") return false;
    return GAME_STATE.player.field.magics.some(m => m === null);
}

/** 魔術発動試行 */
function tryActivateMagic(cardData) {
    if (!checkCanActivateMagic(cardData)) return;
    startMagicSlotSelection(cardData, false);
}

/** 魔術セット試行（罠に限らず、通常・永続もブラフとして伏せられる） */
function trySetMagic(cardData) {
    if (!checkCanSetMagic(cardData)) return;
    startMagicSlotSelection(cardData, true);
}

/**
 * 伏せてある自分の魔術を表向きにして発動する
 * 罠魔術は条件成立時に自動で発動するため、ここでは扱わない
 */
async function activateSetMagic(slotIdx) {
    const p = GAME_STATE.player;
    const card = p.field.magics[slotIdx];

    if (!card || !card._isSet) return;
    if (card.subType === "trap") return; // 罠魔術のみ伏せたターンは発動できない
    if (!EffectLogic.isEffectActivatable(card, "player", "on_activate")) return;

    hideCardDetail();
    card._isSet = false;
    renderFieldCard("player", "magic", slotIdx, card);

    await EffectLogic.resolveEffects(card, "player", "on_activate");

    if (card.subType === "normal") {
        setTimeout(() => {
            if (p.field.magics[slotIdx] !== card) return;
            p.field.magics[slotIdx] = null;
            renderFieldCard("player", "magic", slotIdx, null);
            sendCardToTrash("player", card);
            updateUI();
        }, 500);
    } else {
        updateUI();
    }

    console.log(`Set Magic Activated: ${card.name}`);
}

/** 魔術発動・セット先の選択開始 */
function startMagicSlotSelection(cardData, asSet = false) {
    document.getElementById('floating-action-container').innerHTML = "";
    document.getElementById('field-surface').classList.add('selecting-mode');
    document.getElementById('game-viewport').classList.add('field-selecting');
    GAME_STATE.isSelectingSlot = true;
    GAME_STATE.pendingCard = cardData;
    GAME_STATE.pendingSetMode = asSet;
    showSelectionPrompt(asSet ? "カードを伏せる場所を選択してください" : "魔術を置く場所を選択してください");

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
            // 同じカードをもう一度タップしたら選択解除
            if (handCard.classList.contains('selected')) {
                hideCardDetail();
                return;
            }
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
    const asSet = GAME_STATE.pendingSetMode;
    const p = GAME_STATE.player;

    // 効果解決（await）の前に選択モードを完全に終了させる
    cancelMagicSlotSelection();

    // 1. 手札から削除（同名カードを取り違えないようオブジェクト同一性で検索）
    const handIndex = p.hand.indexOf(cardData);
    if (handIndex !== -1) p.hand.splice(handIndex, 1);

    // セットの場合は裏側で置くだけ。効果は解決しない。
    if (asSet) {
        cardData._isSet = true;
        cardData._setTurnSerial = GAME_STATE.turnSerial;
        p.field.magics[slotIdx] = cardData;
        renderFieldCard("player", "magic", slotIdx, cardData);
        updateUI();
        console.log(`Magic Set: ${cardData.name}`);
        return;
    }

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
    showSelectionPrompt(null);
    GAME_STATE.isSelectingSlot = false;
    GAME_STATE.pendingCard = null;
    GAME_STATE.pendingSetMode = false;

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

    // 攻撃宣言時の罠を先に解決する（弱体化・強化・攻撃モンスターの破壊など）
    const aborted = await EffectLogic.notifyAttackDeclared(
        attackerSide, attacker, atkIdx, defender, defIdx);

    if (aborted) {
        console.log("Battle cancelled by trap effect.");
        GAME_STATE.isAnimating = false;
        updateUI();
        return;
    }

    // 誰が誰を攻撃したのかを矢印とトーストで示す
    showToastMessage(
        defender ? `${attacker.name} → ${defender.name}` : `${attacker.name} のダイレクトアタック`,
        attackerSide);
    await showAttackArrow(attackerSide, atkIdx, defenderSide, defIdx);

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

            // 戦闘で相手モンスターを破壊した時の誘発（炎界の砲手 等）
            if (GAME_STATE[attackerSide].field.monsters[atkIdx] === attacker) {
                await EffectLogic.resolveEffects(attacker, attackerSide, "on_battle_destroy");
            }
        } else if (pAtk === pDef) {
            await Promise.all([
                destroyMonster(attackerSide, atkIdx, "battle"),
                destroyMonster(defenderSide, defIdx, "battle")
            ]);
        } else {
            const damage = pDef - pAtk;
            damagePlayer(attackerSide, damage);
            await destroyMonster(attackerSide, atkIdx, "battle");

            // 返り討ちにした防御側も「戦闘で相手モンスターを破壊した」に当たる
            if (GAME_STATE[defenderSide].field.monsters[defIdx] === defender) {
                await EffectLogic.resolveEffects(defender, defenderSide, "on_battle_destroy");
            }
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

    showDamageNumber(side, finalDamage);
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

        // 破壊演出を見せてから盤面から取り除く。
        // 先に消すと、いきなりトラッシュへ飛んだように見えて何が起きたか分からない。
        showToastMessage(`${card.name} が破壊された`, side);
        await playDestroyEffect(side, slotIdx);

        p.field.monsters[slotIdx] = null;
        sendCardToTrash(side, card);

        // UIクリア
        const prefix = (side === "player") ? "ply" : "opt";
        const el = document.getElementById(`${prefix}-monster-${slotIdx}`);
        if (el) el.innerHTML = "";

        // トラッシュ送りに伴う誘発（自身の on_sent_to_trash と、他カードの on_other_sent_to_trash）
        await EffectLogic.notifyCardSentToTrash(card, side);

        // 「自分のモンスターが破壊された時」に反応する罠の判定
        await EffectLogic.notifyMonsterDestroyed(side, card);
    }
}

// ==========================================
// 7. UI描画 (Rendering)
// ==========================================

function updateUI() {
    renderLpDisplay();
    document.getElementById('opt-hand-hud').innerText = GAME_STATE.opponent.hand.length;
    renderOpponentHand();
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

// 直前に描画した手札の顔ぶれ。同じなら作り直さないための記録。
let _renderedHandCards = [];

/** 手札カード1枚に、現在の状態に応じたクラスを反映する */
function applyHandCardState(el, card, costFilter) {
    el.classList.toggle('entering', !!card.isNew);

    const inCostMode = GAME_STATE.isSelectingCost && card !== GAME_STATE.pendingCard;
    el.classList.toggle('cost-highlight', inCostMode && matchesCostFilter(card, costFilter));
    el.classList.toggle('cost-selected', inCostMode && isCostSelected(card));
}

function renderHand() {
    const container = document.getElementById('player-hand');
    const hand = GAME_STATE.player.hand;

    const costFilter = (GAME_STATE.isSelectingCost && GAME_STATE.pendingCard)
        ? (GAME_STATE.pendingCard.summonRequirement || {}).costFilter
        : null;

    // 顔ぶれが変わっていなければ、DOMは作り直さずクラスだけ更新する。
    // updateUI() は効果解決のたびに呼ばれるので、毎回 <img> ごと作り直すと
    // 画像の再デコードで手札全体が一瞬暗くなってちらつく。
    const sameHand = _renderedHandCards.length === hand.length
        && _renderedHandCards.every((c, i) => c === hand[i])
        && container.children.length === hand.length;

    if (sameHand) {
        hand.forEach((card, idx) => {
            applyHandCardState(container.children[idx], card, costFilter);
        });
        return;
    }

    // 新しく手札に加わったカードを検出する。
    // ドロー(drawCard)は自前で isNew を立てて飛来演出をつけるので対象外。
    // サーチ・回収など、飛来演出を持たずに直接手札へ入る効果は、
    // ここで拾って「その場でふわっとフェードイン」させないと、
    // 画像未読み込みのまま一瞬で出現してチラつく。
    const previousCards = _renderedHandCards;
    const newlyAdded = hand.filter(c => !previousCards.includes(c) && !c.isNew);
    newlyAdded.forEach(c => { c.isNew = true; });

    container.innerHTML = "";
    _renderedHandCards = hand.slice();

    if (hand.length === 0) return;

    const cardToElement = new Map();
    const elements = hand.map((card, idx) => {
        const el = createCardElement(card, "hand");
        el.dataset.handIndex = idx; // 同名カードを位置で識別する
        el.style.zIndex = idx;
        applyHandCardState(el, card, costFilter);
        container.appendChild(el);
        cardToElement.set(card, el);
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

    // entering(opacity:0) で一度描画してから、次のペイント後にクラスを外して
    // CSSトランジション(0.3s)でフェードインさせる。
    // 1回のrAFだと opacity:0 の状態がまだ画面に反映される前に消してしまい
    // 効果が出ないことがあるため、2重に待つ。
    if (newlyAdded.length > 0) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                newlyAdded.forEach(card => {
                    delete card.isNew;
                    const el = cardToElement.get(card);
                    if (el) el.classList.remove('entering');
                });
            });
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

    // セットされた魔術はフィールド上では裏向きに描画する
    // （情報パネルやビューアでは中身を見せたいので、フィールド表示のときだけ）
    const onField = (location === "ply-field" || location === "opt-field");
    if (onField && cardData._isSet) {
        el.classList.add('face-down');
        if (location === "ply-field") el.classList.add('own-set');
    }

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
            <div class="card-img-frame">${buildCardArtHtml(cardData)}</div>
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
            ${onField ? buildCardStateBadges(cardData, location, isMonster) : ''}
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
    // 相手が伏せたカードの中身は見せない
    if (cardData && cardData._isSet && location === "opt-field") {
        showHiddenCardInfo();
        hideCardDetail();
        return;
    }

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
    // 起動効果はメインフェイズのみ（バトルフェイズでは使えない）
    const canShowEffect = (location === "ply-field" && isMain
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
        // 罠魔術は手札から直接発動できない（伏せてから条件成立で自動発動）
        if (cardData.subType !== "trap") {
            const btn = document.createElement('button');
            btn.className = 'btn-action-float';
            btn.innerText = "発動";
            btn.disabled = !checkCanActivateMagic(cardData);
            btn.onclick = () => tryActivateMagic(cardData);
            buttons.push(btn);
        }

        const setBtn = document.createElement('button');
        setBtn.className = 'btn-action-float set';
        setBtn.innerText = "セット";
        setBtn.disabled = !checkCanSetMagic(cardData);
        setBtn.onclick = () => trySetMagic(cardData);
        buttons.push(setBtn);
    }

    // 伏せてある自分の魔術を表向きにして発動する
    if (location === "ply-field" && isMain && cardData.type === "magic" && cardData._isSet) {
        if (cardData.subType !== "trap") {
            const btn = document.createElement('button');
            btn.className = 'btn-action-float';
            btn.innerText = "発動";

            // 通常・永続魔術は伏せたターンでも発動できる（制限があるのは罠魔術のみ）
            if (!EffectLogic.isEffectActivatable(cardData, "player", "on_activate")) {
                btn.disabled = true;
                btn.innerText = "対象なし";
            }

            const effectiveIdx = slotIdx !== null ? slotIdx : GAME_STATE.player.field.magics.indexOf(cardData);
            btn.onclick = () => activateSetMagic(effectiveIdx);
            buttons.push(btn);
        }
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
            // 手札カードは選択時に15px浮くが、その分は rect にまだ反映されていない。
            // 見込んで引いておかないと、浮き上がった後にボタンだけ取り残されて
            // 2回目のタップで位置がずれて見える。
            const liftOffset = (location === "hand") ? 15 : 0;
            menu.style.left = `${rect.left + rect.width / 2}px`;
            menu.style.top = `${rect.top - liftOffset - 20}px`;
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

    // 長い名前も省略せず、横に縮めて必ず収める
    requestAnimationFrame(() => fitTextToWidth(nameEl));
}

/**
 * 要素内の1行テキストを、はみ出す場合だけ横方向に縮めて枠内に収める。
 * text-overflow による「…」は使わない（名前が読めなくなるため）。
 */
function fitTextToWidth(el) {
    if (!el) return;

    // 前回のscaleXが残っていると測定値が狂うので、先に戻してから測る
    el.style.transform = 'none';

    const available = el.clientWidth;
    const natural = el.scrollWidth;
    if (!available || !natural) return;

    if (natural > available) {
        el.style.transformOrigin = 'left center';
        el.style.transform = `scaleX(${available / natural})`;
    }
}

/** 詳細パネルを未選択状態に戻す */
function clearInfoPanel() {
    const visual = document.getElementById('info-visual-container');
    if (visual) visual.innerHTML = "";

    const nameEl = document.getElementById('info-name');
    if (nameEl) {
        nameEl.innerText = "No Selection";
        nameEl.style.transform = 'none';
    }
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };
    set('info-attr', "");
    set('info-level', "");
    set('info-power', "");
    set('info-extra-stats', "");
    set('info-text', "カードをタップして詳細を表示");
}

/** 相手の伏せカードを選んだときの情報パネル表示 */
function showHiddenCardInfo() {
    document.getElementById('info-visual-container').innerHTML =
        `<div class="card-mini face-down"><div class="card-face card-back"></div></div>`;
    document.getElementById('info-name').innerText = "セットされたカード";
    document.getElementById('info-name').style.transform = 'none';
    document.getElementById('info-attr').innerText = "";
    document.getElementById('info-level').innerText = "";
    document.getElementById('info-power').innerText = "";
    document.getElementById('info-extra-stats').innerText = "";
    document.getElementById('info-text').innerText = "相手が伏せているため内容は確認できません。";
}

/**
 * カード画像が用意されていない場合の差し替え表示。
 * Game-icons.net のSVG（img/game_icons.js）をカードごとに出し分けて、見分けがつくようにする。
 * 属性ごとに色分けする。画像枠いっぱいに正方形のタイルとして表示する。
 */
const ART_FALLBACK_ATTR_TINT = { "火": "#ff6b4a", "水": "#38b6ff", "草": "#7ed957", "光": "#ffd23f", "闇": "#c17dff", "無": "#9fb4c7" };

/**
 * 画像枠の中身を組み立てる。
 * icon が設定されているカードは「イラスト未作成」の印なので、最初からアイコンを描く。
 * 以前は <img> を出して404の onerror で差し替えていたが、描画のたびに
 * 読み込み失敗までの一瞬だけ黒い枠が見えてカードが点滅していた。
 * イラストを用意したら cards.js の icon 行を消すこと（そのまま画像表示に切り替わる）。
 */
function buildCardArtHtml(cardData) {
    if (!cardData.icon) {
        return `<img src="${cardData.image}" class="card-img-content" draggable="false">`;
    }

    const iconPath = (window.GAME_ICONS && window.GAME_ICONS[cardData.icon]) || null;
    const tint = ART_FALLBACK_ATTR_TINT[cardData.attribute] || "#9fb4c7";
    const inner = iconPath
        ? `<svg class="card-art-fallback-svg" viewBox="0 0 512 512"><path d="${iconPath}"/></svg>`
        : `<span class="card-art-fallback-glyph">❔</span>`;
    return `<span class="card-art-fallback"><span class="card-art-fallback-inner" style="color:${tint}">${inner}</span></span>`;
}
window.buildCardArtHtml = buildCardArtHtml;

/**
 * カードの現在位置（ゾーン要素）を探す。演出の起点・終点に使う。
 */
function findCardZoneElement(card, side) {
    const prefix = (side === "player") ? "ply" : "opt";
    const p = GAME_STATE[side];

    const mIdx = p.field.monsters.indexOf(card);
    if (mIdx !== -1) return document.getElementById(`${prefix}-monster-${mIdx}`);

    const gIdx = p.field.magics.indexOf(card);
    if (gIdx !== -1) return document.getElementById(`${prefix}-magic-${gIdx}`);

    // 場に無いカード（トラッシュ・除外から発動する効果）は、そのゾーンを光らせる
    const sideName = (side === "player") ? "player" : "opponent";
    if (p.trash.includes(card)) return document.getElementById(`${sideName}-trash-zone`);
    if (p.banished.includes(card)) return document.getElementById(`${sideName}-banish-zone`);

    return null;
}

/**
 * 相手の手札を裏向きで描画する。
 * 枚数だけが分かればよいので中身は持たせない。
 */
let _renderedOppHandCount = -1;
function renderOpponentHand() {
    const container = document.getElementById('opponent-hand');
    if (!container) return;

    const count = GAME_STATE.opponent.hand.length;
    if (count === _renderedOppHandCount) return;

    const isDraw = count > _renderedOppHandCount && _renderedOppHandCount >= 0;
    _renderedOppHandCount = count;

    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'opp-hand-card';
        // 増えた分だけ差し込むように見せる
        if (isDraw && i >= count - 1) el.classList.add('dealt');
        container.appendChild(el);
    }
}

/**
 * 効果発動などをトーストで知らせる。
 * カードの真下だと盤面に埋もれて見落とすので、相手の場と詳細エリアの間の帯に出す。
 * 新しいトーストが来たら前のものは即座に差し替える。
 */
let _effectToastTimer = null;
function showToastMessage(text, side) {
    const toast = document.getElementById('effect-toast');
    if (!toast) return;

    const owner = (side === "player") ? "自分" : "相手";
    toast.innerHTML = `<span class="toast-owner">${owner}</span>${text}`;
    toast.classList.toggle('opponent', side === "opponent");
    toast.classList.add('show');

    clearTimeout(_effectToastTimer);
    _effectToastTimer = setTimeout(() => toast.classList.remove('show'), 1000);
}

/** トーストを即座に消す（対戦終了・リセット時） */
function clearToastMessage() {
    const toast = document.getElementById('effect-toast');
    if (!toast) return;
    clearTimeout(_effectToastTimer);
    toast.classList.remove('show');
}

/**
 * 効果が発動したカードを光らせつつ、帯にトーストを出す。
 * @returns {Promise} 演出が終わるまで待てる
 */
function showEffectActivation(card, side) {
    return new Promise(resolve => {
        if (GAME_STATE.isGameOver) { resolve(); return; }

        showToastMessage(`${card.name} の効果発動`, side);

        const zone = findCardZoneElement(card, side);
        if (zone) {
            const fx = document.createElement('div');
            fx.className = 'vfx-effect-burst';
            zone.appendChild(fx);
            setTimeout(() => fx.remove(), 1000);
        }

        setTimeout(resolve, 1000);
    });
}

/**
 * HUDに出すLP。
 * ダメージ数字がLP表示に届いた瞬間に減らしたいので、
 * 実際のLP(GAME_STATE)とは別に「表示中のLP」を持つ。
 * null の間は実数値をそのまま出す。
 */
const _pendingLpDisplay = { player: null, opponent: null };

function renderLpDisplay() {
    ["player", "opponent"].forEach(side => {
        const el = document.getElementById(side === "player" ? 'player-lp-hud' : 'opponent-lp-hud');
        if (!el) return;
        const pending = _pendingLpDisplay[side];
        el.innerText = (pending === null) ? GAME_STATE[side].lp : pending;
    });
}

/**
 * 受けたダメージ（回復）を数字で見せる。
 * その側の手札あたりに出してからLP表示へ吸い込ませ、どちらが何点受けたか分かるようにする。
 * 数字がLPに届いたタイミングでLPの数値が動く。
 */
function showDamageNumber(side, amount, isHeal = false) {
    const viewport = document.getElementById('game-viewport');
    if (!viewport || amount <= 0) return;

    const lpEl = document.getElementById(side === "player" ? 'player-lp-hud' : 'opponent-lp-hud');
    // 自分は手札、相手は裏向き手札の帯を起点にする
    const originEl = document.getElementById(side === "player" ? 'player-hand-container' : 'opponent-band');
    if (!lpEl || !originEl) return;

    // 数字がLPに届くまでは変動前の値を出しておく
    const before = GAME_STATE[side].lp + (isHeal ? -amount : amount);
    _pendingLpDisplay[side] = before;
    renderLpDisplay();

    const from = originEl.getBoundingClientRect();
    const to = lpEl.getBoundingClientRect();

    const el = document.createElement('div');
    el.className = `vfx-damage-number pop${isHeal ? ' heal' : ''}`;
    el.innerText = `${isHeal ? '+' : '-'}${amount}`;
    el.style.left = `${from.left + from.width / 2}px`;
    el.style.top = `${from.top + from.height / 2}px`;
    document.body.appendChild(el);

    // 数字が読める間を置いてからLPへ飛ばす
    setTimeout(() => {
        el.style.left = `${to.left + to.width / 2}px`;
        el.style.top = `${to.top + to.height / 2}px`;
        el.style.fontSize = '0.9rem';
        el.style.opacity = '0';
    }, 450);

    // 数字がLPに到達した瞬間にLPの数値を動かす
    setTimeout(() => {
        _pendingLpDisplay[side] = null;
        renderLpDisplay();

        if (!isHeal) {
            // LPが減ったことを画面全体でも伝える
            viewport.classList.remove('lp-shake');
            void viewport.offsetWidth;
            viewport.classList.add('lp-shake');
            setTimeout(() => viewport.classList.remove('lp-shake'), 420);

            lpEl.classList.remove('lp-hit');
            void lpEl.offsetWidth;
            lpEl.classList.add('lp-hit');
            setTimeout(() => lpEl.classList.remove('lp-hit'), 470);
        }
    }, 1000);

    setTimeout(() => el.remove(), 1050);
}

/**
 * モンスターが破壊された時の演出。
 * 何の前触れもなくトラッシュに送られると、何が起きたのか分からないため。
 */
/**
 * 交差した剣のマーク（攻撃状態の表示に使う自作SVG）。
 * 絵文字だと環境ごとに絵柄が変わるので、パスで持つ。
 */
const CROSSED_SWORDS_SVG = `
<svg class="state-badge-icon" viewBox="0 0 24 24" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <g stroke-width="2.6">
      <path d="M3.6 20.4 L17.4 4.6"/>
      <path d="M20.4 20.4 L6.6 4.6"/>
    </g>
    <g stroke-width="2">
      <path d="M12.6 3.2 L20.6 7.4"/>
      <path d="M11.4 3.2 L3.4 7.4"/>
    </g>
  </g>
</svg>`;

/** 1ターンに1度の効果を使い切った印（禁止マーク） */
const EFFECT_USED_SVG = `
<svg class="state-badge-icon" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.6"/>
  <path d="M6 18 L18 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
</svg>`;

/**
 * フィールド上のカードに出す状態バッジ。
 * ・バトルフェイズ中のモンスター: 攻撃できるか／攻撃済みか
 * ・「1ターンに1度」を使い切った効果: 使用済み
 */
function buildCardStateBadges(cardData, location, isMonster) {
    // 伏せカードは中身を見せない
    if (cardData._isSet) return '';

    const side = (location === "ply-field") ? "player" : "opponent";
    let html = '';

    if (isMonster && GAME_STATE.phase === "BATTLE" && GAME_STATE.turnPlayer === side) {
        const done = !!cardData._hasAttacked;
        html += `<div class="card-state-badge ${done ? 'attacked' : 'can-attack'}"
                      title="${done ? '攻撃済み' : '攻撃可能'}">${CROSSED_SWORDS_SVG}</div>`;
    }

    if (EffectLogic.isLimitUsed(cardData)) {
        html += `<div class="card-state-badge used-effect"
                      title="このターンの効果は使用済み">${EFFECT_USED_SVG}</div>`;
    }

    return html;
}

/**
 * 召喚時の演出。周囲が軽く光るだけの短いもの。
 * 召喚 → （召喚時効果があれば）効果発動 の順に見せるため、先に呼ぶ。
 */
function playSummonEffect(side, slotIdx) {
    return new Promise(resolve => {
        const prefix = (side === "player") ? "ply" : "opt";
        const zone = document.getElementById(`${prefix}-monster-${slotIdx}`);
        if (!zone || GAME_STATE.isGameOver) { resolve(); return; }

        const glow = document.createElement('div');
        glow.className = 'vfx-summon-glow';
        zone.appendChild(glow);

        setTimeout(() => {
            glow.remove();
            resolve();
        }, 400);
    });
}

function playDestroyEffect(side, slotIdx) {
    return new Promise(resolve => {
        const prefix = (side === "player") ? "ply" : "opt";
        const zone = document.getElementById(`${prefix}-monster-${slotIdx}`);
        if (!zone || GAME_STATE.isGameOver) { resolve(); return; }

        const card = zone.querySelector('.card-mini');
        if (card) card.classList.add('destroying');

        const burst = document.createElement('div');
        burst.className = 'vfx-destroy-burst';
        zone.appendChild(burst);

        setTimeout(() => {
            burst.remove();
            resolve();
        }, 450);
    });
}

/**
 * 攻撃の矢印演出。誰から誰に攻撃したかを見せる。
 * defenderSlot が -1 ならダイレクトアタック（相手のLP表示へ向かう）。
 */
function showAttackArrow(attackerSide, attackerSlot, defenderSide, defenderSlot) {
    return new Promise(resolve => {
        const atkPrefix = (attackerSide === "player") ? "ply" : "opt";
        const fromEl = document.getElementById(`${atkPrefix}-monster-${attackerSlot}`);

        let toEl;
        if (defenderSlot >= 0) {
            const defPrefix = (defenderSide === "player") ? "ply" : "opt";
            toEl = document.getElementById(`${defPrefix}-monster-${defenderSlot}`);
        } else {
            // ダイレクトアタックは守る側の手札あたりを狙う（プレイヤー本体を殴るイメージ）
            toEl = document.getElementById(
                defenderSide === "player" ? 'player-hand-container' : 'opponent-band');
        }

        if (!fromEl || !toEl) { resolve(); return; }

        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        const x1 = a.left + a.width / 2, y1 = a.top + a.height / 2;
        const x2 = b.left + b.width / 2, y2 = b.top + b.height / 2;
        const length = Math.hypot(x2 - x1, y2 - y1);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

        const arrow = document.createElement('div');
        arrow.className = 'vfx-attack-arrow';
        arrow.style.left = `${x1}px`;
        arrow.style.top = `${y1}px`;
        arrow.style.width = `${length}px`;
        arrow.style.transform = `rotate(${angle}deg)`;
        document.body.appendChild(arrow);

        // 矢印が届いてから揺らす（同時だと当たる前に相手が震えて見える）
        const ARROW_REACH_MS = 320;
        setTimeout(() => toEl.classList.add('shake-target'), ARROW_REACH_MS);

        setTimeout(() => {
            arrow.remove();
            toEl.classList.remove('shake-target');
            resolve();
        }, 900);
    });
}

/**
 * デッキからトラッシュへ1枚落ちる演出。
 * 一気に消えると何が起きたか分からないので、1枚ずつ見せる。
 */
function animateMillCard(cardData, side) {
    return new Promise(resolve => {
        const deckEl = document.getElementById(`${side}-deck-zone`);
        const trashEl = document.getElementById(`${side}-trash-zone`);
        if (!deckEl || !trashEl || GAME_STATE.isGameOver) { resolve(); return; }

        const from = deckEl.getBoundingClientRect();
        const to = trashEl.getBoundingClientRect();

        const el = createCardElement(cardData, 'animation');
        el.classList.add('anim-milling-card');
        el.style.left = `${from.left}px`;
        el.style.top = `${from.top}px`;
        document.body.appendChild(el);

        requestAnimationFrame(() => {
            el.style.left = `${to.left}px`;
            el.style.top = `${to.top}px`;
            el.style.opacity = '0.15';
            el.style.transform = 'scale(0.8) rotate(8deg)';
        });

        setTimeout(() => { el.remove(); resolve(); }, 260);
    });
}

/** 罠が発動したことを見せる演出 */
function showTrapActivation(side, slotIdx, card) {
    const prefix = (side === "player") ? "ply" : "opt";
    const zone = document.getElementById(`${prefix}-magic-${slotIdx}`);
    if (zone) {
        const flash = document.createElement('div');
        flash.className = 'vfx-landing-flash';
        zone.appendChild(flash);
        setTimeout(() => flash.remove(), 600);
    }

    const banner = document.getElementById('selection-prompt');
    if (!banner) return;
    banner.innerHTML = `<span>罠発動: ${card.name}</span>`;
    banner.classList.add('active', 'trap-banner');
    setTimeout(() => {
        banner.classList.remove('active', 'trap-banner');
        banner.innerHTML = "";
    }, 1600);
}

/** 召喚先選択モードの開始 */
function startSlotSelection(cardData) {
    document.getElementById('floating-action-container').innerHTML = "";
    document.getElementById('field-surface').classList.add('selecting-mode');
    document.getElementById('game-viewport').classList.add('field-selecting');
    showSelectionPrompt("召喚する場所を選択してください");
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
    showSelectionPrompt(null);
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
    // subType(通常/効果モンスター)の絞り込み。以前は素材種別を無視していたため、
    // 例えば「通常モンスター限定」のコスト指定でも効果モンスターを渡せてしまっていた。
    if (filter.subType && card.subType !== filter.subType) return false;
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
    // 選択モード中（召喚コスト・召喚先・攻撃対象・効果対象など）は開かない。
    // ゾーンのonclickは選択モードの状態に関わらず常に生きているため、ここで
    // ガードしないと選択操作中の誤タップでトラッシュ/除外ビューアが割り込む。
    if (GAME_STATE.isSelectingSlot || GAME_STATE.isSelectingTarget || GAME_STATE.isSelectingCost) return;

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