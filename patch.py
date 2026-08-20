import sys

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. executeSummon
    content = content.replace(
        "async function executeSummon(side, cardData, slotIndex, costs = []) {\n    const p = (side === \"player\") ? GAME_STATE.player : GAME_STATE.opponent;",
        "async function executeSummon(side, cardData, slotIndex, costs = []) {\n    if (GAME_STATE.isOnlineMatch && side === 'player' && !window._isProcessingRootAction) {\n        const handIdx = GAME_STATE.player.hand.indexOf(cardData);\n        const costData = costs.map(c => ({ from: c.from, idx: c.from === 'hand' ? GAME_STATE.player.hand.indexOf(c.card) : c.slotIdx }));\n        NetworkManager.sendAction('SUMMON', { handIdx, slotIdx: slotIndex, costData });\n    }\n    const p = (side === \"player\") ? GAME_STATE.player : GAME_STATE.opponent;"
    )

    # 2. finishMagicSlotSelection
    content = content.replace(
        "async function finishMagicSlotSelection(slotIdx) {\n    if (!GAME_STATE.pendingCard) return;\n    const cardData = GAME_STATE.pendingCard;",
        "async function finishMagicSlotSelection(slotIdx) {\n    if (!GAME_STATE.pendingCard) return;\n    const cardData = GAME_STATE.pendingCard;\n    if (GAME_STATE.isOnlineMatch && !window._isProcessingRootAction) {\n        const handIdx = GAME_STATE.player.hand.indexOf(cardData);\n        NetworkManager.sendAction('MAGIC_ACTION', { handIdx, slotIdx, isSet: GAME_STATE.pendingSetMode });\n    }"
    )

    # 3. activateSetMagic
    content = content.replace(
        "async function activateSetMagic(slotIdx) {\n    const p = GAME_STATE.player;",
        "async function activateSetMagic(slotIdx) {\n    if (GAME_STATE.isOnlineMatch && !window._isProcessingRootAction) NetworkManager.sendAction('ACTIVATE_SET_MAGIC', { slotIdx });\n    const p = GAME_STATE.player;"
    )

    # 4. resolveBattle
    content = content.replace(
        "async function resolveBattle(attacker, defender, atkIdx, defIdx) {\n    if (GAME_STATE.isGameOver) return;",
        "async function resolveBattle(attacker, defender, atkIdx, defIdx) {\n    if (GAME_STATE.isGameOver) return;\n    if (GAME_STATE.isOnlineMatch && GAME_STATE.turnPlayer === 'player' && !window._isProcessingRootAction) {\n        NetworkManager.sendAction('ATTACK', { atkIdx, defIdx });\n    }"
    )

    # 5. advancePhase
    content = content.replace(
        "function advancePhase() {\n    if (GAME_STATE.isGameOver) return;",
        "function advancePhase() {\n    if (GAME_STATE.isGameOver) return;\n    if (GAME_STATE.isOnlineMatch && GAME_STATE.turnPlayer === 'player' && !window._isProcessingRootAction) { NetworkManager.sendAction('ADVANCE_PHASE', {}); }\n"
    )

    # 6. surrender (in window.showCustomConfirm maybe? Let's check if surrender exists, if not, skip)

    # 7. Ignition effect execution
    content = content.replace(
        "await EffectLogic.resolveEffects(cardData, \"player\", \"ignition\");",
        "if (GAME_STATE.isOnlineMatch && !window._isProcessingRootAction) { NetworkManager.sendAction('IGNITION', { slotIdx: effectiveIdx }); }\n            await EffectLogic.resolveEffects(cardData, \"player\", \"ignition\");"
    )

    # 8. selectTargetUI network integration
    content = content.replace(
        "// 相手ターン（CPU）または非ターンプレイヤーが選択する場合はランダム\n    if (GAME_STATE.turnPlayer !== \"player\") {\n        return candidates[Math.floor(GameRandom() * candidates.length)];\n    }",
        "// 相手ターン（CPU）または非ターンプレイヤーが選択する場合はランダム\n    if (GAME_STATE.turnPlayer !== \"player\") {\n        if (GAME_STATE.isOnlineMatch) {\n            return NetworkManager.waitFor('TARGET_SELECTED').then(action => action.payload.result);\n        }\n        return candidates[Math.floor(GameRandom() * candidates.length)];\n    }"
    )
    content = content.replace(
        "const selectHandler = (e) => {\n                e.stopPropagation();\n                cleanup(i);\n            };",
        "const selectHandler = (e) => {\n                e.stopPropagation();\n                if (GAME_STATE.isOnlineMatch) NetworkManager.sendAction('TARGET_SELECTED', { result: i });\n                cleanup(i);\n            };"
    )

    # 9. selectHandCardsUI network integration
    content = content.replace(
        "async function selectHandCardsUI(count) {\n    return new Promise((resolve) => {",
        "async function selectHandCardsUI(count) {\n    if (GAME_STATE.isOnlineMatch && GAME_STATE.turnPlayer !== \"player\") {\n        return NetworkManager.waitFor('HAND_CARDS_SELECTED').then(action => action.payload.result);\n    }\n    return new Promise((resolve) => {"
    )
    content = content.replace(
        "btn.onclick = () => {\n            modal.style.display = \"none\";\n            resolve(selectedIndices);",
        "btn.onclick = () => {\n            modal.style.display = \"none\";\n            if (GAME_STATE.isOnlineMatch) NetworkManager.sendAction('HAND_CARDS_SELECTED', { result: selectedIndices });\n            resolve(selectedIndices);"
    )


    # APPEND remote executor
    remote_code = """

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
"""
    if "ONLINE MATCH REMOTE ACTION HANDLER" not in content:
        content += remote_code

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patch successful!")

if __name__ == '__main__':
    patch_file('main.js')
