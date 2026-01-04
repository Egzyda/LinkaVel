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
    pendingCard: null       // 召喚待機中のカード
};

// ==========================================
// 2. 初期化・起動シーケンス
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("LinkaVel Game Engine Initializing...");

    // 安全装置: データロード確認
    if (typeof MASTER_CARDS === 'undefined' || typeof DECK_RECIPES === 'undefined') {
        alert("エラー: カードデータ(cards.js)が読み込まれていません。");
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
        s.style.display = 'none';
    });
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
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
    alert(isPlayerFirst ? "あなたが先行です！" : "相手が先行です！");

    // 画面表示を先行させることでレイアウトを安定させる
    showScreen('game-screen');

    // 描画バグ防止: 画面遷移(display:block)後に僅かな猶予を置いてから手札生成を開始する
    setTimeout(() => {
        drawCard("player", 5);
        drawCard("opponent", 5);
        updateUI();
        startTurnProcess();
    }, 150);
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
    if (confirm("メニューに戻りますか？現在のゲームは破棄されます。")) {
        showScreen('menu-screen');
    }
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

function drawCard(side, count) {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;

    for (let i = 0; i < count; i++) {
        // デッキ切れチェック (リフレッシュ規定)
        if (p.deck.length === 0) {
            if (p.trash.length > 0) {
                console.log(`${side}: Deck Refreshing...`);
                p.deck = shuffleArray([...p.trash]);
                p.trash = [];
                // ルール: リフレッシュしたら1枚ドローする (ループ内なので自然に次へ)
            } else {
                console.log(`${side}: No cards to draw/refresh.`);
                break;
            }
        }

        const card = p.deck.pop();
        p.hand.push(card);

        // ループ内での個別描画は廃止（updateUIに集約）
    }
    updateUI();
}

// ==========================================
// 5. アクション: 召喚 (Summon)
// ==========================================

/**
 * 召喚試行 (UIから呼ばれる)
 * 今回はコスト無視の簡易実装
 */
function trySummon(cardData) {
    // チェック1: メインフェイズか
    if (GAME_STATE.phase !== "MAIN1" && GAME_STATE.phase !== "MAIN2") {
        alert("メインフェイズのみ召喚できます。");
        return;
    }
    // チェック2: ターン1制限
    if (GAME_STATE.hasNormalSummoned) {
        alert("通常召喚は1ターンに1回までです。");
        return;
    }
    // チェック3: 空きスロット
    const emptySlot = GAME_STATE.player.field.monsters.findIndex(c => c === null);
    if (emptySlot === -1) {
        alert("モンスターゾーンがいっぱいです。");
        return;
    }

    // 実行
    executeSummon("player", cardData, emptySlot);
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
// 6. アクション: 攻撃 (Battle)
// ==========================================

function tryAttack(attackerCard, attackerSlotIdx) {
    // チェック: バトルフェイズか
    if (GAME_STATE.phase !== "BATTLE") {
        alert("攻撃はバトルフェイズのみ可能です。");
        return;
    }

    // ターゲット選択の簡易化
    // 相手モンスターがいるかチェック
    const optMonsters = GAME_STATE.opponent.field.monsters;
    const livingTargets = optMonsters.map((m, i) => ({ m, i })).filter(obj => obj.m !== null);

    if (livingTargets.length === 0) {
        // ダイレクトアタック
        if (confirm(`相手モンスターがいません。${attackerCard.name}でダイレクトアタックしますか？`)) {
            resolveBattle(attackerCard, null, attackerSlotIdx, -1);
        }
    } else {
        // 攻撃対象選択（今回は簡易的に、先頭のモンスターを自動攻撃 or ランダム）
        // ※ 本来はタップして選択だが、まずは「攻撃ボタン」でランダムな敵を殴る仕様で動通確認する
        const targetObj = livingTargets[0]; // 一番左の敵を殴る
        if (confirm(`${attackerCard.name} (ATK:${attackerCard.power}) で ${targetObj.m.name} (ATK:${targetObj.m.power}) を攻撃しますか？`)) {
            resolveBattle(attackerCard, targetObj.m, attackerSlotIdx, targetObj.i);
        }
    }
}

function resolveBattle(attacker, defender, atkIdx, defIdx) {
    console.log(`Battle: ${attacker.name} vs ${defender ? defender.name : "Direct"}`);

    if (!defender) {
        // ダイレクト
        damagePlayer("opponent", attacker.power);
        alert(`ダイレクトアタック成功！ ${attacker.power}ダメージ！`);
    } else {
        // モンスター同士
        const pAtk = attacker.power;
        const pDef = defender.power;

        if (pAtk > pDef) {
            const damage = pAtk - pDef;
            damagePlayer("opponent", damage);
            destroyMonster("opponent", defIdx);
            alert(`撃破！ 相手に${damage}ダメージ！`);
        } else if (pAtk === pDef) {
            destroyMonster("player", atkIdx);
            destroyMonster("opponent", defIdx);
            alert("相打ち！ 両者破壊！");
        } else {
            const damage = pDef - pAtk;
            damagePlayer("player", damage);
            destroyMonster("player", atkIdx);
            alert(`返り討ち... ${damage}ダメージを受けた！`);
        }
    }
    updateUI();
}

function damagePlayer(side, amount) {
    if (side === "player") GAME_STATE.player.lp -= amount;
    else GAME_STATE.opponent.lp -= amount;

    // 0以下チェック
    if (GAME_STATE.player.lp <= 0) alert("You Lose...");
    if (GAME_STATE.opponent.lp <= 0) alert("You Win!");
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
    document.getElementById('ply-deck-count-badge').innerText = GAME_STATE.player.deck.length;
    document.getElementById('opt-deck-count').innerText = GAME_STATE.opponent.deck.length;

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

    if (GAME_STATE.turnPlayer === "opponent" || isAutoPhase) {
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

    const handCount = GAME_STATE.player.hand.length;
    // 6枚以上で重なりを開始 (枚数が多いほど重なりを深くする)
    const overlap = handCount > 5 ? Math.max(-35, -5 * (handCount - 2)) : 4;

    GAME_STATE.player.hand.forEach((card, idx) => {
        const el = createCardElement(card, "hand");
        if (idx > 0) el.style.marginLeft = overlap + "px";
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
            const el = createCardElement(cardData, "field");
            zoneEl.appendChild(el);
        }
    }
}

function createCardElement(cardData, location) {
    const el = document.createElement('div');
    el.className = 'card-mini';
    el.dataset.id = cardData.id;

    // 背景・枠色
    if (cardData.type === 'monster') {
        el.style.borderColor = cardData.subType === 'effect' ? '#ff9900' : '#ffeebb';
    } else {
        el.style.borderColor = '#00d2ff';
    }

    // 属性ごとの簡易色分け
    const colorMap = { "火": "#551111", "水": "#111155", "草": "#115511" };
    const bgBase = colorMap[cardData.attribute] || "#333";
    el.style.background = `linear-gradient(135deg, ${bgBase}, #000)`;

    // transformの設定はstyle.cssに一任するため、JS側での強制上書きを廃止

    // 情報表示
    // 名前 (横幅圧縮設定)
    const nameEl = document.createElement('div');
    nameEl.innerText = cardData.name;
    nameEl.style.fontSize = "8px";
    nameEl.style.color = "#fff";
    nameEl.style.position = "absolute";
    nameEl.style.top = "2px";
    nameEl.style.left = "2px";
    nameEl.style.width = "calc(100% - 4px)";
    nameEl.style.whiteSpace = "nowrap";
    nameEl.style.transformOrigin = "left center";

    // 文字数に応じて横幅を圧縮 (全角6文字以上で圧縮開始)
    const charLimit = 6;
    if (cardData.name.length > charLimit) {
        const scale = charLimit / cardData.name.length;
        nameEl.style.transform = `scaleX(${scale})`;
    }
    el.appendChild(nameEl);

    // 属性・レベル・ATK
    const infoEl = document.createElement('div');
    if (cardData.type === 'monster') {
        infoEl.innerText = `${cardData.attribute} / Lv${cardData.level}\nATK ${cardData.power}`;
    } else {
        infoEl.innerText = "MAGIC";
    }
    infoEl.style.position = "absolute";
    infoEl.style.bottom = "2px";
    infoEl.style.right = "2px";
    infoEl.style.fontSize = "8px";
    infoEl.style.textAlign = "right";
    infoEl.style.lineHeight = "1";
    el.appendChild(infoEl);

    // イベント
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

    // 相手のターンならアクションは出さない
    if (GAME_STATE.turnPlayer !== "player") return;

    // 既存のアクションメニューをクリア
    const container = document.getElementById('floating-action-container');
    container.innerHTML = "";

    // ボタンが必要な状況か判定
    const isMain = (GAME_STATE.phase === "MAIN1" || GAME_STATE.phase === "MAIN2");
    const isBattle = (GAME_STATE.phase === "BATTLE");

    if ((location === "hand" && isMain && cardData.type === "monster" && !GAME_STATE.hasNormalSummoned) ||
        (location === "field" && isBattle && cardData.type === "monster")) {

        const menu = document.createElement('div');
        menu.className = 'floating-actions';

        // カードの座標に合わせて配置
        const rect = event.currentTarget.getBoundingClientRect();
        menu.style.left = `${rect.left + rect.width/2}px`;
        menu.style.top = `${rect.top - 20}px`;
        menu.style.transform = 'translateX(-50%) translateY(-100%)';

        // 座標確定後に表示（描画の飛び跳ねを防止）
        menu.style.opacity = "1";

        const btn = document.createElement('button');
        btn.className = 'btn-action-float';

        if (location === "hand") {
            btn.innerText = "召喚する";
            btn.onclick = () => startSlotSelection(cardData);
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

    const nameEl = document.getElementById('info-name');
    const attrEl = document.getElementById('info-attr');
    const levelEl = document.getElementById('info-level');
    const powerEl = document.getElementById('info-power');
    const textEl = document.getElementById('info-text');

    nameEl.innerText = cardData.name;
    attrEl.innerText = `[${cardData.attribute}]`;
    textEl.innerText = cardData.text;

    // 表示制御をCSSに委ねる（overflow-y: auto）
    textEl.scrollTop = 0;

    if (cardData.type === 'monster') {
        levelEl.innerText = `Lv.${cardData.level}`;
        powerEl.innerText = `ATK: ${cardData.power}`;
    } else {
        levelEl.innerText = "MAGIC";
        powerEl.innerText = "";
    }
}

/** 召喚先選択モードの開始 */
function startSlotSelection(cardData) {
    document.getElementById('floating-action-container').innerHTML = "";
    GAME_STATE.isSelectingSlot = true;
    GAME_STATE.pendingCard = cardData;

    // モンスターゾーンを光らせる
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-monster-${i}`);
        if (GAME_STATE.player.field.monsters[i] === null) {
            zone.classList.add('highlight');
            zone.onclick = () => finishSlotSelection(i);
        }
    });

    // キャンセル用に背景クリックイベントを一時的に貼る
    setTimeout(() => {
        document.body.onclick = cancelSlotSelection;
    }, 10);
}

function finishSlotSelection(slotIdx) {
    if (!GAME_STATE.pendingCard) return;
    executeSummon("player", GAME_STATE.pendingCard, slotIdx);
    cancelSlotSelection();
}

function cancelSlotSelection() {
    GAME_STATE.isSelectingSlot = false;
    GAME_STATE.pendingCard = null;
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-monster-${i}`);
        zone.classList.remove('highlight');
        zone.onclick = null;
    });
    document.body.onclick = () => hideCardDetail();
}

function hideCardDetail() {
    document.getElementById('floating-action-container').innerHTML = "";
}