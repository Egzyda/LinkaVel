/**
 * LinkaVel - Matchmaking UI
 */

function openRoomMatchMenu() {
    showScreen('room-match-screen');
    document.getElementById('room-menu-content').style.display = 'block';
    document.getElementById('room-waiting-content').style.display = 'none';
}

function leaveRoomMenu() {
    NetworkManager.leaveRoom();
    showScreen('menu-screen');
}

async function createRoom() {
    if (!window.db || !window.auth) {
        alert("Firebaseが初期化されていません");
        return;
    }
    
    document.getElementById('room-menu-content').style.display = 'none';
    document.getElementById('room-waiting-content').style.display = 'block';
    document.getElementById('display-room-id').innerText = "生成中...";

    const roomId = await NetworkManager.createRoom();
    if (roomId) {
        document.getElementById('display-room-id').innerText = roomId;
    } else {
        alert("ルーム作成に失敗しました");
        leaveRoomMenu();
    }
}

async function joinRoom() {
    const roomId = document.getElementById('join-room-id').value.trim();
    if (!roomId) return;
    
    if (!window.db || !window.auth) {
        alert("Firebaseが初期化されていません");
        return;
    }

    const success = await NetworkManager.joinRoom(roomId);
    if (!success) {
        alert("ルームが見つからないか、既に満室です");
    }
}

// NetworkManagerからのコールバック: マッチング成立
async function onRoomMatched(roomData) {
    // デッキ選択画面へ遷移（自分が選ぶだけ）
    _pendingPlayerDeck = null;
    showScreen('deck-select-screen');
    renderDeckSelection("player");
}

// 既存の main.js の deck 確定フローを上書き/拡張する関数を定義
// confirmDeckSelection は main.js にある。

window._originalConfirmDeckSelection = confirmDeckSelection;
window.confirmDeckSelection = async function(deckId, type, oppDeckId, oppType) {
    if (NetworkManager.roomId) {
        if (type === "player") {
            // ローカルプレイヤーのデッキを取得してFirestoreへ送信
            let deckArray = [];
            if (deckId === "random") {
                const starterKeys = Object.keys(DECK_RECIPES).filter(k => DECK_RECIPES[k].type === "starter");
                const randomKey = starterKeys[Math.floor(Math.random() * starterKeys.length)];
                deckArray = DECK_RECIPES[randomKey].cards;
            } else {
                deckArray = DECK_RECIPES[deckId]?.cards; // またはカスタムデッキ
                if (!deckArray && deckId.startsWith("custom_")) {
                    // カスタムデッキの取得
                    const customDecks = await loadCustomDecks();
                    const d = customDecks.find(c => c.id === deckId);
                    if (d) deckArray = d.cards;
                }
            }
            if (!deckArray) {
                alert("デッキが見つかりません");
                return;
            }
            
            // 待機画面を表示
            showScreen('room-match-screen');
            document.getElementById('room-menu-content').style.display = 'none';
            document.getElementById('room-waiting-content').style.display = 'block';
            document.getElementById('display-room-id').innerText = NetworkManager.roomId;
            document.querySelector('#room-waiting-content p').innerText = "相手のデッキ選択を待っています...";
            
            await NetworkManager.submitDeckReady(deckArray);
        }
    } else {
        // オフラインソロモードの場合はオリジナルを呼ぶ
        return _originalConfirmDeckSelection(deckId, type, oppDeckId, oppType);
    }
};

// NetworkManagerからのコールバック: 両者デッキ準備完了 -> ゲーム開始
async function startOnlineMatch(roomData) {
    const seed = roomData.seed;
    window.setGameSeed(seed);
    
    const hostDeck = roomData.host.deck;
    const guestDeck = roomData.guest.deck;
    
    // 自分がホストなら player=host, opponent=guest
    const myDeck = NetworkManager.isHost ? hostDeck : guestDeck;
    const oppDeck = NetworkManager.isHost ? guestDeck : hostDeck;

    resetGameState();
    GAME_STATE.isOnlineMatch = true;

    GAME_STATE.player.deck = shuffleArray(myDeck.map(id => getCardData(id)).filter(c => c !== null));
    GAME_STATE.opponent.deck = shuffleArray(oppDeck.map(id => getCardData(id)).filter(c => c !== null));

    // 先攻・後攻はシードによる GameRandom で決定
    const isHostFirst = GameRandom() < 0.5;
    
    // player = ローカル, opponent = リモート
    if (NetworkManager.isHost) {
        GAME_STATE.turnPlayer = isHostFirst ? "player" : "opponent";
    } else {
        GAME_STATE.turnPlayer = isHostFirst ? "opponent" : "player";
    }

    showScreen('game-screen');
    updateUI();
    startGameSequence();
}
