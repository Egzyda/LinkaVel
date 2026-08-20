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
        if (GAME_STATE.isOnlineMatch) return;
        if (GAME_STATE.turnPlayer !== "opponent" || GAME_STATE.isGameOver) return;

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
        // 何もしないフェイズ（特にMAIN2）で待たされると間延びして見えるので、
        // 実際に行動したときだけ「考えている間」を挟む。
        let acted = false;

        // 1. 起動効果の使用
        if (await this.tryCpuIgnition()) acted = true;

        // 2. モンスターの召喚 (レベルの高い順に優先順位付け)
        if (!GAME_STATE.hasNormalSummoned) {
            if (await this.tryCpuSummon()) acted = true;
        }

        if (acted) await this.delay(500);

        // 3. 魔術の発動 (発動条件を厳密にチェック)
        if (await this.tryCpuMagic()) acted = true;

        await this.delay(acted ? 600 : 150);

        if (GAME_STATE.turnPlayer === "opponent" && !GAME_STATE.isGameOver) {
            advancePhase();
        }
    },

    // 手札から除外してよいコストの上限（手札を丸ごと溶かさないための歯止め）
    MAX_HAND_COST: 2,

    /** 手札から捨てる／除外する優先度（高いほど手放してよい） */
    discardScore(card) {
        let score = 0;
        if (card.logic && card.logic.some(l => l.trigger === "on_sent_to_trash")) score += 100;
        if (card.type === "monster" && card.level >= 4) score += 50;
        if (card.type === "monster" && card.level === 1) score -= 30; // 召喚コスト用に保持
        if (card.type === "magic") score -= 20;
        return score;
    },

    /**
     * 手札から除外コストにする優先度（高いほど切ってよい）
     * トラッシュ送りと違い除外は復帰不能なので、墓地効果持ちはむしろ温存する。
     */
    banishScore(card) {
        let score = 0;
        if (card.logic && card.logic.some(l => l.trigger === "on_sent_to_trash")) score -= 80;
        if (card.subType === "normal" && card.type === "monster") score += 40; // 効果なしバニラは切りやすい
        score -= (card.power || 0) / 100;
        return score;
    },

    /**
     * カードの効果がどれくらい盤面価値になるかの目安。
     * パワーだけで比べると、除去や蘇生を持つカードを不当に低く見てしまう。
     */
    effectBonus(card) {
        if (!card.logic || card.logic.length === 0) return 0;
        let bonus = 0;
        for (const l of card.logic) {
            switch (l.type) {
                case "destroy":
                case "destroy_magic":
                case "bounce":       bonus += 400; break;
                case "damage":       bonus += 250; break;
                case "special_summon": bonus += 350; break;
                case "search":
                case "salvage":      bonus += 250; break;
                case "heal":         bonus += 120; break;
                case "global_buff":  bonus += Math.abs(l.value || 0) * 1.5; break;
                case "battle_protection":
                case "damage_reduction": bonus += 250; break;
                case "mill":         bonus += 60; break;
                default:             bonus += 50; break;
            }
            // 常時発動のオーラは場に残り続けるぶん価値が高い
            if (l.trigger === "always") bonus += 150;
        }
        return bonus;
    },

    /**
     * 場に出ているモンスター1体の価値（コストに差し出してよいかの判断に使う）。
     * 召喚時効果はすでに使い終わっているので、場に残す価値にはならない。
     * 逆にトラッシュで誘発する効果を持つカードは、コストにしたほうが得。
     */
    fieldMonsterValue(card, slotIdx) {
        if (!card) return 0;
        let value = EffectLogic.getCurrentPower(card, "opponent", slotIdx);
        for (const l of (card.logic || [])) {
            switch (l.trigger) {
                case "always":   value += 200; break; // 場に居続けることで効くオーラ
                case "ignition": value += 150; break; // 毎ターン使える
                case "on_battle_destroy": value += 80; break;
                case "on_sent_to_trash":  value -= 150; break; // 墓地に送ると誘発する＝コスト向き
                default: break;                        // on_summon等は消費済み
            }
        }
        return Math.max(0, value);
    },

    /** 手札のモンスターを召喚した場合に得られる価値 */
    summonValue(card) {
        return (card.power || 0) + this.effectBonus(card);
    },

    /**
     * 召喚コストの支払い計画を立てる
     * フィールド（トラッシュ送り＝復帰可能）を優先し、足りない分だけ手札（除外）で補う。
     * @returns {{costs:Array, slotIndex:number, lostValue:number}|null}
     */
    planSummonCosts(card, costCount, costFilter) {
        const field = GAME_STATE.opponent.field.monsters;
        const emptySlots = field.map((m, i) => (m === null ? i : null)).filter(i => i !== null);

        // フィールド候補：価値の低いモンスターから差し出す
        const fieldCandidates = field
            .map((m, i) => ({
                card: m, slotIdx: i, from: "field",
                value: m ? this.fieldMonsterValue(m, i) : 0
            }))
            .filter(obj => obj.card && matchesCostFilter(obj.card, costFilter))
            .sort((a, b) => a.value - b.value);

        // 手札候補：除外されるため、切っても痛くない順に並べる
        const handCandidates = GAME_STATE.opponent.hand
            .map(c => ({ card: c, from: "hand" }))
            .filter(obj => obj.card !== card && matchesCostFilter(obj.card, costFilter))
            .sort((a, b) => this.banishScore(b.card) - this.banishScore(a.card));

        const costs = [];
        for (const c of fieldCandidates) {
            if (costs.length >= costCount) break;
            costs.push(c);
        }

        const fieldPicks = costs.length;
        // フィールドだけで足りない分を手札で補う（上限あり）
        const shortage = costCount - fieldPicks;
        if (shortage > 0) {
            if (shortage > this.MAX_HAND_COST) return null;
            if (handCandidates.length < shortage) return null;
            costs.push(...handCandidates.slice(0, shortage));
        }

        if (costs.length < costCount) return null;

        // 置き場所：フィールドコストで空く枠を優先、なければ元々の空き枠
        let slotIndex;
        if (fieldPicks > 0) {
            slotIndex = costs.find(c => c.from === "field").slotIdx;
        } else if (emptySlots.length > 0) {
            slotIndex = emptySlots[0];
        } else {
            return null; // 手札だけ払っても置き場所がない
        }

        // 失う価値。場のモンスターは丸ごと失う。
        // 手札は除外されるが盤面には影響しないので、軽めに見積もる。
        const lostValue = costs.reduce((sum, c) => {
            if (c.from === "field") return sum + this.fieldMonsterValue(c.card, c.slotIdx);
            return sum + 150 + (c.card.power || 0) * 0.15;
        }, 0);

        return { costs, slotIndex, lostValue };
    },

    /**
     * CPUの召喚試行。実際に召喚したら true
     * 手札のモンスターをすべて評価し、盤面がいちばん良くなる1体を出す。
     * 「強いモンスターをコストにして弱いモンスターを出す」ような損な召喚はしない。
     */
    async tryCpuSummon() {
        const hand = GAME_STATE.opponent.hand;
        const field = GAME_STATE.opponent.field.monsters;
        const emptySlots = field.map((m, i) => m === null ? i : null).filter(i => i !== null);

        let best = null;

        for (const card of hand.filter(c => c.type === "monster")) {
            const req = card.summonRequirement || {};
            const costCount = req.costCount || 0;
            const gain = this.summonValue(card);

            if (costCount === 0) {
                // コスト不要。空き枠があるならそのまま得
                if (emptySlots.length === 0) continue;
                if (!best || gain > best.netGain) {
                    best = { card, slotIndex: emptySlots[0], costs: [], netGain: gain };
                }
                continue;
            }

            const plan = this.planSummonCosts(card, costCount, req.costFilter);
            if (!plan) continue;

            // 差し引きで損になる召喚はしない
            const netGain = gain - plan.lostValue;
            if (netGain <= 0) {
                console.log(`CPU: skip summoning ${card.name} (net ${Math.round(netGain)})`);
                continue;
            }
            if (!best || netGain > best.netGain) {
                best = { card, slotIndex: plan.slotIndex, costs: plan.costs, netGain };
            }
        }

        if (!best) return false;

        await executeSummon("opponent", best.card, best.slotIndex, best.costs);
        return true;
    },

    /** CPUの魔術発動。1枚でも発動・セットしたら true */
    async tryCpuMagic() {
        let acted = false;
        const hand = GAME_STATE.opponent.hand;
        // 発動優先度: 1.墓地肥やし(s013, s018) 2.除去(s014) 3.蘇生(s015, s012)
        const priority = {"s013": 10, "s018": 9, "s014": 5, "s015": 1, "s012": 1};
        const magics = hand.filter(c => c.type === "magic")
                           .sort((a, b) => (priority[b.id] || 0) - (priority[a.id] || 0));

        for (const card of magics) {
            const field = GAME_STATE.opponent.field.magics;
            const emptySlot = field.indexOf(null);
            if (emptySlot === -1) break;

            // 罠魔術は伏せる（条件成立時に自動発動する）
            if (card.subType === "trap") {
                const freeSlots = field.filter(m => m === null).length;
                const hasOtherPlayableMagic = hand.some(c =>
                    c !== card && c.type === "magic" && c.subType !== "trap");
                // 最後の1枠は通常魔術のために空けておく
                if (freeSlots <= 1 && hasOtherPlayableMagic) continue;

                const hIdx = GAME_STATE.opponent.hand.indexOf(card);
                if (hIdx === -1) continue;
                GAME_STATE.opponent.hand.splice(hIdx, 1);

                card._isSet = true;
                card._setTurnSerial = GAME_STATE.turnSerial;
                field[emptySlot] = card;
                console.log(`CPU set a trap: ${card.name}`);

                acted = true;
                updateUI();
                await this.delay(500);
                continue;
            }

            // 戦略的発動判定
            let shouldActivate = EffectLogic.isEffectActivatable(card, "opponent", "on_activate");

            // コンボ・状況判断ロジック
            if (shouldActivate) {
                // 0. 引いて捨てる系（マインド・リサーチ等）は、手札を入れ替えて
                //    初めて意味がある。この魔術しか手札に無い状態で撃つと、
                //    引いた2枚をそのまま捨てて手札0になるだけで損しかしない。
                const filterAction = card.logic.find(l => l.type === "draw_and_discard");
                if (filterAction) {
                    const otherHand = hand.filter(c => c !== card).length;
                    const drawCount = filterAction.drawCount || 0;
                    const discardCount = filterAction.discardCount || 0;
                    // 捨てる枚数のほうが多いなら、余剰の手札があるときだけ使う
                    if (otherHand + drawCount <= discardCount) shouldActivate = false;
                }
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

            // 3. 永続魔術は魔術ゾーンを埋め切らないよう1枠は空けておく
            //    (3枠すべて永続で埋まると以後まったく魔術を発動できなくなる)
            if (shouldActivate && card.subType === "permanent") {
                const freeSlots = field.filter(m => m === null).length;
                const hasOtherPlayableMagic = hand.some(c =>
                    c !== card && c.type === "magic" && c.subType !== "permanent");
                if (freeSlots <= 1 && hasOtherPlayableMagic) shouldActivate = false;
            }

            if (shouldActivate) {
                // 同名カードを取り違えないようオブジェクト同一性で手札から取り除く
                const hIdx = GAME_STATE.opponent.hand.indexOf(card);
                if (hIdx === -1) continue;
                GAME_STATE.opponent.hand.splice(hIdx, 1);
                GAME_STATE.opponent.field.magics[emptySlot] = card;

                updateUI();
                await this.delay(800);
                await EffectLogic.resolveEffects(card, "opponent", "on_activate");

                if (card.subType === "normal") {
                    GAME_STATE.opponent.field.magics[emptySlot] = null;
                    sendCardToTrash("opponent", card);
                }
                acted = true;
                updateUI();
                await this.delay(500);
                if (GAME_STATE.isGameOver) return acted;
            }
        }
        return acted;
    },

    /** CPUの起動効果発動。1つでも使ったら true */
    async tryCpuIgnition() {
        let acted = false;
        const field = GAME_STATE.opponent.field.monsters;
        for (let i = 0; i < field.length; i++) {
            const card = field[i];
            if (!card || !card.logic) continue;

            const ignitionLogic = card.logic.filter(l => l.trigger === "ignition");
            if (ignitionLogic.length === 0) continue;

            // 使用済み判定は EffectLogic 側の countLimit 管理に一本化している
            const isUsed = EffectLogic.isIgnitionUsed(card);

            if (!isUsed && EffectLogic.isEffectActivatable(card, "opponent", "ignition")) {
                console.log(`CPU Activating Ignition: ${card.name}`);
                await EffectLogic.resolveEffects(card, "opponent", "ignition");
                acted = true;
                await this.delay(500);
                updateUI();
                if (GAME_STATE.isGameOver) return acted;
            }
        }
        return acted;
    },

    /**
     * バトルフェイズの行動ロジック
     */
    async executeBattlePhase() {
        const field = GAME_STATE.opponent.field.monsters;

        for (let i = 0; i < field.length; i++) {
            if (GAME_STATE.isGameOver) return;

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

            // 先に攻撃先を決めてから間を置く。攻撃しないモンスターの分まで
            // 待たされると、何も起きないのに時間だけ過ぎて間延びして見える。
            let target = null; // { m, idx } / ダイレクトアタックは "direct"

            if (targets.length === 0) {
                target = "direct";
            } else {
                // リーサルチェック: 攻撃可能な全パワーの合計が相手LP以上か？
                // (スロット番号は元のフィールド添字を使う。filter後の添字ではズレる)
                const totalPotential = field.reduce(
                    (sum, m, idx) => (m && !m._hasAttacked)
                        ? sum + EffectLogic.getCurrentPower(m, "opponent", idx)
                        : sum,
                    0);

                // ターゲット優先順位: 1.倒せる敵(効果持ち優先) 2.相打ち(高パワー敵優先)
                const killable = targets.filter(t => atkPower > t.pwr)
                                       .sort((a, b) => (b.isEffect - a.isEffect) || (b.pwr - a.pwr));
                const equal = targets.filter(t => atkPower === t.pwr).sort((a, b) => b.pwr - a.pwr);

                if (totalPotential >= GAME_STATE.player.lp && killable.length === 0) {
                    // 邪魔なモンスターがいなければリーサルだが、守備がいる場合は排除優先
                    // ここでは最も弱い敵を排除して道を空ける思考
                    target = targets.slice().sort((a, b) => a.pwr - b.pwr)[0];
                } else if (killable.length > 0) {
                    target = killable[0];
                } else if (equal.length > 0 && (attacker.logic?.some(l => l.trigger === "on_sent_to_trash") || equal[0].pwr >= 1000)) {
                    target = equal[0];
                } else if (totalPotential >= GAME_STATE.player.lp) {
                    // リーサル圏内の時は多少の損害を覚悟してでも攻撃
                    target = targets[0];
                }
            }

            if (!target) {
                console.log(`CPU: ${attacker.name} stays on defense.`);
                continue;
            }

            await this.delay(600);
            if (target === "direct") {
                await resolveBattle(attacker, null, i, -1);
            } else {
                await resolveBattle(attacker, target.m, i, target.idx);
            }
            updateUI();
        }

        await this.delay(400);
        if (GAME_STATE.turnPlayer === "opponent" && !GAME_STATE.isGameOver) advancePhase();
    }
};

/**
 * main.jsのエンドフェイズから呼ばれる処理
 */
async function handleCpuEndPhase() {
    if (GAME_STATE.isGameOver) return;

    const hand = GAME_STATE.opponent.hand;
    if (hand.length > 10) {
        const discardCount = hand.length - 10;
        // 手札に残しても使えないカード（コスト過多の上級など）から捨てる
        for (let i = 0; i < discardCount; i++) {
            if (hand.length === 0) break;
            hand.sort((a, b) => CpuLogic.discardScore(b) - CpuLogic.discardScore(a));
            const card = hand.shift();
            sendCardToTrash("opponent", card);
            await EffectLogic.notifyCardSentToTrash(card, "opponent");
        }
        console.log(`CPU discarded ${discardCount} cards.`);
    }
    await new Promise(r => setTimeout(r, 400));
    endTurn();
}
