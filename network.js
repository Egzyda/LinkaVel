/**
 * LinkaVel - Network Logic for Room Match
 */

const NetworkManager = {
    roomId: null,
    isHost: false,
    myUid: null,
    unsubscribeRoom: null,
    unsubscribeActions: null,
    
    // アクションキューと待機プロミス
    actionQueue: [],
    pendingResolvers: [], 
    processedActionIds: new Set(),

    init() {
        if (!window.auth) return;
        window.auth.onAuthStateChanged(user => {
            if (user) {
                this.myUid = user.uid;
            } else {
                window.auth.signInAnonymously().catch(err => console.error("Auth error", err));
            }
        });
    },

    generateRoomId() {
        return Math.floor(10000 + Math.random() * 90000).toString(); // 5桁の数字
    },

    async createRoom() {
        if (!this.myUid || !window.db) return null;
        
        const roomId = this.generateRoomId();
        const roomRef = window.db.collection('rooms').doc(roomId);
        
        this.roomId = roomId;
          this.isHost = true;
          roomRef.set({
            status: 'waiting',
            host: { uid: this.myUid, ready: false, deck: null },
            guest: null,
            seed: Math.floor(Math.random() * 2147483647),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        this.roomId = roomId;
        this.isHost = true;
        this.listenRoomStatus(roomId);
        return roomId;
    },

    async joinRoom(roomId) {
        if (!this.myUid || !window.db) return false;
        
        const roomRef = window.db.collection('rooms').doc(roomId);
        const snap = await roomRef.get();
        
        if (!snap.exists) return false;
        
        const data = snap.data();
        if (data.status !== 'waiting' || data.guest !== null) return false;

        this.roomId = roomId;
          this.isHost = false;
          roomRef.update({
            guest: { uid: this.myUid, ready: false, deck: null },
            status: 'selecting_deck'
        });

        this.roomId = roomId;
        this.isHost = false;
        this.listenRoomStatus(roomId);
        return true;
    },

    async leaveRoom() {
        if (this.unsubscribeRoom) this.unsubscribeRoom();
        if (this.unsubscribeActions) this.unsubscribeActions();
        
        if (this.roomId && this.isHost) {
            window.db.collection('rooms').doc(this.roomId).update({ status: 'finished' }).catch(()=>{});
        }
        
        this.roomId = null;
        this.isHost = false;
        this.actionQueue = [];
        this.pendingResolvers = [];
        this.processedActionIds.clear();
        if (typeof GAME_STATE !== 'undefined') GAME_STATE.isOnlineMatch = false;
    },

    listenRoomStatus(roomId) {
        if (this.unsubscribeRoom) this.unsubscribeRoom();
        const roomRef = window.db.collection('rooms').doc(roomId);
        
        this.unsubscribeRoom = roomRef.onSnapshot(snap => {
            if (!snap.exists) {
                this.handleRoomClosed();
                return;
            }
            const data = snap.data();
            
            if (data.status === 'selecting_deck' && GAME_STATE.phase === 'DRAW' && !GAME_STATE.isOnlineMatch) {
                if (typeof onRoomMatched === 'function') onRoomMatched(data);
            }
            
            if (this.isHost && data.status === 'selecting_deck' && data.host.ready && data.guest && data.guest.ready) { this.roomId = roomId;
          this.isHost = false;
          roomRef.update({ status: 'playing' }); }
            if (data.status === 'playing' && (typeof GAME_STATE !== 'undefined') && !GAME_STATE.isOnlineMatch) {
                GAME_STATE.isOnlineMatch = true;
                this.listenActions(roomId);
                if (typeof startOnlineMatch === 'function') startOnlineMatch(data);
            }
            
            if (data.status === 'finished' && GAME_STATE.isOnlineMatch) {
                this.handleRoomClosed();
            }
        });
    },

    async submitDeckReady(deckArray) {
        if (!this.roomId) return;
        const roomRef = window.db.collection('rooms').doc(this.roomId);
        
        const playerKey = this.isHost ? 'host' : 'guest';
        this.roomId = roomId;
          this.isHost = false;
          roomRef.update({
            [`${playerKey}.deck`]: deckArray,
            [`${playerKey}.ready`]: true
        });

        if (this.isHost) {
            const snap = await roomRef.get();
            const data = snap.data();
            if (data.host.ready && data.guest && data.guest.ready) {
                this.roomId = roomId;
          this.isHost = false;
          roomRef.update({ status: 'playing' });
            }
        }
    },

    handleRoomClosed() {
        alert("対戦が終了したか、通信が切断されました。");
        backToMenu();
        this.leaveRoom();
    },
    
    listenActions(roomId) {
        if (this.unsubscribeActions) this.unsubscribeActions();
        
        const actionsRef = window.db.collection('rooms').doc(roomId).collection('actions');
        this.unsubscribeActions = actionsRef.orderBy('timestamp', 'asc').onSnapshot(snap => {
            snap.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const action = change.doc.data();
                    const actionId = change.doc.id;
                    
                    if (this.processedActionIds.has(actionId)) return;
                    
                    if (action.sender === this.myUid) {
                        this.processedActionIds.add(actionId);
                        return; 
                    }

                    this.processedActionIds.add(actionId);
                    this.pushAction(action);
                }
            });
        });
    },

    async sendAction(type, payload = {}) {
        if (!this.roomId || !this.myUid) return;
        
        const actionsRef = window.db.collection('rooms').doc(this.roomId).collection('actions');
        await actionsRef.add({
            sender: this.myUid,
            type: type,
            payload: payload,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    pushAction(action) {
        for (let i = 0; i < this.pendingResolvers.length; i++) {
            const resolver = this.pendingResolvers[i];
            if (resolver.type === action.type || resolver.type === 'ANY') {
                this.pendingResolvers.splice(i, 1);
                resolver.resolve(action);
                return;
            }
        }
        this.actionQueue.push(action);
        this.dispatchRootActionIfNeeded();
    },

    async waitFor(type) {
        for (let i = 0; i < this.actionQueue.length; i++) {
            const action = this.actionQueue[i];
            if (action.type === type || type === 'ANY') {
                this.actionQueue.splice(i, 1);
                return action;
            }
        }
        
        return new Promise(resolve => {
            this.pendingResolvers.push({ type, resolve });
        });
    },
    
    async dispatchRootActionIfNeeded() {
        if (!GAME_STATE.isOnlineMatch || GAME_STATE.turnPlayer === "player") return;
        if (GAME_STATE.isAnimating || window._isProcessingRootAction) return;

        if (this.actionQueue.length > 0) {
            window._isProcessingRootAction = true;
            const action = this.actionQueue.shift();
            try {
                if (typeof executeRemoteAction === 'function') {
                    await executeRemoteAction(action);
                }
            } catch (e) {
                console.error("Error executing remote action", e);
            }
            window._isProcessingRootAction = false;
            this.dispatchRootActionIfNeeded();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    NetworkManager.init();
});
window.addEventListener('beforeunload', () => { if (NetworkManager.roomId) { window.db.collection('rooms').doc(NetworkManager.roomId).update({ status: 'finished' }).catch(()=>{}); } });
