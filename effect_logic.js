/**
 * LinkaVel Card Game - Effect Logic Manager
 * カードの効果（特殊召喚、ドロー、バフ等）を専門に扱う汎用エンジン
 * Ver 1.3 (Common Logic Spec Compliant)
 */

const EffectLogic = {
    /**
     * カードが持つ効果配列を順番に解決する (Ver 1.3準拠)
     * @param {Object} cardData - カードデータ
     * @param {string} side - 発動側 ("player" | "opponent")
     * @param {string} triggerFilter - 特定のトリガーのみ実行する場合に指定 (nullなら全実行)
     */
    async resolveEffects(cardData, side, triggerFilter = null) {
        if (!cardData.logic || cardData.logic.length === 0) return;

        console.log(`EffectLogic: Resolving [${triggerFilter || "All"}] logic for ${cardData.name}`);

        for (const action of cardData.logic) {
            if (triggerFilter && action.trigger !== triggerFilter) continue;
            await this.executeAction(action, side, cardData);
        }
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
            case "special_summon": this.applySpecialSummon(action, side); break;
            case "search": this.applySearch(action, side); break;
            case "salvage": this.applySalvage(action, side); break;
            case "global_buff": await this.applyGlobalBuff(action, side, sourceCard); break;
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
        const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
        p.lp += amount;
        console.log(`${side} healed ${amount} LP. Current LP: ${p.lp}`);

        // 割り込みトリガー: on_lp_gain (聖界王レオニダス等)
        const allFieldMonsters = [...GAME_STATE.player.field.monsters, ...GAME_STATE.opponent.field.monsters];
        for (const m of allFieldMonsters) {
            if (m) await this.resolveEffects(m, (GAME_STATE.player.field.monsters.includes(m) ? "player" : "opponent"), "on_lp_gain");
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
                    p.deck = shuffleArray([...p.trash]);
                    p.trash = [];
                    p.refreshCount++;
                    // リフレッシュ後は追加で 1 枚ドローする
                    await drawCard(side, 1);
                    updateUI();
                } else {
                    break;
                }
            }

            p.trash.push(p.deck.pop());
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

    /** ターゲット取得用内部メソッド */
    async _acquireTargets(action, side, sourceCard) {
        const targetSide = (action.targetSide === "opponent") ? (side === "player" ? "opponent" : "player") : side;
        const select = action.targetSelect || "auto";
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
                if (action.condition === "is_weakened") {
                    const currentPower = this.getCurrentPower(m, targetSide, i);
                    if (currentPower >= m.power) return;
                }
                candidates.push({ card: m, side: targetSide, slotIdx: i });
            }
        });

        if (candidates.length === 0) return [];

        if (select === "manual" && side === "player") {
            const results = [];
            for (let i = 0; i < count; i++) {
                if (candidates.length === 0) break;
                const slot = await selectTargetUI(targetSide, "monster", filter);
                if (slot === null) break;
                const cIdx = candidates.findIndex(c => c.slotIdx === slot);
                if (cIdx !== -1) results.push(candidates.splice(cIdx, 1)[0]);
            }
            return results;
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
            targets.sort((a, b) => b - a).forEach(idx => {
                const card = p.hand.splice(idx, 1)[0];
                p.trash.push(card);
            });
        } else {
            // CPUまたは自動：古い順（先頭）から捨てる
            for (let i = 0; i < discardCount; i++) {
                if (p.hand.length > 0) {
                    p.trash.push(p.hand.shift());
                }
            }
        }
        console.log(`${side} discarded ${discardCount} cards.`);
        if (typeof updateUI === "function") updateUI();
    },

    /** 特殊召喚処理 */
    applySpecialSummon: function(action, side) {
        const p = (side === "player") ? GAME_STATE.player : GAME_STATE.opponent;
        const count = action.count || 1;
        const source = action.source; // deck / trash / choice_deck_or_trash
        const filter = action.filter || {};

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

            // 連鎖：特殊召喚も「召喚成功時」として扱う (ロジック定義1.3準拠)
            this.resolveEffects(targetCard, side, "on_summon");
        }
    },

    /** サーチ処理 (デッキから手札) */
    applySearch: function(action, side) {
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
    applySalvage: function(action, side) {
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
                                if (source._usedProtectionTurn === GAME_STATE.turnCount) return;
                                source._usedProtectionTurn = GAME_STATE.turnCount;
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

            const targetSide = (action.targetSide === "opponent") ? (side === "player" ? "opponent" : "player") : side;
            const p = GAME_STATE[targetSide];

            switch (action.type) {
                case "buff":
                case "destroy":
                case "apply_combat_effect":
                    return p.field.monsters.some(m => m !== null && this._checkFilter(m, action.filter || {}));
                case "special_summon":
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
            GAME_STATE[side].field.monsters.forEach(m => {
                if (m) {
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
                }
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
