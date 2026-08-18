/**
 * LinkaVel Card Game - Effect Logic Manager
 * カードの効果（特殊召喚、ドロー、バフ等）を専門に扱う汎用エンジン
 * Ver 1.3 (Common Logic Spec Compliant)
 */

const EffectLogic = {
    // 効果の連鎖が循環した場合に備えた深さ制限（無限ループ防止）
    MAX_RESOLVE_DEPTH: 12,
    _resolveDepth: 0,
    // プレイヤーが対象選択をキャンセルした場合に立つフラグ。
    // 「自分と相手を1体ずつ破壊」のような効果で、片方だけ実行されるのを防ぐ。
    _selectionCancelled: false,

    /**
     * カードが持つ効果配列を順番に解決する (Ver 1.3準拠)
     * @param {Object} cardData - カードデータ
     * @param {string} side - 発動側 ("player" | "opponent")
     * @param {string} triggerFilter - 特定のトリガーのみ実行する場合に指定 (nullなら全実行)
     */
    async resolveEffects(cardData, side, triggerFilter = null) {
        if (!cardData || !cardData.logic || cardData.logic.length === 0) return;
        if (GAME_STATE.isGameOver) return;

        if (this._resolveDepth >= this.MAX_RESOLVE_DEPTH) {
            console.warn(`EffectLogic: resolve depth limit reached at ${cardData.name}. Aborting chain.`);
            return;
        }

        console.log(`EffectLogic: Resolving [${triggerFilter || "All"}] logic for ${cardData.name}`);
        this._resolveDepth++;

        try {
            for (let i = 0; i < cardData.logic.length; i++) {
                const action = cardData.logic[i];
                if (triggerFilter && action.trigger !== triggerFilter) continue;
                if (GAME_STATE.isGameOver) break;

                // 誘発条件（オブジェクト形式）を満たさないアクションは実行しない
                if (action.condition && typeof action.condition === "object"
                    && !this._checkEventCondition(action, this._eventContext)) {
                    continue;
                }

                // 1ターンに1度の制限チェック (インデックスで管理)
                if (action.countLimit === "once_per_turn") {
                    cardData._usedLimits = cardData._usedLimits || {};
                    const limitKey = `action_${i}`;
                    // 現在のターンですでに使用済みならスキップ
                    if (cardData._usedLimits[limitKey] === GAME_STATE.turnCount) {
                        console.log(`Effect Limit Reached: ${cardData.name} (Action ${i})`);
                        continue;
                    }
                    // 使用済みフラグを立てる
                    cardData._usedLimits[limitKey] = GAME_STATE.turnCount;
                }

                await this.executeAction(action, side, cardData);

                // 対象選択がキャンセルされたら、以降のアクションは実行しない
                if (this._selectionCancelled) {
                    this._selectionCancelled = false;
                    console.log(`EffectLogic: ${cardData.name} の効果は対象選択の中断により終了`);
                    break;
                }
            }
        } finally {
            this._resolveDepth--;
        }
    },

    // ==========================================
    // 罠魔術（セット → 条件成立で強制発動）
    // ==========================================

    /**
     * 罠のトリガーと「誰が持つ罠が反応するか」の対応。
     * "opponent" = イベントを起こした側の相手が持つ罠
     * "self"     = イベントを起こした側自身が持つ罠
     */
    TRAP_TRIGGERS: {
        on_opponent_summon: "opponent",
        on_opponent_attack: "opponent",
        on_own_monster_destroyed: "self"
    },

    // 誘発元の情報（攻撃してきたモンスター等）。解決中のみ有効。
    _eventContext: null,

    /**
     * 指定トリガーの罠を探し、条件を満たすものを順に強制発動する
     * @param {string} trigger
     * @param {string} eventSide - イベントを起こした側
     * @param {Object} context   - 誘発元の情報
     */
    async fireTrapTrigger(trigger, eventSide, context) {
        if (GAME_STATE.isGameOver) return;

        const relation = this.TRAP_TRIGGERS[trigger];
        if (!relation) return;

        const watcherSide = (relation === "opponent")
            ? (eventSide === "player" ? "opponent" : "player")
            : eventSide;

        // 解決中に魔術ゾーンが変動するため、対象を先に確定させる
        const pending = GAME_STATE[watcherSide].field.magics.filter(card => {
            if (!card || card.subType !== "trap" || !card._isSet) return false;
            // 伏せたターンは発動できない
            if (card._setTurnSerial === GAME_STATE.turnSerial) return false;

            const actions = (card.logic || []).filter(a => a.trigger === trigger);
            if (actions.length === 0) return false;
            return actions.some(a => this._checkEventCondition(a, context));
        });

        for (const card of pending) {
            if (GAME_STATE.isGameOver) return;
            const slotIdx = GAME_STATE[watcherSide].field.magics.indexOf(card);
            if (slotIdx === -1) continue; // 解決中に場を離れた
            await this.activateTrap(card, watcherSide, slotIdx, trigger, context);
        }
    },

    /** 罠を表向きにして解決し、トラッシュへ送る */
    async activateTrap(card, side, slotIdx, trigger, context) {
        console.log(`Trap Activated: ${card.name} (${side})`);

        card._isSet = false;
        if (typeof renderFieldCard === "function") renderFieldCard(side, "magic", slotIdx, card);
        if (typeof showTrapActivation === "function") showTrapActivation(side, slotIdx, card);
        await new Promise(r => setTimeout(r, 700)); // 発動を見せる間

        const previous = this._eventContext;
        this._eventContext = context;
        try {
            await this.resolveEffects(card, side, trigger);
        } finally {
            this._eventContext = previous;
        }

        // 罠は解決後トラッシュへ（通常魔術と同じ扱い）
        const current = GAME_STATE[side].field.magics.indexOf(card);
        if (current !== -1) {
            GAME_STATE[side].field.magics[current] = null;
            sendCardToTrash(side, card);
            if (typeof renderFieldCard === "function") renderFieldCard(side, "magic", current, null);
        }
        if (typeof updateUI === "function") updateUI();
    },

    /** 誘発条件（オブジェクト形式）の判定 */
    _checkEventCondition(action, context) {
        const cond = action.condition;
        if (!cond || typeof cond !== "object") return true;

        const ctx = context || {};

        if (cond.summonedFilter) {
            const matched = (ctx.summoned || []).some(c => this._checkFilter(c, cond.summonedFilter));
            if (!matched) return false;
        }
        if (cond.attackerFilter) {
            if (!ctx.attacker || !this._checkFilter(ctx.attacker, cond.attackerFilter)) return false;
        }
        if (cond.defenderFilter) {
            if (!ctx.defender || !this._checkFilter(ctx.defender, cond.defenderFilter)) return false;
        }
        if (cond.destroyedFilter) {
            if (!ctx.destroyed || !this._checkFilter(ctx.destroyed, cond.destroyedFilter)) return false;
        }
        if (typeof cond.attackerWeakenedBy === "number") {
            if (!ctx.attacker) return false;
            // 「元々のパワーよりNダウン」= 掛けられたデバフの合計で判定する
            // (is_weakened と同じ基準。常時オーラによる増減は数えない)
            const downBy = -this.getTempBuffDelta(ctx.attacker);
            if (downBy < cond.attackerWeakenedBy) return false;
        }
        return true;
    },

    /** モンスターの召喚・特殊召喚を罠に通知する */
    async notifySummon(side, summonedCards) {
        const cards = (summonedCards || []).filter(Boolean);
        if (cards.length === 0) return;
        await this.fireTrapTrigger("on_opponent_summon", side, {
            summoned: cards,
            summonedSide: side
        });
    },

    /**
     * 攻撃宣言を罠に通知する
     * @returns {boolean} 攻撃を中止すべきなら true（攻撃モンスターや対象が失われた場合）
     */
    async notifyAttackDeclared(attackerSide, attacker, attackerSlot, defender, defenderSlot) {
        const defenderSide = (attackerSide === "player") ? "opponent" : "player";

        await this.fireTrapTrigger("on_opponent_attack", attackerSide, {
            attacker, attackerSide, attackerSlot,
            defender, defenderSide, defenderSlot
        });

        if (GAME_STATE.isGameOver) return true;
        // 罠で攻撃モンスターが除去された場合は戦闘そのものが発生しない
        if (GAME_STATE[attackerSide].field.monsters[attackerSlot] !== attacker) return true;
        if (defender && GAME_STATE[defenderSide].field.monsters[defenderSlot] !== defender) return true;
        return false;
    },

    /** モンスターが破壊されトラッシュへ送られたことを罠に通知する */
    async notifyMonsterDestroyed(side, card) {
        if (!card) return;
        await this.fireTrapTrigger("on_own_monster_destroyed", side, {
            destroyed: card,
            destroyedSide: side
        });
    },

    /**
     * 起動効果が「このターン使用済み」かどうか（UI/CPUの表示判定用）
     */
    isIgnitionUsed(cardData) {
        if (!cardData || !cardData.logic || !cardData._usedLimits) return false;
        return cardData.logic.some((action, i) =>
            action.trigger === "ignition" &&
            action.countLimit === "once_per_turn" &&
            cardData._usedLimits[`action_${i}`] === GAME_STATE.turnCount
        );
    },

    /**
     * カードがトラッシュに送られた事による誘発をまとめて処理する。
     * - 送られたカード自身の on_sent_to_trash
     * - フィールド上の他カードの on_other_sent_to_trash（フィルタと持ち主を判定する）
     *
     * 除外(banish)はこの関数を通らないため、墓地誘発は一切発生しない。
     * @param {Object} card - トラッシュに送られたカード
     * @param {string} side - そのカードの持ち主 ("player" | "opponent")
     */
    async notifyCardSentToTrash(card, side) {
        if (!card || GAME_STATE.isGameOver) return;

        // 1. 他カードの誘発（アクア・サルベージ s006 等）
        for (const watcherSide of ["player", "opponent"]) {
            const p = GAME_STATE[watcherSide];
            const sources = [...p.field.monsters, ...p.field.magics];

            for (const source of sources) {
                if (!source || source === card || !source.logic) continue;

                const matched = source.logic.some(action => {
                    if (action.trigger !== "on_other_sent_to_trash") return false;
                    // 「自分の」カードが送られた時のみ反応する（相手の破壊では誘発しない）
                    if (watcherSide !== side) return false;
                    return this._checkFilter(card, action.filter || {});
                });

                if (matched) {
                    await this.resolveEffects(source, watcherSide, "on_other_sent_to_trash");
                }
            }
        }

        // 2. 送られたカード自身の誘発
        await this.resolveEffects(card, side, "on_sent_to_trash");
    },

    /**
     * 単一のアクション命令を実行する (命令の振り分け)
     * @param {Object} action - logic内の単一オブジェクト
     * @param {string} side - "player" | "opponent"
     * @param {Object} sourceCard - 効果の発生源
     */
    async executeAction(action, side, sourceCard) {
        switch (action.type) {
            case "heal": this.applyHeal(action, side); break;
            case "draw_card":
                if (typeof drawCard === "function") await drawCard(side, action.count || 1);
                break;
            case "mill": await this.applyMill(action, side); break;
            case "buff": await this.applyBuff(action, side, sourceCard); break;
            case "destroy": await this.applyDestroy(action, side); break;
            case "draw_and_discard": await this.applyDrawAndDiscard(action, side); break;
            case "special_summon": await this.applySpecialSummon(action, side); break;
            case "search": await this.applySearch(action, side); break;
            case "salvage": await this.applySalvage(action, side); break;
            case "global_buff": await this.applyGlobalBuff(action, side, sourceCard); break;
            case "bounce": await this.applyBounce(action, side, sourceCard); break;
            case "apply_combat_effect": await this.applyCombatEffect(action, side, sourceCard); break;
            case "battle_protection":
            case "global_protection":
            case "damage_reduction":
                // これらは判定フェーズで参照されるため実行時はログのみ
                console.log(`Static Effect Active: ${action.type}`);
                break;
            default: console.log(`Effect Type [${action.type}] is not yet implemented.`); break;
        }
        if (typeof updateUI === "function") updateUI();
    },

    /** LP回復処理 */
    applyHeal: async function(action, side) {
        const amount = action.value || 0;
        if (amount <= 0) return;

        const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
        p.lp += amount;
        console.log(`${side} healed ${amount} LP. Current LP: ${p.lp}`);

        // 割り込みトリガー: on_lp_gain (聖界王レオニダス等)
        // 回復したプレイヤー側のモンスターのみが反応する
        for (const m of GAME_STATE[side].field.monsters) {
            if (m) await this.resolveEffects(m, side, "on_lp_gain");
        }
    },

    /** デッキ切削処理 (Mill) */
    applyMill: async function(action, side) {
        const count = action.count || 0;
        const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
        let remaining = count;

        while (remaining > 0) {
            if (p.deck.length === 0) {
                // 効果処理の途中でも条件を満たした瞬間にリフレッシュする (ルール Ver.1.1)
                if (p.trash.length > 0 && p.refreshCount < 1) {
                    console.log(`${side} performs Deck Refresh during Milling!`);
                    p.deck = shuffleArray(p.trash.map(resetCardState));
                    p.trash = [];
                    p.refreshCount++;
                    // リフレッシュ後は追加で 1 枚ドローする
                    await drawCard(side, 1);
                    updateUI();
                } else {
                    break;
                }
            }

            const card = p.deck.pop();
            sendCardToTrash(side, card);
            await this.notifyCardSentToTrash(card, side);
            remaining--;
        }
        console.log(`${side} milled ${count} cards.`);
    },

    /** パワー増減処理 (手動選択対応) */
    async applyBuff(action, side, sourceCard) {
        const value = action.value || 0;
        const targets = await this._acquireTargets(action, side, sourceCard);

        targets.forEach(t => {
            t.card._tempBuffs = t.card._tempBuffs || [];
            // 持続ターンの数値化
            let durationCount = action.duration;
            if (action.duration === "until_end_turn") durationCount = 1;
            if (action.duration === "until_opponent_end") durationCount = 2;

            t.card._tempBuffs.push({
                value: value,
                duration: durationCount || "permanent",
                turn: GAME_STATE.turnCount
            });
            console.log(`${t.card.name} received buff: ${value}`);
        });
    },

    /** 破壊処理の実装 */
    async applyDestroy(action, side) {
        const targets = await this._acquireTargets(action, side);
        for (const t of targets) {
            if (typeof destroyMonster === "function") {
                await destroyMonster(t.side, t.slotIdx);
            }
        }
    },

    /** 対象を持ち主の手札へ戻す（バウンス） */
    async applyBounce(action, side, sourceCard) {
        const targets = await this._acquireTargets(action, side, sourceCard);

        for (const t of targets) {
            const p = GAME_STATE[t.side];
            const idx = p.field.monsters.indexOf(t.card);
            if (idx === -1) continue;

            p.field.monsters[idx] = null;
            p.hand.push(resetCardState(t.card));
            if (typeof renderFieldCard === "function") renderFieldCard(t.side, "monster", idx, null);
            console.log(`${t.card.name} was returned to its owner's hand.`);
        }
        if (typeof updateUI === "function") updateUI();
    },

    /**
     * 誘発元（攻撃モンスター・召喚されたモンスター等）を対象として取得する
     */
    _acquireEventTargets(action, side) {
        const ctx = this._eventContext || {};
        const filter = action.filter || {};
        const results = [];

        const push = (card, cardSide) => {
            if (!card || !cardSide) return;
            // 場を離れている場合は対象にならない
            const slotIdx = GAME_STATE[cardSide].field.monsters.indexOf(card);
            if (slotIdx === -1) return;
            if (!this._checkFilter(card, filter)) return;
            results.push({ card, side: cardSide, slotIdx });
        };

        switch (action.targetSelect) {
            case "event_attacker":
                push(ctx.attacker, ctx.attackerSide);
                break;
            case "event_defender":
                push(ctx.defender, ctx.defenderSide);
                break;
            default: // "event"
                (ctx.summoned || []).forEach(c => push(c, ctx.summonedSide));
                push(ctx.destroyed, ctx.destroyedSide);
                break;
        }
        return results;
    },

    /** ターゲット取得用内部メソッド */
    async _acquireTargets(action, side, sourceCard) {
        const targetSide = (action.targetSide === "opponent") ? (side === "player" ? "opponent" : "player") : side;
        const select = action.targetSelect || "auto";

        // 誘発元を対象にする指定（罠魔術など）
        if (select === "event" || select === "event_attacker" || select === "event_defender") {
            return this._acquireEventTargets(action, side);
        }
        const count = action.count || 1;
        const filter = action.filter || {};
        const p = GAME_STATE[targetSide];

        if (action.target === "self" && sourceCard) {
            const idx = GAME_STATE[side].field.monsters.indexOf(sourceCard);
            return [{ card: sourceCard, side: side, slotIdx: idx }];
        }

        if (action.targetSelect === "all") {
            return p.field.monsters
                .map((m, i) => ({ card: m, side: targetSide, slotIdx: i }))
                .filter(t => t.card !== null && this._checkFilter(t.card, filter));
        }

        let candidates = [];
        p.field.monsters.forEach((m, i) => {
            if (m && this._checkFilter(m, filter)) {
                // 条件判定: is_weakened (森界の怒り等)
                if (action.condition === "is_weakened" && !this.isWeakened(m)) return;
                candidates.push({ card: m, side: targetSide, slotIdx: i });
            }
        });

        if (candidates.length === 0) return [];

        if (select === "manual") {
            if (side === "player") {
                const results = [];
                const prompt = this._targetPromptText(action, targetSide, side);

                for (let i = 0; i < count; i++) {
                    if (candidates.length === 0) break;

                    // 効果の条件を満たすスロットだけを選択可能にする
                    // (フィルタ外のカードを選んで「何も起きない」のを防ぐ)
                    const validSlots = candidates.map(c => c.slotIdx);
                    const label = (count > 1) ? `${prompt}（${i + 1}/${count}）` : prompt;
                    const slot = await selectTargetUI(targetSide, "monster", validSlots, label);

                    if (slot === null) {
                        // キャンセルされた場合は効果全体を中断させる
                        this._selectionCancelled = true;
                        break;
                    }
                    const cIdx = candidates.findIndex(c => c.slotIdx === slot);
                    if (cIdx !== -1) results.push(candidates.splice(cIdx, 1)[0]);
                }
                return results;
            } else {
                // CPUのインテリジェンス選択 (s014等の対応)
                const targetsOwnSide = (targetSide === side);
                const isRemoval = (action.type === "destroy");
                const results = [];

                for (let i = 0; i < count; i++) {
                    if (candidates.length === 0) break;
                    candidates.sort((a, b) => {
                        const pA = this.getCurrentPower(a.card, a.side, a.slotIdx);
                        const pB = this.getCurrentPower(b.card, b.side, b.slotIdx);
                        const hasTrashEff = (c) => (c.logic && c.logic.some(l => l.trigger === "on_sent_to_trash")) ? 1 : 0;

                        if (targetsOwnSide && isRemoval) {
                            // 自分を破壊する場合: 墓地効果持ち、または弱いモンスターを優先
                            return (hasTrashEff(b.card) - hasTrashEff(a.card)) || (pA - pB);
                        }
                        // 相手への除去・弱体化、自分への強化はいずれも「強いモンスター」が最優先
                        return pB - pA;
                    });
                    results.push(candidates.shift());
                }
                return results;
            }
        } else {
            const results = [];
            for (let i = 0; i < count; i++) {
                if (candidates.length === 0) break;
                const rIdx = Math.floor(Math.random() * candidates.length);
                results.push(candidates.splice(rIdx, 1)[0]);
            }
            return results;
        }
    },

    /** ドロー&ディスカード処理 */
    applyDrawAndDiscard: async function(action, side) {
        // 1. ドローを実行
        if (typeof drawCard === "function") {
            await drawCard(side, action.drawCount || 0);
        }

        // 2. 捨てる処理
        const p = GAME_STATE[side];
        const discardCount = Math.min(action.discardCount || 0, p.hand.length);

        if (discardCount <= 0) return;

        if (side === "player" && action.discardType === "manual") {
            // プレイヤーが自分で選ぶ
            const targets = await selectHandCardsUI(discardCount);
            // インデックスのズレを防ぐため降順で削除
            const sortedTargets = targets.sort((a, b) => b - a);
            for (const idx of sortedTargets) {
                const card = p.hand.splice(idx, 1)[0];
                sendCardToTrash(side, card);
                await this.notifyCardSentToTrash(card, side);
            }
        } else {
            // CPU戦略的ディスカード: 墓地利用・高Lvを優先し、Lv1や汎用魔術を残す
            // (優先度の定義は CpuLogic 側に一本化している)
            const score = (c) => (typeof CpuLogic !== "undefined") ? CpuLogic.discardScore(c) : 0;

            for (let i = 0; i < discardCount; i++) {
                if (p.hand.length === 0) break;

                p.hand.sort((a, b) => score(b) - score(a)); // スコア高い順（捨てたい順）

                const card = p.hand.shift();
                sendCardToTrash(side, card);
                await this.notifyCardSentToTrash(card, side);
            }
        }
        console.log(`${side} discarded ${discardCount} cards.`);
        if (typeof updateUI === "function") updateUI();
    },

    /** 特殊召喚処理 */
    applySpecialSummon: async function(action, side) {
        const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
        const count = action.count || 1;
        const source = action.source; // deck / trash / choice_deck_or_trash / event
        const filter = action.filter || {};

        // source: "event" は「誘発元になったそのカード」を蘇生する（海界の奇跡 等）
        if (source === "event") {
            const ctx = this._eventContext || {};
            const target = ctx.destroyed;
            if (!target) return;

            const ownerSide = ctx.destroyedSide || side;
            const trashIdx = GAME_STATE[ownerSide].trash.indexOf(target);
            if (trashIdx === -1) return; // すでにトラッシュにない

            const slotIdx = p.field.monsters.indexOf(null);
            if (slotIdx === -1) return; // 空き枠がない

            GAME_STATE[ownerSide].trash.splice(trashIdx, 1);
            p.field.monsters[slotIdx] = target;
            if (typeof renderFieldCard === "function") renderFieldCard(side, "monster", slotIdx, target);

            await this.resolveEffects(target, side, "on_summon");
            await this.notifySummon(side, [target]);
            return;
        }

        // 1. 候補カードの収集
        let pool = [];
        if (source === "deck" || source === "choice_deck_or_trash") pool = pool.concat(p.deck);
        if (source === "trash" || source === "choice_deck_or_trash") pool = pool.concat(p.trash);

        // 2. フィルタリング (モンスターのみ・条件合致)
        let candidates = pool.filter(card => {
            if (card.type !== "monster") return false;
            if (filter.level && card.level !== filter.level) return false;
            if (filter.minLevel && card.level < filter.minLevel) return false;
            if (filter.maxLevel && card.level > filter.maxLevel) return false;
            if (filter.attribute && card.attribute !== filter.attribute) return false;
            if (filter.category && !card.categories.includes(filter.category)) return false;
            return true;
        });

        // 3. 召喚枠の確認
        let emptySlots = [];
        p.field.monsters.forEach((m, i) => { if (m === null) emptySlots.push(i); });

        // 4. 実行
        const summonedCards = [];
        const summonLimit = Math.min(count, emptySlots.length, candidates.length);
        for (let i = 0; i < summonLimit; i++) {
            const randIdx = Math.floor(Math.random() * candidates.length);
            const targetCard = candidates.splice(randIdx, 1)[0];
            const slotIdx = emptySlots.shift();

            // 元の場所(deck/trash)から削除 (連鎖解決による移動を考慮)
            const deckIdx = p.deck.indexOf(targetCard);
            const trashIdx = p.trash.indexOf(targetCard);

            if (deckIdx !== -1) {
                p.deck.splice(deckIdx, 1);
            } else if (trashIdx !== -1) {
                p.trash.splice(trashIdx, 1);
            } else {
                // 候補にはあったが、連鎖したドローや別の特殊召喚で既に移動済みの場合はスキップ
                console.log(`Summon Cancel: ${targetCard.name} is no longer in deck/trash.`);
                continue;
            }

            // フィールドへ配置
            p.field.monsters[slotIdx] = targetCard;

            // UI描画の更新 (main.jsの関数を呼び出し)
            if (typeof renderFieldCard === "function") {
                renderFieldCard(side, "monster", slotIdx, targetCard);
            }

            summonedCards.push(targetCard);

            // 連鎖：特殊召喚も「召喚成功時」として扱う (ロジック定義1.3準拠)
            await this.resolveEffects(targetCard, side, "on_summon");
        }

        // 「1体以上召喚した時」の罠は、まとめて1回だけ判定する
        await this.notifySummon(side, summonedCards);
    },

    /** サーチ処理 (デッキから手札) */
    applySearch: async function(action, side) {
        const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
        const count = action.count || 1;
        const filter = action.filter || {};

        let candidates = p.deck.filter(card => this._checkFilter(card, filter));

        const moveLimit = Math.min(count, candidates.length);
        for (let i = 0; i < moveLimit; i++) {
            const randIdx = Math.floor(Math.random() * candidates.length);
            const targetCard = candidates.splice(randIdx, 1)[0];

            // デッキから削除して手札へ (安全にインデックスを確認)
            const idx = p.deck.indexOf(targetCard);
            if (idx !== -1) {
                p.deck.splice(idx, 1);
                p.hand.push(targetCard);
                console.log(`${side} searched ${targetCard.name}`);
            }
        }
    },

    /** サルベージ処理 (トラッシュから手札) */
    applySalvage: async function(action, side) {
        const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
        const count = action.count || 1;
        const filter = action.filter || {};

        let candidates = p.trash.filter(card => this._checkFilter(card, filter));

        const moveLimit = Math.min(count, candidates.length);
        for (let i = 0; i < moveLimit; i++) {
            const randIdx = Math.floor(Math.random() * candidates.length);
            const targetCard = candidates.splice(randIdx, 1)[0];

            // トラッシュから削除して手札へ (安全にインデックスを確認)
            const idx = p.trash.indexOf(targetCard);
            if (idx !== -1) {
                p.trash.splice(idx, 1);
                p.hand.push(targetCard);
                console.log(`${side} salvaged ${targetCard.name}`);
            }
        }
    },

    /**
     * 「パワーが元々の数値より低下している」判定 (森界の怒り s007 等)
     *
     * 常時オーラ(always)による低下は含めない。
     * 含めてしまうと「森界の門」を1枚置くだけで相手全員が常に条件を満たし、
     * s007 が無条件除去になってしまうため、
     * 個別に掛けられた一時的なデバフ(_tempBuffs)のみを見る。
     */
    isWeakened: function(card) {
        return this.getTempBuffDelta(card) < 0;
    },

    /**
     * 個別に掛けられた一時バフ／デバフの合計値を返す（マイナスなら弱体化）
     * 常時オーラ(always)は含めない。
     * 含めると「森界の門」1枚で相手全員が常時弱体化扱いになり、
     * 弱体化を条件とするカード（森界の怒り・森界の壁）が無条件化してしまう。
     */
    getTempBuffDelta: function(card) {
        if (!card || !card._tempBuffs || card._tempBuffs.length === 0) return 0;
        return card._tempBuffs.reduce((sum, b) => sum + (b.value || 0), 0);
    },

    /** 対象選択時にプレイヤーへ出す案内文 */
    _targetPromptText: function(action, targetSide, side) {
        const owner = (targetSide === side) ? "自分" : "相手";
        switch (action.type) {
            case "destroy":
                return `破壊する${owner}のモンスターを選択してください`;
            case "buff":
                return (action.value || 0) < 0
                    ? `弱体化させる${owner}のモンスターを選択してください`
                    : `強化する${owner}のモンスターを選択してください`;
            case "apply_combat_effect":
                return `効果を適用する${owner}のモンスターを選択してください`;
            default:
                return `対象にする${owner}のモンスターを選択してください`;
        }
    },

    /** 内部用フィルタリングロジック */
    _checkFilter: function(card, filter) {
        if (filter.level && card.level !== filter.level) return false;
        if (filter.minLevel && card.level < filter.minLevel) return false;
        if (filter.maxLevel && card.level > filter.maxLevel) return false;
        if (filter.attribute && card.attribute !== filter.attribute) return false;
        if (filter.category && (!card.categories || !card.categories.includes(filter.category))) return false;
        if (filter.type && card.type !== filter.type) return false;
        return true;
    },

    /**
     * カードの現在のパワーを動的に計算する (オーラ・条件付バフを反映)
     */
    getCurrentPower: function(card, side, slotIdx) {
        if (!card || card.type !== "monster") return 0;

        // 1. ベースパワー
        let currentPower = card.power;

        // 2. 一時的な個体バフ (_tempBuffs) の加算
        if (card._tempBuffs) {
            card._tempBuffs.forEach(b => {
                currentPower += b.value;
            });
        }

        // 3. 全フィールドを走査して「always」トリガーのバフを適用
        const players = ["player", "opponent"];
        players.forEach(pSide => {
            const p = GAME_STATE[pSide];
            // モンスターゾーンと魔術ゾーンの両方をチェック
            const allFields = [...p.field.monsters, ...p.field.magics];

            allFields.forEach(source => {
                if (!source || !source.logic) return;

                source.logic.forEach(action => {
                    // バフ系の永続効果 (always) かチェック
                    if (action.trigger === "always" && (action.type === "buff" || action.type === "global_buff")) {

                        // 発動条件 (is_opponent_turn等) のチェック
                        if (!this._checkCondition(action, pSide, source)) return;

                        // 効果の対象サイド (targetSide: "opponent" なら発動者の逆側)
                        const effectTargetSide = (action.targetSide === "opponent")
                            ? (pSide === "player" ? "opponent" : "player")
                            : pSide;

                        if (effectTargetSide !== side) return;

                        // フィルタ (属性・カテゴリ等) の一致確認
                        if (action.type === "global_buff" && !this._checkFilter(card, action.filter || {})) return;
                        if (action.type === "buff" && action.target === "self" && source !== card) return;

                        currentPower += (action.value || 0);
                    }
                });
            });
        });

        // パワーは 0 未満にならない (ルール 3 準拠)
        return Math.max(0, currentPower);
    },

    /** 条件チェックロジック */
    _checkCondition: function(action, side, sourceCard) {
        if (!action.condition) return true;

        switch (action.condition) {
            case "is_opponent_turn":
                // 現在のターンプレイヤーが効果の持ち主と異なるか
                return GAME_STATE.turnPlayer !== side;
            case "has_category_on_field":
                // 特定カテゴリが自分フィールドに存在するか
                const p = GAME_STATE[side];
                return p.field.monsters.some(m => m && m.categories.includes(action.category));
            default:
                return true;
        }
    },

    /** 戦闘破壊耐性の判定 */
    checkBattleProtection: function(card, side, slotIdx) {
        const players = ["player", "opponent"];
        let isProtected = false;

        players.forEach(pSide => {
            const p = GAME_STATE[pSide];
            const allFields = [...p.field.monsters, ...p.field.magics];

            allFields.forEach(source => {
                if (!source || !source.logic) return;
                source.logic.forEach(action => {
                    // 耐性系効果(always)かチェック
                    if (action.trigger === "always" && (action.type === "battle_protection" || action.type === "global_protection")) {

                        const effectTargetSide = (action.targetSide === "opponent")
                            ? (pSide === "player" ? "opponent" : "player")
                            : pSide;

                        if (effectTargetSide !== side) return;

                        // 個別耐性(self)か全体耐性(filter一致)か
                        const isSelf = (action.target === "self" && source === card);
                        const isGlobalMatch = (action.type === "global_protection" && this._checkFilter(card, action.filter || {}));

                        if (isSelf || isGlobalMatch) {
                            // 1ターンに1度の制限チェック
                            if (action.countLimit === "once_per_turn") {
                                // 修正: 耐性付与元(source)ではなく、守られる側(card)にフラグを持たせる
                                card._usedProtections = card._usedProtections || {};
                                const protectionKey = `prot_${source.id}_${action.type}`; // sourceIDと効果タイプで識別

                                if (card._usedProtections[protectionKey] === GAME_STATE.turnCount) return;

                                // 適用時にフラグを立てる
                                card._usedProtections[protectionKey] = GAME_STATE.turnCount;
                            }
                            isProtected = true;
                        }
                    }
                });
            });
        });
        return isProtected;
    },

    /** 最終ダメージの計算 (軽減反映) */
    calculateFinalDamage: function(side, originalDamage) {
        let reduction = 0;
        const players = ["player", "opponent"];

        players.forEach(pSide => {
            const p = GAME_STATE[pSide];
            const allFields = [...p.field.monsters, ...p.field.magics];

            allFields.forEach(source => {
                if (!source || !source.logic) return;
                source.logic.forEach(action => {
                    if (action.trigger === "always" && action.type === "damage_reduction") {
                        const effectTargetSide = (action.targetSide === "opponent")
                            ? (pSide === "player" ? "opponent" : "player")
                            : pSide;

                        if (effectTargetSide !== side) return;

                        // 発動条件 (has_category_on_field等) のチェック
                        if (!this._checkCondition(action, pSide, source)) return;

                        reduction += (action.value || 0);
                    }
                });
            });
        });

        return Math.max(0, originalDamage - reduction);
    },

    /**
     * カードが現在発動可能（有効な対象がある）か判定する
     */
    isEffectActivatable: function(cardData, side, trigger = "on_activate") {
        if (!cardData.logic || cardData.logic.length === 0) return true;

        const actions = cardData.logic.filter(a => a.trigger === trigger);
        if (actions.length === 0) return true;

        return actions.some(action => {
            if (action.type === "mill" || action.type === "draw_and_discard") return true;
            if (cardData.id === "s013") return true;

            // s014: 冥界からの迎え (自分と相手の場にモンスターが必要)
            if (cardData.id === "s014") {
                const p = GAME_STATE[side];
                const opp = GAME_STATE[side === "player" ? "opponent" : "player"];
                const hasSelf = p.field.monsters.some(m => m !== null);
                const hasOpp = opp.field.monsters.some(m => m !== null);
                return hasSelf && hasOpp;
            }

            const targetSide = (action.targetSide === "opponent") ? (side === "player" ? "opponent" : "player") : side;
            const p = GAME_STATE[targetSide];

            switch (action.type) {
                case "buff":
                    return p.field.monsters.some((m, i) => {
                        if (!m || !this._checkFilter(m, action.filter || {})) return false;
                        // デバフの場合、既にパワー0なら発動不可
                        if (action.value < 0 && this.getCurrentPower(m, targetSide, i) <= 0) return false;
                        return true;
                    });
                case "destroy":
                    return p.field.monsters.some((m, i) => {
                        if (!m || !this._checkFilter(m, action.filter || {})) return false;
                        // 条件(is_weakened等)のチェック
                        if (action.condition === "is_weakened" && !this.isWeakened(m)) return false;
                        return true;
                    });
                case "apply_combat_effect":
                    return p.field.monsters.some(m => m !== null && this._checkFilter(m, action.filter || {}));
                case "special_summon":
                    // フィールドに空きがない場合は発動不可
                    if (!p.field.monsters.includes(null)) return false;
                    if (action.source === "deck") return p.deck.some(c => this._checkFilter(c, action.filter || {}));
                    if (action.source === "trash") return p.trash.some(c => this._checkFilter(c, action.filter || {}));
                    if (action.source === "choice_deck_or_trash") {
                        return p.deck.some(c => this._checkFilter(c, action.filter || {})) || p.trash.some(c => this._checkFilter(c, action.filter || {}));
                    }
                    return true;
                case "search":
                case "salvage":
                    const pool = (action.type === "search") ? p.deck : p.trash;
                    return pool.some(c => this._checkFilter(c, action.filter || {}));
                case "global_buff":
                    return p.field.monsters.some(m => m !== null);
                default:
                    return true;
            }
        });
    },

    /** 全フィールドのバフ持続時間を更新 */
    cleanAllBuffs: function() {
        ["player", "opponent"].forEach(side => {
            // 魔術ゾーンも対象に含める。
            // 含めないと永続魔術の countLimit がリセットされず、
            // 「1ターンに1度」が「1ゲームに1度」になってしまう。
            const cards = [
                ...GAME_STATE[side].field.monsters,
                ...GAME_STATE[side].field.magics
            ];

            cards.forEach(m => {
                if (!m) return;

                // バフの掃除
                if (m._tempBuffs) {
                    m._tempBuffs = m._tempBuffs.filter(b => {
                        if (b.duration === "permanent") return true;
                        b.duration--;
                        return b.duration > 0;
                    });
                }
                // 戦闘予約エフェクトの掃除
                if (m._combatEffects) {
                    m._combatEffects = m._combatEffects.filter(e => {
                        e.duration--;
                        return e.duration > 0;
                    });
                }

                // 1ターンに1度の制限リセット (ターン開始時にクリーニング)
                if (m._usedLimits) m._usedLimits = {};
                if (m._usedProtections) m._usedProtections = {};
                delete m._usedTurn;
            });
        });
    },

    /** 広域バフ/デバフの適用 (ボルフ、シルヴァス等) */
    async applyGlobalBuff(action, side, sourceCard) {
        const targets = await this._acquireTargets({ ...action, targetSelect: "all" }, side, sourceCard);
        const value = action.value || 0;
        let durationCount = action.duration === "until_end_turn" ? 1 : (action.duration === "until_opponent_end" ? 2 : "permanent");

        targets.forEach(t => {
            t.card._tempBuffs = t.card._tempBuffs || [];
            t.card._tempBuffs.push({
                value: value,
                duration: durationCount,
                turn: GAME_STATE.turnCount
            });
        });
        console.log(`Global Buff applied: ${value} to ${targets.length} targets.`);
    },

    /** 戦闘予約効果の付与 (海の突撃等) */
    async applyCombatEffect(action, side, sourceCard) {
        const targets = await this._acquireTargets(action, side, sourceCard);
        targets.forEach(t => {
            t.card._combatEffects = t.card._combatEffects || [];
            t.card._combatEffects.push({
                type: action.effect,
                duration: action.duration === "until_end_turn" ? 1 : 2
            });
        });
    }
};
