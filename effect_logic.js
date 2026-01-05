/**
 * LinkaVel Card Game - Effect Logic Manager
 * カードの効果（特殊召喚、ドロー、バフ等）を専門に扱う
 */

const EffectLogic = {
    /**
     * 魔術カードの効果を解決する
     * @param {Object} cardData - 発動したカードのデータ
     * @param {string} side - "player" | "opponent"
     */
    resolveMagic: function(cardData, side) {
        console.log(`EffectLogic: Resolving logic for ${cardData.name}`);

        // cards.jsで定義されたlogic配列をループ
        if (cardData.logic && cardData.logic.length > 0) {
            cardData.logic.forEach(effect => {
                this.execute(effect, side);
            });
        }
    },

    /**
     * 個別の効果命令を実行する
     */
    execute: function(effect, side) {
        switch (effect.type) {
            case "special_summon":
                // 本来は特殊召喚だが、まずは確実な動作確認のため「ドロー」を代行させる
                console.log("Effect: Drawing 1 card instead of Special Summon (Test)");
                drawCard(side, 1);
                break;
                
            case "draw_card":
                drawCard(side, effect.count || 1);
                break;

            default:
                console.log(`Unknown effect type: ${effect.type}`);
                break;
        }
    }
};
