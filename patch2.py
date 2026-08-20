import sys

def patch_endphase(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to replace the body of startEndPhaseProcess
    import re
    # Match the function body
    pattern = r"async function startEndPhaseProcess\(\) \{[\s\S]*?\}\n\n/\*\*"
    
    new_body = """async function startEndPhaseProcess() {
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

/**"""
    
    content = re.sub(pattern, new_body, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched end phase!")

if __name__ == '__main__':
    patch_endphase('main.js')
