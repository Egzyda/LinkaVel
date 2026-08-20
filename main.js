/**
 * LinkaVel Card Game - Main Logic (Rebuilt for Stability)
 * * 蠖ｹ蜑ｲ: 繧ｲ繝ｼ繝縺ｮ繧ｳ繧｢繧ｵ繧､繧ｯ繝ｫ・医ラ繝ｭ繝ｼ縲∝小蝟壹∵姶髣倥√ち繝ｼ繝ｳ騾ｲ陦鯉ｼ峨・遒ｺ螳溘↑螳溯｡・
 * * 迚ｹ險倅ｺ矩・
 * - 蛻晄悄LP 5000
 * - 蜿ｬ蝟壹さ繧ｹ繝医↑縺暦ｼ医ユ繧ｹ繝育畑邁｡譏灘ｮ溯｣・ｼ・
 * - 蜈郁｡・繧ｿ繝ｼ繝ｳ逶ｮ縺ｮ繝峨Ο繝ｼ繝ｻ謾ｻ謦・宛髯仙ｮ溯｣・ｸ医∩
 * - 繝・ャ繧ｭ蛻・ｌ譎ゅ・繝ｪ繝輔Ξ繝・す繝･・医ヨ繝ｩ繝・す繝･蝗槫庶・牙ｮ溯｣・ｸ医∩
 */

// ==========================================
// 0. 逍台ｼｼ荵ｱ謨ｰ逕滓・蝎ｨ (PRNG) for 豎ｺ螳夊ｫ也噪蜷梧悄
// ==========================================
let _rngSeed = 12345;
window.setGameSeed = function(seed) {
    _rngSeed = seed;
};
window.GameRandom = function() {
    // LCG (Linear Congruential Generator)
    _rngSeed = (_rngSeed * 9301 + 49297) % 233280;
    return _rngSeed / 233280;
};

// ==========================================
// 1. 繧ｲ繝ｼ繝迥ｶ諷狗ｮ｡逅・(Game State)
// ==========================================
const GAME_STATE = {
    // 繧ｿ繝ｼ繝ｳ邂｡逅・
    turnCount: 1,           // 邨碁℃繧ｿ繝ｼ繝ｳ謨ｰ
    turnSerial: 1,          // 謇狗分縺ｮ騾壹＠逡ｪ蜿ｷ・育ｽ縺ｮ縲御ｼ上○縺溘ち繝ｼ繝ｳ縺ｯ逋ｺ蜍穂ｸ榊庄縲榊愛螳夂畑・・
    isFirstTurnOfGame: true,// 繧ｲ繝ｼ繝髢句ｧ狗峩蠕後・繝輔Λ繧ｰ・亥・陦・繧ｿ繝ｼ繝ｳ逶ｮ蛻､螳夂畑・・
    phase: "DRAW",
    phases: ["DRAW", "MAIN1", "BATTLE", "MAIN2", "END"],

    // 謇狗分邂｡逅・
    turnPlayer: "player",   // "player" | "opponent"
    hasNormalSummoned: false, // 繧ｿ繝ｼ繝ｳ荳ｭ縺ｮ蜿ｬ蝟壽ｸ医∩繝輔Λ繧ｰ
    isGameOver: false,        // 豎ｺ逹貂医∩繝輔Λ繧ｰ・井ｻ･髯阪・蜃ｦ逅・ｒ荳蛻・｡後ｏ縺ｪ縺・ｼ・

    // 繝励Ξ繧､繝､繝ｼ迥ｶ諷・
    player: {
        lp: 5000, // 繝ｫ繝ｼ繝ｫ貅匁侠
        deck: [],
        hand: [],
        trash: [],
        banished: [], // 髯､螟悶だ繝ｼ繝ｳ・医％縺ｮ繧ｲ繝ｼ繝荳ｭ縺ｯ荳蛻・ｹｲ貂峨〒縺阪↑縺・ｼ・
        refreshCount: 0,
        field: {
            monsters: [null, null, null],
            magics: [null, null, null]
        }
    },

    // 逶ｸ謇狗憾諷・
    opponent: {
        lp: 5000, // 繝ｫ繝ｼ繝ｫ貅匁侠
        deck: [],
        hand: [], // CPU縺ｯ邁｡譏鍋ｮ｡逅・・縺溘ａ驟榊・縺ｧ謖√▽縺後∝渕譛ｬ縺ｯ謨ｰ縺ｮ縺ｿ蜿ら・縺ｧ繧ょ庄
        trash: [],
        banished: [],
        refreshCount: 0,
        field: {
            monsters: [null, null, null],
            magics: [null, null, null]
        }
    },

    // UI謫堺ｽ懃畑
    selectedCard: null,
    selectedCardLocation: null,
    isSelectingSlot: false, // 蜿ｬ蝟壼・驕ｸ謚槭Δ繝ｼ繝我ｸｭ縺・
    isSelectingTarget: false, // 謾ｻ謦・ｯｾ雎｡驕ｸ謚槭Δ繝ｼ繝我ｸｭ縺・
    pendingCard: null,       // 蜿ｬ蝟壼ｾ・ｩ滉ｸｭ縺ｮ繧ｫ繝ｼ繝・
    attackerPending: null,   // 謾ｻ謦・ｾ・ｩ滉ｸｭ縺ｮ諠・ｱ {card, slotIdx}
    isSelectingCost: false,  // 繧ｳ繧ｹ繝磯∈謚樔ｸｭ縺・
    selectedCosts: [],       // 驕ｸ謚槭＆繧後◆繧ｳ繧ｹ繝亥ｯｾ雎｡ [{card, slotIdx, from:"field"|"hand"}]
    isAnimating: false       // 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ荳ｭ・・I繝ｭ繝・け逕ｨ・・
};

/**
 * 繧ｫ繝ｼ繝峨′蝣ｴ繧帝屬繧後ｋ髫帙↓縲∝倶ｽ薙↓莉倥＞縺滉ｸ譎ら憾諷九ｒ縺吶∋縺ｦ豸医☆縲・
 * 縺薙ｌ繧帝壹＆縺ｪ縺・→縲∬・逕溘＠縺溘Δ繝ｳ繧ｹ繧ｿ繝ｼ縺後梧判謦・ｸ医∩縲阪・縺ｾ縺ｾ縺縺｣縺溘ｊ
 * 蜿､縺・ョ繝舌ヵ繧貞ｼ輔″縺壹▲縺溘∪縺ｾ繝医Λ繝・す繝･・上ョ繝・く縺ｫ謌ｻ縺｣縺ｦ縺励∪縺・・
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

/** 繧ｫ繝ｼ繝峨ｒ繝医Λ繝・す繝･縺ｸ騾√ｋ・亥倶ｽ鍋憾諷九・繝ｪ繧ｻ繝・ヨ繧剃ｿ晁ｨｼ縺吶ｋ蜈ｱ騾夂ｵ瑚ｷｯ・・*/
function sendCardToTrash(side, card) {
    if (!card) return;
    GAME_STATE[side].trash.push(resetCardState(card));
}

/** 繧ｫ繝ｼ繝峨ｒ髯､螟悶☆繧具ｼ医％縺ｮ繧ｲ繝ｼ繝荳ｭ縺ｯ蠕ｩ蟶ｰ繝ｻ蜿ら・縺ｨ繧ゅ↓荳榊庄・・*/
function banishCard(side, card) {
    if (!card) return;
    GAME_STATE[side].banished.push(resetCardState(card));
    console.log(`${side} banished ${card.name}`);
}

// ==========================================
// 2. 蛻晄悄蛹悶・襍ｷ蜍輔す繝ｼ繧ｱ繝ｳ繧ｹ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("LinkaVel Game Engine Initializing...");

    // 螳牙・陬・ｽｮ: 繝・・繧ｿ繝ｭ繝ｼ繝臥｢ｺ隱・
    if (typeof MASTER_CARDS === 'undefined' || typeof DECK_RECIPES === 'undefined') {
        console.error("繧ｨ繝ｩ繝ｼ: 繧ｫ繝ｼ繝峨ョ繝ｼ繧ｿ(cards.js)縺瑚ｪｭ縺ｿ霎ｼ縺ｾ繧後※縺・∪縺帙ｓ縲・);
        return;
    }

    setupEventListeners();
    updateViewportScale();
    window.addEventListener('resize', updateViewportScale);
    window.addEventListener('orientationchange', updateViewportScale);

    // 蛹ｿ蜷阪Ο繧ｰ繧､繝ｳ縺ｯ襍ｷ蜍墓凾縺ｫ荳蠎ｦ縺縺第ｸ医∪縺帙※縺翫￥縲・
    // 繝・ャ繧ｭ繝薙Ν繝繝ｼ繧帝幕縺九★縺ｫ繝・Η繧ｨ繝ｫ縺ｸ蜈･繧九→菫晏ｭ倥ョ繝・く縺瑚ｪｭ繧√↑縺・撫鬘後∈縺ｮ蟇ｾ蜃ｦ縲・
    ensureAuth();

    console.log("LinkaVel Game Engine Ready.");
});

/**
 * Firebase蛹ｿ蜷阪Ο繧ｰ繧､繝ｳ繧剃ｿ晁ｨｼ縺吶ｋ・亥､夐㍾蜻ｼ縺ｳ蜃ｺ縺励・蜷後§Promise繧貞・譛会ｼ・
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
                authPromise = null; // 谺｡蝗槭Μ繝医Λ繧､縺ｧ縺阪ｋ繧医≧縺ｫ縺吶ｋ
                return null;
            });
    }
    return authPromise;
}

/**
 * ensureAuth 縺ｫ繧ｿ繧､繝繧｢繧ｦ繝医ｒ縺､縺代◆繝ｩ繝・ヱ繝ｼ縲・
 * 謖・ｮ壽凾髢灘・縺ｫ隱崎ｨｼ縺悟ｮ御ｺ・＠縺ｪ縺上※繧・null 繧定ｿ斐＠縺ｦ蜃ｦ逅・ｒ邯夊｡後＆縺帙ｋ縲・
 * Loading... 縺ｧ豌ｸ荵・↓豁｢縺ｾ繧九ヰ繧ｰ繧帝亟縺舌・
 */
function ensureAuthWithTimeout(ms = 3000) {
    const timeout = new Promise(resolve => setTimeout(() => resolve(null), ms));
    return Promise.race([ensureAuth(), timeout]);
}
window.ensureAuth = ensureAuth;

/**
 * PC遲峨・蠎・＞逕ｻ髱｢縺ｧ縺ｯ縲√せ繝槭・險ｭ險医・繝ｬ繧､繧｢繧ｦ繝医ｒ菫昴▲縺溘∪縺ｾ諡｡螟ｧ縺吶ｋ縲・
 * 蟷・□縺大ｺ・￡繧九→繧ｫ繝ｼ繝峨′雎・ｲ偵・縺ｾ縺ｾ菴咏區縺縺大｢励∴縺ｦ縺励∪縺・◆繧√・
 * 險ｭ險医し繧､繧ｺ(480x900)繧貞渕貅悶↓遲牙阪せ繧ｱ繝ｼ繝ｫ繧呈寺縺代ｋ譁ｹ蠑上↓縺励※縺・ｋ縲・
 */
const DESIGN_WIDTH = 480;
const DESIGN_HEIGHT = 720;

function updateViewportScale() {
    const viewport = document.getElementById('game-viewport');
    if (!viewport) return;

    // 繧ｹ繝槭・蟷・〒縺ｯ蠕捺擂騾壹ｊ縺ｮ豬∝虚繝ｬ繧､繧｢繧ｦ繝茨ｼ・SS蛛ｴ縺ｮ繝｡繝・ぅ繧｢繧ｯ繧ｨ繝ｪ縺ｨ謠・∴繧具ｼ・
    if (window.innerWidth <= 480) {
        viewport.style.transform = "";
        return;
    }

    const scale = Math.min(
        window.innerWidth / DESIGN_WIDTH,
        window.innerHeight / DESIGN_HEIGHT,
        1.7 // 諡｡螟ｧ縺励☆縺弱※邊励￥縺ｪ繧峨↑縺・ｈ縺・ｸ企剞繧定ｨｭ縺代ｋ
    );
    viewport.style.transform = `scale(${scale})`;
}

function setupEventListeners() {
    // 髯榊盾繝懊ち繝ｳ
    const surrenderBtn = document.getElementById('surrender-btn');
    if (surrenderBtn) {
        surrenderBtn.addEventListener('click', async () => {
            if (await window.showCustomConfirm("譛ｬ蠖薙↓髯榊盾縺励∪縺吶°・・)) {
                endGameSequence("opponent");
            }
        });
    }

    // 繝輔ぉ繧､繧ｺ騾ｲ陦後・繧ｿ繝ｳ
    const nextPhaseBtn = document.getElementById('next-phase-btn');
    if (nextPhaseBtn) {
        nextPhaseBtn.addEventListener('click', () => {
            // 繝励Ξ繧､繝､繝ｼ縺ｮ繧ｿ繝ｼ繝ｳ縺九▽縲，PU蜃ｦ逅・ｸｭ縺ｧ縺ｪ縺・ｴ蜷医・縺ｿ騾ｲ陦悟庄閭ｽ
            if (GAME_STATE.turnPlayer === "player") {
                advancePhase();
            }
        });
    }

    // 隧ｳ邏ｰ陦ｨ遉ｺ繧帝哩縺倥ｋ・郁レ譎ｯ繧ｿ繝・・・・
    document.body.addEventListener('click', (e) => {
        // 繧ｫ繝ｼ繝芽ｦ∫ｴ繧・・繧ｿ繝ｳ縺ｪ縺ｩ繧偵け繝ｪ繝・け縺励◆蝣ｴ蜷医・髢峨§縺ｪ縺・
        if (!e.target.closest('.card-mini') && !e.target.closest('#card-detail-overlay') && !e.target.closest('.btn-action-float') && !e.target.closest('.floating-actions')) {
            hideCardDetail();
        }
    });
}

// 逕ｻ髱｢驕ｷ遘ｻ
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
    });
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
    }
}

// 繧ｲ繝ｼ繝髢句ｧ句・逅・ｼ医％縺薙′繧ｨ繝ｳ繝医Μ繝ｼ繝昴う繝ｳ繝茨ｼ・
function startSinglePlay() {
    _pendingPlayerDeck = null;
    showScreen('deck-select-screen');
    renderDeckSelection("player");
}

/**
 * 繝・ャ繧ｭ驕ｸ謚槭・騾ｲ陦檎憾諷九・
 * 閾ｪ蛻・・繝・ャ繧ｭ繧帝∈繧薙□縺ゅ→縲∫ｶ壹￠縺ｦ逶ｸ謇九・繝・ャ繧ｭ繧帝∈縺ｰ縺帙ｋ縲・
 */
let _pendingPlayerDeck = null;

/**
 * 繝・ャ繧ｭ驕ｸ謚槭Μ繧ｹ繝医ｒ蜍慕噪縺ｫ逕滓・ (繝・Η繧ｨ繝ｫ髢句ｧ狗畑)
 * @param {"player"|"opponent"} target 縺ｩ縺｡繧峨・繝・ャ繧ｭ繧帝∈繧薙〒縺・ｋ縺・
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
            ? "逶ｸ謇九′菴ｿ縺・ョ繝・く繧帝∈謚槭＠縺ｦ縺上□縺輔＞"
            : "菴ｿ逕ｨ縺吶ｋ繝・ャ繧ｭ繧帝∈謚槭＠縺ｦ縺上□縺輔＞";
    }

    let html = "";

    // 逶ｸ謇九ョ繝・く驕ｸ謚槭・縺ｨ縺阪・縲√∪縺壹Λ繝ｳ繝繝繧帝∈縺ｹ繧九ｈ縺・↓縺吶ｋ
    if (isOpponent) {
        html += `
            <button class="menu-btn custom-deck-item" onclick="selectOpponentDeck('random', 'random')">
                <span class="btn-text">縺翫∪縺九○・医Λ繝ｳ繝繝・・<small class="deck-manage-tag starter">RANDOM</small></span>
            </button>
            <hr style="border:0; border-top:1px solid #333; margin:10px 0; width:100%;">
        `;
    }

    // 1. 繝ｦ繝ｼ繧ｶ繝ｼ繝・ャ繧ｭ (Firestore) 繧貞・縺ｫ陦ｨ遉ｺ縲・
    //    3遘剃ｻ･蜀・↓隱崎ｨｼ縺ｧ縺阪↑縺代ｌ縺ｰ繧ｿ繧､繝繧｢繧ｦ繝医＠縺ｦ繧ｹ繧ｭ繝・・・・oading蝗ｺ縺ｾ繧企亟豁｢・峨・
    let userDeckLoaded = false;
    if (typeof DeckBuilder !== 'undefined') {
        try {
            const user = await ensureAuthWithTimeout(3000);
            if (user) {
                const userDecks = await DeckBuilder.fetchUserDecks();
                userDecks.forEach(deck => {
                    html += createDeckItemHtml(deck.id, deck.name, "user", true, target);
                });
                userDeckLoaded = true;
            }
        } catch (e) {
            console.warn("繝ｦ繝ｼ繧ｶ繝ｼ繝・ャ繧ｭ蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆・医せ繧ｿ繝ｼ繧ｿ繝ｼ繝・ャ繧ｭ縺ｮ縺ｿ陦ｨ遉ｺ・・", e);
        }
    }

    // 繝ｦ繝ｼ繧ｶ繝ｼ繝・ャ繧ｭ縺瑚ｪｭ縺ｿ霎ｼ繧√↑縺九▲縺溷ｴ蜷医・蜀崎ｪｭ縺ｿ霎ｼ縺ｿ繝懊ち繝ｳ繧定｡ｨ遉ｺ
    if (!userDeckLoaded && typeof DeckBuilder !== 'undefined') {
        html += `
            <button class="menu-btn" style="font-size:0.8rem; opacity:0.8;" onclick="renderDeckSelection('${target}')">
                <span class="btn-icon">売</span>
                <span class="btn-text">閾ｪ蛻・・繝・ャ繧ｭ繧貞・隱ｭ縺ｿ霎ｼ縺ｿ</span>
            </button>
            <hr style="border:0; border-top:1px solid #333; margin:10px 0; width:100%;">
        `;
    }

    // 2. 繧ｹ繧ｿ繝ｼ繧ｿ繝ｼ繝・ャ繧ｭ縺ｯ蠢・★陦ｨ遉ｺ
    Object.keys(DECK_RECIPES).forEach(key => {
        const recipe = DECK_RECIPES[key];
        html += createDeckItemHtml(key, recipe.name, "starter", true, target);
    });

    container.innerHTML = html;
    container.scrollTop = 0;
}

/** 閾ｪ蛻・・繝・ャ繧ｭ繧帝∈繧薙□縺ゅ→縲∫嶌謇九・繝・ャ繧ｭ驕ｸ謚槭∈騾ｲ繧 */
function selectPlayerDeck(deckId, type) {
    _pendingPlayerDeck = { deckId, type };
    renderDeckSelection("opponent");
}

/** 逶ｸ謇九・繝・ャ繧ｭ縺梧ｱｺ縺ｾ縺｣縺溘ｉ繝・Η繧ｨ繝ｫ髢句ｧ・*/
function selectOpponentDeck(deckId, type) {
    if (!_pendingPlayerDeck) return;
    const mine = _pendingPlayerDeck;
    _pendingPlayerDeck = null;
    confirmDeckSelection(mine.deckId, mine.type, deckId, type);
}

/** 繝・ャ繧ｭ驕ｸ謚樒判髱｢縺ｮBACK縲ら嶌謇九ョ繝・く驕ｸ謚樔ｸｭ縺ｪ繧芽・蛻・・繝・ャ繧ｭ驕ｸ謚槭∈謌ｻ繧・*/
function backFromDeckSelect() {
    if (_pendingPlayerDeck) {
        _pendingPlayerDeck = null;
        renderDeckSelection("player");
        return;
    }
    backToMenu();
}

/**
 * 繝・ャ繧ｭ邂｡逅・判髱｢縺ｮ謠冗判 (邱ｨ髮・・蜑企勁繝ｻ繧ｳ繝斐・)
 */
async function renderDeckManager() {
    const container = document.getElementById('deck-list-container');
    container.innerHTML = "<div style='color:#fff;text-align:center;'>Loading...</div>";

    // 繝・Η繧ｨ繝ｫ逕ｨ縺ｮ繝・ャ繧ｭ驕ｸ謚槭→逕ｻ髱｢繧貞・逕ｨ縺励※縺・ｋ縺ｮ縺ｧ縲∬ｦ句・縺励ｒ邂｡逅・畑縺ｫ謌ｻ縺・
    _pendingPlayerDeck = null;
    const title = document.getElementById('deck-select-title');
    const subtitle = document.getElementById('deck-select-subtitle');
    if (title) title.innerText = "Deck Build";
    if (subtitle) subtitle.innerText = "繝・ャ繧ｭ繧剃ｽ懈・繝ｻ邱ｨ髮・〒縺阪∪縺・;

    // 譁ｰ隕丈ｽ懈・繝懊ち繝ｳ
    let html = `
        <button class="menu-btn" onclick="DeckBuilder.startSession(null); showScreen('deck-screen');">
            <span class="btn-icon">・・/span>
            <span class="btn-text">譁ｰ隕上ョ繝・く菴懈・</span>
        </button>
        <hr style="border:0; border-top:1px solid #333; margin:10px 0; width:100%;">
    `;

    // 繝ｦ繝ｼ繧ｶ繝ｼ繝・ャ繧ｭ荳隕ｧ・郁ｪ崎ｨｼ繧ｿ繧､繝繧｢繧ｦ繝医・繧ｨ繝ｩ繝ｼ譎ゅｂ遨ｺ繝ｪ繧ｹ繝医〒邯夊｡鯉ｼ・
    try {
        const user = await ensureAuthWithTimeout(3000);
        if (user) {
            const userDecks = await DeckBuilder.fetchUserDecks();
            if (userDecks.length === 0) {
                html += `<div style="color:#666;text-align:center;padding:20px;">菫晏ｭ倥＆繧後◆繝・ャ繧ｭ縺ｯ縺ゅｊ縺ｾ縺帙ｓ</div>`;
            } else {
                userDecks.forEach(deck => {
                    html += createDeckItemHtml(deck.id, deck.name, "user", false);
                });
            }
        } else {
            html += `<div style="color:#666;text-align:center;padding:20px;">繝ｭ繧ｰ繧､繝ｳ荳ｭ... 繝・ャ繧ｭ荳隕ｧ繧定ｪｭ縺ｿ霎ｼ繧√∪縺帙ｓ縺ｧ縺励◆</div>`;
        }
    } catch (e) {
        console.warn("繝・ャ繧ｭ荳隕ｧ蜿門ｾ励↓螟ｱ謨・", e);
        html += `<div style="color:#666;text-align:center;padding:20px;">繝・ャ繧ｭ荳隕ｧ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆</div>`;
    }

    container.innerHTML = html;
}

function createDeckItemHtml(id, name, type, isDuelMode, target = "player") {
    const tagClass = type === 'starter' ? 'starter' : 'user';
    const tagName = type === 'starter' ? 'STARTER' : 'USER';

    if (isDuelMode) {
        // 繝・Η繧ｨ繝ｫ髢句ｧ九Δ繝ｼ繝・ 繧ｷ繝ｳ繝励Ν縺ｪ繝懊ち繝ｳ
        const handler = (target === "opponent") ? "selectOpponentDeck" : "selectPlayerDeck";
        return `
            <button class="menu-btn custom-deck-item" onclick="${handler}('${id}', '${type}')">
                <span class="btn-text">${name} <small class="deck-manage-tag ${tagClass}">${tagName}</small></span>
            </button>
        `;
    } else {
        // 邂｡逅・Δ繝ｼ繝・ 邱ｨ髮・・繧ｳ繝斐・繝ｻ蜑企勁繝懊ち繝ｳ莉倥″
        return `
            <div class="deck-manage-item">
                <div class="deck-manage-header">
                    <span class="deck-manage-title">${name}</span>
                    <span class="deck-manage-tag ${tagClass}">${tagName}</span>
                </div>
                <div class="deck-manage-actions">
                    <button class="dm-btn primary" onclick="DeckBuilder.startSession('${id}'); showScreen('deck-screen');">邱ｨ髮・/button>
                    <button class="dm-btn" onclick="DeckBuilder.copyDeck('${id}')">繧ｳ繝斐・</button>
                    <button class="dm-btn danger" onclick="deleteDeckAndReload('${id}')">蜑企勁</button>
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
 * 繝・ャ繧ｭ遒ｺ螳壼ｾ後・蛻晄悄蛹悶・繝ｭ繧ｻ繧ｹ
 */
async function confirmDeckSelection(deckId, type, oppDeckId = "random", oppType = "random") {
    // 蜑榊屓縺ｮ蟇ｾ謌ｦ邨先棡・・P繝ｻ豎ｺ逹繝輔Λ繧ｰ遲会ｼ峨ｒ遒ｺ螳溘↓蛻晄悄蛹悶＠縺ｦ縺九ｉ邨・∩逶ｴ縺・
    resetGameState();

    // 繝励Ξ繧､繝､繝ｼ縺ｮ繝・ャ繧ｭ繧貞・譛溷喧
    await initDeck("player", deckId, type);

    // 逶ｸ謇九・繝・ャ繧ｭ縲よ欠螳壹′縺ｪ縺代ｌ縺ｰ繧ｹ繧ｿ繝ｼ繧ｿ繝ｼ縺九ｉ繝ｩ繝ｳ繝繝縺ｫ豎ｺ繧√ｋ
    if (oppType === "random" || !oppDeckId) {
        const allKeys = Object.keys(DECK_RECIPES);
        const randomKey = allKeys[Math.floor(GameRandom() * allKeys.length)];
        await initDeck("opponent", randomKey, "starter");
    } else {
        await initDeck("opponent", oppDeckId, oppType);
    }

    // 蜈郁｡後・蠕梧判豎ｺ螳・(50%縺ｧ繝ｩ繝ｳ繝繝)
    const isPlayerFirst = GameRandom() < 0.5;
    GAME_STATE.turnPlayer = isPlayerFirst ? "player" : "opponent";

    // 逕ｻ髱｢陦ｨ遉ｺ繧貞・陦後＆縺帙ｋ
    showScreen('game-screen');

    // 繧ｹ繧ｿ繝ｼ繝医Δ繝ｼ繝繝ｫ縺ｮ貅門ｙ
    const overlay = document.getElementById('game-start-overlay');
    const msg = document.getElementById('start-message');

    overlay.style.display = "flex";
    if (isPlayerFirst) {
        msg.innerText = "縺ゅ↑縺溘′蜈郁｡後〒縺・;
        msg.style.color = "var(--accent-blue)";
    } else {
        msg.innerText = "縺ゅ↑縺溘′蠕梧判縺ｧ縺・;
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

    // 繝励Ξ繧､繝､繝ｼ繝ｪ繧ｻ繝・ヨ
    GAME_STATE.player.lp = 5000;
    GAME_STATE.player.refreshCount = 0;
    GAME_STATE.player.deck = [];
    GAME_STATE.player.hand = [];
    GAME_STATE.player.trash = [];
    GAME_STATE.player.banished = [];
    GAME_STATE.player.field.monsters = [null, null, null];
    GAME_STATE.player.field.magics = [null, null, null];

    // 逶ｸ謇九Μ繧ｻ繝・ヨ
    GAME_STATE.opponent.lp = 5000;
    GAME_STATE.opponent.refreshCount = 0;
    GAME_STATE.opponent.deck = [];
    GAME_STATE.opponent.hand = [];
    GAME_STATE.opponent.trash = [];
    GAME_STATE.opponent.banished = [];
    GAME_STATE.opponent.field.monsters = [null, null, null];
    GAME_STATE.opponent.field.magics = [null, null, null];

    // UI繧ｯ繝ｪ繝ｼ繝ｳ繧｢繝・・
    document.getElementById('player-hand').innerHTML = "";
    _renderedHandCards = [];
    document.getElementById('opponent-hand').innerHTML = "";
    _renderedOppHandCount = -1;
    _pendingLpDisplay.player = null;
    _pendingLpDisplay.opponent = null;
    clearToastMessage();

    // 蜑阪・蟇ｾ謌ｦ縺ｧ隕九※縺・◆繧ｫ繝ｼ繝峨′谿九ｉ縺ｪ縺・ｈ縺・∬ｩｳ邏ｰ繝代ロ繝ｫ繧ょ・譛溽憾諷九↓謌ｻ縺・
    clearInfoPanel();

    // UI繝ｬ繧､繝､繝ｼ縺ｮ繝昴う繝ｳ繧ｿ繝ｼ謫堺ｽ懊ｒ蜑企勁・亥憶菴懃畑髦ｲ豁｢・・
    // CSS縺ｮ繝・ヵ繧ｩ繝ｫ繝郁ｨｭ螳壹↓蟋斐・繧・

    // 貍泌・繝ｻ驕ｸ謚槭Δ繝ｼ繝峨・繝輔Λ繧ｰ繧偵☆縺ｹ縺ｦ蠑ｷ蛻ｶ繝ｪ繧ｻ繝・ヨ
    GAME_STATE.isAnimating = false;
    GAME_STATE.isSelectingSlot = false;
    GAME_STATE.isSelectingTarget = false;
    GAME_STATE.isSelectingCost = false;
    GAME_STATE.pendingCard = null;
    GAME_STATE.attackerPending = null;
    GAME_STATE.selectedCosts = [];

    // 驕ｸ謚槭Δ繝ｼ繝臥畑CSS繧ｯ繝ｩ繧ｹ縺ｮ繧ｯ繝ｪ繝ｼ繝ｳ繧｢繝・・
    document.getElementById('game-viewport').classList.remove('field-selecting');
    document.getElementById('field-surface').classList.remove('selecting-mode');

    // 繝ｪ繧ｶ繝ｫ繝医が繝ｼ繝舌・繝ｬ繧､縺ｮ迥ｶ諷九ｒ螳悟・縺ｫ繝ｪ繧ｻ繝・ヨ・医う繝ｳ繝ｩ繧､繝ｳ繧ｹ繧ｿ繧､繝ｫ縺ｨ繧ｯ繝ｩ繧ｹ繧呈ｶ亥悉・・
    const overlay = document.getElementById('game-result-overlay');
    if (overlay) {
        overlay.removeAttribute('style');
        overlay.classList.remove("active", "result-win", "result-lose");
        // 蠑ｷ蛻ｶ繝ｪ繝輔Ο繝ｼ・医い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ縺ｮ繝ｪ繧ｻ繝・ヨ繧剃ｿ晁ｨｼ・・
        void overlay.offsetWidth;
    }

    cleanFieldZones();

    // HUD繧ょ・譛溷､縺ｫ謠上″逶ｴ縺吶・
    // 縺薙％縺ｧ譖ｴ譁ｰ縺励↑縺・→縲∵ｬ｡縺ｮ蟇ｾ謌ｦ縺悟ｧ九∪繧九∪縺ｧ蜑阪・蟇ｾ謌ｦ縺ｮLP縺瑚｡ｨ遉ｺ縺ｫ谿九ｋ縲・
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

    // 繝・ャ繧ｭ繝ｻ繝医Λ繝・す繝･繝ｻ髯､螟悶だ繝ｼ繝ｳ縺ｯ譫壽焚繝舌ャ繧ｸ繧呈ｮ九＠縺溘∪縺ｾ繧ｫ繝ｼ繝峨□縺大叙繧企勁縺・
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
        // Firestore縺九ｉ蜿門ｾ・
        const deckData = await DeckBuilder.fetchDeckById(deckId);
        if (deckData) cardIds = deckData.cards;
    }

    if (cardIds.length === 0) {
        console.error(`Deck not found or empty: ${deckId}`);
        return;
    }

    // 繧ｫ繝ｼ繝迂D縺九ｉ螳溘ョ繝ｼ繧ｿ繧堤函謌舌＠縺ｦ繧ｷ繝｣繝・ヵ繝ｫ
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
        const j = Math.floor(GameRandom() * (i + 1));
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
    // 繝・ャ繧ｭ邂｡逅・判髱｢・磯∈謚樒判髱｢・峨ｒ陦ｨ遉ｺ
    showScreen('deck-select-screen');
    if (typeof DeckBuilder !== 'undefined') {
        if (!isDeckBuilderInitialized) {
            DeckBuilder.init();
            isDeckBuilderInitialized = true;
        }
        // 繝・ャ繧ｭ荳隕ｧ繧呈緒逕ｻ (邂｡逅・Δ繝ｼ繝・
        renderDeckManager();
    }
}

// ==========================================
// 3. 繧ｿ繝ｼ繝ｳ騾ｲ陦後Ο繧ｸ繝・け
// ==========================================

function startTurnProcess() {
    if (GAME_STATE.isGameOver) return;
    GAME_STATE.phase = "DRAW";
    GAME_STATE.hasNormalSummoned = false;
    // 繧ｿ繝ｼ繝ｳ髢句ｧ区凾縺ｫ蜈ｨ繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｮ謾ｻ謦・ｸ医∩繝輔Λ繧ｰ繧偵Μ繧ｻ繝・ヨ (繝ｫ繝ｼ繝ｫ5.3)
    const allFieldMonsters = [...GAME_STATE.player.field.monsters, ...GAME_STATE.opponent.field.monsters];
    allFieldMonsters.forEach(m => { if (m) m._hasAttacked = false; });

    // 繧ｿ繝ｼ繝ｳ髢句ｧ区凾縺ｫ蜷・・繝ｬ繧､繝､繝ｼ縺ｮ繝ｪ繝輔Ξ繝・す繝･蝗樊焚繧偵Μ繧ｻ繝・ヨ (繝ｫ繝ｼ繝ｫ1.1)
    GAME_STATE.player.refreshCount = 0;
    GAME_STATE.opponent.refreshCount = 0;

    // 譛滄剞蛻・ｌ縺ｮ荳譎ゅヰ繝輔ｒ繧ｯ繝ｪ繝ｼ繝九Φ繧ｰ
    EffectLogic.cleanAllBuffs();

    updateUI();

    console.log(`Turn Start: ${GAME_STATE.turnPlayer} (Game Turn: ${GAME_STATE.turnCount})`);

    // DRAW PHASE蜃ｦ逅・
    // 繝ｫ繝ｼ繝ｫ: 蜈郁｡・繧ｿ繝ｼ繝ｳ逶ｮ縺ｯ繝峨Ο繝ｼ縺励↑縺・
    if (GAME_STATE.isFirstTurnOfGame) {
        console.log("First Turn: Skip Draw Phase.");
        setTimeout(() => { if (GAME_STATE.phase === "DRAW") advancePhase(); }, 400);
    } else {
        drawCard(GAME_STATE.turnPlayer, 1);
        updateUI();

        // 繝励Ξ繧､繝､繝ｼ繝ｻCPU蝠上ｏ縺壹ラ繝ｭ繝ｼ蠕後・閾ｪ蜍輔〒MAIN1縺ｸ騾ｲ陦・
        // 繝峨Ο繝ｼ貍泌・縺瑚ｦ九∴繧狗ｨ句ｺｦ縺ｫ縺ｯ蠕・▽
        setTimeout(() => { if (GAME_STATE.phase === "DRAW") advancePhase(); }, 700);

    }
}

function advancePhase() {
    if (GAME_STATE.isGameOver) return;
    if (GAME_STATE.isOnlineMatch && GAME_STATE.turnPlayer === 'player' && !window._isProcessingRootAction) { NetworkManager.sendAction('ADVANCE_PHASE', {}); }


    const pOrder = GAME_STATE.phases;
    const currentIdx = pOrder.indexOf(GAME_STATE.phase);

    // END繝輔ぉ繧､繧ｺ縺九ｉ蜈医↓縺ｯ騾ｲ縺ｾ縺ｪ縺・ｼ医ち繝ｼ繝ｳ邨ゆｺ・・逅・・ startEndPhaseProcess 縺梧球蠖難ｼ・
    if (currentIdx === -1 || currentIdx >= pOrder.length - 1) {
        console.warn(`advancePhase: ignored (phase=${GAME_STATE.phase})`);
        return;
    }

    // 谺｡縺ｮ繝輔ぉ繧､繧ｺ繧呈ｱｺ螳・
    let nextPhase = pOrder[currentIdx + 1];

    // END繝輔ぉ繧､繧ｺ縺ｸ縺ｮ遘ｻ陦悟・逅・
    if (nextPhase === "END") {
        GAME_STATE.phase = "END";
        updateUI();
        startEndPhaseProcess();
        return;
    }

    // 蜈郁｡・繧ｿ繝ｼ繝ｳ逶ｮ縺ｮ繝舌ヨ繝ｫ繝輔ぉ繧､繧ｺ繧ｹ繧ｭ繝・・蛻､螳・
    if (GAME_STATE.isFirstTurnOfGame && nextPhase === "BATTLE") {
        console.log("First Turn: Skip Battle Phase.");
        nextPhase = "MAIN2";
    }

    GAME_STATE.phase = nextPhase;
    updateUI();

    console.log(`Phase Changed to: ${GAME_STATE.phase}`);

    // CPU繧ｿ繝ｼ繝ｳ縺ｪ繧臥ｶ咏ｶ壹＠縺ｦ諤晁・
    if (GAME_STATE.turnPlayer === "opponent") {
        setTimeout(executeCpuTurn, 350);
    }
}

function endTurn() {
    if (GAME_STATE.isGameOver) return;

    // 繧ｿ繝ｼ繝ｳ莠､莉｣
    GAME_STATE.turnPlayer = (GAME_STATE.turnPlayer === "player") ? "opponent" : "player";
    GAME_STATE.turnSerial++;

    // 蜈郁｡・繧ｿ繝ｼ繝ｳ逶ｮ繝輔Λ繧ｰ縺ｮ隗｣髯､・亥ｾ梧判縺ｫ蝗槭▲縺滓凾轤ｹ縺ｧ隗｣髯､・・
    if (GAME_STATE.isFirstTurnOfGame) {
        GAME_STATE.isFirstTurnOfGame = false;
    } else {
        GAME_STATE.turnCount++;
    }

    startTurnProcess();
}

// ==========================================
// 4. 繧｢繧ｯ繧ｷ繝ｧ繝ｳ: 繝峨Ο繝ｼ & 繝ｪ繝輔Ξ繝・す繝･
// ==========================================

async function drawCard(side, count) {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    let remainingToDraw = count;
    let drawQueue = [];

    if (side === "player") GAME_STATE.isAnimating = true;

    while (remainingToDraw > 0) {
        if (p.deck.length === 0) {
            // 繝・ャ繧ｭ蛻・ｌ譎ゅ・繝ｪ繝輔Ξ繝・す繝･隕丞ｮ・(繝ｫ繝ｼ繝ｫ Ver.1.1)
            if (p.trash.length > 0 && p.refreshCount < 1) {
                console.log(`${side} performs Deck Refresh!`);
                p.deck = shuffleArray(p.trash.map(resetCardState));
                p.trash = [];
                p.refreshCount++;
                // 繝ｪ繝輔Ξ繝・す繝･謌仙粥譎ゅ∵悽譚･縺ｮ繝峨Ο繝ｼ縺ｫ霑ｽ蜉縺励※縺輔ｉ縺ｫ 1 譫壹ラ繝ｭ繝ｼ縺吶ｋ
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

        // 鬟帙・蜈医・蠎ｧ讓吶・謠冗判逶ｴ蠕後↓縺ｾ縺ｨ繧√※遒ｺ螳壹＆縺帙ｋ縲・
        // 貍泌・縺ｮ騾比ｸｭ縺ｧ謇区惆繧剃ｽ懊ｊ逶ｴ縺吶→蠎ｧ讓吶′縺ｶ繧後ｋ縺・∴縲・
        // 驕・ｌ縺ｦ蟋九∪繧九い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ縺悟盾辣ｧ縺吶ｋ隕∫ｴ縺悟ｷｮ縺玲崛繧上▲縺ｦ縺励∪縺・・
        const targetRects = drawQueue.map(card => {
            const el = findHandCardElement(p, card);
            return el ? el.getBoundingClientRect() : null;
        });

        const animPromises = drawQueue.map(async (card, idx) => {
            await new Promise(r => setTimeout(r, idx * 80));
            await animateDrawCard(card, targetRects[idx], idx);

            // 逹蝨ｰ縺励◆繧ｫ繝ｼ繝峨□縺代ｒ陦ｨ縺ｫ蜃ｺ縺吶・
            // 縺薙％縺ｧ renderHand() 繧偵☆繧九→謇区惆蜈ｨ菴薙′菴懊ｊ逶ｴ縺輔ｌ縲・
            // 繧ｫ繝ｼ繝峨′蟾ｦ蜿ｳ縺ｫ謠ｺ繧後※隕九∴繧九◆繧√∝ｯｾ雎｡1譫壹・繧ｯ繝ｩ繧ｹ縺縺大､悶☆縲・
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
 * 謇区惆縺ｮDOM隕∫ｴ繧偵梧焔譛ｭ蜀・・菴咲ｽｮ縲阪〒迚ｹ螳壹☆繧九・
 * 蜷悟錐繧ｫ繝ｼ繝峨ｒ3譫夂ｩ阪ａ繧九ご繝ｼ繝縺ｪ縺ｮ縺ｧ縲√き繝ｼ繝迂D縺ｧ謗｢縺吶→蛻･縺ｮ1譫壹↓蠖薙◆縺｣縺ｦ縺励∪縺・・
 */
function findHandCardElement(playerState, card) {
    const handIdx = playerState.hand.indexOf(card);
    if (handIdx === -1) return null;
    return document.querySelector(`#player-hand .card-mini[data-hand-index="${handIdx}"]`);
}

/**
 * 繝峨Ο繝ｼ貍泌・・壹ョ繝・く縺九ｉ謇区惆縺ｸ
 */
function animateDrawCard(cardData, targetRect, sequenceIdx = 0) {
    return new Promise(resolve => {
        const deckEl = document.getElementById('player-deck-zone');

        if (!targetRect || !deckEl) {
            resolve();
            return;
        }

        const startRect = deckEl.getBoundingClientRect();

        // 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ逕ｨ隕∫ｴ菴懈・
        const animCard = createCardElement(cardData, 'animation');
        animCard.classList.add('anim-drawing-card');

        // 驥阪↑繧企・・蛻ｶ蠕｡・壼ｾ後°繧牙ｼ輔￥繧ｫ繝ｼ繝峨ｒ荳翫↓縺吶ｋ
        animCard.style.zIndex = 5000 + sequenceIdx;

        // 蛻晄悄迥ｶ諷具ｼ壹ョ繝・く菴咲ｽｮ縲∬｣丞髄縺・
        animCard.style.left = `${startRect.left}px`;
        animCard.style.top = `${startRect.top}px`;
        animCard.style.transform = 'rotateY(180deg)';

        document.body.appendChild(animCard);

        // 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ髢句ｧ具ｼ医Μ繝輔Ο繝ｼ蠕・■・・
        requestAnimationFrame(() => {
            animCard.style.left = `${targetRect.left}px`;
            animCard.style.top = `${targetRect.top}px`;
            animCard.style.transform = 'rotateY(0deg)';
        });

        // 0.5遘貞ｾ後↓邨ゆｺ・ｼ医ユ繝ｳ繝昴い繝・・縺ｮ縺溘ａ繧上★縺九↓遏ｭ邵ｮ・・
        setTimeout(() => {
            animCard.remove();
            resolve();
        }, 500);
    });
}

// ==========================================
// 5. 繧｢繧ｯ繧ｷ繝ｧ繝ｳ: 蜿ｬ蝟・(Summon)
// ==========================================

/**
 * 蜿ｬ蝟壹′蜿ｯ閭ｽ縺九←縺・°繧定ｫ也炊逧・↓蛻､螳壹☆繧・
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

    // 邏譚舌・邱乗焚縺瑚ｶｳ繧翫※縺・ｋ縺具ｼ医ヵ繧｣繝ｼ繝ｫ繝峨→謇区惆縺ｯ閾ｪ逕ｱ縺ｫ邨・∩蜷医ｏ縺帙ｉ繧後ｋ・・
    if (fieldCosters.length + handCosters.length < costCount) return false;

    // 蝣ｴ縺悟沂縺ｾ縺｣縺ｦ縺・ｋ蝣ｴ蜷医√ヵ繧｣繝ｼ繝ｫ繝峨°繧画怙菴・菴薙・繝ｪ繝ｪ繝ｼ繧ｹ縺励↑縺・→鄂ｮ縺榊ｴ謇縺後↑縺・
    return hasEmptySlot || fieldCosters.length >= 1;
}

/**
 * 蜿ｬ蝟夊ｩｦ陦・(UI縺九ｉ蜻ｼ縺ｰ繧後ｋ)
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
 * 蜿ｬ蝟壹・螳溯｡・
 * @param {Array} costs - [{card, slotIdx, from:"field"|"hand"}]
 *   from:"field" 縺ｯ繝医Λ繝・す繝･縺ｸ縲’rom:"hand" 縺ｯ髯､螟悶＆繧後ｋ・磯勁螟悶・蠅灘慍隱倡匱繧定ｵｷ縺薙＆縺ｪ縺・ｼ・
 */
async function executeSummon(side, cardData, slotIndex, costs = []) {
    if (GAME_STATE.isOnlineMatch && side === 'player' && !window._isProcessingRootAction) {
        const handIdx = GAME_STATE.player.hand.indexOf(cardData);
        const costData = costs.map(c => ({ from: c.from, idx: c.from === 'hand' ? GAME_STATE.player.hand.indexOf(c.card) : c.slotIdx }));
        NetworkManager.sendAction('SUMMON', { handIdx, slotIdx: slotIndex, costData });
    }
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    const trashedCosts = [];

    // 1. 繧ｳ繧ｹ繝医・謾ｯ謇輔＞繧貞ｮ溯｡・(繝ｫ繝ｼ繝ｫ Ver.1.1: 蜉ｹ譫懃匱蜍輔・蠕悟屓縺・
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

    // 2. 謇区惆縺九ｉ蜑企勁・亥酔蜷阪き繝ｼ繝峨ｒ蜿悶ｊ驕輔∴縺ｪ縺・ｈ縺・が繝悶ず繧ｧ繧ｯ繝亥酔荳諤ｧ縺ｧ讀懃ｴ｢・・
    const handIndex = p.hand.indexOf(cardData);
    if (handIndex !== -1) {
        p.hand.splice(handIndex, 1);
    }

    // 3. 繝輔ぅ繝ｼ繝ｫ繝峨∈驟咲ｽｮ
    //    蜈医↓謠冗判縺励※縺翫°縺ｪ縺・→縲∝小蝟壽凾蜉ｹ譫懊・貍泌・縺ｮ縺ｻ縺・′繧ｫ繝ｼ繝峨ｈ繧雁・縺ｫ隕九∴縺ｦ縺励∪縺・
    //    鬆・ｺ上・ 蜿ｬ蝟壽ｼ泌・ 竊・蜉ｹ譫懃匱蜍・竊・蜉ｹ譫懈ｼ泌・
    p.field.monsters[slotIndex] = cardData;
    if (side === "player") hideCardDetail();
    updateUI();
    await playSummonEffect(side, slotIndex);

    // 4. 繝医Λ繝・す繝･騾√ｊ譎ゅ♀繧医・蜿ｬ蝟壽・蜉滓凾縺ｮ蜉ｹ譫懆ｧ｣豎ｺ
    //    ・磯勁螟悶＠縺溘き繝ｼ繝峨・縺薙％縺ｫ蜷ｫ縺ｾ繧後↑縺・ｼ晏｢灘慍隱倡匱縺ｯ逋ｺ蜍輔＠縺ｪ縺・ｼ・
    for (const cCard of trashedCosts) {
        await EffectLogic.notifyCardSentToTrash(cCard, side);
    }
    await EffectLogic.resolveEffects(cardData, side, "on_summon");

    // 縲檎嶌謇九′繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧貞小蝟壹＠縺滓凾縲阪↓蜿榊ｿ懊☆繧狗ｽ縺ｮ蛻､螳・
    await EffectLogic.notifySummon(side, [cardData]);

    // 繝輔Λ繧ｰ譖ｴ譁ｰ
    if (side === GAME_STATE.turnPlayer) {
        GAME_STATE.hasNormalSummoned = true;
    }

    // 蜉ｹ譫懆ｧ｣豎ｺ蠕後・逶､髱｢繧貞渚譏・郁ｩｳ邏ｰ繝代ロ繝ｫ縺ｯ驟咲ｽｮ譎ゅ↓髢峨§縺ｦ縺・ｋ・・
    updateUI();

    console.log(`${side} Summoned ${cardData.name} to Slot ${slotIndex}`);
    return Promise.resolve();
}

// ==========================================
// 5.5 繧｢繧ｯ繧ｷ繝ｧ繝ｳ: 鬲碑｡鍋匱蜍・(Magic)
// ==========================================

/** 鬲碑｡薙′逋ｺ蜍募庄閭ｽ縺句愛螳・*/
function checkCanActivateMagic(cardData) {
    if (GAME_STATE.isGameOver) return false;
    if (GAME_STATE.phase !== "MAIN1" && GAME_STATE.phase !== "MAIN2") return false;
    // 鄂鬲碑｡薙・莨上○縺ｦ縺九ｉ縺ｧ縺ｪ縺・→逋ｺ蜍輔〒縺阪↑縺・
    if (cardData.subType === "trap") return false;
    const hasSpace = GAME_STATE.player.field.magics.some(m => m === null);
    if (!hasSpace) return false;
    return EffectLogic.isEffectActivatable(cardData, "player", "on_activate");
}

/** 鬲碑｡薙ｒ繧ｻ繝・ヨ・郁｣丞・縺ｧ險ｭ鄂ｮ・峨〒縺阪ｋ縺句愛螳・*/
function checkCanSetMagic(cardData) {
    if (GAME_STATE.isGameOver) return false;
    if (GAME_STATE.phase !== "MAIN1" && GAME_STATE.phase !== "MAIN2") return false;
    if (!cardData || cardData.type !== "magic") return false;
    return GAME_STATE.player.field.magics.some(m => m === null);
}

/** 鬲碑｡鍋匱蜍戊ｩｦ陦・*/
function tryActivateMagic(cardData) {
    if (!checkCanActivateMagic(cardData)) return;
    startMagicSlotSelection(cardData, false);
}

/** 鬲碑｡薙そ繝・ヨ隧ｦ陦鯉ｼ育ｽ縺ｫ髯舌ｉ縺壹・壼ｸｸ繝ｻ豌ｸ邯壹ｂ繝悶Λ繝輔→縺励※莨上○繧峨ｌ繧具ｼ・*/
function trySetMagic(cardData) {
    if (!checkCanSetMagic(cardData)) return;
    startMagicSlotSelection(cardData, true);
}

/**
 * 莨上○縺ｦ縺ゅｋ閾ｪ蛻・・鬲碑｡薙ｒ陦ｨ蜷代″縺ｫ縺励※逋ｺ蜍輔☆繧・
 * 鄂鬲碑｡薙・譚｡莉ｶ謌千ｫ区凾縺ｫ閾ｪ蜍輔〒逋ｺ蜍輔☆繧九◆繧√√％縺薙〒縺ｯ謇ｱ繧上↑縺・
 */
async function activateSetMagic(slotIdx) {
    if (GAME_STATE.isOnlineMatch && !window._isProcessingRootAction) NetworkManager.sendAction('ACTIVATE_SET_MAGIC', { slotIdx });
    const p = GAME_STATE.player;
    const card = p.field.magics[slotIdx];

    if (!card || !card._isSet) return;
    if (card.subType === "trap") return; // 鄂鬲碑｡薙・縺ｿ莨上○縺溘ち繝ｼ繝ｳ縺ｯ逋ｺ蜍輔〒縺阪↑縺・
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

/** 鬲碑｡鍋匱蜍輔・繧ｻ繝・ヨ蜈医・驕ｸ謚樣幕蟋・*/
function startMagicSlotSelection(cardData, asSet = false) {
    document.getElementById('floating-action-container').innerHTML = "";
    document.getElementById('field-surface').classList.add('selecting-mode');
    document.getElementById('game-viewport').classList.add('field-selecting');
    GAME_STATE.isSelectingSlot = true;
    GAME_STATE.pendingCard = cardData;
    GAME_STATE.pendingSetMode = asSet;
    showSelectionPrompt(asSet ? "繧ｫ繝ｼ繝峨ｒ莨上○繧句ｴ謇繧帝∈謚槭＠縺ｦ縺上□縺輔＞" : "鬲碑｡薙ｒ鄂ｮ縺丞ｴ謇繧帝∈謚槭＠縺ｦ縺上□縺輔＞");

    // 繧､繝吶Φ繝医ョ繝ｪ繧ｲ繝ｼ繧ｷ繝ｧ繝ｳ: 蛟句挨縺ｮonclick縺ｯ險ｭ螳壹○縺壹∝・菴薙〒逶｣隕悶☆繧・
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-magic-${i}`);
        if (GAME_STATE.player.field.magics[i] === null) {
            zone.classList.add('highlight');
            // zone.onclick = ... (蜑企勁)
        }
    });
}

/**
 * 蜈ｱ騾壹ヲ繝・ヨ繝・せ繝磯未謨ｰ (蟷ｾ菴募ｭｦ逧・愛螳壼性繧)
 * @param {MouseEvent} e - 繧ｯ繝ｪ繝・け繧､繝吶Φ繝・
 * @param {string} idPrefix - 蛻､螳壼ｯｾ雎｡縺ｮID謗･鬆ｭ霎・(萓・ 'ply-monster', 'opt-monster')
 * @param {number} count - 繧ｹ繝ｭ繝・ヨ謨ｰ
 * @param {boolean} requireHighlight - '.highlight' 繧ｯ繝ｩ繧ｹ繧貞ｿ・医→縺吶ｋ縺・
 * @returns {number} 繝偵ャ繝医＠縺溘う繝ｳ繝・ャ繧ｯ繧ｹ (-1縺ｯ繝偵ャ繝医↑縺・
 */
function detectHitSlot(e, idPrefix, count = 3, requireHighlight = true) {
    let hitSlotIdx = -1;

    // 1. DOM謗｢邏｢ (e.target.closest)
    const targetZone = e.target.closest('.zone');
    if (targetZone) {
        if (!requireHighlight || targetZone.classList.contains('highlight')) {
            // ID繝√ぉ繝・け (謖・ｮ壹＆繧後◆prefix繧貞性繧薙〒縺・ｋ縺・
            if (targetZone.id.startsWith(idPrefix)) {
                const parts = targetZone.id.split('-');
                hitSlotIdx = parseInt(parts[parts.length - 1], 10);
            }
        }
    }

    // 2. 蟷ｾ菴募ｭｦ逧・愛螳・(繝舌ャ繧ｯ繧｢繝・・)
    //    蛟呵｣懊′隍・焚繝偵ャ繝医☆繧句ｴ蜷医・縲御ｸｭ蠢・′譛繧りｿ代＞繧ｾ繝ｼ繝ｳ縲阪ｒ謗｡逕ｨ縺吶ｋ縲・
    //    蜈育捩鬆・〒豎ｺ繧√ｋ縺ｨ蟶ｸ縺ｫ繧ｹ繝ｭ繝・ヨ0蛛ｴ縺ｸ蛻､螳壹′蛛上▲縺ｦ縺励∪縺・◆繧√・
    if (hitSlotIdx === -1) {
        const margin = 8; // 謖・・螟ｪ縺輔・繧薙・險ｱ螳ｹ・磯團縺ｮ繧ｾ繝ｼ繝ｳ縺ｨ鬟溘＞蜷医ｏ縺ｪ縺・ｯ・峇縺ｫ逡吶ａ繧具ｼ・
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
 * 繧ｰ繝ｭ繝ｼ繝舌Ν繧ｯ繝ｪ繝・け繝上Φ繝峨Λ
 * 蜈ｨ縺ｦ縺ｮ繧ｯ繝ｪ繝・け繧､繝吶Φ繝医ｒ縺薙％縺ｧ蜿励￠蜿悶ｊ縲∫憾諷九↓蠢懊§縺ｦ謖ｯ繧雁・縺代ｋ
 */
function handleGlobalInteract(e) {
    if (GAME_STATE.isGameOver) return;

    // UI隕∫ｴ繧・が繝ｼ繝舌・繝ｬ繧､縺ｸ縺ｮ繧ｯ繝ｪ繝・け縺ｯ繝代せ繧ｹ繝ｫ繝ｼ・医◎繧後◇繧後・蛻ｶ蠕｡縺ｫ莉ｻ縺帙ｋ・・
    if (e.target.closest('#card-detail-overlay') ||
        e.target.closest('.floating-actions') ||
        e.target.closest('#floating-action-container') ||
        e.target.closest('.modal-content') ||
        e.target.closest('.card-mini.entering') ||
        e.target.closest('.btn-sub') || // 繝輔ぉ繧､繧ｺ繝懊ち繝ｳ遲・
        e.target.closest('#next-phase-btn')) {
        return;
    }

    // 繝｢繝ｼ繝牙挨繝・ぅ繧ｹ繝代ャ繝・ｼ磯∈謚槭Δ繝ｼ繝我ｸｭ縺ｯ謇区惆縺ｮ隧ｳ邏ｰ陦ｨ遉ｺ繧医ｊ驕ｸ謚樊桃菴懊ｒ蜆ｪ蜈医☆繧具ｼ・
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

    // 謇区惆縺ｮ繧ｯ繝ｪ繝・け蛻､螳夲ｼ亥酔蜷阪き繝ｼ繝峨ｒ蜿悶ｊ驕輔∴縺ｪ縺・ｈ縺・｡ｨ遉ｺ菴咲ｽｮ縺ｧ迚ｹ螳壹☆繧具ｼ・
    const handCard = e.target.closest('#player-hand .card-mini');
    if (handCard) {
        const handIdx = parseInt(handCard.dataset.handIndex, 10);
        const cardData = GAME_STATE.player.hand[handIdx];
        if (cardData) {
            // 蜷後§繧ｫ繝ｼ繝峨ｒ繧ゅ≧荳蠎ｦ繧ｿ繝・・縺励◆繧蛾∈謚櫁ｧ｣髯､
            if (handCard.classList.contains('selected')) {
                hideCardDetail();
                return;
            }
            showCardDetail(cardData, 'hand', e, null);
            return;
        }
    }

    // 騾壼ｸｸ繝｢繝ｼ繝会ｼ郁ｩｳ邏ｰ陦ｨ遉ｺ / 繧｢繧ｯ繧ｷ繝ｧ繝ｳ繝｡繝九Η繝ｼ・・
    handleNormalInteraction(e);
}

/** 繧ｳ繧ｹ繝磯∈謚樔ｸｭ縺ｮ繧ｯ繝ｪ繝・け繝上Φ繝峨Λ・医ヵ繧｣繝ｼ繝ｫ繝峨・謇区惆縺ｮ荳｡譁ｹ縺悟ｯｾ雎｡・・*/
function handleCostSelectionClick(e) {
    if (!GAME_STATE.isSelectingCost || !GAME_STATE.pendingCard) return;

    const req = GAME_STATE.pendingCard.summonRequirement;
    const filter = req ? req.costFilter : null;

    // 1. 謇区惆縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧偵さ繧ｹ繝茨ｼ茨ｼ晞勁螟厄ｼ峨↓驕ｸ縺ｶ
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
    // 謇区惆繧ｨ繝ｪ繧｢縺ｮ菴咏區繧ｿ繝・・縺ｯ菴輔ｂ縺励↑縺・ｼ郁ｪ､繧ｭ繝｣繝ｳ繧ｻ繝ｫ髦ｲ豁｢・・
    if (e.target.closest('#player-hand-container')) return;

    // 2. 繝輔ぅ繝ｼ繝ｫ繝峨・繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧偵さ繧ｹ繝茨ｼ茨ｼ昴ヨ繝ｩ繝・す繝･・峨↓驕ｸ縺ｶ
    const hitIdx = detectHitSlot(e, 'ply-monster', 3, false);
    if (hitIdx !== -1) {
        const monster = GAME_STATE.player.field.monsters[hitIdx];
        if (monster && matchesCostFilter(monster, filter)) {
            e.stopPropagation();
            toggleCostSelection({ card: monster, slotIdx: hitIdx, from: "field" });
        }
        return;
    }

    // 3. 閭梧勹繧ｿ繝・・縺ｧ繧ｭ繝｣繝ｳ繧ｻ繝ｫ
    if (checkGlobalCancel(e)) {
        cancelCostSelection();
    }
}

/**
 * 騾壼ｸｸ譎ゅ・繧､繝ｳ繧ｿ繝ｩ繧ｯ繧ｷ繝ｧ繝ｳ (蟷ｾ菴募ｭｦ逧・愛螳壻ｻ倥″)
 */
function handleNormalInteraction(e) {
    // 閾ｪ蛻・・繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧ｾ繝ｼ繝ｳ
    let idx = detectHitSlot(e, 'ply-monster', 3, false);
    if (idx !== -1) {
        const card = GAME_STATE.player.field.monsters[idx];
        if (card) showCardDetail(card, 'ply-field', e, idx);
        return;
    }

    // 閾ｪ蛻・・鬲碑｡薙だ繝ｼ繝ｳ
    idx = detectHitSlot(e, 'ply-magic', 3, false);
    if (idx !== -1) {
        const card = GAME_STATE.player.field.magics[idx];
        if (card) showCardDetail(card, 'ply-field', e, idx); // location縺ｯply-field縺ｧ邨ｱ蜷・
        return;
    }

    // 逶ｸ謇九・繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧ｾ繝ｼ繝ｳ
    idx = detectHitSlot(e, 'opt-monster', 3, false);
    if (idx !== -1) {
        const card = GAME_STATE.opponent.field.monsters[idx];
        if (card) showCardDetail(card, 'opt-field', e, idx);
        return;
    }

    // 逶ｸ謇九・鬲碑｡薙だ繝ｼ繝ｳ
    idx = detectHitSlot(e, 'opt-magic', 3, false);
    if (idx !== -1) {
        const card = GAME_STATE.opponent.field.magics[idx];
        if (card) showCardDetail(card, 'opt-field', e, idx);
        return;
    }

    // 繝医Λ繝・す繝･繝ｻ髯､螟悶だ繝ｼ繝ｳ縺ｮ蟷ｾ菴募愛螳・
    // 繝輔ぅ繝ｼ繝ｫ繝峨・3D螟牙ｽ｢縺励※縺・ｋ縺溘ａ縲．OM縺ｮ繝偵ャ繝医ユ繧ｹ繝医′隕ｪ隕∫ｴ(.field-row)縺ｫ蜷ｸ繧上ｌ縺ｦ
    // 繧ｾ繝ｼ繝ｳ縺ｮinline onclick縺檎匱轣ｫ縺励↑縺・％縺ｨ縺後≠繧九ょｺｧ讓吶〒謨第ｸ医☆繧九・
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
        const margin = 6; // 蛻､螳壹・縺ゅ◎縺ｳ・磯團縺ｮ繧ｾ繝ｼ繝ｳ縺ｨ鬟溘＞蜷医ｏ縺ｪ縺・ｯ・峇・・
        if (e.clientX >= rect.left - margin && e.clientX <= rect.right + margin &&
            e.clientY >= rect.top - margin && e.clientY <= rect.bottom + margin) {
            openCardPileViewer(pz.side, pz.pile);
            return;
        }
    }

    // 菴輔ｂ縺ｪ縺・ｴ謇繧偵け繝ｪ繝・け -> 繝｡繝九Η繝ｼ縺ｪ縺ｩ繧帝哩縺倥ｋ
    // 縺溘□縺励∬ｪ､繧ｿ繝・・縺ｧ髢峨§縺吶℃繧九・繧り憶縺上↑縺・・縺ｧ縲∵・遉ｺ逧・↑閭梧勹繧ｯ繝ｪ繝・け縺ｮ縺ｿ・・
    // 縺・▲縺溘ｓfloating-action遲峨・蜀帝ｭ縺ｮ繧ｬ繝ｼ繝峨〒髯､螟悶＆繧後※縺・ｋ縺ｮ縺ｧ縲√％縺薙↓譚･繧九・縺ｯ繝輔ぅ繝ｼ繝ｫ繝芽レ譎ｯ縺ｮ縺ｿ
    hideCardDetail();
}

/** 閭梧勹繧ｯ繝ｪ繝・け遲峨↓繧医ｋ蜈ｱ騾壹く繝｣繝ｳ繧ｻ繝ｫ蛻､螳・*/
function checkGlobalCancel(e) {
    // 繝薙Η繝ｼ繝昴・繝医√ヵ繧｣繝ｼ繝ｫ繝芽｡ｨ髱｢縲・□霑代Λ繝・ヱ繝ｼ繧偵け繝ｪ繝・け縺ｧ繧ｭ繝｣繝ｳ繧ｻ繝ｫ
    const cancelTargets = ['game-viewport', 'field-perspective-wrapper', 'field-surface'];
    if (cancelTargets.includes(e.target.id)) return true;
    return false;
}

function handleSelectionClick(e) {
    if (!GAME_STATE.isSelectingSlot || !GAME_STATE.pendingCard) return;

    // 隱､縺｣縺ｦ謇区惆繧偵ち繝・・縺励◆蝣ｴ蜷・-> 繧ｭ繝｣繝ｳ繧ｻ繝ｫ縺励※縺昴・謇区惆繧帝∈謚槭＠縺溘％縺ｨ縺ｫ縺吶ｋ
    if (e.target.closest('#player-hand')) {
        console.log("Switching selection to hand card");
        if (GAME_STATE.pendingCard.type === 'monster') cancelSlotSelection();
        else cancelMagicSlotSelection();
        return;
        // 蛯呵・ 縺薙％縺ｧreturn縺吶ｋ縺ｨ莉雁屓縺ｮ繧､繝吶Φ繝医・豸郁ｲｻ縺輔ｌ繧九・
        // 繝ｦ繝ｼ繧ｶ繝ｼ縺ｯ縲後く繝｣繝ｳ繧ｻ繝ｫ縺輔ｌ縺溘咲憾諷九↓縺ｪ繧九・縺ｧ縲√ｂ縺・ｸ蠎ｦ繧ｿ繝・・縺吶ｌ縺ｰ隧ｳ邏ｰ縺碁幕縺上・
        // 縺昴ｌ縺ｧ蜊∝・隕ｪ蛻・ｼ亥渚蠢懊＠縺ｪ縺・ｈ繧翫・繧ｷ・峨・
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

/** 謾ｻ謦・ｯｾ雎｡驕ｸ謚樔ｸｭ縺ｮ繧ｯ繝ｪ繝・け繝上Φ繝峨Λ */
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

/** 鬲碑｡鍋匱蜍輔・螳御ｺ・*/
async function finishMagicSlotSelection(slotIdx) {
    if (!GAME_STATE.pendingCard) return;
    const cardData = GAME_STATE.pendingCard;
    if (GAME_STATE.isOnlineMatch && !window._isProcessingRootAction) {
        const handIdx = GAME_STATE.player.hand.indexOf(cardData);
        NetworkManager.sendAction('MAGIC_ACTION', { handIdx, slotIdx, isSet: GAME_STATE.pendingSetMode });
    }
    const asSet = GAME_STATE.pendingSetMode;
    const p = GAME_STATE.player;

    // 蜉ｹ譫懆ｧ｣豎ｺ・・wait・峨・蜑阪↓驕ｸ謚槭Δ繝ｼ繝峨ｒ螳悟・縺ｫ邨ゆｺ・＆縺帙ｋ
    cancelMagicSlotSelection();

    // 1. 謇区惆縺九ｉ蜑企勁・亥酔蜷阪き繝ｼ繝峨ｒ蜿悶ｊ驕輔∴縺ｪ縺・ｈ縺・が繝悶ず繧ｧ繧ｯ繝亥酔荳諤ｧ縺ｧ讀懃ｴ｢・・
    const handIndex = p.hand.indexOf(cardData);
    if (handIndex !== -1) p.hand.splice(handIndex, 1);

    // 繧ｻ繝・ヨ縺ｮ蝣ｴ蜷医・陬丞・縺ｧ鄂ｮ縺上□縺代ょ柑譫懊・隗｣豎ｺ縺励↑縺・・
    if (asSet) {
        cardData._isSet = true;
        cardData._setTurnSerial = GAME_STATE.turnSerial;
        p.field.magics[slotIdx] = cardData;
        renderFieldCard("player", "magic", slotIdx, cardData);
        updateUI();
        console.log(`Magic Set: ${cardData.name}`);
        return;
    }

    // 2. 荳譌ｦ鬲碑｡薙だ繝ｼ繝ｳ縺ｫ驟咲ｽｮ縺励※謠冗判・亥柑譫懆ｧ｣豎ｺ荳ｭ縺ｧ縺ゅｋ縺薙→繧堤､ｺ縺呻ｼ・
    p.field.magics[slotIdx] = cardData;
    renderFieldCard("player", "magic", slotIdx, cardData);

    // 3. 蜉ｹ譫懊・隗｣豎ｺ繧貞ｮ溯｡・(髱槫酔譛溷ｾ・ｩ・
    await EffectLogic.resolveEffects(cardData, "player", "on_activate");

    // 4. 遞ｮ蛻･縺ｫ繧医ｋ蠕悟・逅・
    if (cardData.subType === 'normal') {
        // 騾壼ｸｸ鬲碑｡薙・蟆代＠蠕・▲縺ｦ縺九ｉ繝医Λ繝・す繝･縺ｸ (貍泌・逕ｨ)
        setTimeout(() => {
            if (p.field.magics[slotIdx] !== cardData) return;
            p.field.magics[slotIdx] = null;
            renderFieldCard("player", "magic", slotIdx, null);
            sendCardToTrash("player", cardData);
            updateUI();
        }, 500);
    } else {
        // 豌ｸ邯夐ｭ碑｡薙・縺昴・縺ｾ縺ｾ谿九ｋ
        updateUI();
    }

    console.log(`Magic Played: ${cardData.name}`);
}

/** 鬲碑｡馴∈謚槭・繧ｭ繝｣繝ｳ繧ｻ繝ｫ */
function cancelMagicSlotSelection() {
    document.getElementById('field-surface').classList.remove('selecting-mode');
    document.getElementById('game-viewport').classList.remove('field-selecting');
    showSelectionPrompt(null);
    GAME_STATE.isSelectingSlot = false;
    GAME_STATE.pendingCard = null;
    GAME_STATE.pendingSetMode = false;

    // 繧､繝吶Φ繝医Μ繧ｹ繝雁炎髯､
    document.removeEventListener('click', handleSelectionClick);

    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-magic-${i}`);
        zone.classList.remove('highlight');
        // zone.onclick = null; (荳崎ｦ・
    });
    // body.onclick = ... (荳崎ｦ・
}

// ==========================================
// 6. 繧｢繧ｯ繧ｷ繝ｧ繝ｳ: 謾ｻ謦・(Battle)
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
    if (GAME_STATE.isOnlineMatch && GAME_STATE.turnPlayer === 'player' && !window._isProcessingRootAction) {
        NetworkManager.sendAction('ATTACK', { atkIdx, defIdx });
    }

    console.log(`Battle: ${attacker.name} vs ${defender ? defender.name : "Direct"}`);
    attacker._hasAttacked = true;
    GAME_STATE.isAnimating = true; // CPU縺ｮ騾｣邯壼・逅・ｒ髦ｲ豁｢

    const attackerSide = GAME_STATE.turnPlayer;
    const defenderSide = (attackerSide === "player") ? "opponent" : "player";

    // 謾ｻ謦・ｮ｣險譎ゅ・鄂繧貞・縺ｫ隗｣豎ｺ縺吶ｋ・亥ｼｱ菴灘喧繝ｻ蠑ｷ蛹悶・謾ｻ謦・Δ繝ｳ繧ｹ繧ｿ繝ｼ縺ｮ遐ｴ螢翫↑縺ｩ・・
    const aborted = await EffectLogic.notifyAttackDeclared(
        attackerSide, attacker, atkIdx, defender, defIdx);

    if (aborted) {
        console.log("Battle cancelled by trap effect.");
        GAME_STATE.isAnimating = false;
        updateUI();
        return;
    }

    // 隱ｰ縺瑚ｪｰ繧呈判謦・＠縺溘・縺九ｒ遏｢蜊ｰ縺ｨ繝医・繧ｹ繝医〒遉ｺ縺・
    showToastMessage(
        defender ? `${attacker.name} 竊・${defender.name}` : `${attacker.name} 縺ｮ繝繧､繝ｬ繧ｯ繝医い繧ｿ繝・け`,
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

            // 謌ｦ髣倥〒逶ｸ謇九Δ繝ｳ繧ｹ繧ｿ繝ｼ繧堤ｴ螢翫＠縺滓凾縺ｮ隱倡匱・育ｎ逡後・遐ｲ謇・遲会ｼ・
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

            // 霑斐ｊ險弱■縺ｫ縺励◆髦ｲ蠕｡蛛ｴ繧ゅ梧姶髣倥〒逶ｸ謇九Δ繝ｳ繧ｹ繧ｿ繝ｼ繧堤ｴ螢翫＠縺溘阪↓蠖薙◆繧・
            if (GAME_STATE[defenderSide].field.monsters[defIdx] === defender) {
                await EffectLogic.resolveEffects(defender, defenderSide, "on_battle_destroy");
            }
        }

        // 謌ｦ髣伜ｾ後・莠育ｴ・柑譫懶ｼ域ｵｷ縺ｮ遯∵茶縺ｪ縺ｩ・峨・
        // 縲梧姶髣倥ｒ陦後▲縺溽嶌謇九Δ繝ｳ繧ｹ繧ｿ繝ｼ縲阪′蟇ｾ雎｡縺ｪ縺ｮ縺ｧ縲∵判謦・・繝ｻ髦ｲ蠕｡蛛ｴ縺ｩ縺｡繧峨′謖√▲縺ｦ縺・※繧よｩ溯・縺吶ｋ縲・
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

    // 繝繝｡繝ｼ繧ｸ霆ｽ貂帙Ο繧ｸ繝・け縺ｮ驕ｩ逕ｨ
    const finalDamage = EffectLogic.calculateFinalDamage(side, amount);

    if (side === "player") {
        GAME_STATE.player.lp = Math.max(0, GAME_STATE.player.lp - finalDamage);
    } else {
        GAME_STATE.opponent.lp = Math.max(0, GAME_STATE.opponent.lp - finalDamage);
    }

    showDamageNumber(side, finalDamage);
    checkGameEnd();
}

/** LP縺ｫ繧医ｋ豎ｺ逹蛻､螳夲ｼ亥酔譎ゅ↓0縺ｪ繧牙ｼ輔″蛻・￠ / 繝ｫ繝ｼ繝ｫ1貅匁侠・・*/
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
 * 繧ｲ繝ｼ繝邨ゆｺ・す繝ｼ繧ｱ繝ｳ繧ｹ
 * @param {string} winner - "player" | "opponent" | "draw"
 */
function endGameSequence(winner) {
    // 莠碁㍾蜻ｼ縺ｳ蜃ｺ縺鈴亟豁｢・壻ｻ･髯阪・繧ｿ繝ｼ繝ｳ騾ｲ陦後・蜉ｹ譫懆ｧ｣豎ｺ繧偵☆縺ｹ縺ｦ蛛懈ｭ｢縺吶ｋ
    if (GAME_STATE.isGameOver) return;
    GAME_STATE.isGameOver = true;

    // 驕ｸ謚槭Δ繝ｼ繝峨′谿九▲縺ｦ縺・ｋ縺ｨ謫堺ｽ應ｸ崎・縺ｫ隕九∴繧九◆繧∝ｼｷ蛻ｶ隗｣髯､
    GAME_STATE.isSelectingSlot = false;
    GAME_STATE.isSelectingTarget = false;
    GAME_STATE.isSelectingCost = false;
    GAME_STATE.pendingCard = null;
    GAME_STATE.attackerPending = null;
    GAME_STATE.selectedCosts = [];
    document.getElementById('floating-action-container').innerHTML = "";
    document.getElementById('game-viewport').classList.remove('field-selecting', 'cost-selecting');
    document.getElementById('field-surface').classList.remove('selecting-mode');

    // 1遘偵・縲碁俣・域ｼ泌・・峨阪・蠕後↓繝｢繝ｼ繝繝ｫ繧定｡ｨ遉ｺ
    setTimeout(() => {
        const overlay = document.getElementById('game-result-overlay');
        const title = document.getElementById('result-title');
        const msg = document.getElementById('result-message');

        overlay.classList.remove("result-win", "result-lose");
        overlay.classList.add('active');

        if (winner === "player") {
            overlay.classList.add("result-win");
            title.innerText = "VICTORY";
            msg.innerText = "逶ｸ謇九・LP繧・縺ｫ縺励∪縺励◆・・;
        } else if (winner === "opponent") {
            overlay.classList.add("result-lose");
            title.innerText = "DEFEAT";
            msg.innerText = "閾ｪ蛻・・LP縺・縺ｫ縺ｪ繧翫∪縺励◆...";
        } else {
            title.innerText = "DRAW";
            msg.innerText = "縺贋ｺ偵＞縺ｮLP縺悟酔譎ゅ↓0縺ｫ縺ｪ繧翫∪縺励◆";
        }
    }, 1000);
}

async function destroyMonster(side, slotIdx, reason = "effect") {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    const card = p.field.monsters[slotIdx];

    if (card) {
        // 謌ｦ髣倡ｴ螢願先ｧ縺ｮ繝√ぉ繝・け
        if (reason === "battle" && EffectLogic.checkBattleProtection(card, side, slotIdx)) {
            console.log(`Protection Active: ${card.name} survived destruction.`);
            return;
        }

        // 遐ｴ螢頑ｼ泌・繧定ｦ九○縺ｦ縺九ｉ逶､髱｢縺九ｉ蜿悶ｊ髯､縺上・
        // 蜈医↓豸医☆縺ｨ縲√＞縺阪↑繧翫ヨ繝ｩ繝・す繝･縺ｸ鬟帙ｓ縺繧医≧縺ｫ隕九∴縺ｦ菴輔′襍ｷ縺阪◆縺句・縺九ｉ縺ｪ縺・・
        showToastMessage(`${card.name} 縺檎ｴ螢翫＆繧後◆`, side);
        await playDestroyEffect(side, slotIdx);

        p.field.monsters[slotIdx] = null;
        sendCardToTrash(side, card);

        // UI繧ｯ繝ｪ繧｢
        const prefix = (side === "player") ? "ply" : "opt";
        const el = document.getElementById(`${prefix}-monster-${slotIdx}`);
        if (el) el.innerHTML = "";

        // 繝医Λ繝・す繝･騾√ｊ縺ｫ莨ｴ縺・ｪ倡匱・郁・霄ｫ縺ｮ on_sent_to_trash 縺ｨ縲∽ｻ悶き繝ｼ繝峨・ on_other_sent_to_trash・・
        await EffectLogic.notifyCardSentToTrash(card, side);

        // 縲瑚・蛻・・繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺檎ｴ螢翫＆繧後◆譎ゅ阪↓蜿榊ｿ懊☆繧狗ｽ縺ｮ蛻､螳・
        await EffectLogic.notifyMonsterDestroyed(side, card);
    }
}

// ==========================================
// 7. UI謠冗判 (Rendering)
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

    // 繝輔ぅ繝ｼ繝ｫ繝我ｸ翫・蜈ｨ繧ｫ繝ｼ繝峨ｒ譛譁ｰ繝・・繧ｿ縺ｧ蜀肴緒逕ｻ (繝舌ヵ繝ｻ繧ｪ繝ｼ繝ｩ蜿肴丐)
    ["player", "opponent"].forEach(side => {
        GAME_STATE[side].field.monsters.forEach((card, i) => renderFieldCard(side, "monster", i, card));
        GAME_STATE[side].field.magics.forEach((card, i) => renderFieldCard(side, "magic", i, card));
    });

    // 繝輔ぉ繧､繧ｺ荳ｭ螟ｮ陦ｨ遉ｺ
    const phaseLabel = document.getElementById('phase-center-label');
    if (phaseLabel) phaseLabel.innerText = `${GAME_STATE.phase} PHASE`;

    // 谺｡縺ｮ繝輔ぉ繧､繧ｺ莠域ｸｬ陦ｨ遉ｺ
    const nextPhaseDisplay = document.getElementById('next-phase-display');
    if (nextPhaseDisplay) {
        const pOrder = GAME_STATE.phases;
        const currentIdx = pOrder.indexOf(GAME_STATE.phase);
        let nextIdx = (currentIdx + 1) % pOrder.length;
        if (GAME_STATE.isFirstTurnOfGame && pOrder[nextIdx] === "BATTLE") nextIdx++;
        nextPhaseDisplay.innerText = (GAME_STATE.phase === "END") ? "NEXT TURN" : pOrder[nextIdx];
    }

    // 逶ｸ謇九ち繝ｼ繝ｳ縲√∪縺溘・閾ｪ蜍暮ｲ陦後☆縺ｹ縺阪ヵ繧ｧ繧､繧ｺ(DRAW/END)縺ｯ謫堺ｽ應ｸ崎・縺ｫ縺吶ｋ
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

// 逶ｴ蜑阪↓謠冗判縺励◆謇区惆縺ｮ鬘斐・繧後ょ酔縺倥↑繧我ｽ懊ｊ逶ｴ縺輔↑縺・◆繧√・險倬鹸縲・
let _renderedHandCards = [];

/** 謇区惆繧ｫ繝ｼ繝・譫壹↓縲∫樟蝨ｨ縺ｮ迥ｶ諷九↓蠢懊§縺溘け繝ｩ繧ｹ繧貞渚譏縺吶ｋ */
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

    // 鬘斐・繧後′螟峨ｏ縺｣縺ｦ縺・↑縺代ｌ縺ｰ縲．OM縺ｯ菴懊ｊ逶ｴ縺輔★繧ｯ繝ｩ繧ｹ縺縺第峩譁ｰ縺吶ｋ縲・
    // updateUI() 縺ｯ蜉ｹ譫懆ｧ｣豎ｺ縺ｮ縺溘・縺ｫ蜻ｼ縺ｰ繧後ｋ縺ｮ縺ｧ縲∵ｯ主屓 <img> 縺斐→菴懊ｊ逶ｴ縺吶→
    // 逕ｻ蜒上・蜀阪ョ繧ｳ繝ｼ繝峨〒謇区惆蜈ｨ菴薙′荳迸ｬ證励￥縺ｪ縺｣縺ｦ縺｡繧峨▽縺上・
    const sameHand = _renderedHandCards.length === hand.length
        && _renderedHandCards.every((c, i) => c === hand[i])
        && container.children.length === hand.length;

    if (sameHand) {
        hand.forEach((card, idx) => {
            applyHandCardState(container.children[idx], card, costFilter);
        });
        return;
    }

    // 譁ｰ縺励￥謇区惆縺ｫ蜉繧上▲縺溘き繝ｼ繝峨ｒ讀懷・縺吶ｋ縲・
    // 繝峨Ο繝ｼ(drawCard)縺ｯ閾ｪ蜑阪〒 isNew 繧堤ｫ九※縺ｦ鬟帶擂貍泌・繧偵▽縺代ｋ縺ｮ縺ｧ蟇ｾ雎｡螟悶・
    // 繧ｵ繝ｼ繝√・蝗槫庶縺ｪ縺ｩ縲・｣帶擂貍泌・繧呈戟縺溘★縺ｫ逶ｴ謗･謇区惆縺ｸ蜈･繧句柑譫懊・縲・
    // 縺薙％縺ｧ諡ｾ縺｣縺ｦ縲後◎縺ｮ蝣ｴ縺ｧ縺ｵ繧上▲縺ｨ繝輔ぉ繝ｼ繝峨う繝ｳ縲阪＆縺帙↑縺・→縲・
    // 逕ｻ蜒乗悴隱ｭ縺ｿ霎ｼ縺ｿ縺ｮ縺ｾ縺ｾ荳迸ｬ縺ｧ蜃ｺ迴ｾ縺励※繝√Λ縺､縺上・
    const previousCards = _renderedHandCards;
    const newlyAdded = hand.filter(c => !previousCards.includes(c) && !c.isNew);
    newlyAdded.forEach(c => { c.isNew = true; });

    container.innerHTML = "";
    _renderedHandCards = hand.slice();

    if (hand.length === 0) return;

    const cardToElement = new Map();
    const elements = hand.map((card, idx) => {
        const el = createCardElement(card, "hand");
        el.dataset.handIndex = idx; // 蜷悟錐繧ｫ繝ｼ繝峨ｒ菴咲ｽｮ縺ｧ隴伜挨縺吶ｋ
        el.style.zIndex = idx;
        applyHandCardState(el, card, costFilter);
        container.appendChild(el);
        cardToElement.set(card, el);
        return el;
    });

    // 螳滄圀縺ｫ謠冗判縺輔ｌ縺溘き繝ｼ繝牙ｹ・ｒ貂ｬ縺｣縺ｦ縺九ｉ驥阪↑繧企㍼繧呈ｱｺ繧√ｋ
    // (--card-width 縺ｯ vw 蝓ｺ貅悶↑縺ｮ縺ｧ遶ｯ譛ｫ縺斐→縺ｫ螳溷ｯｸ縺悟､峨ｏ繧・
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

    // entering(opacity:0) 縺ｧ荳蠎ｦ謠冗判縺励※縺九ｉ縲∵ｬ｡縺ｮ繝壹う繝ｳ繝亥ｾ後↓繧ｯ繝ｩ繧ｹ繧貞､悶＠縺ｦ
    // CSS繝医Λ繝ｳ繧ｸ繧ｷ繝ｧ繝ｳ(0.3s)縺ｧ繝輔ぉ繝ｼ繝峨う繝ｳ縺輔○繧九・
    // 1蝗槭・rAF縺縺ｨ opacity:0 縺ｮ迥ｶ諷九′縺ｾ縺逕ｻ髱｢縺ｫ蜿肴丐縺輔ｌ繧句燕縺ｫ豸医＠縺ｦ縺励∪縺・
    // 蜉ｹ譫懊′蜃ｺ縺ｪ縺・％縺ｨ縺後≠繧九◆繧√・驥阪↓蠕・▽縲・
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
            // 繧ｹ繝ｭ繝・ヨ逡ｪ蜿ｷ(index)繧呈ｸ｡縺吶ｈ縺・↓菫ｮ豁｣
            const el = createCardElement(cardData, location, index);
            zoneEl.appendChild(el);
        }
    }
}

function createCardElement(cardData, location, slotIdx = null) {
    const el = document.createElement('div');
    el.className = 'card-mini';
    el.dataset.id = cardData.id;

    // 繧ｻ繝・ヨ縺輔ｌ縺滄ｭ碑｡薙・繝輔ぅ繝ｼ繝ｫ繝我ｸ翫〒縺ｯ陬丞髄縺阪↓謠冗判縺吶ｋ
    // ・域ュ蝣ｱ繝代ロ繝ｫ繧・ン繝･繝ｼ繧｢縺ｧ縺ｯ荳ｭ霄ｫ繧定ｦ九○縺溘＞縺ｮ縺ｧ縲√ヵ繧｣繝ｼ繝ｫ繝芽｡ｨ遉ｺ縺ｮ縺ｨ縺阪□縺托ｼ・
    const onField = (location === "ply-field" || location === "opt-field");
    if (onField && cardData._isSet) {
        el.classList.add('face-down');
        if (location === "ply-field") el.classList.add('own-set');
    }

    const isMonster = cardData.type === 'monster';

    // 迴ｾ蝨ｨ縺ｮ繝代Ρ繝ｼ繧定ｨ育ｮ暦ｼ医ヰ繝輔・繝・ヰ繝輔・繧ｪ繝ｼ繝ｩ蜿肴丐・・
    let currentPower = cardData.power;
    if (isMonster && (location === "ply-field" || location === "opt-field")) {
        const side = (location === "ply-field") ? "player" : "opponent";
        // 貂｡縺輔ｌ縺殱lotIdx繧貞━蜈医＠縲√↑縺代ｌ縺ｰindexOf(繝ｦ繝九・繧ｯ繧ｪ繝悶ず繧ｧ繧ｯ繝・縺ｧ迚ｹ螳・
        const targetIdx = slotIdx !== null ? slotIdx : GAME_STATE[side].field.monsters.indexOf(cardData);
        currentPower = EffectLogic.getCurrentPower(cardData, side, targetIdx);
    }
    const isEffect = cardData.subType === 'effect';
    let bgClass = isMonster ? (isEffect ? 'bg-effect' : 'bg-normal') : 'bg-magic';

    const attrMap = { "轣ｫ": "fire", "豌ｴ": "water", "闕・: "leaf", "蜈・: "light", "髣・: "dark", "辟｡": "neutral" };
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

    // 閾ｪ蜍墓､懃衍縺ｫ繧医ｋ蜷咲ｧｰ蝨ｧ邵ｮ繝ｭ繧ｸ繝・け
    const nameBox = el.querySelector('.card-name-box');
    const nameText = el.querySelector('.card-name-text');

    // 謠冗判蠕後↓迚ｩ逅・ｹ・ｒ貂ｬ螳壹＠縺ｦ險育ｮ・
    requestAnimationFrame(() => {
        const maxWidth = nameBox.clientWidth * 0.9; // 蟾ｦ蜿ｳ菴咏區繧定・・
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
// 8. 隧ｳ邏ｰ逕ｻ髱｢ & 謫堺ｽ懊ヱ繝阪Ν
// ==========================================

function showCardDetail(cardData, location, event, slotIdx = null) {
    // 逶ｸ謇九′莨上○縺溘き繝ｼ繝峨・荳ｭ霄ｫ縺ｯ隕九○縺ｪ縺・
    if (cardData && cardData._isSet && location === "opt-field") {
        showHiddenCardInfo();
        hideCardDetail();
        return;
    }

    updateInfoPanel(cardData, location);

    // 蟇ｾ雎｡隕∫ｴ縺ｮ隗｣豎ｺ
    let targetEl = null;
    if (location === "hand") {
        // 謇区惆縺ｮ蝣ｴ蜷医・DOM縺九ｉID遲峨〒謗｢縺吶°縲・∈謚樒憾諷九け繝ｩ繧ｹ縺ｮ蛻ｶ蠕｡縺ｮ縺ｿ縺ｪ繧・
        // infoPanel譖ｴ譁ｰ縺縺代〒蜊∝・縺九ｂ遏･繧後↑縺・′縲√ワ繧､繝ｩ繧､繝亥・逅・・蠢・ｦ・
        // 謇区惆縺ｮ蝣ｴ蜷医・event.target縺九ｉ驕｡繧後ｋ (.card-mini)
        targetEl = event ? event.target.closest('.card-mini') : null;
    } else {
        // 繝輔ぅ繝ｼ繝ｫ繝峨・蝣ｴ蜷医・ID縺九ｉ迚ｹ螳・
        const prefix = (location === "ply-field" || location === "opt-field")
            ? (location === "ply-field" ? "ply" : "opt")
            : null;
        if (prefix && slotIdx !== null) {
            const type = cardData.type === 'monster' ? 'monster' : 'magic';
            targetEl = document.getElementById(`${prefix}-${type}-${slotIdx}`);
        }
    }

    // 謇区惆縺ｮ蠑ｷ隱ｿ陦ｨ遉ｺ・域ｵｮ縺堺ｸ翫′繧奇ｼ牙宛蠕｡
    const handCards = document.querySelectorAll('#player-hand .card-mini');
    handCards.forEach(c => c.classList.remove('selected'));
    if (location === "hand" && targetEl) {
        targetEl.classList.add('selected');
    }

    // 繧ｿ繝ｼ繧ｲ繝・ヨ驕ｸ謚槭Δ繝ｼ繝我ｸｭ縺ｮ蜃ｦ逅・
    if (GAME_STATE.isSelectingTarget && location === "opt-field") {
        // 逶ｸ謇九Δ繝ｳ繧ｹ繧ｿ繝ｼ驕ｸ謚樊凾繧ＴlotIdx繧貞━蜈・
        const targetIdx = slotIdx !== null ? slotIdx : GAME_STATE.opponent.field.monsters.indexOf(cardData);
        if (targetIdx !== -1) {
            finishAttackTargetSelection(targetIdx);
            return;
        }
    }

    // 繧ｳ繧ｹ繝磯∈謚槭Δ繝ｼ繝我ｸｭ縺ｮ蜃ｦ逅・
    if (GAME_STATE.isSelectingCost && location === "ply-field") {
        const targetIdx = slotIdx !== null ? slotIdx : GAME_STATE.player.field.monsters.indexOf(cardData);
        if (targetIdx !== -1) {
            toggleCostSelection({ card: cardData, slotIdx: targetIdx });
            return;
        }
    }

    // 蜿ｬ蝟壼・驕ｸ謚槭Δ繝ｼ繝我ｸｭ縺ｮ蜃ｦ逅・ｼ域里蟄倥き繝ｼ繝峨ｒ繧ｿ繝・・縺励※鄂ｮ謠帙☆繧句ｴ蜷医↑縺ｩ・・
    if (GAME_STATE.isSelectingSlot && location === "ply-field") {
        const targetIdx = slotIdx !== null ? slotIdx : GAME_STATE.player.field.monsters.indexOf(cardData);
        if (targetIdx !== -1) {
            if (GAME_STATE.pendingCard.type === 'monster') finishSlotSelection(targetIdx);
            else finishMagicSlotSelection(targetIdx);
            return;
        }
    }

    // 驕ｸ謚槭Δ繝ｼ繝我ｸｭ縲√∪縺溘・逶ｸ謇九・繧ｿ繝ｼ繝ｳ縺ｪ繧峨い繧ｯ繧ｷ繝ｧ繝ｳ縺ｯ蜃ｺ縺輔↑縺・
    if (GAME_STATE.isSelectingSlot || GAME_STATE.isSelectingTarget || GAME_STATE.turnPlayer !== "player") return;

    // 譌｢蟄倥・繧｢繧ｯ繧ｷ繝ｧ繝ｳ繝｡繝九Η繝ｼ繧偵け繝ｪ繧｢
    const container = document.getElementById('floating-action-container');
    container.innerHTML = "";

    // 繝懊ち繝ｳ縺悟ｿ・ｦ√↑迥ｶ豕√°蛻､螳・
    const isMain = (GAME_STATE.phase === "MAIN1" || GAME_STATE.phase === "MAIN2");
    const isBattle = (GAME_STATE.phase === "BATTLE");

    // 繧｢繧ｯ繧ｷ繝ｧ繝ｳ繝懊ち繝ｳ陦ｨ遉ｺ蛻､螳・
    const canShowSummon = (location === "hand" && isMain && cardData.type === "monster");
    const canShowMagic = (location === "hand" && isMain && cardData.type === "magic");
    const canShowAttack = (location === "ply-field" && isBattle && cardData.type === "monster" && !cardData._hasAttacked);
    // 襍ｷ蜍募柑譫懊・繝｡繧､繝ｳ繝輔ぉ繧､繧ｺ縺ｮ縺ｿ・医ヰ繝医Ν繝輔ぉ繧､繧ｺ縺ｧ縺ｯ菴ｿ縺医↑縺・ｼ・
    const canShowEffect = (location === "ply-field" && isMain
        && cardData.logic && cardData.logic.some(l => l.trigger === "ignition"));

    const buttons = [];

    if (canShowSummon) {
        const btn = document.createElement('button');
        btn.className = 'btn-action-float';
        btn.innerText = "蜿ｬ蝟・;
        btn.disabled = !checkCanSummon(cardData);
        btn.onclick = () => trySummon(cardData);
        buttons.push(btn);
    } else if (canShowMagic) {
        // 鄂鬲碑｡薙・謇区惆縺九ｉ逶ｴ謗･逋ｺ蜍輔〒縺阪↑縺・ｼ井ｼ上○縺ｦ縺九ｉ譚｡莉ｶ謌千ｫ九〒閾ｪ蜍慕匱蜍包ｼ・
        if (cardData.subType !== "trap") {
            const btn = document.createElement('button');
            btn.className = 'btn-action-float';
            btn.innerText = "逋ｺ蜍・;
            btn.disabled = !checkCanActivateMagic(cardData);
            btn.onclick = () => tryActivateMagic(cardData);
            buttons.push(btn);
        }

        const setBtn = document.createElement('button');
        setBtn.className = 'btn-action-float set';
        setBtn.innerText = "繧ｻ繝・ヨ";
        setBtn.disabled = !checkCanSetMagic(cardData);
        setBtn.onclick = () => trySetMagic(cardData);
        buttons.push(setBtn);
    }

    // 莨上○縺ｦ縺ゅｋ閾ｪ蛻・・鬲碑｡薙ｒ陦ｨ蜷代″縺ｫ縺励※逋ｺ蜍輔☆繧・
    if (location === "ply-field" && isMain && cardData.type === "magic" && cardData._isSet) {
        if (cardData.subType !== "trap") {
            const btn = document.createElement('button');
            btn.className = 'btn-action-float';
            btn.innerText = "逋ｺ蜍・;

            // 騾壼ｸｸ繝ｻ豌ｸ邯夐ｭ碑｡薙・莨上○縺溘ち繝ｼ繝ｳ縺ｧ繧ら匱蜍輔〒縺阪ｋ・亥宛髯舌′縺ゅｋ縺ｮ縺ｯ鄂鬲碑｡薙・縺ｿ・・
            if (!EffectLogic.isEffectActivatable(cardData, "player", "on_activate")) {
                btn.disabled = true;
                btn.innerText = "蟇ｾ雎｡縺ｪ縺・;
            }

            const effectiveIdx = slotIdx !== null ? slotIdx : GAME_STATE.player.field.magics.indexOf(cardData);
            btn.onclick = () => activateSetMagic(effectiveIdx);
            buttons.push(btn);
        }
    }

    if (canShowAttack) {
        const btn = document.createElement('button');
        btn.className = 'btn-action-float attack';
        btn.innerText = "謾ｻ謦・;
        // 逶ｴ謗･slotIdx繧剃ｽｿ逕ｨ縺吶ｋ縺薙→縺ｧ蜷悟錐繧ｫ繝ｼ繝峨・隱､隱阪ｒ蝗樣∩
        const effectiveIdx = slotIdx !== null ? slotIdx : GAME_STATE.player.field.monsters.indexOf(cardData);
        btn.onclick = () => { container.innerHTML = ""; tryAttack(cardData, effectiveIdx); };
        buttons.push(btn);
    }

    if (canShowEffect) {
        const btn = document.createElement('button');
        btn.className = 'btn-action-float';
        btn.innerText = "蜉ｹ譫懃匱蜍・;

        const isUsed = EffectLogic.isIgnitionUsed(cardData);
        const isActivatable = EffectLogic.isEffectActivatable(cardData, "player", "ignition");

        if (isUsed) {
            btn.disabled = true;
            btn.innerText = "菴ｿ逕ｨ貂医∩";
        } else if (!isActivatable) {
            btn.disabled = true;
            btn.innerText = "蟇ｾ雎｡縺ｪ縺・;
        }

        btn.onclick = async () => {
            container.innerHTML = "";
            // 菴ｿ逕ｨ貂医∩蛻､螳壹・ EffectLogic 蛛ｴ縺ｮ countLimit 邂｡逅・↓荳譛ｬ蛹悶＠縺ｦ縺・ｋ
            if (GAME_STATE.isOnlineMatch && !window._isProcessingRootAction) { NetworkManager.sendAction('IGNITION', { slotIdx: effectiveIdx }); }
            await EffectLogic.resolveEffects(cardData, "player", "ignition");
        };
        buttons.push(btn);
    }

    if (buttons.length > 0) {
        const menu = document.createElement('div');
        menu.className = 'floating-actions';

        if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            // 謇区惆繧ｫ繝ｼ繝峨・驕ｸ謚樊凾縺ｫ15px豬ｮ縺上′縲√◎縺ｮ蛻・・ rect 縺ｫ縺ｾ縺蜿肴丐縺輔ｌ縺ｦ縺・↑縺・・
            // 隕玖ｾｼ繧薙〒蠑輔＞縺ｦ縺翫°縺ｪ縺・→縲∵ｵｮ縺堺ｸ翫′縺｣縺溷ｾ後↓繝懊ち繝ｳ縺縺大叙繧頑ｮ九＆繧後※
            // 2蝗樒岼縺ｮ繧ｿ繝・・縺ｧ菴咲ｽｮ縺後★繧後※隕九∴繧九・
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
 * cpu_logic.js 縺ｮ繧ｨ繝ｳ繝医Μ繝昴う繝ｳ繝医ｒ蜻ｼ縺ｳ蜃ｺ縺・
 */
function executeCpuTurn() {
    if (typeof CpuLogic !== 'undefined') {
        CpuLogic.execute();
    } else {
        console.warn("CpuLogic is not loaded yet.");
    }
}

/**
 * 蟾ｦ荳翫・繧ｫ繝ｼ繝画ュ蝣ｱ繝代ロ繝ｫ繧呈峩譁ｰ縺吶ｋ
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

    // 蟾ｦ蛛ｴ: 繝薙ず繝･繧｢繝ｫ譖ｴ譁ｰ (createCardElement繧貞・蛻ｩ逕ｨ)
    visualContainer.innerHTML = "";
    const previewCard = createCardElement(cardData, 'preview');
    visualContainer.appendChild(previewCard);

    // 蜿ｳ蛛ｴ: 蝓ｺ譛ｬ繝・く繧ｹ繝域峩譁ｰ
    nameEl.innerText = cardData.name;
    attrEl.innerText = `[${cardData.attribute}]`;
    textEl.innerText = cardData.text;
    textEl.scrollTop = 0;

    if (cardData.type === 'monster') {
        levelEl.innerText = `Lv.${cardData.level}`;

        // 隧ｳ邏ｰ繝代ロ繝ｫ縺ｧ繧ゅヰ繝輔ｒ蜿肴丐・亥ｴ謇縺檎音螳壹〒縺阪ｋ蝣ｴ蜷医・縺ｿ・・
        let displayPower = cardData.power;
        if (location === "ply-field" || location === "opt-field") {
            const side = (location === "ply-field") ? "player" : "opponent";
            const slotIdx = GAME_STATE[side].field.monsters.indexOf(cardData);
            displayPower = EffectLogic.getCurrentPower(cardData, side, slotIdx);
        }
        powerEl.innerText = `ATK: ${displayPower}`;

        // 蜿ｬ蝟壽擅莉ｶ縺ｮ譌･譛ｬ隱槫､画鋤
        const req = cardData.summonRequirement;
        if (req && req.type === 'normal') {
            if (req.costCount === 0) {
                extraEl.innerText = "蜿ｬ蝟・ 繧ｳ繧ｹ繝医↑縺・;
            } else {
                const minLv = req.costFilter ? req.costFilter.minLevel : 1;
                extraEl.innerText = `蜿ｬ蝟・ Lv.${minLv}莉･荳・ﾃ・${req.costCount}菴伝;
            }
        } else {
            extraEl.innerText = "";
        }
    } else {
        // 鬲碑｡鍋ｨｮ蛻･縺ｮ譌･譛ｬ隱槫喧
        levelEl.innerText = getMagicTypeLabel(cardData.subType);
        powerEl.innerText = "";
        extraEl.innerText = "";
    }

    // 髟ｷ縺・錐蜑阪ｂ逵∫払縺帙★縲∵ｨｪ縺ｫ邵ｮ繧√※蠢・★蜿弱ａ繧・
    requestAnimationFrame(() => fitTextToWidth(nameEl));
}

/**
 * 隕∫ｴ蜀・・1陦後ユ繧ｭ繧ｹ繝医ｒ縲√・縺ｿ蜃ｺ縺吝ｴ蜷医□縺第ｨｪ譁ｹ蜷代↓邵ｮ繧√※譫蜀・↓蜿弱ａ繧九・
 * text-overflow 縺ｫ繧医ｋ縲娯ｦ縲阪・菴ｿ繧上↑縺・ｼ亥錐蜑阪′隱ｭ繧√↑縺上↑繧九◆繧・ｼ峨・
 */
function fitTextToWidth(el) {
    if (!el) return;

    // 蜑榊屓縺ｮscaleX縺梧ｮ九▲縺ｦ縺・ｋ縺ｨ貂ｬ螳壼､縺檎汲縺・・縺ｧ縲∝・縺ｫ謌ｻ縺励※縺九ｉ貂ｬ繧・
    el.style.transform = 'none';

    const available = el.clientWidth;
    const natural = el.scrollWidth;
    if (!available || !natural) return;

    if (natural > available) {
        el.style.transformOrigin = 'left center';
        el.style.transform = `scaleX(${available / natural})`;
    }
}

/** 隧ｳ邏ｰ繝代ロ繝ｫ繧呈悴驕ｸ謚樒憾諷九↓謌ｻ縺・*/
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
    set('info-text', "繧ｫ繝ｼ繝峨ｒ繧ｿ繝・・縺励※隧ｳ邏ｰ繧定｡ｨ遉ｺ");
}

/** 逶ｸ謇九・莨上○繧ｫ繝ｼ繝峨ｒ驕ｸ繧薙□縺ｨ縺阪・諠・ｱ繝代ロ繝ｫ陦ｨ遉ｺ */
function showHiddenCardInfo() {
    document.getElementById('info-visual-container').innerHTML =
        `<div class="card-mini face-down"><div class="card-face card-back"></div></div>`;
    document.getElementById('info-name').innerText = "繧ｻ繝・ヨ縺輔ｌ縺溘き繝ｼ繝・;
    document.getElementById('info-name').style.transform = 'none';
    document.getElementById('info-attr').innerText = "";
    document.getElementById('info-level').innerText = "";
    document.getElementById('info-power').innerText = "";
    document.getElementById('info-extra-stats').innerText = "";
    document.getElementById('info-text').innerText = "逶ｸ謇九′莨上○縺ｦ縺・ｋ縺溘ａ蜀・ｮｹ縺ｯ遒ｺ隱阪〒縺阪∪縺帙ｓ縲・;
}

/**
 * 繧ｫ繝ｼ繝臥判蜒上′逕ｨ諢上＆繧後※縺・↑縺・ｴ蜷医・蟾ｮ縺玲崛縺郁｡ｨ遉ｺ縲・
 * Game-icons.net 縺ｮSVG・・mg/game_icons.js・峨ｒ繧ｫ繝ｼ繝峨＃縺ｨ縺ｫ蜃ｺ縺怜・縺代※縲∬ｦ句・縺代′縺､縺上ｈ縺・↓縺吶ｋ縲・
 * 螻樊ｧ縺斐→縺ｫ濶ｲ蛻・￠縺吶ｋ縲ら判蜒乗棧縺・▲縺ｱ縺・↓豁｣譁ｹ蠖｢縺ｮ繧ｿ繧､繝ｫ縺ｨ縺励※陦ｨ遉ｺ縺吶ｋ縲・
 */
const ART_FALLBACK_ATTR_TINT = { "轣ｫ": "#ff6b4a", "豌ｴ": "#38b6ff", "闕・: "#7ed957", "蜈・: "#ffd23f", "髣・: "#c17dff", "辟｡": "#9fb4c7" };

/**
 * 逕ｻ蜒乗棧縺ｮ荳ｭ霄ｫ繧堤ｵ・∩遶九※繧九・
 * icon 縺瑚ｨｭ螳壹＆繧後※縺・ｋ繧ｫ繝ｼ繝峨・縲後う繝ｩ繧ｹ繝域悴菴懈・縲阪・蜊ｰ縺ｪ縺ｮ縺ｧ縲∵怙蛻昴°繧峨い繧､繧ｳ繝ｳ繧呈緒縺上・
 * 莉･蜑阪・ <img> 繧貞・縺励※404縺ｮ onerror 縺ｧ蟾ｮ縺玲崛縺医※縺・◆縺後∵緒逕ｻ縺ｮ縺溘・縺ｫ
 * 隱ｭ縺ｿ霎ｼ縺ｿ螟ｱ謨励∪縺ｧ縺ｮ荳迸ｬ縺縺鷹ｻ偵＞譫縺瑚ｦ九∴縺ｦ繧ｫ繝ｼ繝峨′轤ｹ貊・＠縺ｦ縺・◆縲・
 * 繧､繝ｩ繧ｹ繝医ｒ逕ｨ諢上＠縺溘ｉ cards.js 縺ｮ icon 陦後ｒ豸医☆縺薙→・医◎縺ｮ縺ｾ縺ｾ逕ｻ蜒剰｡ｨ遉ｺ縺ｫ蛻・ｊ譖ｿ繧上ｋ・峨・
 */
function buildCardArtHtml(cardData) {
    if (!cardData.icon) {
        return `<img src="${cardData.image}" class="card-img-content" draggable="false">`;
    }

    const iconPath = (window.GAME_ICONS && window.GAME_ICONS[cardData.icon]) || null;
    const tint = ART_FALLBACK_ATTR_TINT[cardData.attribute] || "#9fb4c7";
    const inner = iconPath
        ? `<svg class="card-art-fallback-svg" viewBox="0 0 512 512"><path d="${iconPath}"/></svg>`
        : `<span class="card-art-fallback-glyph">笶・/span>`;
    return `<span class="card-art-fallback"><span class="card-art-fallback-inner" style="color:${tint}">${inner}</span></span>`;
}
window.buildCardArtHtml = buildCardArtHtml;

/**
 * 繧ｫ繝ｼ繝峨・迴ｾ蝨ｨ菴咲ｽｮ・医だ繝ｼ繝ｳ隕∫ｴ・峨ｒ謗｢縺吶よｼ泌・縺ｮ襍ｷ轤ｹ繝ｻ邨らせ縺ｫ菴ｿ縺・・
 */
function findCardZoneElement(card, side) {
    const prefix = (side === "player") ? "ply" : "opt";
    const p = GAME_STATE[side];

    const mIdx = p.field.monsters.indexOf(card);
    if (mIdx !== -1) return document.getElementById(`${prefix}-monster-${mIdx}`);

    const gIdx = p.field.magics.indexOf(card);
    if (gIdx !== -1) return document.getElementById(`${prefix}-magic-${gIdx}`);

    // 蝣ｴ縺ｫ辟｡縺・き繝ｼ繝会ｼ医ヨ繝ｩ繝・す繝･繝ｻ髯､螟悶°繧臥匱蜍輔☆繧句柑譫懶ｼ峨・縲√◎縺ｮ繧ｾ繝ｼ繝ｳ繧貞・繧峨○繧・
    const sideName = (side === "player") ? "player" : "opponent";
    if (p.trash.includes(card)) return document.getElementById(`${sideName}-trash-zone`);
    if (p.banished.includes(card)) return document.getElementById(`${sideName}-banish-zone`);

    return null;
}

/**
 * 逶ｸ謇九・謇区惆繧定｣丞髄縺阪〒謠冗判縺吶ｋ縲・
 * 譫壽焚縺縺代′蛻・°繧後・繧医＞縺ｮ縺ｧ荳ｭ霄ｫ縺ｯ謖√◆縺帙↑縺・・
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
        // 蠅励∴縺溷・縺縺大ｷｮ縺苓ｾｼ繧繧医≧縺ｫ隕九○繧・
        if (isDraw && i >= count - 1) el.classList.add('dealt');
        container.appendChild(el);
    }
}

/**
 * 蜉ｹ譫懃匱蜍輔↑縺ｩ繧偵ヨ繝ｼ繧ｹ繝医〒遏･繧峨○繧九・
 * 繧ｫ繝ｼ繝峨・逵滉ｸ九□縺ｨ逶､髱｢縺ｫ蝓九ｂ繧後※隕玖誠縺ｨ縺吶・縺ｧ縲∫嶌謇九・蝣ｴ縺ｨ隧ｳ邏ｰ繧ｨ繝ｪ繧｢縺ｮ髢薙・蟶ｯ縺ｫ蜃ｺ縺吶・
 * 譁ｰ縺励＞繝医・繧ｹ繝医′譚･縺溘ｉ蜑阪・繧ゅ・縺ｯ蜊ｳ蠎ｧ縺ｫ蟾ｮ縺玲崛縺医ｋ縲・
 */
let _effectToastTimer = null;
function showToastMessage(text, side) {
    const toast = document.getElementById('effect-toast');
    if (!toast) return;

    const owner = (side === "player") ? "閾ｪ蛻・ : "逶ｸ謇・;
    toast.innerHTML = `<span class="toast-owner">${owner}</span>${text}`;
    toast.classList.toggle('opponent', side === "opponent");
    toast.classList.add('show');

    clearTimeout(_effectToastTimer);
    _effectToastTimer = setTimeout(() => toast.classList.remove('show'), 1000);
}

/** 繝医・繧ｹ繝医ｒ蜊ｳ蠎ｧ縺ｫ豸医☆・亥ｯｾ謌ｦ邨ゆｺ・・繝ｪ繧ｻ繝・ヨ譎ゑｼ・*/
function clearToastMessage() {
    const toast = document.getElementById('effect-toast');
    if (!toast) return;
    clearTimeout(_effectToastTimer);
    toast.classList.remove('show');
}

/**
 * 蜉ｹ譫懊′逋ｺ蜍輔＠縺溘き繝ｼ繝峨ｒ蜈峨ｉ縺帙▽縺､縲∝ｸｯ縺ｫ繝医・繧ｹ繝医ｒ蜃ｺ縺吶・
 * @returns {Promise} 貍泌・縺檎ｵゅｏ繧九∪縺ｧ蠕・※繧・
 */
function showEffectActivation(card, side) {
    return new Promise(resolve => {
        if (GAME_STATE.isGameOver) { resolve(); return; }

        showToastMessage(`${card.name} 縺ｮ蜉ｹ譫懃匱蜍描, side);

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
 * HUD縺ｫ蜃ｺ縺儉P縲・
 * 繝繝｡繝ｼ繧ｸ謨ｰ蟄励′LP陦ｨ遉ｺ縺ｫ螻翫＞縺溽椪髢薙↓貂帙ｉ縺励◆縺・・縺ｧ縲・
 * 螳滄圀縺ｮLP(GAME_STATE)縺ｨ縺ｯ蛻･縺ｫ縲瑚｡ｨ遉ｺ荳ｭ縺ｮLP縲阪ｒ謖√▽縲・
 * null 縺ｮ髢薙・螳滓焚蛟､繧偵◎縺ｮ縺ｾ縺ｾ蜃ｺ縺吶・
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
 * 蜿励￠縺溘ム繝｡繝ｼ繧ｸ・亥屓蠕ｩ・峨ｒ謨ｰ蟄励〒隕九○繧九・
 * 縺昴・蛛ｴ縺ｮ謇区惆縺ゅ◆繧翫↓蜃ｺ縺励※縺九ｉLP陦ｨ遉ｺ縺ｸ蜷ｸ縺・ｾｼ縺ｾ縺帙√←縺｡繧峨′菴慕せ蜿励￠縺溘°蛻・°繧九ｈ縺・↓縺吶ｋ縲・
 * 謨ｰ蟄励′LP縺ｫ螻翫＞縺溘ち繧､繝溘Φ繧ｰ縺ｧLP縺ｮ謨ｰ蛟､縺悟虚縺上・
 */
function showDamageNumber(side, amount, isHeal = false) {
    const viewport = document.getElementById('game-viewport');
    if (!viewport || amount <= 0) return;

    const lpEl = document.getElementById(side === "player" ? 'player-lp-hud' : 'opponent-lp-hud');
    // 閾ｪ蛻・・謇区惆縲∫嶌謇九・陬丞髄縺肴焔譛ｭ縺ｮ蟶ｯ繧定ｵｷ轤ｹ縺ｫ縺吶ｋ
    const originEl = document.getElementById(side === "player" ? 'player-hand-container' : 'opponent-band');
    if (!lpEl || !originEl) return;

    // 謨ｰ蟄励′LP縺ｫ螻翫￥縺ｾ縺ｧ縺ｯ螟牙虚蜑阪・蛟､繧貞・縺励※縺翫￥
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

    // 謨ｰ蟄励′隱ｭ繧√ｋ髢薙ｒ鄂ｮ縺・※縺九ｉLP縺ｸ鬟帙・縺・
    setTimeout(() => {
        el.style.left = `${to.left + to.width / 2}px`;
        el.style.top = `${to.top + to.height / 2}px`;
        el.style.fontSize = '0.9rem';
        el.style.opacity = '0';
    }, 450);

    // 謨ｰ蟄励′LP縺ｫ蛻ｰ驕斐＠縺溽椪髢薙↓LP縺ｮ謨ｰ蛟､繧貞虚縺九☆
    setTimeout(() => {
        _pendingLpDisplay[side] = null;
        renderLpDisplay();

        if (!isHeal) {
            // LP縺梧ｸ帙▲縺溘％縺ｨ繧堤判髱｢蜈ｨ菴薙〒繧ゆｼ昴∴繧・
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
 * 繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺檎ｴ螢翫＆繧後◆譎ゅ・貍泌・縲・
 * 菴輔・蜑崎ｧｦ繧後ｂ縺ｪ縺上ヨ繝ｩ繝・す繝･縺ｫ騾√ｉ繧後ｋ縺ｨ縲∽ｽ輔′襍ｷ縺阪◆縺ｮ縺句・縺九ｉ縺ｪ縺・◆繧√・
 */
/**
 * 莠､蟾ｮ縺励◆蜑｣縺ｮ繝槭・繧ｯ・域判謦・憾諷九・陦ｨ遉ｺ縺ｫ菴ｿ縺・・菴彜VG・峨・
 * 邨ｵ譁・ｭ励□縺ｨ迺ｰ蠅・＃縺ｨ縺ｫ邨ｵ譟・′螟峨ｏ繧九・縺ｧ縲√ヱ繧ｹ縺ｧ謖√▽縲・
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

/** 1繧ｿ繝ｼ繝ｳ縺ｫ1蠎ｦ縺ｮ蜉ｹ譫懊ｒ菴ｿ縺・・縺｣縺溷魂・育ｦ∵ｭ｢繝槭・繧ｯ・・*/
const EFFECT_USED_SVG = `
<svg class="state-badge-icon" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.6"/>
  <path d="M6 18 L18 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
</svg>`;

/**
 * 繝輔ぅ繝ｼ繝ｫ繝我ｸ翫・繧ｫ繝ｼ繝峨↓蜃ｺ縺咏憾諷九ヰ繝・ず縲・
 * 繝ｻ繝舌ヨ繝ｫ繝輔ぉ繧､繧ｺ荳ｭ縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ: 謾ｻ謦・〒縺阪ｋ縺具ｼ乗判謦・ｸ医∩縺・
 * 繝ｻ縲・繧ｿ繝ｼ繝ｳ縺ｫ1蠎ｦ縲阪ｒ菴ｿ縺・・縺｣縺溷柑譫・ 菴ｿ逕ｨ貂医∩
 */
function buildCardStateBadges(cardData, location, isMonster) {
    // 莨上○繧ｫ繝ｼ繝峨・荳ｭ霄ｫ繧定ｦ九○縺ｪ縺・
    if (cardData._isSet) return '';

    const side = (location === "ply-field") ? "player" : "opponent";
    let html = '';

    if (isMonster && GAME_STATE.phase === "BATTLE" && GAME_STATE.turnPlayer === side) {
        const done = !!cardData._hasAttacked;
        html += `<div class="card-state-badge ${done ? 'attacked' : 'can-attack'}"
                      title="${done ? '謾ｻ謦・ｸ医∩' : '謾ｻ謦・庄閭ｽ'}">${CROSSED_SWORDS_SVG}</div>`;
    }

    if (EffectLogic.isLimitUsed(cardData)) {
        html += `<div class="card-state-badge used-effect"
                      title="縺薙・繧ｿ繝ｼ繝ｳ縺ｮ蜉ｹ譫懊・菴ｿ逕ｨ貂医∩">${EFFECT_USED_SVG}</div>`;
    }

    return html;
}

/**
 * 蜿ｬ蝟壽凾縺ｮ貍泌・縲ょ捉蝗ｲ縺瑚ｻｽ縺丞・繧九□縺代・遏ｭ縺・ｂ縺ｮ縲・
 * 蜿ｬ蝟・竊・・亥小蝟壽凾蜉ｹ譫懊′縺ゅｌ縺ｰ・牙柑譫懃匱蜍・縺ｮ鬆・↓隕九○繧九◆繧√∝・縺ｫ蜻ｼ縺ｶ縲・
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
 * 謾ｻ謦・・遏｢蜊ｰ貍泌・縲りｪｰ縺九ｉ隱ｰ縺ｫ謾ｻ謦・＠縺溘°繧定ｦ九○繧九・
 * defenderSlot 縺・-1 縺ｪ繧峨ム繧､繝ｬ繧ｯ繝医い繧ｿ繝・け・育嶌謇九・LP陦ｨ遉ｺ縺ｸ蜷代°縺・ｼ峨・
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
            // 繝繧､繝ｬ繧ｯ繝医い繧ｿ繝・け縺ｯ螳医ｋ蛛ｴ縺ｮ謇区惆縺ゅ◆繧翫ｒ迢吶≧・医・繝ｬ繧､繝､繝ｼ譛ｬ菴薙ｒ谿ｴ繧九う繝｡繝ｼ繧ｸ・・
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

        // 遏｢蜊ｰ縺悟ｱ翫＞縺ｦ縺九ｉ謠ｺ繧峨☆・亥酔譎ゅ□縺ｨ蠖薙◆繧句燕縺ｫ逶ｸ謇九′髴・∴縺ｦ隕九∴繧具ｼ・
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
 * 繝・ャ繧ｭ縺九ｉ繝医Λ繝・す繝･縺ｸ1譫夊誠縺｡繧区ｼ泌・縲・
 * 荳豌励↓豸医∴繧九→菴輔′襍ｷ縺阪◆縺句・縺九ｉ縺ｪ縺・・縺ｧ縲・譫壹★縺､隕九○繧九・
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

/** 鄂縺檎匱蜍輔＠縺溘％縺ｨ繧定ｦ九○繧区ｼ泌・ */
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
    banner.innerHTML = `<span>鄂逋ｺ蜍・ ${card.name}</span>`;
    banner.classList.add('active', 'trap-banner');
    setTimeout(() => {
        banner.classList.remove('active', 'trap-banner');
        banner.innerHTML = "";
    }, 1600);
}

/** 蜿ｬ蝟壼・驕ｸ謚槭Δ繝ｼ繝峨・髢句ｧ・*/
function startSlotSelection(cardData) {
    document.getElementById('floating-action-container').innerHTML = "";
    document.getElementById('field-surface').classList.add('selecting-mode');
    document.getElementById('game-viewport').classList.add('field-selecting');
    showSelectionPrompt("蜿ｬ蝟壹☆繧句ｴ謇繧帝∈謚槭＠縺ｦ縺上□縺輔＞");
    GAME_STATE.isSelectingSlot = true;
    GAME_STATE.pendingCard = cardData;

    // 繝輔ぅ繝ｼ繝ｫ繝峨°繧峨Μ繝ｪ繝ｼ繧ｹ縺吶ｋ譫縺ｯ縲檎ｩｺ縺榊慍縲阪→縺励※謇ｱ縺・ｼ域焔譛ｭ繧ｳ繧ｹ繝医・譫繧堤ｩｺ縺代↑縺・ｼ・
    const costIndices = GAME_STATE.selectedCosts
        .filter(c => c.from === "field")
        .map(c => c.slotIdx);

    // 繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧ｾ繝ｼ繝ｳ繧貞・繧峨○繧・
    [0, 1, 2].forEach(i => {
        const zone = document.getElementById(`ply-monster-${i}`);
        // 縲悟・縲・ｩｺ縲阪∪縺溘・縲後さ繧ｹ繝医〒縺・↑縺上↑繧九榊ｴ謇繧偵ワ繧､繝ｩ繧､繝・
        if (GAME_STATE.player.field.monsters[i] === null || costIndices.includes(i)) {
            zone.classList.add('highlight');
        }
    });
}

async function finishSlotSelection(slotIdx) {
    if (!GAME_STATE.pendingCard) return;

    const card = GAME_STATE.pendingCard;
    const costs = GAME_STATE.selectedCosts.slice();

    // 莠碁㍾螳溯｡後ｒ髦ｲ縺舌◆繧√∬ｧ｣豎ｺ蜑阪↓驕ｸ謚樒憾諷九ｒ逡ｳ繧
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
    // 繧ｳ繧ｹ繝磯∈謚樔ｸｭ縺ｮ繧ｬ繧､繝峨ヰ繝ｼ縺ｯ髢峨§縺ｪ縺・ｼ郁レ譎ｯ繧ｿ繝・・縺ｧ豸医∴縺ｦ縺励∪縺・・繧帝亟縺撰ｼ・
    if (GAME_STATE.isSelectingCost) return;

    document.getElementById('floating-action-container').innerHTML = "";
    // 蜈ｨ縺ｦ縺ｮ謇区惆縺ｮ驕ｸ謚樒憾諷具ｼ域ｵｮ縺堺ｸ翫′繧奇ｼ峨ｒ隗｣髯､
    const handCards = document.querySelectorAll('#player-hand .card-mini');
    handCards.forEach(c => c.classList.remove('selected'));
}

/** 謾ｻ謦・ｯｾ雎｡驕ｸ謚槭Δ繝ｼ繝峨・髢句ｧ・*/
function startAttackTargetSelection(attackerCard, attackerSlotIdx) {
    document.getElementById('floating-action-container').innerHTML = "";
    document.getElementById('game-viewport').classList.add('field-selecting');
    GAME_STATE.isSelectingTarget = true;
    GAME_STATE.attackerPending = { card: attackerCard, slotIdx: attackerSlotIdx };

    // 逶ｸ謇九Δ繝ｳ繧ｹ繧ｿ繝ｼ縺後＞繧九せ繝ｭ繝・ヨ繧貞・繧峨○繧・
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
 * 繝・ャ繧ｭ縺ｨ繝医Λ繝・す繝･縺ｮ隕冶ｦ夂噪譖ｴ譁ｰ・亥字縺ｿ縺ｨ荳逡ｪ荳翫・繧ｫ繝ｼ繝会ｼ・
 */
function updateZoneVisuals(side, type) {
    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    const prefix = (side === "player") ? "player" : "opponent";
    const zoneId = `${prefix}-${type}-zone`;
    const zoneEl = document.getElementById(zoneId);
    if (!zoneEl) return;

    const pile = (type === "deck") ? p.deck : (type === "trash") ? p.trash : p.banished;
    const count = pile.length;

    // 霑ｽ蜉: 繝医Λ繝・す繝･繝ｻ髯､螟悶ち繝・・繧､繝吶Φ繝医・隕冶ｦ壼宛蠕｡
    if (type === "trash" || type === "banish") {
        zoneEl.style.cursor = count > 0 ? "pointer" : "default";
        // 蛻､螳壹ｒ遒ｺ螳溘↓縺吶ｋ縺溘ａ縲】-index繧貞虚逧・↓遒ｺ菫・
        zoneEl.style.zIndex = "100";
    }

    // 1. 蜴壹∩繧ｯ繝ｩ繧ｹ縺ｮ譖ｴ譁ｰ
    zoneEl.classList.remove('stack-stage-1', 'stack-stage-2', 'stack-stage-3');
    if (count > 0) {
        if (count >= 14) zoneEl.classList.add('stack-stage-3');
        else if (count >= 7) zoneEl.classList.add('stack-stage-2');
        else zoneEl.classList.add('stack-stage-1');
    }

    // 2. 繧ｫ繝ｼ繝画緒逕ｻ縺ｮ譖ｴ譁ｰ
    let cardEl = zoneEl.querySelector('.card-mini');
    if (count === 0) {
        if (cardEl) cardEl.remove();
    } else {
        // 繧ｫ繝ｼ繝峨′蠢・ｦ√□縺悟ｭ伜惠縺励↑縺・ｴ蜷医・譁ｰ隕丈ｽ懈・
        if (!cardEl) {
            cardEl = document.createElement('div');
            zoneEl.appendChild(cardEl);
        }

        if (type === "deck") {
            cardEl.className = 'card-mini card-back';
            cardEl.innerHTML = ''; // 繝・ャ繧ｭ縺ｯ閭碁擇逕ｻ蜒上・縺ｿ繧定｡ｨ遉ｺ
        } else {
            const topCard = pile.at(-1);
            // 譌｢蟄倥・ createCardElement 繧呈ｵ∫畑縺励※譛譁ｰ縺ｮ繧ｫ繝ｼ繝峨ｒ陦ｨ蜷代″縺ｧ陦ｨ遉ｺ
            const newCard = createCardElement(topCard, `${side}-${type}`);
            zoneEl.replaceChild(newCard, cardEl);
        }
    }

    // 3. 譫壽焚陦ｨ遉ｺ縺ｮ譖ｴ譁ｰ・・eck / Trash / Banish・・
    const badgeIds = {
        deck: { player: 'ply-deck-count-badge', opponent: 'opt-deck-count' },
        trash: { player: 'ply-trash-count-badge', opponent: 'opt-trash-count-badge' },
        banish: { player: 'ply-banish-count-badge', opponent: 'opt-banish-count-badge' }
    };
    const badgeId = badgeIds[type][side];

    const badge = document.getElementById(badgeId);
    if (badge) {
        badge.innerText = count;
        // 0譫壹・譎ゅ・繝舌ャ繧ｸ繧帝國縺吶√≠繧九＞縺ｯ阮・￥縺吶ｋ貍泌・
        badge.style.opacity = count > 0 ? "1" : "0";
    }
}

/**
 * 繝｢繝ｼ繝繝ｫ繧帝哩縺倥※螳滄圀縺ｫ繝・Η繧ｨ繝ｫ繧帝幕蟋九☆繧・
 */
async function beginDuel() {
    const overlay = document.getElementById('game-start-overlay');
    overlay.style.display = "none";

    // 蛻晄悄謇区惆縺ｮ驟榊ｸ・′邨ゅｏ縺｣縺ｦ縺九ｉ繧ｿ繝ｼ繝ｳ繧帝幕蟋九☆繧・
    // (await 縺励↑縺・→繝峨Ο繝ｼ貍泌・縺ｨ繧ｿ繝ｼ繝ｳ髢句ｧ句・逅・′遶ｶ蜷医＠ isAnimating 縺悟｣翫ｌ繧・
    await drawCard("player", 6);
    await drawCard("opponent", 6);
    updateUI();
    startTurnProcess();
}

/** 繧ｳ繧ｹ繝医ヵ繧｣繝ｫ繧ｿ縺ｫ蜷郁・縺吶ｋ縺・*/
function matchesCostFilter(card, filter) {
    if (!card || card.type !== "monster") return false;
    if (!filter) return true;
    if (filter.minLevel && card.level < filter.minLevel) return false;
    if (filter.maxLevel && card.level > filter.maxLevel) return false;
    if (filter.attribute && card.attribute !== filter.attribute) return false;
    if (filter.category && (!card.categories || !card.categories.includes(filter.category))) return false;
    // subType(騾壼ｸｸ/蜉ｹ譫懊Δ繝ｳ繧ｹ繧ｿ繝ｼ)縺ｮ邨槭ｊ霎ｼ縺ｿ縲ゆｻ･蜑阪・邏譚千ｨｮ蛻･繧堤┌隕悶＠縺ｦ縺・◆縺溘ａ縲・
    // 萓九∴縺ｰ縲碁壼ｸｸ繝｢繝ｳ繧ｹ繧ｿ繝ｼ髯仙ｮ壹阪・繧ｳ繧ｹ繝域欠螳壹〒繧ょ柑譫懊Δ繝ｳ繧ｹ繧ｿ繝ｼ繧呈ｸ｡縺帙※縺励∪縺｣縺ｦ縺・◆縲・
    if (filter.subType && card.subType !== filter.subType) return false;
    return true;
}

/** 蜿ｬ蝟壹さ繧ｹ繝亥ｯｾ雎｡縺ｮ蜿門ｾ暦ｼ郁・蛻・ヵ繧｣繝ｼ繝ｫ繝会ｼ・*/
function getValidCosterMonsters(filter) {
    return GAME_STATE.player.field.monsters
        .map((m, i) => ({ card: m, slotIdx: i, from: "field" }))
        .filter(obj => matchesCostFilter(obj.card, filter));
}

/** 蜿ｬ蝟壹さ繧ｹ繝亥ｯｾ雎｡縺ｮ蜿門ｾ暦ｼ郁・蛻・・謇区惆 / 謾ｯ謇輔≧縺ｨ髯､螟悶＆繧後ｋ・・*/
function getValidHandCosters(filter, excludeCard = null) {
    return GAME_STATE.player.hand
        .map((c, i) => ({ card: c, handIdx: i, from: "hand" }))
        .filter(obj => obj.card !== excludeCard && matchesCostFilter(obj.card, filter));
}

/** 驕ｸ謚樊ｸ医∩繧ｳ繧ｹ繝医↓蜷ｫ縺ｾ繧後ｋ縺具ｼ医が繝悶ず繧ｧ繧ｯ繝亥酔荳諤ｧ縺ｧ蛻､螳夲ｼ・*/
function isCostSelected(card) {
    return GAME_STATE.selectedCosts.some(c => c.card === card);
}

/** 繧ｳ繧ｹ繝磯∈謚槭Δ繝ｼ繝峨・髢句ｧ・*/
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

    renderHand(); // 謇区惆蛛ｴ縺ｮ繧ｳ繧ｹ繝亥呵｣懊ワ繧､繝ｩ繧､繝医ｒ蜿肴丐
    renderCostSelectionBar();
}

/** 繧ｳ繧ｹ繝磯∈謚樔ｸｭ縺ｮ繧ｬ繧､繝会ｼ・｢ｺ螳壹ヰ繝ｼ繧呈緒逕ｻ */
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
    info.innerHTML = `<strong>${GAME_STATE.pendingCard.name}</strong> 縺ｮ蜿ｬ蝟壹さ繧ｹ繝・
        <span class="cost-progress">${selected.length} / ${req.costCount}</span>
        <span class="cost-hint">蝣ｴ縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｯ繝医Λ繝・す繝･縺ｸ / 謇区惆縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｯ髯､螟悶＆繧後∪縺・{handPicks > 0 ? `・磯勁螟・${handPicks}譫夲ｼ荏 : ""}</span>
        ${enough && !hasRoom ? `<span class="cost-warn">蝣ｴ縺ｫ鄂ｮ縺榊ｴ謇縺後≠繧翫∪縺帙ｓ縲ゅヵ繧｣繝ｼ繝ｫ繝峨°繧・菴謎ｻ･荳翫Μ繝ｪ繝ｼ繧ｹ縺励※縺上□縺輔＞</span>` : ""}`;

    const btns = document.createElement('div');
    btns.className = 'cost-select-buttons';

    const okBtn = document.createElement('button');
    okBtn.className = 'btn-action-float';
    okBtn.innerText = "遒ｺ螳・;
    okBtn.disabled = !(enough && hasRoom);
    okBtn.onclick = (e) => { e.stopPropagation(); proceedToSlotSelectionFromCost(); };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-action-float cancel';
    cancelBtn.innerText = "繧・ａ繧・;
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
        // 蠢・ｦ∵焚繧定ｶ・∴繧矩∈謚槭・蜿励￠莉倥￠縺ｪ縺・ｼ磯∈縺ｳ逶ｴ縺励・隗｣髯､縺励※縺九ｉ・・
        if (GAME_STATE.selectedCosts.length >= req.costCount) return;
        GAME_STATE.selectedCosts.push(costObj);
    }

    // 繝輔ぅ繝ｼ繝ｫ繝牙・縺ｮ隕九◆逶ｮ繧呈峩譁ｰ
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

/** 蟇ｾ雎｡驕ｸ謚樔ｸｭ縺ｮ譯亥・繝・く繧ｹ繝医ｒ陦ｨ遉ｺ・乗ｶ亥悉縺吶ｋ */
function showSelectionPrompt(text) {
    const el = document.getElementById('selection-prompt');
    if (!el) return;
    if (!text) {
        el.classList.remove('active');
        el.innerHTML = "";
        return;
    }
    el.innerHTML = `<span>${text}</span><small>閭梧勹繧偵ち繝・・縺ｧ繧ｭ繝｣繝ｳ繧ｻ繝ｫ</small>`;
    el.classList.add('active');
}

/**
 * 豎守畑繧ｿ繝ｼ繧ｲ繝・ヨ驕ｸ謚霸romise
 * @param {Array<number>} validSlots - 驕ｸ謚槭ｒ險ｱ蜿ｯ縺吶ｋ繧ｹ繝ｭ繝・ヨ逡ｪ蜿ｷ・亥柑譫懊・繝輔ぅ繝ｫ繧ｿ驕ｩ逕ｨ貂医∩・・
 * @param {string} promptText - 繝励Ξ繧､繝､繝ｼ縺ｸ縺ｮ譯亥・譁・
 * @returns {Promise<number|null>} 驕ｸ縺ｰ繧後◆繧ｹ繝ｭ繝・ヨ逡ｪ蜿ｷ縲ゅく繝｣繝ｳ繧ｻ繝ｫ譎ゅ・ null
 */
async function selectTargetUI(side, type, validSlots = null, promptText = "蟇ｾ雎｡繧帝∈謚槭＠縺ｦ縺上□縺輔＞") {
    const zoneList = GAME_STATE[side].field[type + "s"];

    // 蟇ｾ雎｡謖・ｮ壹′縺ｪ縺・ｴ蜷医・縲後◎縺ｮ繧ｾ繝ｼ繝ｳ縺ｫ縺ゅｋ繧ｫ繝ｼ繝峨☆縺ｹ縺ｦ縲阪ｒ蛟呵｣懊→縺吶ｋ
    let candidates = validSlots;
    if (!Array.isArray(candidates)) {
        candidates = zoneList.map((card, i) => (card ? i : null)).filter(i => i !== null);
    }
    candidates = candidates.filter(i => zoneList[i]);

    if (candidates.length === 0) return null;

    // 逶ｸ謇九ち繝ｼ繝ｳ・・PU・峨∪縺溘・髱槭ち繝ｼ繝ｳ繝励Ξ繧､繝､繝ｼ縺碁∈謚槭☆繧句ｴ蜷医・繝ｩ繝ｳ繝繝
    if (GAME_STATE.turnPlayer !== "player") {
        return candidates[Math.floor(GameRandom() * candidates.length)];
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
            // 繧ｾ繝ｼ繝ｳ縺ｨ繧ｫ繝ｼ繝画悽菴薙√←縺｡繧峨・繧ｯ繝ｪ繝・け繧よ鏡縺医ｋ繧医≧縺ｫ縺吶ｋ・磯溘＞邨瑚ｷｯ・・
            const selectHandler = (e) => {
                e.stopPropagation();
                if (GAME_STATE.isOnlineMatch) NetworkManager.sendAction('TARGET_SELECTED', { result: i });
                cleanup(i);
            };
            zone.onclick = selectHandler;
            const cardEl = zone.querySelector('.card-mini');
            if (cardEl) cardEl.onclick = selectHandler;
        });

        // 繝輔ぅ繝ｼ繝ｫ繝峨・3D螟牙ｽ｢縺励※縺翫ｊ縲．OM縺ｮ繝偵ャ繝医ユ繧ｹ繝医′隕ｪ隕∫ｴ縺ｫ蜷ｸ繧上ｌ縺ｦ繧ｾ繝ｼ繝ｳ縺ｮ
        // onclick 縺檎匱轣ｫ縺励↑縺・％縺ｨ縺後≠繧九ゆｻ悶・驕ｸ謚槭Δ繝ｼ繝峨→蜷後§蟷ｾ菴募愛螳壹〒諡ｾ縺・・
        const handleClick = (e) => {
            const hit = detectHitSlot(e, `${prefix}-${type}`, 3, true);
            if (hit !== -1 && candidates.includes(hit)) {
                e.stopPropagation();
                cleanup(hit);
                return;
            }
            // 隱､繧ｿ繝・・縺ｧ縺・″縺ｪ繧贋ｸ咲匱縺ｫ縺ｪ繧峨↑縺・ｈ縺・∵・遉ｺ逧・↑閭梧勹繧ｿ繝・・縺ｮ縺ｿ繧ｭ繝｣繝ｳ繧ｻ繝ｫ謇ｱ縺・↓縺吶ｋ
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
 * 繝医Λ繝・す繝･髢ｲ隕ｧ繝｢繝ｼ繝繝ｫ繧帝幕縺・
 * @param {string} side - "player" | "opponent"
 */
function openTrashViewer(side) {
    openCardPileViewer(side, "trash");
}

/**
 * 髯､螟悶だ繝ｼ繝ｳ髢ｲ隕ｧ繝｢繝ｼ繝繝ｫ繧帝幕縺・
 * 髯､螟悶＆繧後◆繧ｫ繝ｼ繝峨・繧ｲ繝ｼ繝荳ｭ縺ｫ蠕ｩ蟶ｰ縺励↑縺・′縲∽ｽ輔ｒ蛻・▲縺溘°縺ｯ遒ｺ隱阪〒縺阪ｋ繧医≧縺ｫ縺吶ｋ
 */
function openBanishViewer(side) {
    openCardPileViewer(side, "banish");
}

/**
 * 繧ｫ繝ｼ繝峨・螻ｱ・医ヨ繝ｩ繝・す繝･・城勁螟厄ｼ峨ｒ荳隕ｧ陦ｨ遉ｺ縺吶ｋ
 * @param {string} side - "player" | "opponent"
 * @param {string} pileType - "trash" | "banish"
 */
function openCardPileViewer(side, pileType) {
    // 驕ｸ謚槭Δ繝ｼ繝我ｸｭ・亥小蝟壹さ繧ｹ繝医・蜿ｬ蝟壼・繝ｻ謾ｻ謦・ｯｾ雎｡繝ｻ蜉ｹ譫懷ｯｾ雎｡縺ｪ縺ｩ・峨・髢九°縺ｪ縺・・
    // 繧ｾ繝ｼ繝ｳ縺ｮonclick縺ｯ驕ｸ謚槭Δ繝ｼ繝峨・迥ｶ諷九↓髢｢繧上ｉ縺壼ｸｸ縺ｫ逕溘″縺ｦ縺・ｋ縺溘ａ縲√％縺薙〒
    // 繧ｬ繝ｼ繝峨＠縺ｪ縺・→驕ｸ謚樊桃菴應ｸｭ縺ｮ隱､繧ｿ繝・・縺ｧ繝医Λ繝・す繝･/髯､螟悶ン繝･繝ｼ繧｢縺悟牡繧願ｾｼ繧縲・
    if (GAME_STATE.isSelectingSlot || GAME_STATE.isSelectingTarget || GAME_STATE.isSelectingCost) return;

    const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
    const pile = (pileType === "trash") ? p.trash : p.banished;
    if (pile.length === 0) return;

    const modal = document.getElementById('trash-viewer-modal');
    const title = document.getElementById('trash-viewer-title');
    const list = document.getElementById('trash-card-list');

    const owner = (side === "player") ? "閾ｪ蛻・ : "逶ｸ謇・;
    const label = (pileType === "trash") ? "繝医Λ繝・す繝･" : "髯､螟悶だ繝ｼ繝ｳ";
    title.innerText = `${owner}縺ｮ${label} (${pile.length}譫・`;
    list.innerHTML = "";

    // 隧ｳ邏ｰ繝代ロ繝ｫ縺ｧ繝舌ヵ霎ｼ縺ｿ縺ｮ謨ｰ蛟､繧貞・縺輔↑縺・ｈ縺・∫ｴ縺ｮ諠・ｱ縺ｨ縺励※陦ｨ遉ｺ縺吶ｋ
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
 * 繝医Λ繝・す繝･髢ｲ隕ｧ繝｢繝ｼ繝繝ｫ繧帝哩縺倥ｋ
 */
function closeTrashViewer() {
    const modal = document.getElementById('trash-viewer-modal');
    if (modal) modal.style.display = "none";
}

/**
 * 繝｢繝ｼ繝繝ｫ繧剃ｽｿ逕ｨ縺励※謇区惆縺九ｉ繧ｫ繝ｼ繝峨ｒ驕ｸ謚槭＆縺帙ｋ
 * @param {number} count - 驕ｸ謚槭′蠢・ｦ√↑譫壽焚
 */
async function selectHandCardsUI(count) {
    if (GAME_STATE.isOnlineMatch && GAME_STATE.turnPlayer !== "player") {
        return NetworkManager.waitFor('HAND_CARDS_SELECTED').then(action => action.payload.result);
    }
    return new Promise((resolve) => {
        const modal = document.getElementById('selection-modal');
        const list = document.getElementById('selection-card-list');
        const btn = document.getElementById('selection-confirm-btn');
        const countBadge = document.getElementById('selection-needed-count');
        const selectedIndices = [];

        list.innerHTML = "";
        modal.style.display = "flex";
        countBadge.innerText = count;

        // 謇区惆繧偵け繝ｭ繝ｼ繝ｳ縺励※繝｢繝ｼ繝繝ｫ縺ｫ陦ｨ遉ｺ
        GAME_STATE.player.hand.forEach((card, idx) => {
            const el = createCardElement(card, "selection-preview");
            el.onclick = () => {
                // 隧ｳ邏ｰ繝代ロ繝ｫ繧呈峩譁ｰ
                updateInfoPanel(card, "selection-preview");

                const sIdx = selectedIndices.indexOf(idx);
                if (sIdx > -1) {
                    selectedIndices.splice(sIdx, 1);
                    el.classList.remove('selected');
                } else if (selectedIndices.length < count) {
                    selectedIndices.push(idx);
                    el.classList.add('selected');
                }

                // 繝懊ち繝ｳ迥ｶ諷九・譖ｴ譁ｰ
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
                if (GAME_STATE.isOnlineMatch) NetworkManager.sendAction('HAND_CARDS_SELECTED', { result: selectedIndices });
                resolve(selectedIndices);
            }
        };
    });
}

/**
 * 繧ｨ繝ｳ繝峨ヵ繧ｧ繧､繧ｺ縺ｮ髢句ｧ句・逅・ｼ域焔譛ｭ蛻ｶ髯舌メ繧ｧ繝・け・・
 */
async function startEndPhaseProcess() {
    if (GAME_STATE.isGameOver) return;
    console.log(`End Phase started for ${GAME_STATE.turnPlayer}`);

    if (!GAME_STATE.isOnlineMatch && GAME_STATE.turnPlayer !== "player") {
        if (typeof handleCpuEndPhase === "function") {
            handleCpuEndPhase();
        } else {
            endTurn();
        }
        return;
    }

    const currentP = GAME_STATE.turnPlayer;
    const pObj = GAME_STATE[currentP];
    if (pObj.hand.length > 10) {
        const discardCount = pObj.hand.length - 10;
        const targetIndices = await selectHandCardsUI(discardCount);
        const discarded = targetIndices.sort((a, b) => b - a).map(idx => pObj.hand.splice(idx, 1)[0]);
        for (const card of discarded) {
            sendCardToTrash(currentP, card);
            await EffectLogic.notifyCardSentToTrash(card, currentP);
        }
        updateUI();
    }
    setTimeout(endTurn, 500);
}

/**
 * 豎守畑遒ｺ隱阪Δ繝ｼ繝繝ｫ繧定｡ｨ遉ｺ (Promise繝吶・繧ｹ)
 * @param {string} message - 陦ｨ遉ｺ縺吶ｋ繝｡繝・そ繝ｼ繧ｸ
 * @returns {Promise<boolean>} - 縺ｯ縺・ true, 縺・＞縺・ false
 */
window.showCustomConfirm = function (message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('common-confirm-modal');
        const msgEl = document.getElementById('common-confirm-message');
        const btnOk = document.getElementById('common-confirm-ok');
        const btnCancel = document.getElementById('common-confirm-cancel');

        if (!modal || !msgEl || !btnOk || !btnCancel) {
            console.error("Confirm modal elements missing.");
            // 繧ｨ繝ｩ繝ｼ譎ゅ・螳牙・蛛ｴ縺ｫ蛟偵＠縺ｦfalse縲√∪縺溘・邱頑･逕ｨalert繧貞・縺吶↑縺ｩ讀懆ｨ・
            resolve(false);
            return;
        }

        msgEl.innerText = message;
        modal.style.display = 'flex';

        // 繝上Φ繝峨Λ螳夂ｾｩ (荳蠎ｦ螳溯｡後＠縺溘ｉ繧ｯ繝ｪ繝ｼ繝ｳ繧｢繝・・)
        const cleanup = (result) => {
            modal.style.display = 'none';
            resolve(result);
        };

        // { once: true } 縺ｧ閾ｪ蜍慕噪縺ｫ繝ｪ繧ｹ繝翫・隗｣髯､縺輔ｌ繧九′縲・
        // 繧ｭ繝｣繝ｳ繧ｻ繝ｫ譎ゅ↓OK繝懊ち繝ｳ縺ｮ繝ｪ繧ｹ繝翫・縺梧ｮ九ｋ(騾・ｂ辟ｶ繧・縺ｮ繧帝亟縺舌◆繧√・
        // 繧ｯ繝ｭ繝ｼ繝ｳ隕∫ｴ縺ｸ縺ｮ鄂ｮ謠帙〒繝ｪ繧ｹ繝翫・繧剃ｸ謗・☆繧九・縺梧怙繧ょｮ牙・縺九▽謇玖ｻｽ
        const newBtnOk = btnOk.cloneNode(true);
        const newBtnCancel = btnCancel.cloneNode(true);

        btnOk.parentNode.replaceChild(newBtnOk, btnOk);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

        newBtnOk.addEventListener('click', () => cleanup(true));
        newBtnCancel.addEventListener('click', () => cleanup(false));
    });
};

// 繧ｰ繝ｭ繝ｼ繝舌Ν繧ｯ繝ｪ繝・け繝上Φ繝峨Λ縺ｮ逋ｻ骭ｲ (蛻晄悄蛹匁凾)
setTimeout(() => {
    document.addEventListener('click', handleGlobalInteract);
    console.log("Global Interaction Handler Attached.");
}, 100);

window.openImageViewer = function(htmlContent) {
    const modal = document.getElementById('image-viewer-modal');
    const container = document.getElementById('image-viewer-container');
    if(modal && container) {
        container.innerHTML = htmlContent;
        const svg = container.querySelector('svg');
        if (svg) {
            svg.style.width = '100%';
            svg.style.height = '100%';
        }
        modal.style.display = 'flex';
    }
}
window.closeImageViewer = function() {
    const modal = document.getElementById('image-viewer-modal');
    if(modal) {
        modal.style.display = 'none';
    }
}

 
 / *   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =   * / 
 
 / *   O N L I N E   M A T C H   R E M O T E   A C T I O N   H A N D L E R   * / 
 
 / *   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =   * / 
 
 


// ==================================
// ONLINE MATCH REMOTE ACTION HANDLER
// ==================================
window.executeRemoteAction = async function(action) {
    console.log("Executing remote action:", action);
    const payload = action.payload;
    const opp = GAME_STATE.opponent;

    // ヘルパー: 相手視点の executeMagicAction (finishMagicSlotSelectionと同等のロジック)
    const execRemoteMagic = async (handIdx, slotIdx, isSet) => {
        const card = opp.hand[handIdx];
        if (!card) return;
        opp.hand.splice(handIdx, 1);
        if (isSet) {
            card._isSet = true;
            card._setTurnSerial = GAME_STATE.turnSerial;
            opp.field.magics[slotIdx] = card;
            renderFieldCard("opponent", "magic", slotIdx, card);
            updateUI();
        } else {
            opp.field.magics[slotIdx] = card;
            renderFieldCard("opponent", "magic", slotIdx, card);
            await EffectLogic.resolveEffects(card, "opponent", "on_activate");
            if (card.subType === 'normal') {
                setTimeout(() => {
                    if (opp.field.magics[slotIdx] !== card) return;
                    opp.field.magics[slotIdx] = null;
                    renderFieldCard("opponent", "magic", slotIdx, null);
                    sendCardToTrash("opponent", card);
                    updateUI();
                }, 500);
            }
        }
    };

    switch (action.type) {
        case 'SUMMON': {
            const card = opp.hand[payload.handIdx];
            const costs = payload.costData.map(c => {
                if (c.from === 'hand') return { from: 'hand', card: opp.hand[c.idx], handIdx: c.idx };
                else return { from: 'field', card: opp.field.monsters[c.idx], slotIdx: c.idx };
            });
            await executeSummon("opponent", card, payload.slotIdx, costs);
            break;
        }
        case 'MAGIC_ACTION': {
            await execRemoteMagic(payload.handIdx, payload.slotIdx, payload.isSet);
            break;
        }
        case 'ACTIVATE_SET_MAGIC': {
            const card = opp.field.magics[payload.slotIdx];
            if (card) {
                card._isSet = false;
                renderFieldCard("opponent", "magic", payload.slotIdx, card);
                await EffectLogic.resolveEffects(card, "opponent", "on_activate");
                if (card.subType === "normal") {
                    setTimeout(() => {
                        if (opp.field.magics[payload.slotIdx] !== card) return;
                        opp.field.magics[payload.slotIdx] = null;
                        renderFieldCard("opponent", "magic", payload.slotIdx, null);
                        sendCardToTrash("opponent", card);
                        updateUI();
                    }, 500);
                } else {
                    updateUI();
                }
            }
            break;
        }
        case 'ATTACK': {
            const attacker = opp.field.monsters[payload.atkIdx];
            const defender = payload.defIdx === -1 ? null : GAME_STATE.player.field.monsters[payload.defIdx];
            await resolveBattle(attacker, defender, payload.atkIdx, payload.defIdx);
            break;
        }
        case 'IGNITION': {
            const card = opp.field.monsters[payload.slotIdx];
            if (card) {
                await EffectLogic.resolveEffects(card, "opponent", "ignition");
            }
            break;
        }
        case 'ADVANCE_PHASE': {
            advancePhase();
            break;
        }
    }
    updateUI();
};
