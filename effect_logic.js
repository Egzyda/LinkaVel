/**
 * LinkaVel Card Game - Effect Logic Manager
 * 繧ｫ繝ｼ繝峨・蜉ｹ譫懶ｼ育音谿雁小蝟壹√ラ繝ｭ繝ｼ縲√ヰ繝慕ｭ会ｼ峨ｒ蟆る摩縺ｫ謇ｱ縺・ｱ守畑繧ｨ繝ｳ繧ｸ繝ｳ
 * Ver 1.3 (Common Logic Spec Compliant)
 */

const EffectLogic = {
    // 蜉ｹ譫懊・騾｣骼悶′蠕ｪ迺ｰ縺励◆蝣ｴ蜷医↓蛯吶∴縺滓ｷｱ縺募宛髯撰ｼ育┌髯舌Ν繝ｼ繝鈴亟豁｢・・
    MAX_RESOLVE_DEPTH: 12,
    _resolveDepth: 0,
    // 繝励Ξ繧､繝､繝ｼ縺悟ｯｾ雎｡驕ｸ謚槭ｒ繧ｭ繝｣繝ｳ繧ｻ繝ｫ縺励◆蝣ｴ蜷医↓遶九▽繝輔Λ繧ｰ縲・
    // 縲瑚・蛻・→逶ｸ謇九ｒ1菴薙★縺､遐ｴ螢翫阪・繧医≧縺ｪ蜉ｹ譫懊〒縲∫援譁ｹ縺縺大ｮ溯｡後＆繧後ｋ縺ｮ繧帝亟縺舌・
    _selectionCancelled: false,

    /**
     * 繧ｫ繝ｼ繝峨′謖√▽蜉ｹ譫憺・蛻励ｒ鬆・分縺ｫ隗｣豎ｺ縺吶ｋ (Ver 1.3貅匁侠)
     * @param {Object} cardData - 繧ｫ繝ｼ繝峨ョ繝ｼ繧ｿ
     * @param {string} side - 逋ｺ蜍募・ ("player" | "opponent")
     * @param {string} triggerFilter - 迚ｹ螳壹・繝医Μ繧ｬ繝ｼ縺ｮ縺ｿ螳溯｡後☆繧句ｴ蜷医↓謖・ｮ・(null縺ｪ繧牙・螳溯｡・
     */
    async resolveEffects(cardData, side, triggerFilter = null) {
        if (!cardData || !cardData.logic || cardData.logic.length === 0) return;
        if (GAME_STATE.isGameOver) return;

        if (this._resolveDepth >= this.MAX_RESOLVE_DEPTH) {
            console.warn(`EffectLogic: resolve depth limit reached at ${cardData.name}. Aborting chain.`);
            return;
        }

        console.log(`EffectLogic: Resolving [${triggerFilter || "All"}] logic for ${cardData.name}`);

        // 繝輔ぅ繝ｼ繝ｫ繝我ｸ翫・繧ｫ繝ｼ繝峨・蜉ｹ譫懊′蜍輔￥譎ゅ・縲√←縺ｮ繧ｫ繝ｼ繝峨′逋ｺ蜍輔＠縺溘・縺九ｒ隕九○繧九・
        // 繝ｻ蟶ｸ譎ょ柑譫・always)縺ｯ貍泌・縺励↑縺・ｼ亥愛螳壹・縺溘・縺ｫ蜈峨▲縺ｦ縺励∪縺・ｼ・
        // 繝ｻ蟇ｾ雎｡縺後↑縺上※遨ｺ謖ｯ繧翫☆繧句柑譫懊ｂ貍泌・縺励↑縺・ｼ育┌鬧・↑蠕・■譎る俣縺ｫ縺ｪ繧具ｼ・
        // 繝ｻ縲・繧ｿ繝ｼ繝ｳ縺ｫ1蠎ｦ縲阪ｒ菴ｿ縺・・縺｣縺溷柑譫懊ｂ貍泌・縺励↑縺・
        //   ・域擅莉ｶ繧呈ｺ縺溘☆縺溘・縺ｫ蜈峨ｋ縺悟ｮ滄圀縺ｫ縺ｯ菴輔ｂ襍ｷ縺阪↑縺・√→縺・≧迥ｶ諷九ｒ髦ｲ縺撰ｼ・
        if (typeof showEffectActivation === "function"
            && triggerFilter && triggerFilter !== "always"
            && this.hasUsableAction(cardData, triggerFilter)
            && this.isEffectActivatable(cardData, side, triggerFilter)) {
            await showEffectActivation(cardData, side);
        }

        this._resolveDepth++;

        try {
            for (let i = 0; i < cardData.logic.length; i++) {
                const action = cardData.logic[i];
                if (triggerFilter && action.trigger !== triggerFilter) continue;
                if (GAME_STATE.isGameOver) break;

                // 隱倡匱譚｡莉ｶ・医が繝悶ず繧ｧ繧ｯ繝亥ｽ｢蠑擾ｼ峨ｒ貅縺溘＆縺ｪ縺・い繧ｯ繧ｷ繝ｧ繝ｳ縺ｯ螳溯｡後＠縺ｪ縺・
                if (action.condition && typeof action.condition === "object"
                    && !this._checkEventCondition(action, this._eventContext)) {
                    continue;
                }

                // 1繧ｿ繝ｼ繝ｳ縺ｫ1蠎ｦ縺ｮ蛻ｶ髯舌メ繧ｧ繝・け (繧､繝ｳ繝・ャ繧ｯ繧ｹ縺ｧ邂｡逅・
                if (action.countLimit === "once_per_turn") {
                    cardData._usedLimits = cardData._usedLimits || {};
                    const limitKey = `action_${i}`;
                    // 迴ｾ蝨ｨ縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺吶〒縺ｫ菴ｿ逕ｨ貂医∩縺ｪ繧峨せ繧ｭ繝・・
                    if (cardData._usedLimits[limitKey] === GAME_STATE.turnCount) {
                        console.log(`Effect Limit Reached: ${cardData.name} (Action ${i})`);
                        continue;
                    }
                    // 菴ｿ逕ｨ貂医∩繝輔Λ繧ｰ繧堤ｫ九※繧・
                    cardData._usedLimits[limitKey] = GAME_STATE.turnCount;
                }

                // 繧ｳ繧ｹ繝茨ｼ域焔譛ｭ繧呈昏縺ｦ繧具ｼ上ヨ繝ｩ繝・す繝･繧帝勁螟悶☆繧狗ｭ会ｼ峨ｒ蜈医↓謾ｯ謇輔≧縲・
                // 謇輔∴縺ｪ縺代ｌ縺ｰ縺昴・繧｢繧ｯ繧ｷ繝ｧ繝ｳ縺ｯ逋ｺ蜍輔＠縺ｪ縺・・
                if (action.cost && !(await this.payActionCost(action, side))) {
                    console.log(`Cost not payable: ${cardData.name} (Action ${i})`);
                    continue;
                }

                await this.executeAction(action, side, cardData);

                // 蟇ｾ雎｡驕ｸ謚槭′繧ｭ繝｣繝ｳ繧ｻ繝ｫ縺輔ｌ縺溘ｉ縲∽ｻ･髯阪・繧｢繧ｯ繧ｷ繝ｧ繝ｳ縺ｯ螳溯｡後＠縺ｪ縺・
                if (this._selectionCancelled) {
                    this._selectionCancelled = false;
                    console.log(`EffectLogic: ${cardData.name} 縺ｮ蜉ｹ譫懊・蟇ｾ雎｡驕ｸ謚槭・荳ｭ譁ｭ縺ｫ繧医ｊ邨ゆｺ・);
                    break;
                }
            }
        } finally {
            this._resolveDepth--;
        }
    },

    // ==========================================
    // 鄂鬲碑｡難ｼ医そ繝・ヨ 竊・譚｡莉ｶ謌千ｫ九〒蠑ｷ蛻ｶ逋ｺ蜍包ｼ・
    // ==========================================

    /**
     * 鄂縺ｮ繝医Μ繧ｬ繝ｼ縺ｨ縲瑚ｪｰ縺梧戟縺､鄂縺悟渚蠢懊☆繧九°縲阪・蟇ｾ蠢懊・
     * "opponent" = 繧､繝吶Φ繝医ｒ襍ｷ縺薙＠縺溷・縺ｮ逶ｸ謇九′謖√▽鄂
     * "self"     = 繧､繝吶Φ繝医ｒ襍ｷ縺薙＠縺溷・閾ｪ霄ｫ縺梧戟縺､鄂
     */
    TRAP_TRIGGERS: {
        on_opponent_summon: "opponent",
        on_opponent_attack: "opponent",
        on_own_monster_destroyed: "self"
    },

    // 隱倡匱蜈・・諠・ｱ・域判謦・＠縺ｦ縺阪◆繝｢繝ｳ繧ｹ繧ｿ繝ｼ遲会ｼ峨りｧ｣豎ｺ荳ｭ縺ｮ縺ｿ譛牙柑縲・
    _eventContext: null,

    /**
     * 謖・ｮ壹ヨ繝ｪ繧ｬ繝ｼ縺ｮ鄂繧呈爾縺励∵擅莉ｶ繧呈ｺ縺溘☆繧ゅ・繧帝・↓蠑ｷ蛻ｶ逋ｺ蜍輔☆繧・
     * @param {string} trigger
     * @param {string} eventSide - 繧､繝吶Φ繝医ｒ襍ｷ縺薙＠縺溷・
     * @param {Object} context   - 隱倡匱蜈・・諠・ｱ
     */
    async fireTrapTrigger(trigger, eventSide, context) {
        if (GAME_STATE.isGameOver) return;

        const relation = this.TRAP_TRIGGERS[trigger];
        if (!relation) return;

        const watcherSide = (relation === "opponent")
            ? (eventSide === "player" ? "opponent" : "player")
            : eventSide;

        // 隗｣豎ｺ荳ｭ縺ｫ鬲碑｡薙だ繝ｼ繝ｳ縺悟､牙虚縺吶ｋ縺溘ａ縲∝ｯｾ雎｡繧貞・縺ｫ遒ｺ螳壹＆縺帙ｋ
        const pending = GAME_STATE[watcherSide].field.magics.filter(card => {
            if (!card || card.subType !== "trap" || !card._isSet) return false;
            // 莨上○縺溘ち繝ｼ繝ｳ縺ｯ逋ｺ蜍輔〒縺阪↑縺・
            if (card._setTurnSerial === GAME_STATE.turnSerial) return false;

            const actions = (card.logic || []).filter(a => a.trigger === trigger);
            if (actions.length === 0) return false;
            return actions.some(a => this._checkEventCondition(a, context));
        });

        for (const card of pending) {
            if (GAME_STATE.isGameOver) return;
            const slotIdx = GAME_STATE[watcherSide].field.magics.indexOf(card);
            if (slotIdx === -1) continue; // 隗｣豎ｺ荳ｭ縺ｫ蝣ｴ繧帝屬繧後◆
            await this.activateTrap(card, watcherSide, slotIdx, trigger, context);
        }
    },

    /** 鄂繧定｡ｨ蜷代″縺ｫ縺励※隗｣豎ｺ縺励√ヨ繝ｩ繝・す繝･縺ｸ騾√ｋ */
    async activateTrap(card, side, slotIdx, trigger, context) {
        console.log(`Trap Activated: ${card.name} (${side})`);

        card._isSet = false;
        if (typeof renderFieldCard === "function") renderFieldCard(side, "magic", slotIdx, card);
        if (typeof showTrapActivation === "function") showTrapActivation(side, slotIdx, card);
        await new Promise(r => setTimeout(r, 700)); // 逋ｺ蜍輔ｒ隕九○繧矩俣

        const previous = this._eventContext;
        this._eventContext = context;
        try {
            await this.resolveEffects(card, side, trigger);
        } finally {
            this._eventContext = previous;
        }

        // 鄂縺ｯ隗｣豎ｺ蠕後ヨ繝ｩ繝・す繝･縺ｸ・磯壼ｸｸ鬲碑｡薙→蜷後§謇ｱ縺・ｼ・
        const current = GAME_STATE[side].field.magics.indexOf(card);
        if (current !== -1) {
            GAME_STATE[side].field.magics[current] = null;
            sendCardToTrash(side, card);
            if (typeof renderFieldCard === "function") renderFieldCard(side, "magic", current, null);
        }
        if (typeof updateUI === "function") updateUI();
    },

    /** 隱倡匱譚｡莉ｶ・医が繝悶ず繧ｧ繧ｯ繝亥ｽ｢蠑擾ｼ峨・蛻､螳・*/
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
            // 縲悟・縲・・繝代Ρ繝ｼ繧医ｊN繝繧ｦ繝ｳ縲・ 蜊ｰ蛻ｷ蛟､縺ｨ迴ｾ蝨ｨ縺ｮ螳滓焚蛟､・医が繝ｼ繝ｩ霎ｼ縺ｿ・峨・蟾ｮ
            const downBy = this.getPowerDrop(ctx.attacker, ctx.attackerSide, ctx.attackerSlot);
            if (downBy < cond.attackerWeakenedBy) return false;
        }
        return true;
    },

    /** 繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｮ蜿ｬ蝟壹・迚ｹ谿雁小蝟壹ｒ鄂縺ｫ騾夂衍縺吶ｋ */
    async notifySummon(side, summonedCards) {
        const cards = (summonedCards || []).filter(Boolean);
        if (cards.length === 0) return;
        await this.fireTrapTrigger("on_opponent_summon", side, {
            summoned: cards,
            summonedSide: side
        });
    },

    /**
     * 謾ｻ謦・ｮ｣險繧堤ｽ縺ｫ騾夂衍縺吶ｋ
     * @returns {boolean} 謾ｻ謦・ｒ荳ｭ豁｢縺吶∋縺阪↑繧・true・域判謦・Δ繝ｳ繧ｹ繧ｿ繝ｼ繧・ｯｾ雎｡縺悟､ｱ繧上ｌ縺溷ｴ蜷茨ｼ・
     */
    async notifyAttackDeclared(attackerSide, attacker, attackerSlot, defender, defenderSlot) {
        const defenderSide = (attackerSide === "player") ? "opponent" : "player";

        await this.fireTrapTrigger("on_opponent_attack", attackerSide, {
            attacker, attackerSide, attackerSlot,
            defender, defenderSide, defenderSlot
        });

        if (GAME_STATE.isGameOver) return true;
        // 鄂縺ｧ謾ｻ謦・Δ繝ｳ繧ｹ繧ｿ繝ｼ縺碁勁蜴ｻ縺輔ｌ縺溷ｴ蜷医・謌ｦ髣倥◎縺ｮ繧ゅ・縺檎匱逕溘＠縺ｪ縺・
        if (GAME_STATE[attackerSide].field.monsters[attackerSlot] !== attacker) return true;
        if (defender && GAME_STATE[defenderSide].field.monsters[defenderSlot] !== defender) return true;
        return false;
    },

    /** 繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺檎ｴ螢翫＆繧後ヨ繝ｩ繝・す繝･縺ｸ騾√ｉ繧後◆縺薙→繧堤ｽ縺ｫ騾夂衍縺吶ｋ */
    async notifyMonsterDestroyed(side, card) {
        if (!card) return;
        await this.fireTrapTrigger("on_own_monster_destroyed", side, {
            destroyed: card,
            destroyedSide: side
        });
    },

    /**
     * 襍ｷ蜍募柑譫懊′縲後％縺ｮ繧ｿ繝ｼ繝ｳ菴ｿ逕ｨ貂医∩縲阪°縺ｩ縺・°・・I/CPU縺ｮ陦ｨ遉ｺ蛻､螳夂畑・・
     */
    isIgnitionUsed(cardData) {
        return this.isLimitUsed(cardData, "ignition");
    },

    /**
     * 縲・繧ｿ繝ｼ繝ｳ縺ｫ1蠎ｦ縲阪・蜉ｹ譫懊ｒ縲√％縺ｮ繧ｿ繝ｼ繝ｳ縺吶〒縺ｫ菴ｿ縺・・縺｣縺ｦ縺・ｋ縺九・
     * trigger 繧堤怐逡･縺吶ｋ縺ｨ縲√◎縺ｮ繧ｫ繝ｼ繝峨・縺ｩ繧後°縺ｮ蝗樊焚蛻ｶ髯仙柑譫懊′菴ｿ逕ｨ貂医∩縺九ｒ隕九ｋ縲・
     */
    isLimitUsed(cardData, trigger = null) {
        if (!cardData || !cardData.logic || !cardData._usedLimits) return false;
        const limited = cardData.logic
            .map((action, i) => ({ action, i }))
            .filter(({ action }) =>
                action.countLimit === "once_per_turn" &&
                (trigger === null || action.trigger === trigger));
        if (limited.length === 0) return false;
        // 蝗樊焚蛻ｶ髯舌・縺ゅｋ蜉ｹ譫懊′縺吶∋縺ｦ菴ｿ逕ｨ貂医∩縺ｪ繧峨御ｽｿ逕ｨ貂医∩縲阪→縺ｿ縺ｪ縺・
        return limited.every(({ i }) => cardData._usedLimits[`action_${i}`] === GAME_STATE.turnCount);
    },

    /**
     * 縺薙・繝医Μ繧ｬ繝ｼ縺ｧ螳滄圀縺ｫ蜍輔￥菴吝慍縺後≠繧九°縲・
     * 蝗樊焚蛻ｶ髯舌ｒ菴ｿ縺・・縺｣縺溷柑譫懊＠縺狗┌縺・ｴ蜷医・縲∵ｼ泌・繧ょ・縺輔↑縺・・
     */
    hasUsableAction(cardData, trigger) {
        if (!cardData || !cardData.logic) return false;
        return cardData.logic.some((action, i) => {
            if (action.trigger !== trigger) return false;
            if (action.countLimit !== "once_per_turn") return true;
            const used = cardData._usedLimits
                && cardData._usedLimits[`action_${i}`] === GAME_STATE.turnCount;
            return !used;
        });
    },

    /**
     * 繧ｫ繝ｼ繝峨′繝医Λ繝・す繝･縺ｫ騾√ｉ繧後◆莠九↓繧医ｋ隱倡匱繧偵∪縺ｨ繧√※蜃ｦ逅・☆繧九・
     * - 騾√ｉ繧後◆繧ｫ繝ｼ繝芽・霄ｫ縺ｮ on_sent_to_trash
     * - 繝輔ぅ繝ｼ繝ｫ繝我ｸ翫・莉悶き繝ｼ繝峨・ on_other_sent_to_trash・医ヵ繧｣繝ｫ繧ｿ縺ｨ謖√■荳ｻ繧貞愛螳壹☆繧具ｼ・
     *
     * 髯､螟・banish)縺ｯ縺薙・髢｢謨ｰ繧帝壹ｉ縺ｪ縺・◆繧√∝｢灘慍隱倡匱縺ｯ荳蛻・匱逕溘＠縺ｪ縺・・
     * @param {Object} card - 繝医Λ繝・す繝･縺ｫ騾√ｉ繧後◆繧ｫ繝ｼ繝・
     * @param {string} side - 縺昴・繧ｫ繝ｼ繝峨・謖√■荳ｻ ("player" | "opponent")
     */
    async notifyCardSentToTrash(card, side, location = "unknown") {
        if (!card || GAME_STATE.isGameOver) return;

        // 1. 莉悶き繝ｼ繝峨・隱倡匱・医い繧ｯ繧｢繝ｻ繧ｵ繝ｫ繝吶・繧ｸ s006 遲会ｼ・
        for (const watcherSide of ["player", "opponent"]) {
            const p = GAME_STATE[watcherSide];
            const sources = [...p.field.monsters, ...p.field.magics];

            for (const source of sources) {
                if (!source || source === card || !source.logic) continue;

                let matchedTrigger = null;
                source.logic.forEach(action => {
                    if (action.trigger === "on_other_sent_to_trash" || action.trigger === "on_card_trashed") {
                        if (watcherSide === side && this._checkFilter(card, action.triggerFilter || action.filter || {})) {
                            matchedTrigger = action.trigger;
                        }
                    } else if (action.trigger === "on_deck_trashed" && location === "deck") {
                        if (watcherSide === side && this._checkFilter(card, action.triggerFilter || action.filter || {})) {
                            matchedTrigger = action.trigger;
                        }
                    }
                });

                if (matchedTrigger) {
                    await this.resolveEffects(source, watcherSide, matchedTrigger);
                }
            }
        }

        // 2. 騾√ｉ繧後◆繧ｫ繝ｼ繝芽・霄ｫ縺ｮ隱倡匱
        await this.resolveEffects(card, side, "on_sent_to_trash");
    },

    /**
     * 蜊倅ｸ縺ｮ繧｢繧ｯ繧ｷ繝ｧ繝ｳ蜻ｽ莉､繧貞ｮ溯｡後☆繧・(蜻ｽ莉､縺ｮ謖ｯ繧雁・縺・
     * @param {Object} action - logic蜀・・蜊倅ｸ繧ｪ繝悶ず繧ｧ繧ｯ繝・
     * @param {string} side - "player" | "opponent"
     * @param {Object} sourceCard - 蜉ｹ譫懊・逋ｺ逕滓ｺ・
     */
    async executeAction(action, side, sourceCard) {
        switch (action.type) {
            // applyHeal 縺ｯ蜀・Κ縺ｧ on_lp_gain 縺ｮ騾｣骼悶ｒ隗｣豎ｺ縺吶ｋ縺ｮ縺ｧ蠢・★蠕・▽縲・
            // await 縺励↑縺・→縲∝屓蠕ｩ縺ｫ蜿榊ｿ懊☆繧句柑譫懊′蠕檎ｶ壼・逅・→縺壹ｌ縺ｦ蜍輔￥縲・
            case "heal": await this.applyHeal(action, side); break;
            case "draw_card":
                if (typeof drawCard === "function") await drawCard(side, action.count || 1);
                break;
            case "mill": await this.applyMill(action, side); break;
            case "buff": await this.applyBuff(action, side, sourceCard); break;
            case "destroy": await this.applyDestroy(action, side); break;
            case "banish": await this.applyBanish(action, side, sourceCard); break;
            case "draw_and_discard": await this.applyDrawAndDiscard(action, side); break;
            case "special_summon": await this.applySpecialSummon(action, side); break;
            case "search": await this.applySearch(action, side); break;
            case "salvage": await this.applySalvage(action, side); break;
            case "global_buff": await this.applyGlobalBuff(action, side, sourceCard); break;
            case "bounce": await this.applyBounce(action, side, sourceCard); break;
            case "damage": this.applyDamage(action, side); break;
            case "destroy_magic": await this.applyDestroyMagic(action, side); break;
            case "apply_combat_effect": await this.applyCombatEffect(action, side, sourceCard); break;
            case "battle_protection":
            case "global_protection":
            case "damage_reduction":
            case "resist_magic":
                // 縺薙ｌ繧峨・蛻､螳壹ヵ繧ｧ繝ｼ繧ｺ縺ｧ蜿ら・縺輔ｌ繧九◆繧∝ｮ溯｡梧凾縺ｯ繝ｭ繧ｰ縺ｮ縺ｿ
                console.log(`Static Effect Active: ${action.type}`);
                break;
            default: console.log(`Effect Type [${action.type}] is not yet implemented.`); break;
        }
        if (typeof updateUI === "function") updateUI();
    },

    /** LP蝗槫ｾｩ蜃ｦ逅・*/
    applyHeal: async function(action, side) {
        const amount = action.value || 0;
        if (amount <= 0) return;

        const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
        p.lp += amount;
        console.log(`${side} healed ${amount} LP. Current LP: ${p.lp}`);

        if (typeof showDamageNumber === "function") showDamageNumber(side, amount, true);
        if (typeof updateUI === "function") updateUI();

        // 蜑ｲ繧願ｾｼ縺ｿ繝医Μ繧ｬ繝ｼ: on_lp_gain (閨也阜邇九Ξ繧ｪ繝九ム繧ｹ遲・
        // 蝗槫ｾｩ縺励◆繝励Ξ繧､繝､繝ｼ蛛ｴ縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｮ縺ｿ縺悟渚蠢懊☆繧・
        for (const m of GAME_STATE[side].field.monsters) {
            if (m) await this.resolveEffects(m, side, "on_lp_gain");
        }
    },

    /** 繝・ャ繧ｭ蛻・炎蜃ｦ逅・(Mill) */
    applyMill: async function(action, side) {
        const count = action.count || 0;
        const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
        let remaining = count;

        while (remaining > 0) {
            if (p.deck.length === 0) {
                // 蜉ｹ譫懷・逅・・騾比ｸｭ縺ｧ繧よ擅莉ｶ繧呈ｺ縺溘＠縺溽椪髢薙↓繝ｪ繝輔Ξ繝・す繝･縺吶ｋ (繝ｫ繝ｼ繝ｫ Ver.1.1)
                if (p.trash.length > 0 && p.refreshCount < 1) {
                    console.log(`${side} performs Deck Refresh during Milling!`);
                    p.deck = shuffleArray(p.trash.map(resetCardState));
                    p.trash = [];
                    p.refreshCount++;
                    // 繝ｪ繝輔Ξ繝・す繝･蠕後・霑ｽ蜉縺ｧ 1 譫壹ラ繝ｭ繝ｼ縺吶ｋ
                    await drawCard(side, 1);
                    updateUI();
                    // 縺薙・繝峨Ο繝ｼ縺ｧ蜀阪・繝・ャ繧ｭ縺檎ｩｺ縺ｫ縺ｪ繧九％縺ｨ縺後≠繧九・縺ｧ縲∝ｿ・★蛻､螳壹＠逶ｴ縺・
                    continue;
                } else {
                    break;
                }
            }

            const card = p.deck.pop();

            // 1譫壹★縺､繝・ャ繧ｭ竊偵ヨ繝ｩ繝・す繝･縺ｸ關ｽ縺ｨ縺励※隕九○繧九・
            // 縺ｾ縺ｨ繧√※豸医∴繧九→菴輔′襍ｷ縺阪◆縺ｮ縺句・縺九ｉ縺ｪ縺・◆繧√・
            if (typeof animateMillCard === "function") {
                await animateMillCard(card, side);
            }

            sendCardToTrash(side, card);
            if (typeof updateUI === "function") updateUI();
            await this.notifyCardSentToTrash(card, side, "deck");
            remaining--;
        }
        console.log(`${side} milled ${count} cards.`);
    },

    /** 繝代Ρ繝ｼ蠅玲ｸ帛・逅・(謇句虚驕ｸ謚槫ｯｾ蠢・ */
    async applyBuff(action, side, sourceCard) {
        const value = action.value || 0;
        const targets = await this._acquireTargets(action, side, sourceCard);

        targets.forEach(t => {
            t.card._tempBuffs = t.card._tempBuffs || [];
            // 謖∫ｶ壹ち繝ｼ繝ｳ縺ｮ謨ｰ蛟､蛹・
            let durationCount = action.duration;
            if (action.duration === "until_end_turn") durationCount = 1;
            if (action.duration === "until_opponent_end") durationCount = 2;

            t.card._tempBuffs.push({
                value: value,
                duration: durationCount || "permanent",
                turn: GAME_STATE.turnCount
            });
            console.log(`${t.card.name} received buff: ${value}`);
            if (value > 0) {
                this.notifyPowerUp(t.card, t.side);
            }
        });
    },

    /** 繝代Ρ繝ｼ繧｢繝・・繧帝夂衍縺吶ｋ */
    async notifyPowerUp(card, side) {
        if (!card || GAME_STATE.isGameOver) return;
        for (const watcherSide of ["player", "opponent"]) {
            const p = GAME_STATE[watcherSide];
            const sources = [...p.field.monsters, ...p.field.magics];
            for (const source of sources) {
                if (!source || !source.logic) continue;
                let matchedTrigger = null;
                source.logic.forEach(action => {
                    if (action.trigger === "on_power_up") {
                        if (watcherSide === side && this._checkFilter(card, action.filter || {})) {
                            matchedTrigger = action.trigger;
                        }
                    }
                });
                if (matchedTrigger) {
                    await this.resolveEffects(source, watcherSide, matchedTrigger);
                }
            }
        }
    },

    /** 遐ｴ螢雁・逅・・螳溯｣・*/
    async applyDestroy(action, side) {
        const targets = await this._acquireTargets(action, side);
        for (const t of targets) {
            if (typeof destroyMonster === "function") {
                await destroyMonster(t.side, t.slotIdx);
            }
        }
    },

    /** 髯､螟門・逅・・螳溯｣・*/
    async applyBanish(action, side, sourceCard) {
        const targets = await this._acquireTargets(action, side, sourceCard);
        for (const t of targets) {
            const p = GAME_STATE[t.side];
            const card = p.field.monsters[t.slotIdx];
            if (card) {
                // UI縺九ｉ蜑企勁
                const prefix = (t.side === "player") ? "ply" : "opt";
                const el = document.getElementById(`${prefix}-monster-${t.slotIdx}`);
                if (el) el.innerHTML = "";
                
                if (typeof showToastMessage === "function") showToastMessage(`${card.name} 縺碁勁螟悶＆繧後◆`, t.side);
                p.field.monsters[t.slotIdx] = null;
                if (typeof banishCard === "function") {
                    banishCard(t.side, card);
                }
                if (typeof updateUI === "function") updateUI();
            }
        }
    },

    /** LP繝繝｡繝ｼ繧ｸ繧剃ｸ弱∴繧・*/
    applyDamage(action, side) {
        const targetSide = (action.targetSide === "opponent")
            ? (side === "player" ? "opponent" : "player")
            : side;
        const amount = action.value || 0;
        if (amount <= 0) return;

        // 蜉ｹ譫懊ム繝｡繝ｼ繧ｸ縺ｪ縺ｮ縺ｧ謌ｦ髣倥ム繝｡繝ｼ繧ｸ霆ｽ貂帙・騾壹＆縺壹√◎縺ｮ縺ｾ縺ｾ荳弱∴繧・
        const p = GAME_STATE[targetSide];
        p.lp = Math.max(0, p.lp - amount);
        console.log(`${targetSide} took ${amount} effect damage. LP: ${p.lp}`);

        if (typeof showDamageNumber === "function") showDamageNumber(targetSide, amount);
        if (typeof checkGameEnd === "function") checkGameEnd();
    },

    /** 鬲碑｡薙だ繝ｼ繝ｳ縺ｮ繧ｫ繝ｼ繝峨ｒ遐ｴ螢翫☆繧具ｼ井ｼ上○繧ｫ繝ｼ繝峨ｂ蟇ｾ雎｡・・*/
    async applyDestroyMagic(action, side) {
        const targetSide = (action.targetSide === "opponent")
            ? (side === "player" ? "opponent" : "player")
            : side;
        const p = GAME_STATE[targetSide];
        const count = action.count || 1;
        const filter = action.filter || {};

        let candidates = [];
        p.field.magics.forEach((m, i) => {
            if (m && this._checkFilter(m, filter)) candidates.push(i);
        });
        if (candidates.length === 0) return;

        const chosen = [];
        for (let i = 0; i < count; i++) {
            if (candidates.length === 0) break;

            if (action.targetSelect === "manual" && (side === "player" || GAME_STATE.isOnlineMatch)) {
                const slot = await selectTargetUI(targetSide, "magic", candidates,
                    `遐ｴ螢翫☆繧・{targetSide === side ? "閾ｪ蛻・ : "逶ｸ謇・}縺ｮ鬲碑｡薙ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞`);
                if (slot === null) { this._selectionCancelled = true; break; }
                chosen.push(slot);
                candidates = candidates.filter(c => c !== slot);
            } else {
                const pick = candidates[Math.floor(GameRandom() * candidates.length)];
                chosen.push(pick);
                candidates = candidates.filter(c => c !== pick);
            }
        }

        for (const slot of chosen) {
            const card = p.field.magics[slot];
            if (!card) continue;
            p.field.magics[slot] = null;
            sendCardToTrash(targetSide, card);
            if (typeof renderFieldCard === "function") renderFieldCard(targetSide, "magic", slot, null);
            console.log(`${card.name} (magic) was destroyed.`);
            await this.notifyCardSentToTrash(card, targetSide);
        }
        if (typeof updateUI === "function") updateUI();
    },

    /**
     * 繧｢繧ｯ繧ｷ繝ｧ繝ｳ縺ｫ莉倬囂縺吶ｋ繧ｳ繧ｹ繝医ｒ謾ｯ謇輔≧縲・
     * 謇輔∴縺ｪ縺・ｴ蜷医・ false 繧定ｿ斐＠縲√◎縺ｮ繧｢繧ｯ繧ｷ繝ｧ繝ｳ縺ｯ螳溯｡後＠縺ｪ縺・・
     */
    async payActionCost(action, side) {
        const cost = action.cost;
        if (!cost) return true;

        const p = GAME_STATE[side];

        // 謇区惆繧呈昏縺ｦ繧九さ繧ｹ繝・
        if (cost.discardHand) {
            const n = cost.discardHand;
            if (p.hand.length < n) return false;

            let discarded = [];
            if ((side === "player" || GAME_STATE.isOnlineMatch) && typeof selectHandCardsUI === "function") {
                const picks = await selectHandCardsUI(n);
                discarded = picks.sort((a, b) => b - a).map(i => p.hand.splice(i, 1)[0]);
            } else {
                const score = (c) => (typeof CpuLogic !== "undefined") ? CpuLogic.discardScore(c) : 0;
                for (let i = 0; i < n; i++) {
                    if (p.hand.length === 0) break;
                    p.hand.sort((a, b) => score(b) - score(a));
                    discarded.push(p.hand.shift());
                }
            }
            for (const card of discarded) {
                sendCardToTrash(side, card);
                await this.notifyCardSentToTrash(card, side);
            }
        }

        // 繝医Λ繝・す繝･繧帝勁螟悶☆繧九さ繧ｹ繝・
        if (cost.banishTrash) {
            const n = cost.banishTrash;
            if (p.trash.length < n) return false;
            for (let i = 0; i < n; i++) {
                const card = p.trash.pop();
                if (card) banishCard(side, card);
            }
        }

        // LP繧呈髪謇輔≧繧ｳ繧ｹ繝・
        if (cost.payLp) {
            if (p.lp <= cost.payLp) return false;
            p.lp -= cost.payLp;
            if (typeof showDamageNumber === "function") showDamageNumber(side, cost.payLp, false);
            console.log(`${side} paid ${cost.payLp} LP. Current LP: ${p.lp}`);
        }

        // 迚ｹ螳壹・繧ｫ繝ｼ繝峨ｒ繝医Λ繝・す繝･縺吶ｋ繧ｳ繧ｹ繝・
        if (cost.sendToTrash) {
            const n = cost.sendToTrash;
            let candidates = [];
            if (cost.location.includes("hand")) {
                p.hand.forEach((c, idx) => {
                    if (this._checkFilter(c, cost.filter)) candidates.push({ type: "hand", idx: idx, card: c });
                });
            }
            if (cost.location.includes("field")) {
                p.field.monsters.forEach((c, idx) => {
                    if (c && this._checkFilter(c, cost.filter)) candidates.push({ type: "monster", idx: idx, card: c });
                });
                p.field.magics.forEach((c, idx) => {
                    if (c && this._checkFilter(c, cost.filter)) candidates.push({ type: "magic", idx: idx, card: c });
                });
            }
            if (candidates.length < n) return false;
            
            // 閾ｪ蜍輔〒驕ｸ縺ｶ・井ｻ雁屓縺ｯ謇区惆蜆ｪ蜈医√◎繧後°繧峨Δ繝ｳ繧ｹ繧ｿ繝ｼ縲・ｭ碑｡薙・鬆・〒驕ｸ縺ｶ縺ｪ縺ｩ邁｡譏薙Ο繧ｸ繝・け・・
            for (let i = 0; i < n; i++) {
                const target = candidates[i];
                if (target.type === "hand") {
                    const c = p.hand.splice(target.idx, 1)[0];
                    sendCardToTrash(side, c);
                    await this.notifyCardSentToTrash(c, side);
                } else if (target.type === "monster") {
                    const c = p.field.monsters[target.idx];
                    p.field.monsters[target.idx] = null;
                    if (typeof renderFieldCard === "function") renderFieldCard(side, "monster", target.idx, null);
                    sendCardToTrash(side, c);
                    await this.notifyCardSentToTrash(c, side);
                } else if (target.type === "magic") {
                    const c = p.field.magics[target.idx];
                    p.field.magics[target.idx] = null;
                    if (typeof renderFieldCard === "function") renderFieldCard(side, "magic", target.idx, null);
                    sendCardToTrash(side, c);
                    await this.notifyCardSentToTrash(c, side);
                }
            }
        }

        if (typeof updateUI === "function") updateUI();
        return true;
    },

    /** 繧ｳ繧ｹ繝医ｒ謾ｯ謇輔∴繧九□縺代・雉・ｺ舌′縺ゅｋ縺具ｼ育匱蜍募庄閭ｽ蛻､螳夂畑繝ｻ螳滄圀縺ｫ縺ｯ謇輔ｏ縺ｪ縺・ｼ・*/
    canPayActionCost(action, side) {
        const cost = action.cost;
        if (!cost) return true;
        const p = GAME_STATE[side];
        if (cost.discardHand && p.hand.length < cost.discardHand) return false;
        if (cost.banishTrash && p.trash.length < cost.banishTrash) return false;
        if (cost.payLp && p.lp <= cost.payLp) return false;
        if (cost.sendToTrash) {
            let candidates = [];
            if (cost.location.includes("hand")) {
                candidates = candidates.concat(p.hand.filter(c => this._checkFilter(c, cost.filter)));
            }
            if (cost.location.includes("field")) {
                candidates = candidates.concat(p.field.monsters.filter(c => c && this._checkFilter(c, cost.filter)));
                candidates = candidates.concat(p.field.magics.filter(c => c && this._checkFilter(c, cost.filter)));
            }
            if (candidates.length < cost.sendToTrash) return false;
        }
        return true;
    },

    /** 蟇ｾ雎｡繧呈戟縺｡荳ｻ縺ｮ謇区惆縺ｸ謌ｻ縺呻ｼ医ヰ繧ｦ繝ｳ繧ｹ・・*/
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
     * 隱倡匱蜈・ｼ域判謦・Δ繝ｳ繧ｹ繧ｿ繝ｼ繝ｻ蜿ｬ蝟壹＆繧後◆繝｢繝ｳ繧ｹ繧ｿ繝ｼ遲会ｼ峨ｒ蟇ｾ雎｡縺ｨ縺励※蜿門ｾ励☆繧・
     */
    _acquireEventTargets(action, side) {
        const ctx = this._eventContext || {};
        const filter = action.filter || {};
        const results = [];

        const push = (card, cardSide) => {
            if (!card || !cardSide) return;
            // 蝣ｴ繧帝屬繧後※縺・ｋ蝣ｴ蜷医・蟇ｾ雎｡縺ｫ縺ｪ繧峨↑縺・
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

    /** 繧ｿ繝ｼ繧ｲ繝・ヨ蜿門ｾ礼畑蜀・Κ繝｡繧ｽ繝・ラ */
    async _acquireTargets(action, side, sourceCard) {
        const targetSide = (action.targetSide === "opponent") ? (side === "player" ? "opponent" : "player") : side;
        const select = action.targetSelect || "auto";

        // 隱倡匱蜈・ｒ蟇ｾ雎｡縺ｫ縺吶ｋ謖・ｮ夲ｼ育ｽ鬲碑｡薙↑縺ｩ・・
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
                .filter(t => {
                    if (t.card === null || !this._checkFilter(t.card, filter)) return false;
                    if (sourceCard && sourceCard.type === "magic" && targetSide !== side) {
                        if (this.checkMagicProtection(t.card, targetSide)) return false;
                    }
                    return true;
                });
        }

        let candidates = [];
        p.field.monsters.forEach((m, i) => {
            if (m && this._checkFilter(m, filter)) {
                // 譚｡莉ｶ蛻､螳・ is_weakened (譽ｮ逡後・諤偵ｊ遲・
                if (action.condition === "is_weakened" && !this.isWeakened(m, targetSide, i)) return;
                // 鬲碑｡楢先ｧ蛻､螳・
                if (sourceCard && sourceCard.type === "magic" && targetSide !== side) {
                    if (this.checkMagicProtection(m, targetSide)) return;
                }
                candidates.push({ card: m, side: targetSide, slotIdx: i });
            }
        });

        if (candidates.length === 0) return [];

        if (select === "manual") {
            if (side === "player" || GAME_STATE.isOnlineMatch) {
                const results = [];
                const prompt = this._targetPromptText(action, targetSide, side);

                for (let i = 0; i < count; i++) {
                    if (candidates.length === 0) break;

                    // 蜉ｹ譫懊・譚｡莉ｶ繧呈ｺ縺溘☆繧ｹ繝ｭ繝・ヨ縺縺代ｒ驕ｸ謚槫庄閭ｽ縺ｫ縺吶ｋ
                    // (繝輔ぅ繝ｫ繧ｿ螟悶・繧ｫ繝ｼ繝峨ｒ驕ｸ繧薙〒縲御ｽ輔ｂ襍ｷ縺阪↑縺・阪・繧帝亟縺・
                    const validSlots = candidates.map(c => c.slotIdx);
                    const label = (count > 1) ? `${prompt}・・{i + 1}/${count}・荏 : prompt;
                    const slot = await selectTargetUI(targetSide, "monster", validSlots, label);

                    if (slot === null) {
                        // 繧ｭ繝｣繝ｳ繧ｻ繝ｫ縺輔ｌ縺溷ｴ蜷医・蜉ｹ譫懷・菴薙ｒ荳ｭ譁ｭ縺輔○繧・
                        this._selectionCancelled = true;
                        break;
                    }
                    const cIdx = candidates.findIndex(c => c.slotIdx === slot);
                    if (cIdx !== -1) results.push(candidates.splice(cIdx, 1)[0]);
                }
                return results;
            } else {
                // CPU縺ｮ繧､繝ｳ繝・Μ繧ｸ繧ｧ繝ｳ繧ｹ驕ｸ謚・(s014遲峨・蟇ｾ蠢・
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
                            // 閾ｪ蛻・ｒ遐ｴ螢翫☆繧句ｴ蜷・ 蠅灘慍蜉ｹ譫懈戟縺｡縲√∪縺溘・蠑ｱ縺・Δ繝ｳ繧ｹ繧ｿ繝ｼ繧貞━蜈・
                            return (hasTrashEff(b.card) - hasTrashEff(a.card)) || (pA - pB);
                        }
                        // 逶ｸ謇九∈縺ｮ髯､蜴ｻ繝ｻ蠑ｱ菴灘喧縲∬・蛻・∈縺ｮ蠑ｷ蛹悶・縺・★繧後ｂ縲悟ｼｷ縺・Δ繝ｳ繧ｹ繧ｿ繝ｼ縲阪′譛蜆ｪ蜈・
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
                const rIdx = Math.floor(GameRandom() * candidates.length);
                results.push(candidates.splice(rIdx, 1)[0]);
            }
            return results;
        }
    },

    /** 繝峨Ο繝ｼ&繝・ぅ繧ｹ繧ｫ繝ｼ繝牙・逅・*/
    applyDrawAndDiscard: async function(action, side) {
        // 1. 繝峨Ο繝ｼ繧貞ｮ溯｡・
        if (typeof drawCard === "function") {
            await drawCard(side, action.drawCount || 0);
        }

        // 2. 謐ｨ縺ｦ繧句・逅・
        const p = GAME_STATE[side];
        const discardCount = Math.min(action.discardCount || 0, p.hand.length);

        if (discardCount <= 0) return;

        if ((side === "player" || GAME_STATE.isOnlineMatch) && action.discardType === "manual") {
            // 繝励Ξ繧､繝､繝ｼ縺瑚・蛻・〒驕ｸ縺ｶ
            const targets = await selectHandCardsUI(discardCount);
            // 繧､繝ｳ繝・ャ繧ｯ繧ｹ縺ｮ繧ｺ繝ｬ繧帝亟縺舌◆繧・剄鬆・〒蜑企勁
            const sortedTargets = targets.sort((a, b) => b - a);
            for (const idx of sortedTargets) {
                const card = p.hand.splice(idx, 1)[0];
                sendCardToTrash(side, card);
                await this.notifyCardSentToTrash(card, side);
            }
        } else {
            // CPU謌ｦ逡･逧・ョ繧｣繧ｹ繧ｫ繝ｼ繝・ 蠅灘慍蛻ｩ逕ｨ繝ｻ鬮廊v繧貞━蜈医＠縲´v1繧・ｱ守畑鬲碑｡薙ｒ谿九☆
            // (蜆ｪ蜈亥ｺｦ縺ｮ螳夂ｾｩ縺ｯ CpuLogic 蛛ｴ縺ｫ荳譛ｬ蛹悶＠縺ｦ縺・ｋ)
            const score = (c) => (typeof CpuLogic !== "undefined") ? CpuLogic.discardScore(c) : 0;

            for (let i = 0; i < discardCount; i++) {
                if (p.hand.length === 0) break;

                p.hand.sort((a, b) => score(b) - score(a)); // 繧ｹ繧ｳ繧｢鬮倥＞鬆・ｼ域昏縺ｦ縺溘＞鬆・ｼ・

                const card = p.hand.shift();
                sendCardToTrash(side, card);
                await this.notifyCardSentToTrash(card, side);
            }
        }
        console.log(`${side} discarded ${discardCount} cards.`);
        if (typeof updateUI === "function") updateUI();
    },

    /** 迚ｹ谿雁小蝟壼・逅・*/
    applySpecialSummon: async function(action, side) {
        const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
        const count = action.count || 1;
        const source = action.source; // deck / trash / choice_deck_or_trash / event
        const filter = action.filter || {};

        // source: "event" 縺ｯ縲瑚ｪ倡匱蜈・↓縺ｪ縺｣縺溘◎縺ｮ繧ｫ繝ｼ繝峨阪ｒ陂・函縺吶ｋ・域ｵｷ逡後・螂・ｷ｡ 遲会ｼ・
        if (source === "event") {
            const ctx = this._eventContext || {};
            const target = ctx.destroyed;
            if (!target) return;

            const ownerSide = ctx.destroyedSide || side;
            const trashIdx = GAME_STATE[ownerSide].trash.indexOf(target);
            if (trashIdx === -1) return; // 縺吶〒縺ｫ繝医Λ繝・す繝･縺ｫ縺ｪ縺・

            const slotIdx = p.field.monsters.indexOf(null);
            if (slotIdx === -1) return; // 遨ｺ縺肴棧縺後↑縺・

            GAME_STATE[ownerSide].trash.splice(trashIdx, 1);
            p.field.monsters[slotIdx] = target;
            if (typeof renderFieldCard === "function") renderFieldCard(side, "monster", slotIdx, target);
            if (typeof playSummonEffect === "function") await playSummonEffect(side, slotIdx);

            await this.resolveEffects(target, side, "on_summon");
            await this.notifySummon(side, [target]);
            return;
        }

        // 1. 蛟呵｣懊き繝ｼ繝峨・蜿朱寔
        let pool = [];
        if (source === "deck" || source === "choice_deck_or_trash") pool = pool.concat(p.deck);
        if (source === "trash" || source === "choice_deck_or_trash") pool = pool.concat(p.trash);

        // 2. 繝輔ぅ繝ｫ繧ｿ繝ｪ繝ｳ繧ｰ (繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｮ縺ｿ繝ｻ譚｡莉ｶ蜷郁・)
        let candidates = pool.filter(card => {
            if (card.type !== "monster") return false;
            if (filter.level && card.level !== filter.level) return false;
            if (filter.minLevel && card.level < filter.minLevel) return false;
            if (filter.maxLevel && card.level > filter.maxLevel) return false;
            if (filter.attribute && card.attribute !== filter.attribute) return false;
            if (filter.category && !card.categories.includes(filter.category)) return false;
            return true;
        });

        // 3. 蜿ｬ蝟壽棧縺ｮ遒ｺ隱・
        let emptySlots = [];
        p.field.monsters.forEach((m, i) => { if (m === null) emptySlots.push(i); });

        // 4. 螳溯｡・
        const summonedCards = [];
        const summonLimit = Math.min(count, emptySlots.length, candidates.length);
        for (let i = 0; i < summonLimit; i++) {
            const randIdx = Math.floor(GameRandom() * candidates.length);
            const targetCard = candidates.splice(randIdx, 1)[0];
            const slotIdx = emptySlots.shift();

            // 蜈・・蝣ｴ謇(deck/trash)縺九ｉ蜑企勁 (騾｣骼冶ｧ｣豎ｺ縺ｫ繧医ｋ遘ｻ蜍輔ｒ閠・・)
            const deckIdx = p.deck.indexOf(targetCard);
            const trashIdx = p.trash.indexOf(targetCard);

            if (deckIdx !== -1) {
                p.deck.splice(deckIdx, 1);
            } else if (trashIdx !== -1) {
                p.trash.splice(trashIdx, 1);
            } else {
                // 蛟呵｣懊↓縺ｯ縺ゅ▲縺溘′縲・｣骼悶＠縺溘ラ繝ｭ繝ｼ繧・挨縺ｮ迚ｹ谿雁小蝟壹〒譌｢縺ｫ遘ｻ蜍墓ｸ医∩縺ｮ蝣ｴ蜷医・繧ｹ繧ｭ繝・・
                console.log(`Summon Cancel: ${targetCard.name} is no longer in deck/trash.`);
                continue;
            }

            // 繝輔ぅ繝ｼ繝ｫ繝峨∈驟咲ｽｮ
            p.field.monsters[slotIdx] = targetCard;

            // UI謠冗判縺ｮ譖ｴ譁ｰ (main.js縺ｮ髢｢謨ｰ繧貞他縺ｳ蜃ｺ縺・
            if (typeof renderFieldCard === "function") {
                renderFieldCard(side, "monster", slotIdx, targetCard);
            }
            // 迚ｹ谿雁小蝟壹ｂ縲悟小蝟壽ｼ泌・ 竊・蜉ｹ譫懃匱蜍輔阪・鬆・↓隕九○繧・
            if (typeof playSummonEffect === "function") {
                await playSummonEffect(side, slotIdx);
            }

            summonedCards.push(targetCard);

            // 騾｣骼厄ｼ夂音谿雁小蝟壹ｂ縲悟小蝟壽・蜉滓凾縲阪→縺励※謇ｱ縺・(繝ｭ繧ｸ繝・け螳夂ｾｩ1.3貅匁侠)
            await this.resolveEffects(targetCard, side, "on_summon");
        }

        // 縲・菴謎ｻ･荳雁小蝟壹＠縺滓凾縲阪・鄂縺ｯ縲√∪縺ｨ繧√※1蝗槭□縺大愛螳壹☆繧・
        await this.notifySummon(side, summonedCards);
    },

    /** 繧ｵ繝ｼ繝∝・逅・(繝・ャ繧ｭ縺九ｉ謇区惆) */
    applySearch: async function(action, side) {
        const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
        const count = action.count || 1;
        const filter = action.filter || {};

        let candidates = p.deck.filter(card => this._checkFilter(card, filter));

        const moveLimit = Math.min(count, candidates.length);
        for (let i = 0; i < moveLimit; i++) {
            const randIdx = Math.floor(GameRandom() * candidates.length);
            const targetCard = candidates.splice(randIdx, 1)[0];

            const idx = p.deck.indexOf(targetCard);
            if (idx !== -1) {
                p.deck.splice(idx, 1);
                p.hand.push(targetCard);
                console.log(`${side} searched ${targetCard.name}`);
            }
        }
        
        // followUp蜃ｦ逅・(萓・ discard)
        if (action.followUp && action.followUp.type === "discard") {
            const discardCount = action.followUp.count || 1;
            if (p.hand.length > 0) {
                const actualCount = Math.min(discardCount, p.hand.length);
                let discarded = [];
                if ((side === "player" || GAME_STATE.isOnlineMatch) && typeof selectHandCardsUI === "function") {
                    const picks = await selectHandCardsUI(actualCount);
                    discarded = picks.sort((a, b) => b - a).map(idx => p.hand.splice(idx, 1)[0]);
                } else {
                    const score = (c) => (typeof CpuLogic !== "undefined") ? CpuLogic.discardScore(c) : 0;
                    for (let i = 0; i < actualCount; i++) {
                        p.hand.sort((a, b) => score(b) - score(a));
                        discarded.push(p.hand.shift());
                    }
                }
                for (const card of discarded) {
                    sendCardToTrash(side, card);
                    await this.notifyCardSentToTrash(card, side);
                }
            }
        }
    },

    /** 繧ｵ繝ｫ繝吶・繧ｸ蜃ｦ逅・(繝医Λ繝・す繝･縺九ｉ謇区惆) */
    applySalvage: async function(action, side) {
        const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
        const count = action.count || 1;
        const filter = action.filter || {};

        let candidates = p.trash.filter(card => this._checkFilter(card, filter));

        const moveLimit = Math.min(count, candidates.length);
        for (let i = 0; i < moveLimit; i++) {
            const randIdx = Math.floor(GameRandom() * candidates.length);
            const targetCard = candidates.splice(randIdx, 1)[0];

            // 繝医Λ繝・す繝･縺九ｉ蜑企勁縺励※謇区惆縺ｸ (螳牙・縺ｫ繧､繝ｳ繝・ャ繧ｯ繧ｹ繧堤｢ｺ隱・
            const idx = p.trash.indexOf(targetCard);
            if (idx !== -1) {
                p.trash.splice(idx, 1);
                p.hand.push(targetCard);
                console.log(`${side} salvaged ${targetCard.name}`);
            }
        }
    },

    /**
     * 蜈・・・繝代Ρ繝ｼ・亥魂蛻ｷ蛟､・峨°繧臥樟蝨ｨ菴輔ム繧ｦ繝ｳ縺励※縺・ｋ縺九ｒ霑斐☆縲・
     * getCurrentPower 縺ｯ蟶ｸ譎ゅが繝ｼ繝ｩ繝ｻ荳譎ゅヰ繝輔ｒ縺吶∋縺ｦ蜷ｫ繧√◆螳滓焚蛟､縺ｪ縺ｮ縺ｧ縲・
     * 縺薙％繧ょ酔讒倥↓縲御ｻ翫ヵ繧｣繝ｼ繝ｫ繝峨↓蜃ｺ縺ｦ縺・ｋ迥ｶ諷九阪ｒ縺昴・縺ｾ縺ｾ豈碑ｼ・☆繧九・
     * 萓・ 閾ｪ霄ｫ縺ｫ+300縺ｮ蟶ｸ譎ゅが繝ｼ繝ｩ繧呈戟縺､繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｯ縲・300縺ｮ繝・ヰ繝輔ｒ蜿励￠縺ｦ繧・
     * 蟾ｮ縺怜ｼ輔″0・亥魂蛻ｷ蛟､縺ｨ蜷後§・峨↑縺ｮ縺ｧ縲悟ｼｱ菴灘喧縲肴桶縺・↓縺ｯ縺ｪ繧峨↑縺・・
     */
    getPowerDrop: function(card, side, slotIdx) {
        if (!card) return 0;
        return card.power - this.getCurrentPower(card, side, slotIdx);
    },

    /** 縲後ヱ繝ｯ繝ｼ縺悟・縲・・謨ｰ蛟､繧医ｊ菴惹ｸ九＠縺ｦ縺・ｋ縲榊愛螳・(譽ｮ逡後・諤偵ｊ s007 遲・ */
    isWeakened: function(card, side, slotIdx) {
        return this.getPowerDrop(card, side, slotIdx) > 0;
    },

    /** 蟇ｾ雎｡驕ｸ謚樊凾縺ｫ繝励Ξ繧､繝､繝ｼ縺ｸ蜃ｺ縺呎｡亥・譁・*/
    _targetPromptText: function(action, targetSide, side) {
        const owner = (targetSide === side) ? "閾ｪ蛻・ : "逶ｸ謇・;
        switch (action.type) {
            case "destroy":
                return `遐ｴ螢翫☆繧・{owner}縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈謚槭＠縺ｦ縺上□縺輔＞`;
            case "buff":
                return (action.value || 0) < 0
                    ? `蠑ｱ菴灘喧縺輔○繧・{owner}縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈謚槭＠縺ｦ縺上□縺輔＞`
                    : `蠑ｷ蛹悶☆繧・{owner}縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈謚槭＠縺ｦ縺上□縺輔＞`;
            case "apply_combat_effect":
                return `蜉ｹ譫懊ｒ驕ｩ逕ｨ縺吶ｋ${owner}縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈謚槭＠縺ｦ縺上□縺輔＞`;
            default:
                return `蟇ｾ雎｡縺ｫ縺吶ｋ${owner}縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈謚槭＠縺ｦ縺上□縺輔＞`;
        }
    },

    /** 蜀・Κ逕ｨ繝輔ぅ繝ｫ繧ｿ繝ｪ繝ｳ繧ｰ繝ｭ繧ｸ繝・け */
    _checkFilter: function(card, filter) {
        if (filter.level && card.level !== filter.level) return false;
        if (filter.minLevel && card.level < filter.minLevel) return false;
        if (filter.maxLevel && card.level > filter.maxLevel) return false;
        if (filter.attribute && card.attribute !== filter.attribute) return false;
        if (filter.category && (!card.categories || !card.categories.includes(filter.category))) return false;
        if (filter.type && card.type !== filter.type) return false;
        if (filter.subType && card.subType !== filter.subType) return false;
        return true;
    },

    /**
     * 繧ｫ繝ｼ繝峨・迴ｾ蝨ｨ縺ｮ繝代Ρ繝ｼ繧貞虚逧・↓險育ｮ励☆繧・(繧ｪ繝ｼ繝ｩ繝ｻ譚｡莉ｶ莉倥ヰ繝輔ｒ蜿肴丐)
     */
    getCurrentPower: function(card, side, slotIdx) {
        if (!card || card.type !== "monster") return 0;

        // 1. 繝吶・繧ｹ繝代Ρ繝ｼ
        let currentPower = card.power;

        // 2. 荳譎ら噪縺ｪ蛟倶ｽ薙ヰ繝・(_tempBuffs) 縺ｮ蜉邂・
        if (card._tempBuffs) {
            card._tempBuffs.forEach(b => {
                currentPower += b.value;
            });
        }

        // 3. 蜈ｨ繝輔ぅ繝ｼ繝ｫ繝峨ｒ襍ｰ譟ｻ縺励※縲径lways縲阪ヨ繝ｪ繧ｬ繝ｼ縺ｮ繝舌ヵ繧帝←逕ｨ
        const players = ["player", "opponent"];
        players.forEach(pSide => {
            const p = GAME_STATE[pSide];
            // 繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧ｾ繝ｼ繝ｳ縺ｨ鬲碑｡薙だ繝ｼ繝ｳ縺ｮ荳｡譁ｹ繧偵メ繧ｧ繝・け
            const allFields = [...p.field.monsters, ...p.field.magics];

            allFields.forEach(source => {
                if (!source || !source.logic) return;

                source.logic.forEach(action => {
                    // 繝舌ヵ邉ｻ縺ｮ豌ｸ邯壼柑譫・(always) 縺九メ繧ｧ繝・け
                    if (action.trigger === "always" && (action.type === "buff" || action.type === "global_buff")) {

                        // 逋ｺ蜍墓擅莉ｶ (is_opponent_turn遲・ 縺ｮ繝√ぉ繝・け
                        if (!this._checkCondition(action, pSide, source)) return;

                        // 蜉ｹ譫懊・蟇ｾ雎｡繧ｵ繧､繝・(targetSide: "opponent" 縺ｪ繧臥匱蜍戊・・騾・・)
                        const effectTargetSide = (action.targetSide === "opponent")
                            ? (pSide === "player" ? "opponent" : "player")
                            : pSide;

                        if (effectTargetSide !== side) return;

                        // 繝輔ぅ繝ｫ繧ｿ (螻樊ｧ繝ｻ繧ｫ繝・ざ繝ｪ遲・ 縺ｮ荳閾ｴ遒ｺ隱・
                        if (action.type === "global_buff" && !this._checkFilter(card, action.filter || {})) return;
                        if (action.type === "buff" && action.target === "self" && source !== card) return;

                        currentPower += (action.value || 0);
                    }
                });
            });
        });

        // 繝代Ρ繝ｼ縺ｯ 0 譛ｪ貅縺ｫ縺ｪ繧峨↑縺・(繝ｫ繝ｼ繝ｫ 3 貅匁侠)
        return Math.max(0, currentPower);
    },

    /** 譚｡莉ｶ繝√ぉ繝・け繝ｭ繧ｸ繝・け */
    _checkCondition: function(action, side, sourceCard) {
        if (!action.condition) return true;

        switch (action.condition) {
            case "is_opponent_turn":
                // 迴ｾ蝨ｨ縺ｮ繧ｿ繝ｼ繝ｳ繝励Ξ繧､繝､繝ｼ縺悟柑譫懊・謖√■荳ｻ縺ｨ逡ｰ縺ｪ繧九°
                return GAME_STATE.turnPlayer !== side;
            case "has_category_on_field":
                // 迚ｹ螳壹き繝・ざ繝ｪ縺瑚・蛻・ヵ繧｣繝ｼ繝ｫ繝峨↓蟄伜惠縺吶ｋ縺・
                const p = GAME_STATE[side];
                return p.field.monsters.some(m => m && m.categories.includes(action.category));
            default:
                return true;
        }
    },

    /** 鬲碑｡楢先ｧ縺ｮ蛻､螳・*/
    checkMagicProtection: function(card, side) {
        let isProtected = false;
        const p = GAME_STATE[side];
        const allFields = [...p.field.monsters, ...p.field.magics];
        
        allFields.forEach(source => {
            if (!source || !source.logic) return;
            source.logic.forEach(action => {
                if (action.trigger === "always" && action.type === "resist_magic" && action.targetSide === "self") {
                    if (action.filter) {
                        if (this._checkFilter(card, action.filter)) isProtected = true;
                    } else {
                        isProtected = true;
                    }
                }
            });
        });
        return isProtected;
    },

    /** 謌ｦ髣倡ｴ螢願先ｧ縺ｮ蛻､螳・*/
    checkBattleProtection: function(card, side, slotIdx) {
        const players = ["player", "opponent"];
        let isProtected = false;

        players.forEach(pSide => {
            const p = GAME_STATE[pSide];
            const allFields = [...p.field.monsters, ...p.field.magics];

            allFields.forEach(source => {
                if (!source || !source.logic) return;
                source.logic.forEach(action => {
                    // 閠先ｧ邉ｻ蜉ｹ譫・always)縺九メ繧ｧ繝・け
                    if (action.trigger === "always" && (action.type === "battle_protection" || action.type === "global_protection")) {

                        const effectTargetSide = (action.targetSide === "opponent")
                            ? (pSide === "player" ? "opponent" : "player")
                            : pSide;

                        if (effectTargetSide !== side) return;

                        // 蛟句挨閠先ｧ(self)縺句・菴楢先ｧ(filter荳閾ｴ)縺・
                        const isSelf = (action.target === "self" && source === card);
                        const isGlobalMatch = (action.type === "global_protection" && this._checkFilter(card, action.filter || {}));

                        if (isSelf || isGlobalMatch) {
                            // 1繧ｿ繝ｼ繝ｳ縺ｫ1蠎ｦ縺ｮ蛻ｶ髯舌メ繧ｧ繝・け
                            if (action.countLimit === "once_per_turn") {
                                // 菫ｮ豁｣: 閠先ｧ莉倅ｸ主・(source)縺ｧ縺ｯ縺ｪ縺上∝ｮ医ｉ繧後ｋ蛛ｴ(card)縺ｫ繝輔Λ繧ｰ繧呈戟縺溘○繧・
                                card._usedProtections = card._usedProtections || {};
                                const protectionKey = `prot_${source.id}_${action.type}`; // sourceID縺ｨ蜉ｹ譫懊ち繧､繝励〒隴伜挨

                                if (card._usedProtections[protectionKey] === GAME_STATE.turnCount) return;

                                // 驕ｩ逕ｨ譎ゅ↓繝輔Λ繧ｰ繧堤ｫ九※繧・
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

    /** 譛邨ゅム繝｡繝ｼ繧ｸ縺ｮ險育ｮ・(霆ｽ貂帛渚譏) */
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

                        // 逋ｺ蜍墓擅莉ｶ (has_category_on_field遲・ 縺ｮ繝√ぉ繝・け
                        if (!this._checkCondition(action, pSide, source)) return;

                        reduction += (action.value || 0);
                    }
                });
            });
        });

        return Math.max(0, originalDamage - reduction);
    },

    /**
     * 繧ｫ繝ｼ繝峨′迴ｾ蝨ｨ逋ｺ蜍募庄閭ｽ・域怏蜉ｹ縺ｪ蟇ｾ雎｡縺後≠繧具ｼ峨°蛻､螳壹☆繧・
     */
    isEffectActivatable: function(cardData, side, trigger = "on_activate") {
        if (!cardData.logic || cardData.logic.length === 0) return true;

        const actions = cardData.logic.filter(a => a.trigger === trigger);
        if (actions.length === 0) return true;

        return actions.some(action => {
            // 繧ｳ繧ｹ繝医ｒ謇輔∴縺ｪ縺・ｂ縺ｮ縺ｯ逋ｺ蜍輔〒縺阪↑縺・
            if (!this.canPayActionCost(action, side)) return false;

            if (action.type === "mill" || action.type === "draw_and_discard") return true;
            if (cardData.id === "s013") return true;

            // s014: 蜀･逡後°繧峨・霑弱∴ (閾ｪ蛻・→逶ｸ謇九・蝣ｴ縺ｫ繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺悟ｿ・ｦ・
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
                        // 繝・ヰ繝輔・蝣ｴ蜷医∵里縺ｫ繝代Ρ繝ｼ0縺ｪ繧臥匱蜍穂ｸ榊庄
                        if (action.value < 0 && this.getCurrentPower(m, targetSide, i) <= 0) return false;
                        return true;
                    });
                case "destroy":
                    return p.field.monsters.some((m, i) => {
                        if (!m || !this._checkFilter(m, action.filter || {})) return false;
                        // 譚｡莉ｶ(is_weakened遲・縺ｮ繝√ぉ繝・け
                        if (action.condition === "is_weakened" && !this.isWeakened(m, targetSide, i)) return false;
                        return true;
                    });
                case "apply_combat_effect":
                    return p.field.monsters.some(m => m !== null && this._checkFilter(m, action.filter || {}));
                case "special_summon": {
                    // 繝輔ぅ繝ｼ繝ｫ繝峨↓遨ｺ縺阪′縺ｪ縺・ｴ蜷医・逋ｺ蜍穂ｸ榊庄
                    if (!p.field.monsters.includes(null)) return false;
                    // 迚ｹ谿雁小蝟壹〒縺阪ｋ縺ｮ縺ｯ繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺縺代・
                    // maxLevel 遲峨・繝輔ぅ繝ｫ繧ｿ縺ｯ level 繧呈戟縺溘↑縺・ｭ碑｡薙ｒ蠑ｾ縺九↑縺・・縺ｧ縲・
                    // 縺薙％縺ｧ遞ｮ蛻･繧定ｦ九↑縺・→縲悟ｯｾ雎｡縺後＞縺ｪ縺・・縺ｫ逋ｺ蜍輔〒縺阪ｋ縲咲憾諷九↓縺ｪ繧九・
                    const summonable = c => c.type === "monster" && this._checkFilter(c, action.filter || {});
                    if (action.source === "deck") return p.deck.some(summonable);
                    if (action.source === "trash") return p.trash.some(summonable);
                    if (action.source === "choice_deck_or_trash") {
                        return p.deck.some(summonable) || p.trash.some(summonable);
                    }
                    return true;
                }
                case "search":
                case "salvage":
                    const pool = (action.type === "search") ? p.deck : p.trash;
                    return pool.some(c => this._checkFilter(c, action.filter || {}));
                case "global_buff":
                    return p.field.monsters.some(m => m !== null);
                case "destroy_magic":
                    // 莨上○繧ｫ繝ｼ繝峨ｂ蜷ｫ繧√∝ｯｾ雎｡縺ｮ鬲碑｡薙だ繝ｼ繝ｳ縺ｫ菴輔°縺ゅｌ縺ｰ逋ｺ蜍輔〒縺阪ｋ
                    return p.field.magics.some(m => m !== null && this._checkFilter(m, action.filter || {}));
                case "bounce":
                    return p.field.monsters.some(m => m !== null && this._checkFilter(m, action.filter || {}));
                case "banish":
                    // 蟇ｾ雎｡縺ｪ縺励〒逋ｺ蜍輔〒縺阪※縺励∪縺・→縲´P遲峨・繧ｳ繧ｹ繝医□縺第鴛縺｣縺ｦ
                    // 菴輔ｂ襍ｷ縺阪↑縺・憾諷九↓縺ｪ繧・閨也阜蜈画ｳ｢ s031 遲・
                    return p.field.monsters.some(m => m !== null && this._checkFilter(m, action.filter || {}));
                default:
                    return true;
            }
        });
    },

    /** 蜈ｨ繝輔ぅ繝ｼ繝ｫ繝峨・繝舌ヵ謖∫ｶ壽凾髢薙ｒ譖ｴ譁ｰ */
    cleanAllBuffs: function() {
        ["player", "opponent"].forEach(side => {
            // 鬲碑｡薙だ繝ｼ繝ｳ繧ょｯｾ雎｡縺ｫ蜷ｫ繧√ｋ縲・
            // 蜷ｫ繧√↑縺・→豌ｸ邯夐ｭ碑｡薙・ countLimit 縺後Μ繧ｻ繝・ヨ縺輔ｌ縺壹・
            // 縲・繧ｿ繝ｼ繝ｳ縺ｫ1蠎ｦ縲阪′縲・繧ｲ繝ｼ繝縺ｫ1蠎ｦ縲阪↓縺ｪ縺｣縺ｦ縺励∪縺・・
            const cards = [
                ...GAME_STATE[side].field.monsters,
                ...GAME_STATE[side].field.magics
            ];

            cards.forEach(m => {
                if (!m) return;

                // 繝舌ヵ縺ｮ謗・勁
                if (m._tempBuffs) {
                    m._tempBuffs = m._tempBuffs.filter(b => {
                        if (b.duration === "permanent") return true;
                        b.duration--;
                        return b.duration > 0;
                    });
                }
                // 謌ｦ髣倅ｺ育ｴ・お繝輔ぉ繧ｯ繝医・謗・勁
                if (m._combatEffects) {
                    m._combatEffects = m._combatEffects.filter(e => {
                        e.duration--;
                        return e.duration > 0;
                    });
                }

                // 1繧ｿ繝ｼ繝ｳ縺ｫ1蠎ｦ縺ｮ蛻ｶ髯舌Μ繧ｻ繝・ヨ (繧ｿ繝ｼ繝ｳ髢句ｧ区凾縺ｫ繧ｯ繝ｪ繝ｼ繝九Φ繧ｰ)
                if (m._usedLimits) m._usedLimits = {};
                if (m._usedProtections) m._usedProtections = {};
                delete m._usedTurn;
            });
        });
    },

    /** 蠎・沺繝舌ヵ/繝・ヰ繝輔・驕ｩ逕ｨ (繝懊Ν繝輔√す繝ｫ繝ｴ繧｡繧ｹ遲・ */
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
            if (value > 0) {
                this.notifyPowerUp(t.card, t.side);
            }
        });
        console.log(`Global Buff applied: ${value} to ${targets.length} targets.`);
    },

    /** 謌ｦ髣倅ｺ育ｴ・柑譫懊・莉倅ｸ・(豬ｷ縺ｮ遯∵茶遲・ */
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
