/**
 * LinkaVel Card Game - CPU Logic (Step 1: Prototype)
 * 役割: フェイズごとの基本行動の自動実行
 */

const CpuLogic = {
    // 思考の間（ミリ秒）
    delay: (ms) => new Promise(res => setTimeout(res, ms)),

    /**
     * main.jsからフェイズごとに呼び出されるエントリーポイント
     */
    async execute() {
        if (GAME_STATE.turnPlayer !== "opponent") return;

        console.log(`CPU Thinking... Phase: ${GAME_STATE.phase}`);

        switch (GAME_STATE.phase) {
            case "MAIN1":
            case "MAIN2":
                await this.executeMainPhase();
                break;
            case "BATTLE":
                await this.executeBattlePhase();
                break;
            default:
                // DRAWやENDは自動進行を待つ
                break;
        }
    },

    /**
     * メインフェイズの行動ロジック
     */
    async executeMainPhase() {
        await this.delay(1000);

        // 1. モンスターの召喚 (1ターン1回制限)
        if (!GAME_STATE.hasNormalSummoned) {
            await this.tryCpuSummon();
        }

        await this.delay(800);

        // 2. 魔術の発動 (空き枠がある限りランダムに試行)
        await this.tryCpuMagic();

        await this.delay(1000);

        // プレイヤーに状況を見せてから次へ
        if (GAME_STATE.turnPlayer === "opponent") {
            advancePhase();
        }
    },

    /** CPUの召喚試行 */
    async tryCpuSummon() {
        const hand = GAME_STATE.opponent.hand;
        const monsters = hand.filter(c => c.type === "monster");

        for (const card of monsters) {
            const req = card.summonRequirement;
            const costCount = req.costCount || 0;
            const field = GAME_STATE.opponent.field.monsters;

            // 空きスロットの確認
            const emptySlots = field.map((m, i) => m === null ? i : null).filter(i => i !== null);

            // Lv1なら空き枠があれば即召喚
            if (costCount === 0 && emptySlots.length > 0) {
                await executeSummon("opponent", card, emptySlots[0]);
                break;
            }

            // Lv2以上：コストが足りるか確認
            const candidates = field.map((m, i) => ({m, i})).filter(obj => obj.m !== null);
            if (costCount > 0 && candidates.length >= costCount) {
                // 最も左側のコストを優先的に選ぶ（簡易ロジック）
                const costs = candidates.slice(0, costCount).map(c => c.i);
                // 召喚先はコストで空いた場所にする
                await executeSummon("opponent", card, costs[0], costs);
                break;
            }
        }
    },

    /** CPUの魔術発動 */
    async tryCpuMagic() {
        const hand = GAME_STATE.opponent.hand;
        const magics = hand.filter(c => c.type === "magic");
        const field = GAME_STATE.opponent.field.magics;

        for (const card of magics) {
            const emptySlot = field.indexOf(null);
            if (emptySlot !== -1 && EffectLogic.isEffectActivatable(card, "opponent", "on_activate")) {
                // CPU魔術発動 (現在は簡易的にMAIN1/2で即解決)
                GAME_STATE.opponent.field.magics[emptySlot] = card;
                const hIdx = GAME_STATE.opponent.hand.findIndex(c => c.id === card.id);
                GAME_STATE.opponent.hand.splice(hIdx, 1);

                updateUI();
                await this.delay(800);
                await EffectLogic.resolveEffects(card, "opponent", "on_activate");

                if (card.subType === "normal") {
                    GAME_STATE.opponent.field.magics[emptySlot] = null;
                    GAME_STATE.opponent.trash.push(card);
                }
                updateUI();
                await this.delay(500);
            }
        }
    },

    /**
     * バトルフェイズの行動ロジック
     */
    async executeBattlePhase() {
        const field = GAME_STATE.opponent.field.monsters;

        for (let i = 0; i < field.length; i++) {
            const attacker = field[i];
            if (attacker && !attacker._hasAttacked) {
                await this.delay(1000);

                // ターゲット選定
                const targets = GAME_STATE.player.field.monsters
                    .map((m, idx) => ({m, idx}))
                    .filter(obj => obj.m !== null);

                if (targets.length === 0) {
                    // ダイレクトアタック
                    await resolveBattle(attacker, null, i, -1);
                } else {
                    // とりあえず一番左のモンスターを狙う
                    await resolveBattle(attacker, targets[0].m, i, targets[0].idx);
                }
                updateUI();
            }
        }

        await this.delay(1000);
        if (GAME_STATE.turnPlayer === "opponent") {
            advancePhase();
        }
    }
};

/**
 * main.jsのエンドフェイズから呼ばれる処理
 */
async function handleCpuEndPhase() {
    const hand = GAME_STATE.opponent.hand;
    if (hand.length > 10) {
        const discardCount = hand.length - 10;
        // CPUは古いカード（先頭）から機械的に捨てる
        for (let i = 0; i < discardCount; i++) {
            const card = hand.shift();
            GAME_STATE.opponent.trash.push(card);
        }
        console.log(`CPU discarded ${discardCount} cards.`);
    }
    await new Promise(r => setTimeout(r, 1000));
    endTurn();
}
