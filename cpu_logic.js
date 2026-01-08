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

        // 1. 起動効果の使用 (追加)
        await this.tryCpuIgnition();

        // 2. モンスターの召喚 (レベルの高い順に優先順位付け)
        if (!GAME_STATE.hasNormalSummoned) {
            await this.tryCpuSummon();
        }

        await this.delay(800);

        // 3. 魔術の発動 (発動条件を厳密にチェック)
        await this.tryCpuMagic();

        await this.delay(1000);

        if (GAME_STATE.turnPlayer === "opponent") {
            advancePhase();
        }
    },

    /** CPUの召喚試行 */
    async tryCpuSummon() {
        const hand = GAME_STATE.opponent.hand;
        // レベルの高い順、同レベルならパワーの高い順にソート
        const monsters = hand.filter(c => c.type === "monster")
                            .sort((a, b) => (b.level - a.level) || (b.power - a.power));

        for (const card of monsters) {
            const req = card.summonRequirement;
            const costCount = req.costCount || 0;
            const field = GAME_STATE.opponent.field.monsters;
            const emptySlots = field.map((m, i) => m === null ? i : null).filter(i => i !== null);

            if (costCount === 0) {
                if (emptySlots.length > 0) {
                    await executeSummon("opponent", card, emptySlots[0]);
                    break;
                }
                continue;
            }

            // コスト候補の選定：バフがない、かつパワーが低い順
            const candidates = field.map((m, i) => ({
                m, i,
                pwr: m ? EffectLogic.getCurrentPower(m, "opponent", i) : 0,
                hasBuff: m && ((m._tempBuffs && m._tempBuffs.length > 0) || (m.logic && m.logic.some(l => l.trigger === "always")))
            })).filter(obj => obj.m !== null);

            candidates.sort((a, b) => (a.hasBuff - b.hasBuff) || (a.pwr - b.pwr));

            if (candidates.length >= costCount) {
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
        // 発動優先度: 1.墓地肥やし(s013, s018) 2.除去(s014) 3.蘇生(s015, s012)
        const priority = {"s013": 10, "s018": 9, "s014": 5, "s015": 1, "s012": 1};
        const magics = hand.filter(c => c.type === "magic")
                           .sort((a, b) => (priority[b.id] || 0) - (priority[a.id] || 0));

        for (const card of magics) {
            const field = GAME_STATE.opponent.field.magics;
            const emptySlot = field.indexOf(null);
            if (emptySlot === -1) break;

            // 戦略的発動判定
            let shouldActivate = EffectLogic.isEffectActivatable(card, "opponent", "on_activate");

            // コンボ・状況判断ロジック
            if (shouldActivate) {
                // 1. 蘇生札(s015等)は、トラッシュに「召喚時効果」を持つLv2がいれば優先、いなければ温存
                if (card.id === "s015" || card.id === "s012") {
                    const highValue = GAME_STATE.opponent.trash.some(c => c.type === "monster" && c.level === 2 && c.subType === "effect");
                    if (!highValue) shouldActivate = false;
                }
                // 2. デバフ魔術(s017等)は、相手に勝てないモンスターがいる時のみ使う
                const debuffAction = card.logic.find(l => l.type === "buff" && l.value < 0);
                if (debuffAction) {
                    const canFlipTable = GAME_STATE.opponent.field.monsters.some((m, i) => {
                        if (!m) return false;
                        const myPwr = EffectLogic.getCurrentPower(m, "opponent", i);
                        // 相手の各モンスターに対して、デバフ込みで勝てるようになるか判定
                        return GAME_STATE.player.field.monsters.some((oppM, oppI) => {
                            if (!oppM) return false;
                            const oppPwr = EffectLogic.getCurrentPower(oppM, "player", oppI);
                            return myPwr <= oppPwr && myPwr > (oppPwr + debuffAction.value);
                        });
                    });
                    if (!canFlipTable) shouldActivate = false;
                }
            }

            if (shouldActivate) {
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

    /** CPUの起動効果発動 (新規) */
    async tryCpuIgnition() {
        const field = GAME_STATE.opponent.field.monsters;
        for (let i = 0; i < field.length; i++) {
            const card = field[i];
            if (!card || !card.logic) continue;

            const ignitionLogic = card.logic.filter(l => l.trigger === "ignition");
            if (ignitionLogic.length === 0) continue;

            const hasLimit = ignitionLogic.some(l => l.countLimit === "once_per_turn");
            const isUsed = hasLimit && card._usedTurn === GAME_STATE.turnCount;

            if (!isUsed && EffectLogic.isEffectActivatable(card, "opponent", "ignition")) {
                console.log(`CPU Activating Ignition: ${card.name}`);
                if (hasLimit) card._usedTurn = GAME_STATE.turnCount;
                await EffectLogic.resolveEffects(card, "opponent", "ignition");
                await this.delay(800);
                updateUI();
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
            if (!attacker || attacker._hasAttacked) continue;

            const atkPower = EffectLogic.getCurrentPower(attacker, "opponent", i);
            const targets = GAME_STATE.player.field.monsters
                .map((m, idx) => ({
                    m, idx,
                    pwr: m ? EffectLogic.getCurrentPower(m, "player", idx) : 0,
                    isEffect: m && m.subType === "effect"
                }))
                .filter(obj => obj.m !== null);

            await this.delay(800);

            if (targets.length === 0) {
                // ダイレクトアタック
                await resolveBattle(attacker, null, i, -1);
            } else {
                // リーサルチェック: 攻撃可能な全パワーの合計が相手LP以上か？
                const totalPotential = field.filter(m => m && !m._hasAttacked)
                                          .reduce((sum, m, idx) => sum + EffectLogic.getCurrentPower(m, "opponent", idx), 0);

                // ターゲット優先順位: 1.倒せる敵(効果持ち優先) 2.相打ち(高パワー敵優先)
                const killable = targets.filter(t => atkPower > t.pwr)
                                       .sort((a, b) => (b.isEffect - a.isEffect) || (b.pwr - a.pwr));
                const equal = targets.filter(t => atkPower === t.pwr).sort((a, b) => b.pwr - a.pwr);

                if (totalPotential >= GAME_STATE.player.lp && killable.length === 0) {
                    // 邪魔なモンスターがいなければリーサルだが、守備がいる場合は排除優先
                    // ここでは最も弱い敵を排除して道を空ける思考
                    const weakest = targets.sort((a, b) => a.pwr - b.pwr)[0];
                    await resolveBattle(attacker, weakest.m, i, weakest.idx);
                } else if (killable.length > 0) {
                    await resolveBattle(attacker, killable[0].m, i, killable[0].idx);
                } else if (equal.length > 0 && (attacker.logic?.some(l => l.trigger === "on_sent_to_trash") || equal[0].pwr >= 1000)) {
                    await resolveBattle(attacker, equal[0].m, i, equal[0].idx);
                } else if (targets.length > 0 && totalPotential >= GAME_STATE.player.lp) {
                    // リーサル圏内の時は多少の損害を覚悟してでも攻撃
                    await resolveBattle(attacker, targets[0].m, i, targets[0].idx);
                } else {
                    console.log(`CPU: ${attacker.name} stays on defense.`);
                }
            }
            updateUI();
        }

        await this.delay(1000);
        if (GAME_STATE.turnPlayer === "opponent") advancePhase();
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
