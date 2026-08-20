import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'<div id="room-match-screen" class="screen">.*?(?=<!-- DECK SELECT SCREEN -->)'
replacement = """<div id="room-match-screen" class="screen" style="background: url('img/bg_menu.webp') no-repeat center center; background-size: cover;">
        <div class="menu-header">
            <h1 class="game-title">ROOM MATCH</h1>
            <p class="game-subtitle">オンライン対戦</p>
        </div>
        <div class="menu-options" style="max-width: 400px;">
            <div id="room-menu-content">
                <button class="menu-btn" onclick="createRoom()">
                    <span class="btn-icon">🏠</span>
                    <span class="btn-text">CREATE ROOM<br><small>ルームを新規作成する</small></span>
                </button>
                <div style="margin: 30px 0; text-align: center; color: #888; font-size: 0.9rem; letter-spacing: 2px;">OR JOIN EXISTING</div>
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <input type="text" id="join-room-id" placeholder="ROOM ID" maxlength="5" style="flex: 1; padding: 15px; font-size: 1.5rem; text-align: center; border-radius: 8px; border: 2px solid #555; background: rgba(0,0,0,0.5); color: #fff; text-transform: uppercase; letter-spacing: 5px; font-weight: bold; outline: none;">
                    <button class="menu-btn" onclick="joinRoom()" style="width: auto; padding: 0 25px; border-radius: 8px;">参加</button>
                </div>
                <button class="menu-btn" onclick="leaveRoomMenu()" style="margin-top: 20px; background: rgba(255,50,50,0.1); border-color: rgba(255,50,50,0.3);">
                    <span class="btn-icon">↩</span>
                    <span class="btn-text">BACK<br><small>メニューへ戻る</small></span>
                </button>
            </div>
            
            <div id="room-waiting-content" style="display: none; text-align: center; background: rgba(0,0,0,0.6); padding: 40px 20px; border-radius: 12px; border: 1px solid #444;">
                <div style="font-size: 1.2rem; color: #aaa; margin-bottom: 10px;">あなたのルームID</div>
                <div style="font-size: 3rem; color: #4CAF50; margin-bottom: 30px; font-weight: bold; letter-spacing: 8px; text-shadow: 0 0 10px rgba(76,175,80,0.5);"><span id="display-room-id"></span></div>
                <div class="loading-spinner" style="margin: 0 auto 30px; width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="color: #ddd; margin-bottom: 30px; font-size: 1.1rem;">対戦相手の参加を待っています...</p>
                <button class="menu-btn" onclick="leaveRoomMenu()" style="background: rgba(255,50,50,0.2); border-color: rgba(255,50,50,0.4); justify-content: center;">
                    <span class="btn-text">キャンセル</span>
                </button>
            </div>
        </div>
    </div>
    
    """

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated room-match-screen UI!")
