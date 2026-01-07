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

    // プレイヤー状態
    player: {
        lp: 5000, // ルール準拠
        deck: [],
        hand: [],
        trash: [],
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
    selectedCosts: [],       // 選択されたコスト対象 [{card, slotIdx}]
    isAnimating: false       // アニメーション中（UIロック用）
};

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
    console.log("LinkaVel Game Engine Ready.");
});

function setupEventListeners() {
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
        if (!e.target.closest('.card-mini') && !e.target.closest('#card-detail-overlay') && !e.target.closest('.btn-action')) {
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
 * デッキ選択リストを動的に生成
 */
function renderDeckSelection() {
    const container = document.getElementById('deck-list-container');
    container.innerHTML = "";

    Object.keys(DECK_RECIPES).forEach(key => {
        const recipe = DECK_RECIPES[key];
        const btn = document.createElement('button');
        btn.className = 'menu-btn';
        btn.innerHTML = `<span class="btn-text">${recipe.name}</span>`;
        btn.onclick = () => confirmDeckSelection(key);
        container.appendChild(btn);
    });
}

/**
 * デッキ確定後の初期化プロセス
 */
function confirmDeckSelection(playerDeckKey) {
    resetGameState();

    // プレイヤーのデッキを初期化
    initDeck("player", playerDeckKey);

    // 相手のデッキをランダムに決定
    const allKeys = Object.keys(DECK_RECIPES);
    const randomKey = allKeys[Math.floor(Math.random() * allKeys.length)];
    initDeck("opponent", randomKey);

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

    // プレイヤーリセット
    GAME_STATE.player.lp = 5000;
    GAME_STATE.player.refreshCount = 0;
    GAME_STATE.player.deck = [];
    GAME_STATE.player.hand = [];
    GAME_STATE.player.trash = [];
    GAME_STATE.player.field.monsters = [null, null, null];
    GAME_STATE.player.field.magics = [null, null, null];

    // 相手リセット
    GAME_STATE.opponent.lp = 5000;
    GAME_STATE.opponent.refreshCount = 0;
    GAME_STATE.opponent.deck = [];
    GAME_STATE.opponent.hand = [];
    GAME_STATE.opponent.trash = [];
    GAME_STATE.opponent.field.monsters = [null, null, null];

    // UIクリーンアップ
    document.getElementById('player-hand').innerHTML = "";
    cleanFieldZones();
}

function cleanFieldZones() {
    [0, 1, 2].forEach(i => {
        const ids = [`ply-monster-${i}`, `opt-monster-${i}`, `ply-magic-${i}`, `opt-magic-${i}`];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.innerHTML = "";
        });
    });
}

function initDeck(side, recipeKey) {
    const recipe = DECK_RECIPES[recipeKey];
    if (!recipe) {
        console.error(`Deck Recipe not found: ${recipeKey}`);
        return;
    }
    // カードIDから実データを生成してシャッフル
    const rawDeck = recipe.cards.map(id => getCardData(id)).filter(c => c !== null);

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
    showScreen('menu-screen');
}

let isDeckBuilderInitialized = false;

function openDeckEditor() {
    showScreen('deck-screen');
    if (typeof DeckBuilder !== 'undefined') {
        if (!isDeckBuilderInitialized) {
            DeckBuilder.init();
            isDeckBuilderInitialized = true;
        }
        // 新規セッション開始
        DeckBuilder.startSession();
    }
}

// ==========================================
// 3. ターン進行ロジック
// ==========================================

function startTurnProcess() {
    GAME_STATE.phase = "DRAW";
    GAME_STATE.hasNormalSummoned = false;
    // ターン開始時に全モンスターの攻撃済みフラグをリセット (ルール5.3)
    const allFieldMonsters = [...GAME_STATE.player.field.monsters, ...GAME_STATE.opponent.field.monsters];
    allFieldMonsters.forEach(m => { if(m) m._hasAttacked = false; });

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
    const pOrder = GAME_STATE.phases;
    const currentIdx = pOrder.indexOf(GAME_STATE.phase);

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
                p.deck = shuffleArray([...p.trash]);
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
    if (GAME_STATE.phase !== "MAIN1" && GAME_STATE.phase !== "MAIN2") return false;
    if (GAME_STATE.hasNormalSummoned) return false;

    const req = cardData.summonRequirement;
    const costCount = (req && req.type === 'normal') ? req.costCount : 0;

    if (costCount > 0) {
        // コストが必要な場合：フィールドの空きに関わらず、コスト対象がいればOK
        return getValidCosterMonsters(req.costFilter).length >= costCount;
    } else {
        // コスト不要な場合：モンスターゾーンに空きがあるか
        return GAME_STATE.player.field.monsters.some(c => c === null);
    }
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

async function executeSummon(side, cardData, slotIndex, costSlotIndices = []) {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    const costCards = [];

    // 1. コストの支払いを実行 (ルール Ver.1.1: 効果発動は後回し)
    for (const cIdx of costSlotIndices) {
        const cCard = p.field.monsters[cIdx];
        if (cCard) {
            costCards.push(cCard);
            p.trash.push(cCard);
            p.field.monsters[cIdx] = null;
        }
    }

    // 2. 手札から削除
    const handIndex = p.hand.findIndex(c => c.id === cardData.id);
    if (handIndex !== -1) {
        p.hand.splice(handIndex, 1);
    }

    // 3. フィールドへ配置
    p.field.monsters[slotIndex] = cardData;

    // 4. トラッシュ送り時および召喚成功時の効果解決
    for (const cCard of costCards) {
        await EffectLogic.resolveEffects(cCard, side, "on_sent_to_trash");
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
    GAME_STATE.isSelectingSlot = true;
    GAME_STATE.pendingCard = cardData;

    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-magic-${i}`);
        if (GAME_STATE.player.field.magics[i] === null) {
            zone.classList.add('highlight');
            zone.onclick = (e) => {
                e.stopPropagation();
                finishMagicSlotSelection(i);
            };
        }
    });
    setTimeout(() => { document.body.onclick = cancelMagicSlotSelection; }, 10);
}

/** 魔術発動の完了 */
async function finishMagicSlotSelection(slotIdx) {
    if (!GAME_STATE.pendingCard) return;
    const cardData = GAME_STATE.pendingCard;
    const p = GAME_STATE.player;

    // 1. 手札から削除
    const handIndex = p.hand.findIndex(c => c.id === cardData.id);
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
            p.field.magics[slotIdx] = null;
            renderFieldCard("player", "magic", slotIdx, null);
            p.trash.push(cardData);
            updateUI();
        }, 500);
    } else {
        // 永続魔術はそのまま残る
        updateUI();
    }

    cancelMagicSlotSelection();
    console.log(`Magic Played: ${cardData.name}`);
}

/** 魔術選択のキャンセル */
function cancelMagicSlotSelection() {
    document.getElementById('field-surface').classList.remove('selecting-mode');
    GAME_STATE.isSelectingSlot = false;
    GAME_STATE.pendingCard = null;
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-magic-${i}`);
        zone.classList.remove('highlight');
        zone.onclick = null;
    });
    document.body.onclick = () => hideCardDetail();
}

// ==========================================
// 6. アクション: 攻撃 (Battle)
// ==========================================

function tryAttack(attackerCard, attackerSlotIdx) {
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

        if (attacker._combatEffects && attacker._combatEffects.some(e => e.type === "destroy_opponent_after_combat")) {
            if (GAME_STATE[defenderSide].field.monsters[defIdx]) {
                await destroyMonster(defenderSide, defIdx, "effect");
            }
        }
    }

    GAME_STATE.isAnimating = false;
    updateUI();
    return Promise.resolve();
}

function damagePlayer(side, amount) {
    // ダメージ軽減ロジックの適用
    const finalDamage = EffectLogic.calculateFinalDamage(side, amount);

    if (side === "player") {
        GAME_STATE.player.lp = Math.max(0, GAME_STATE.player.lp - finalDamage);
    } else {
        GAME_STATE.opponent.lp = Math.max(0, GAME_STATE.opponent.lp - finalDamage);
    }

    // 決着判定
    if (GAME_STATE.player.lp === 0) {
        endGameSequence("opponent");
    } else if (GAME_STATE.opponent.lp === 0) {
        endGameSequence("player");
    }
}

/**
 * ゲーム終了シーケンス
 * @param {string} winner - "player" | "opponent"
 */
function endGameSequence(winner) {
    // 操作を完全にロックして誤操作を防止
    document.getElementById('ui-layer').style.pointerEvents = "none";

    // 1秒の「間（演出）」の後にモーダルを表示
    setTimeout(() => {
        const overlay = document.getElementById('game-result-overlay');
        const title = document.getElementById('result-title');
        const msg = document.getElementById('result-message');

        overlay.style.display = "flex";
        if (winner === "player") {
            overlay.classList.add("result-win");
            title.innerText = "VICTORY";
            msg.innerText = "相手のLPを0にしました！";
        } else {
            overlay.classList.add("result-lose");
            title.innerText = "DEFEAT";
            msg.innerText = "自分のLPが0になりました...";
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

        p.trash.push(card); // トラッシュ送り
        p.field.monsters[slotIdx] = null;

        // 割り込みトリガー: on_other_sent_to_trash (アクア・サルベージ s006等)
        const allFieldCards = [
            ...GAME_STATE.player.field.monsters, ...GAME_STATE.player.field.magics,
            ...GAME_STATE.opponent.field.monsters, ...GAME_STATE.opponent.field.magics
        ];
        for (const source of allFieldCards) {
            if (source && source !== card) {
                await EffectLogic.resolveEffects(source, (allFieldCards.indexOf(source) < 6 ? "player" : "opponent"), "on_other_sent_to_trash");
            }
        }

        // トラッシュ送り時トリガーの発火
        await EffectLogic.resolveEffects(card, side, "on_sent_to_trash");

        // UIクリア
        const prefix = (side === "player") ? "ply" : "opt";
        const el = document.getElementById(`${prefix}-monster-${slotIdx}`);
        if(el) el.innerHTML = "";
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
    updateZoneVisuals("opponent", "deck");
    updateZoneVisuals("opponent", "trash");

    // フィールド上の全カードを最新データで再描画 (バフ・オーラ反映)
    ["player", "opponent"].forEach(side => {
        GAME_STATE[side].field.monsters.forEach((card, i) => renderFieldCard(side, "monster", i, card));
        GAME_STATE[side].field.magics.forEach((card, i) => renderFieldCard(side, "magic", i, card));
    });

    // フェイズ中央表示
    const phaseLabel = document.getElementById('phase-center-label');
    if(phaseLabel) phaseLabel.innerText = `${GAME_STATE.phase} PHASE`;

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

    // 最大幅をコンテナの90%に制限して計算
    const maxDisplayWidth = (container.parentElement.clientWidth || window.innerWidth) * 0.9;
    const cardWidth = 65; // CSSの--card-max-widthに相当
    const idealGap = 8;   // 枚数が少ない時の理想的な隙間

    // 全カードを隙間ありで並べた時の合計幅
    const totalRawWidth = (cardWidth * hand.length) + (idealGap * (hand.length - 1));

    let currentGap = idealGap;
    // 合計幅が制限を超える場合のみ、重なり（ネガティブマージン）を計算
    if (totalRawWidth > maxDisplayWidth) {
        currentGap = (maxDisplayWidth - cardWidth) / (hand.length - 1) - cardWidth;
    }

    hand.forEach((card, idx) => {
        const el = createCardElement(card, "hand");
        el.style.zIndex = idx;
        if (idx > 0) {
            el.style.marginLeft = `${currentGap}px`;
        }
        // 新規カードなら透明クラスを付与
        if (card.isNew) {
            el.classList.add('entering');
        }
        container.appendChild(el);
    });
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
                    <div class="card-magic-type">${cardData.subType === 'permanent' ? '永続魔術' : '通常魔術'}</div>
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

    // トラッシュ内のカードには詳細表示イベントを付けない（ゾーンのクリックを優先）
    if (location && !location.includes('trash')) {
        el.onclick = (e) => {
            e.stopPropagation();
            showCardDetail(cardData, location, e, slotIdx);
        };
    }

    return el;
}

// ==========================================
// 8. 詳細画面 & 操作パネル
// ==========================================

function showCardDetail(cardData, location, event, slotIdx = null) {
    updateInfoPanel(cardData, location);

    // 手札の強調表示（浮き上がり）制御
    const handCards = document.querySelectorAll('#player-hand .card-mini');
    handCards.forEach(c => c.classList.remove('selected'));
    if (location === "hand" && event) {
        event.currentTarget.classList.add('selected');
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

    // 選択モード中、または相手のターンならアクションは出さない
    if (GAME_STATE.isSelectingSlot || GAME_STATE.isSelectingTarget || GAME_STATE.turnPlayer !== "player") return;

    // 既存のアクションメニューをクリア
    const container = document.getElementById('floating-action-container');
    container.innerHTML = "";

    // ボタンが必要な状況か判定
    const isMain = (GAME_STATE.phase === "MAIN1" || GAME_STATE.phase === "MAIN2");
    const isBattle = (GAME_STATE.phase === "BATTLE");

    // アクションボタン表示判定
    const canShowSummon = (location === "hand" && isMain && cardData.type === "monster" && !GAME_STATE.hasNormalSummoned);
    const canShowMagic = (location === "hand" && isMain && cardData.type === "magic");
    const canShowAttack = (location === "ply-field" && isBattle && cardData.type === "monster" && !cardData._hasAttacked);
    const canShowEffect = (location === "ply-field" && isMain && cardData.logic && cardData.logic.some(l => l.trigger === "ignition"));

    if (canShowSummon || canShowMagic || canShowAttack || canShowEffect) {
        const menu = document.createElement('div');
        menu.className = 'floating-actions';

        const rect = event.currentTarget.getBoundingClientRect();
        menu.style.left = `${rect.left + rect.width/2}px`;
        menu.style.top = `${rect.top - 20}px`;
        menu.style.transform = 'translateX(-50%) translateY(-100%)';
        menu.style.opacity = "1";

        const btn = document.createElement('button');
        btn.className = 'btn-action-float';

        if (location === "hand") {
            if (cardData.type === "monster") {
                btn.innerText = "召喚";
                btn.disabled = !checkCanSummon(cardData);
                btn.onclick = () => trySummon(cardData);
            } else {
                btn.innerText = "発動";
                btn.disabled = !checkCanActivateMagic(cardData);
                btn.onclick = () => tryActivateMagic(cardData);
            }
        } else if (canShowAttack) {
            btn.innerText = "攻撃";
            btn.className += " attack";
            // 直接slotIdxを使用することで同名カードの誤認を回避
            const effectiveIdx = slotIdx !== null ? slotIdx : GAME_STATE.player.field.monsters.indexOf(cardData);
            btn.onclick = () => { container.innerHTML = ""; tryAttack(cardData, effectiveIdx); };
        } else if (canShowEffect) {
            btn.innerText = "効果発動";
            const hasLimit = cardData.logic.some(l => l.countLimit === "once_per_turn");
            const isUsed = hasLimit && cardData._usedTurn === GAME_STATE.turnCount;
            const isActivatable = EffectLogic.isEffectActivatable(cardData, "player", "ignition");

            if (isUsed) {
                btn.disabled = true;
                btn.innerText = "使用済み";
            } else if (!isActivatable) {
                btn.disabled = true;
                btn.innerText = "対象なし";
            }

            btn.onclick = () => {
                container.innerHTML = "";
                if (hasLimit) cardData._usedTurn = GAME_STATE.turnCount;
                EffectLogic.resolveEffects(cardData, "player", "ignition");
            };
        }

        menu.appendChild(btn);
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
        levelEl.innerText = cardData.subType === 'permanent' ? '永続魔術' : '通常魔術';
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
    GAME_STATE.isSelectingSlot = true;
    GAME_STATE.pendingCard = cardData;

    // コストで選択されたインデックスを取得（その場所は空き地として扱う）
    const costIndices = GAME_STATE.selectedCosts.map(c => c.slotIdx);

    // モンスターゾーンを光らせる
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-monster-${i}`);
        // 「元々空」または「コストでいなくなる」場所をハイライト
        if (GAME_STATE.player.field.monsters[i] === null || costIndices.includes(i)) {
            zone.classList.add('highlight');
            zone.onclick = (e) => {
                e.stopPropagation();
                finishSlotSelection(i);
            };
        }
    });

    // キャンセル用に背景クリックイベントを一時的に貼る
    setTimeout(() => {
        document.body.onclick = cancelSlotSelection;
    }, 10);
}

async function finishSlotSelection(slotIdx) {
    if (!GAME_STATE.pendingCard) return;

    const costIndices = GAME_STATE.selectedCosts.map(c => c.slotIdx);

    // API化した executeSummon を呼び出し
    await executeSummon("player", GAME_STATE.pendingCard, slotIdx, costIndices);

    // クリーンアップ
    GAME_STATE.selectedCosts = [];
    cancelSlotSelection();
}

function cancelSlotSelection() {
    document.getElementById('field-surface').classList.remove('selecting-mode');
    GAME_STATE.isSelectingSlot = false;
    GAME_STATE.pendingCard = null;
    GAME_STATE.selectedCosts = [];
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-monster-${i}`);
        zone.classList.remove('highlight', 'cost-highlight', 'cost-selected');
        zone.onclick = null;
    });
    document.body.onclick = () => hideCardDetail();
}

function hideCardDetail() {
    document.getElementById('floating-action-container').innerHTML = "";
    // 全ての手札の選択状態（浮き上がり）を解除
    const handCards = document.querySelectorAll('#player-hand .card-mini');
    handCards.forEach(c => c.classList.remove('selected'));
}

/** 攻撃対象選択モードの開始 */
function startAttackTargetSelection(attackerCard, attackerSlotIdx) {
    document.getElementById('floating-action-container').innerHTML = "";
    GAME_STATE.isSelectingTarget = true;
    GAME_STATE.attackerPending = { card: attackerCard, slotIdx: attackerSlotIdx };

    // 相手モンスターがいるスロットを光らせる
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`opt-monster-${i}`);
        if (GAME_STATE.opponent.field.monsters[i] !== null) {
            zone.classList.add('highlight');
            zone.onclick = (e) => {
                e.stopPropagation();
                finishAttackTargetSelection(i);
            };
        }
    });

    // キャンセル用に背景クリックイベントを一時的に貼る
    setTimeout(() => {
        document.body.onclick = cancelAttackTargetSelection;
    }, 10);
}

function finishAttackTargetSelection(targetSlotIdx) {
    if (!GAME_STATE.attackerPending) return;
    const { card, slotIdx } = GAME_STATE.attackerPending;
    const targetMonster = GAME_STATE.opponent.field.monsters[targetSlotIdx];

    resolveBattle(card, targetMonster, slotIdx, targetSlotIdx);
    cancelAttackTargetSelection();
}

function cancelAttackTargetSelection() {
    GAME_STATE.isSelectingTarget = false;
    GAME_STATE.attackerPending = null;
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`opt-monster-${i}`);
        zone.classList.remove('highlight');
        zone.onclick = null;
    });
    document.body.onclick = () => hideCardDetail();
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

    const count = (type === "deck") ? p.deck.length : p.trash.length;

    // 追加: トラッシュタップイベントの視覚制御
    if (type === "trash") {
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
            const topCard = p.trash.at(-1);
            // 既存の createCardElement を流用して最新の捨て札を表向きで表示
            const newCard = createCardElement(topCard, `${side}-trash`);
            zoneEl.replaceChild(newCard, cardEl);
        }
    }

    // 3. 枚数表示の更新（Deck & Trash）
    const badgeId = (type === "deck")
        ? ((side === "player") ? 'ply-deck-count-badge' : 'opt-deck-count')
        : ((side === "player") ? 'ply-trash-count-badge' : 'opt-trash-count-badge');

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
function beginDuel() {
    const overlay = document.getElementById('game-start-overlay');
    overlay.style.display = "none";

    // 初期手札の配布と最初のターン開始
    drawCard("player", 6);
    drawCard("opponent", 6);
    updateUI();
    startTurnProcess();
}

/** 召喚コスト対象の取得 */
function getValidCosterMonsters(filter) {
    return GAME_STATE.player.field.monsters
        .map((m, i) => ({ card: m, slotIdx: i }))
        .filter(obj => {
            if (!obj.card) return false;
            if (!filter) return true;
            if (filter.minLevel && obj.card.level < filter.minLevel) return false;
            return true;
        });
}

/** コスト選択モードの開始 */
function startCostSelection(cardData) {
    hideCardDetail();
    document.getElementById('field-surface').classList.add('selecting-mode');
    GAME_STATE.isSelectingCost = true;
    GAME_STATE.pendingCard = cardData;
    GAME_STATE.selectedCosts = [];

    const validMonsters = getValidCosterMonsters(cardData.summonRequirement.costFilter);

    validMonsters.forEach(obj => {
        const zone = document.getElementById(`ply-monster-${obj.slotIdx}`);
        zone.classList.add('cost-highlight');
        zone.onclick = (e) => {
            e.stopPropagation();
            toggleCostSelection(obj);
        };
    });

    setTimeout(() => { document.body.onclick = cancelCostSelection; }, 10);
}

function toggleCostSelection(monsterObj) {
    const idx = GAME_STATE.selectedCosts.findIndex(c => c.slotIdx === monsterObj.slotIdx);
    const zone = document.getElementById(`ply-monster-${monsterObj.slotIdx}`);

    if (idx > -1) {
        GAME_STATE.selectedCosts.splice(idx, 1);
        zone.classList.remove('cost-selected');
    } else {
        GAME_STATE.selectedCosts.push(monsterObj);
        zone.classList.add('cost-selected');
    }

    const req = GAME_STATE.pendingCard.summonRequirement;
    if (GAME_STATE.selectedCosts.length >= req.costCount) {
        // 必要コストが溜まったら場所選択へ移行
        proceedToSlotSelectionFromCost();
    }
}

function proceedToSlotSelectionFromCost() {
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-monster-${i}`);
        zone.classList.remove('cost-highlight', 'cost-selected');
        zone.onclick = null;
    });
    GAME_STATE.isSelectingCost = false;
    startSlotSelection(GAME_STATE.pendingCard);
}

function cancelCostSelection() {
    GAME_STATE.isSelectingCost = false;
    cancelSlotSelection();
}

/**
 * 汎用ターゲット選択Promise
 */
async function selectTargetUI(side, type, filter = {}) {
    // 相手ターン（CPU）または非ターンプレイヤーが選択する場合はランダム
    if (GAME_STATE.turnPlayer !== "player") {
        const p = GAME_STATE[side];
        const validIdx = [];
        p.field[type + "s"].forEach((card, i) => { if (card) validIdx.push(i); });
        return validIdx.length > 0 ? validIdx[Math.floor(Math.random() * validIdx.length)] : null;
    }

    return new Promise((resolve) => {
        const prefix = (side === "player") ? "ply" : "opt";
        document.getElementById('field-surface').classList.add('selecting-mode');

        const zones = [0, 1, 2].map(i => document.getElementById(`${prefix}-${type}-${i}`));
        let resolved = false;

        zones.forEach((zone, i) => {
            const card = GAME_STATE[side].field[type + "s"][i];
            if (card) {
                zone.classList.add('highlight');
                zone.onclick = (e) => {
                    e.stopPropagation();
                    cleanup(i);
                };
            }
        });

        // キャンセル処理（背景クリック）
        const handleCancel = (e) => {
            if (!e.target.closest('.zone.highlight')) cleanup(null);
        };
        setTimeout(() => { document.body.addEventListener('click', handleCancel, { once: true }); }, 10);

        function cleanup(result) {
            if (resolved) return;
            resolved = true;
            document.body.removeEventListener('click', handleCancel);
            zones.forEach(z => {
                z.classList.remove('highlight');
                z.onclick = null;
            });
            document.getElementById('field-surface').classList.remove('selecting-mode');
            resolve(result);
        }
    });
}

/**
 * トラッシュ閲覧モーダルを開く
 * @param {string} side - "player" | "opponent"
 */
function openTrashViewer(side) {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    if (p.trash.length === 0) return;

    const modal = document.getElementById('trash-viewer-modal');
    const title = document.getElementById('trash-viewer-title');
    const list = document.getElementById('trash-card-list');

    title.innerText = `${side === "player" ? "自分" : "相手"}のトラッシュ (${p.trash.length}枚)`;
    list.innerHTML = "";

    p.trash.forEach((card, idx) => {
        const location = (side === "player") ? "ply-field" : "opt-field";
        const el = createCardElement(card, location);

        el.onclick = (e) => {
            e.stopPropagation();
            showCardDetail(card, location, e, null);
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
    console.log(`End Phase started for ${GAME_STATE.turnPlayer}`);

    if (GAME_STATE.turnPlayer === "player") {
        const hand = GAME_STATE.player.hand;
        if (hand.length > 10) {
            const discardCount = hand.length - 10;
            // すでに main.js に実装されている selectHandCardsUI を利用
            const targetIndices = await selectHandCardsUI(discardCount);

            // 選択されたカードをトラッシュへ（インデックスのズレを防ぐため降順で処理）
            targetIndices.sort((a, b) => b - a).forEach(idx => {
                const card = hand.splice(idx, 1)[0];
                GAME_STATE.player.trash.push(card);
            });

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