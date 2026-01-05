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
    console.log("Starting Single Play Mode...");
    resetGameState();

    // デッキ初期化
    initDeck("player", "starter_fire");
    initDeck("opponent", "starter_water");

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
    GAME_STATE.player.deck = [];
    GAME_STATE.player.hand = [];
    GAME_STATE.player.trash = [];
    GAME_STATE.player.field.monsters = [null, null, null];
    GAME_STATE.player.field.magics = [null, null, null];

    // 相手リセット
    GAME_STATE.opponent.lp = 5000;
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

function openDeckEditor() {
    showScreen('deck-screen');
}

// ==========================================
// 3. ターン進行ロジック
// ==========================================

function startTurnProcess() {
    GAME_STATE.phase = "DRAW";
    GAME_STATE.hasNormalSummoned = false;
    updateUI();

    console.log(`Turn Start: ${GAME_STATE.turnPlayer} (Game Turn: ${GAME_STATE.turnCount})`);

    // DRAW PHASE処理
    // ルール: 先行1ターン目はドローしない
    if (GAME_STATE.isFirstTurnOfGame) {
        console.log("First Turn: Skip Draw Phase.");
        setTimeout(advancePhase, 1000);
    } else {
        drawCard(GAME_STATE.turnPlayer, 1);
        updateUI();

        // プレイヤー・CPU問わずドロー後は自動でMAIN1へ進行
        setTimeout(advancePhase, 1000);

        if (GAME_STATE.turnPlayer === "opponent") {
            setTimeout(executeCpuTurn, 1000);
        }
    }
}

function advancePhase() {
    const pOrder = GAME_STATE.phases;
    const currentIdx = pOrder.indexOf(GAME_STATE.phase);

    // ENDフェイズまたは、次にENDフェイズへ移行する場合は即座にターン交代処理へ
    let nextPhase = pOrder[currentIdx + 1];

    if (GAME_STATE.phase === "END" || nextPhase === "END") {
        endTurn();
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

    if (side === "player") {
        GAME_STATE.isAnimating = true;
        updateUI();

        const drawQueue = [];
        for (let i = 0; i < count; i++) {
            if (p.deck.length === 0 && p.trash.length > 0) {
                p.deck = shuffleArray([...p.trash]);
                p.trash = [];
                updateUI();
            }
            if (p.deck.length === 0) break;

            const card = p.deck.pop();
            card.isNew = true; // ゴースト予約フラグ
            p.hand.push(card);
            drawQueue.push(card);
        }

        // 1. 全カード分のスロットを一括確保（既存手札を一度にスライドさせる）
        renderHand();

        // 2. 連続フライト演出（非同期で並列実行）
        const animPromises = drawQueue.map(async (card, idx) => {
            // 枚数に応じて発射タイミングをずらす（テテテテッというリズム）
            await new Promise(r => setTimeout(r, idx * 80));
            await animateDrawCard(card, idx);

            // 3. 各カード到着ごとに実体化
            delete card.isNew;
            renderHand();
        });

        await Promise.all(animPromises);

        GAME_STATE.isAnimating = false;
        updateUI();
    } else {
        // 相手側は瞬時に処理（必要なら後で演出追加可能）
        for (let i = 0; i < count; i++) {
            if (p.deck.length === 0 && p.trash.length > 0) {
                p.deck = shuffleArray([...p.trash]);
                p.trash = [];
            }
            if (p.deck.length === 0) break;
            p.hand.push(p.deck.pop());
        }
        updateUI();
    }
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

function executeSummon(side, cardData, slotIndex) {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;

    // 手札から削除
    const handIndex = p.hand.findIndex(c => c.id === cardData.id);
    if (handIndex !== -1) {
        p.hand.splice(handIndex, 1);
    }

    // フィールドへ配置
    p.field.monsters[slotIndex] = cardData;

    // フラグ更新
    if (side === GAME_STATE.turnPlayer) {
        GAME_STATE.hasNormalSummoned = true;
    }

    // UI更新
    hideCardDetail();
    if (side === "player") renderHand();
    renderFieldCard(side, "monster", slotIndex, cardData);

    console.log(`${side} Summoned ${cardData.name} to Slot ${slotIndex}`);
}

// ==========================================
// 5.5 アクション: 魔術発動 (Magic)
// ==========================================

/** 魔術が発動可能か判定 */
function checkCanActivateMagic(cardData) {
    if (GAME_STATE.phase !== "MAIN1" && GAME_STATE.phase !== "MAIN2") return false;
    // 魔術ゾーンに空きがあるか確認
    return GAME_STATE.player.field.magics.some(m => m === null);
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
function finishMagicSlotSelection(slotIdx) {
    if (!GAME_STATE.pendingCard) return;
    const cardData = GAME_STATE.pendingCard;
    const p = GAME_STATE.player;

    // 1. 手札から削除
    const handIndex = p.hand.findIndex(c => c.id === cardData.id);
    if (handIndex !== -1) p.hand.splice(handIndex, 1);

    // 2. 一旦魔術ゾーンに配置して描画（効果解決中であることを示す）
    p.field.magics[slotIdx] = cardData;
    renderFieldCard("player", "magic", slotIdx, cardData);

    // 3. 効果の解決を実行
    EffectLogic.resolveMagic(cardData, "player");

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
    if (GAME_STATE.phase !== "BATTLE") {
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

function resolveBattle(attacker, defender, atkIdx, defIdx) {
    console.log(`Battle: ${attacker.name} vs ${defender ? defender.name : "Direct"}`);

    if (!defender) {
        // ダイレクト
        damagePlayer("opponent", attacker.power);
    } else {
        // モンスター同士
        const pAtk = attacker.power;
        const pDef = defender.power;

        if (pAtk > pDef) {
            const damage = pAtk - pDef;
            damagePlayer("opponent", damage);
            destroyMonster("opponent", defIdx);
        } else if (pAtk === pDef) {
            destroyMonster("player", atkIdx);
            destroyMonster("opponent", defIdx);
        } else {
            const damage = pDef - pAtk;
            damagePlayer("player", damage);
            destroyMonster("player", atkIdx);
        }
    }
    updateUI();
}

function damagePlayer(side, amount) {
    if (side === "player") {
        GAME_STATE.player.lp = Math.max(0, GAME_STATE.player.lp - amount);
    } else {
        GAME_STATE.opponent.lp = Math.max(0, GAME_STATE.opponent.lp - amount);
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

function destroyMonster(side, slotIdx) {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    const card = p.field.monsters[slotIdx];

    if (card) {
        p.trash.push(card); // トラッシュ送り
        p.field.monsters[slotIdx] = null;

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
            const el = createCardElement(cardData, location);
            zoneEl.appendChild(el);
        }
    }
}

function createCardElement(cardData, location) {
    const el = document.createElement('div');
    el.className = 'card-mini';
    el.dataset.id = cardData.id;

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
                <img src="${cardData.image}" class="card-img-content" draggable="false">
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

    el.onclick = (e) => {
        e.stopPropagation();
        showCardDetail(cardData, location, e);
    };

    return el;
}

// ==========================================
// 8. 詳細画面 & 操作パネル
// ==========================================

function showCardDetail(cardData, location, event) {
    updateInfoPanel(cardData);

    // 手札の強調表示（浮き上がり）制御
    const handCards = document.querySelectorAll('#player-hand .card-mini');
    handCards.forEach(c => c.classList.remove('selected'));
    if (location === "hand" && event) {
        event.currentTarget.classList.add('selected');
    }

    // ターゲット選択モード中の処理
    if (GAME_STATE.isSelectingTarget && location === "opt-field") {
        const targetIdx = GAME_STATE.opponent.field.monsters.indexOf(cardData);
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
    const canShowAttack = (location === "ply-field" && isBattle && cardData.type === "monster");

    if (canShowSummon || canShowMagic || canShowAttack) {
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
        } else {
            btn.innerText = "攻撃";
            btn.className += " attack";
            const slotIdx = GAME_STATE.player.field.monsters.findIndex(m => m && m.id === cardData.id);
            btn.onclick = () => { container.innerHTML = ""; tryAttack(cardData, slotIdx); };
        }

        menu.appendChild(btn);
        container.appendChild(menu);
    }
}

// Old Action Menu Logic Removed (Now using showCardDetail with floating-actions)

// ==========================================
// 9. CPUロジック (簡易AI)
// ==========================================

function executeCpuTurn() {
    if (GAME_STATE.turnPlayer !== "opponent") return;

    console.log(`CPU Thinking... Phase: ${GAME_STATE.phase}`);

    // フェイズごとの行動
    switch (GAME_STATE.phase) {
        case "DRAW":
            setTimeout(advancePhase, 800);
            break;

        case "MAIN1":
            // モンスターがいなくて、手札があれば召喚 (簡易: デッキから生成してしまうチート召喚)
            // ※ 正しくは hand から出すが、CPUの手札管理を厳密にしていないため
            if (!GAME_STATE.opponent.field.monsters[1]) {
                const dummyCard = getCardData("m007"); // 海界の稚魚
                executeSummon("opponent", dummyCard, 1); // 中央に出す
            }
            setTimeout(advancePhase, 1200);
            break;

        case "BATTLE":
            // モンスターがいれば攻撃
            const attackerIdx = GAME_STATE.opponent.field.monsters.findIndex(m => m !== null);
            if (attackerIdx !== -1) {
                const atkCard = GAME_STATE.opponent.field.monsters[attackerIdx];
                // プレイヤーのモンスターがいるか？
                const playerTargets = GAME_STATE.player.field.monsters;
                const defIdx = playerTargets.findIndex(m => m !== null);

                if (defIdx !== -1) {
                    resolveBattle(atkCard, playerTargets[defIdx], attackerIdx, defIdx);
                } else {
                    damagePlayer("player", atkCard.power);
                    alert(`CPUの攻撃！ ${atkCard.power}ダメージ！`);
                    updateUI();
                }
            }
            setTimeout(advancePhase, 1500);
            break;

        case "MAIN2":
            setTimeout(advancePhase, 800);
            break;

        case "END":
            endTurn();
            break;
    }
}

/**
 * 左上のカード情報パネルを更新する
 */
function updateInfoPanel(cardData) {
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
        powerEl.innerText = `ATK: ${cardData.power}`;

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

function finishSlotSelection(slotIdx) {
    if (!GAME_STATE.pendingCard) return;

    // 1. 選択されたコストの支払いを実行（トラッシュ送り）
    GAME_STATE.selectedCosts.forEach(obj => {
        destroyMonster("player", obj.slotIdx);
    });

    // 2. 召喚実行
    executeSummon("player", GAME_STATE.pendingCard, slotIdx);

    // 3. クリーンアップ
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

    // 3. 枚数表示の更新
    if (type === "deck") {
        const badgeId = (side === "player") ? 'ply-deck-count-badge' : 'opt-deck-count';
        const badge = document.getElementById(badgeId);
        if (badge) badge.innerText = count;
    }
}

/**
 * モーダルを閉じて実際にデュエルを開始する
 */
function beginDuel() {
    const overlay = document.getElementById('game-start-overlay');
    overlay.style.display = "none";

    // 初期手札の配布と最初のターン開始
    drawCard("player", 5);
    drawCard("opponent", 5);
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