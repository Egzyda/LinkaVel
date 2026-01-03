/**
 * LinkaVel Card Game - Master Data
 * * 拡張性を考慮したデータ構造を採用しています。
 * - logic: カードの効果をプログラムが解釈するための定義
 * - summonRequirement: 召喚に必要なコストや条件
 * - categories: 「炎界」などのカテゴリタグ
 */

const MASTER_CARDS = {
    // =================================================================
    // モンスターカード
    // =================================================================
    
    "m001": { 
        id: "m001", 
        name: "フレイムタイガー", 
        type: "monster", 
        subType: "effect", // 通常/効果
        attribute: "火", 
        level: 1, 
        power: 300, 
        categories: ["beast"],
        text: "このモンスターは相手ターンの間のみ、パワーが500アップする。",
        
        // 召喚条件: レベル1はコストなし
        summonRequirement: {
            type: "normal", // 通常召喚
            costCount: 0,
            costFilter: null
        },

        // 効果ロジック
        logic: [
            {
                type: "passive_buff", // 常在型バフ
                trigger: "always",
                condition: "is_opponent_turn", // 条件: 相手ターン中
                target: "self",
                value: 500
            }
        ]
    },

    "m002": { 
        id: "m002", 
        name: "炎界の指揮官 モエス", 
        type: "monster", 
        subType: "effect",
        attribute: "火", 
        level: 2, 
        power: 600, 
        categories: ["炎界", "commander"],
        text: "このモンスターを召喚・特殊召喚した時、デッキからレベル1のモンスターをランダムに2体特殊召喚できる。",
        
        // 召喚条件: 基本ルール（Lv1以上を1体リリース）
        summonRequirement: {
            type: "normal",
            costCount: 1,
            costFilter: { minLevel: 1 }
        },

        logic: [
            {
                type: "special_summon",
                trigger: "on_summon", // 召喚・特殊召喚成功時
                source: "deck",
                count: 2,
                filter: { level: 1 }, // レベル1を指定
                optional: true // 「できる」＝任意効果
            }
        ]
    },

    "m003": { 
        id: "m003", 
        name: "炎界の鼠 チューチャン", 
        type: "monster", 
        subType: "normal", // 通常モンスター
        attribute: "火", 
        level: 1, 
        power: 500, 
        categories: ["炎界", "beast"],
        text: "", // フレーバーテキストなし

        summonRequirement: {
            type: "normal",
            costCount: 0,
            costFilter: null
        },

        logic: [] // 効果なし
    },

    "m004": { 
        id: "m004", 
        name: "炎界の戦士 ブレイズ", 
        type: "monster", 
        subType: "effect",
        attribute: "火", 
        level: 3, 
        power: 1000, 
        categories: ["炎界", "warrior"],
        text: "このモンスターを召喚・特殊召喚した時、自分のトラッシュからレベル1のモンスターを2体ランダムに特殊召喚する。",
        
        // 召喚条件: コスト2体（ルール準拠）
        summonRequirement: {
            type: "normal",
            costCount: 2,
            costFilter: { minLevel: 1 }
        },

        logic: [
            {
                type: "special_summon",
                trigger: "on_summon",
                source: "trash",
                count: 2,
                filter: { level: 1 },
                optional: false // 「する」＝強制効果
            }
        ]
    },

    "m005": { 
        id: "m005", 
        name: "炎界王 ヴァルトガス", 
        type: "monster", 
        subType: "effect",
        attribute: "火", 
        level: 4, 
        power: 1500, 
        categories: ["炎界", "king"],
        text: "1ターンに1度、自分のデッキかトラッシュかを選び、その中からランダムで【炎界】モンスターを1体特殊召喚する。\nこのモンスターがフィールドに存在する限り自分の炎属性モンスターのパワーは500アップする。",
        
        // 召喚条件: 重いコスト (3体リリース)
        summonRequirement: {
            type: "normal",
            costCount: 3,
            costFilter: { minLevel: 1 }
        },

        logic: [
            {
                // 起動効果 (Ignition)
                type: "special_summon",
                trigger: "ignition", // 自分のターンに手動発動
                countLimit: "once_per_turn",
                source: "choice_deck_or_trash", // 選択式
                count: 1,
                filter: { category: "炎界" }
            },
            {
                // 永続効果 (Passive)
                type: "global_buff",
                trigger: "always",
                targetSide: "self",
                filter: { attribute: "火" },
                value: 500
            }
        ]
    },

    // =================================================================
    // 魔術カード
    // =================================================================

    "s001": { 
        id: "s001", 
        name: "炎界召集", 
        type: "magic", 
        subType: "normal", // 通常魔術（使い切り）
        attribute: "火", // 魔術にも属性付与
        categories: ["炎界"],
        text: "自分のデッキからレベル1の炎属性モンスターをランダムに2体特殊召喚する。",

        // 魔術の発動条件（現在はなし、将来的に「場に炎界がいる時」などを追加可能）
        summonRequirement: {
            type: "magic_activation",
            cost: null
        },

        logic: [
            {
                type: "special_summon",
                trigger: "on_activate",
                source: "deck",
                count: 2,
                filter: { level: 1, attribute: "火" }
            }
        ]
    },

    "s002": { 
        id: "s002", 
        name: "炎界蘇生", 
        type: "magic", 
        subType: "normal",
        attribute: "火",
        categories: ["炎界"],
        text: "自分のトラッシュからレベル3以下の【炎界】モンスターを1体選択して特殊召喚する。",

        summonRequirement: { type: "magic_activation" },

        logic: [
            {
                type: "special_summon",
                trigger: "on_activate",
                source: "trash",
                count: 1,
                filter: { maxLevel: 3, category: "炎界" },
                targetSelect: "manual" // ランダムではなく選択
            }
        ]
    },

    "s003": { 
        id: "s003", 
        name: "フレイムラッシュ", 
        type: "magic", 
        subType: "normal", 
        attribute: "火", 
        categories: [],
        text: "自分のフィールドの炎属性モンスター1体のパワーを、相手ターン終了時まで500アップする。",

        summonRequirement: { type: "magic_activation" },

        logic: [
            {
                type: "buff",
                trigger: "on_activate",
                targetSelect: "manual",
                filter: { attribute: "火", location: "field" },
                value: 500,
                duration: "until_opponent_end" // 期限付き
            }
        ]
    }
};

// ==========================================
// デッキレシピ定義
// ==========================================
const DECK_RECIPES = {
    "starter_fire": {
        name: "燃え盛る炎界",
        cards: [
            // 3枚積み
            "m001", "m001", "m001",
            "m002", "m002", "m002",
            "m003", "m003", "m003",
            "s001", "s001", "s001",
            "s002", "s002", "s002",
            "s003", "s003", "s003",
            // 2枚積み（エース）
            "m005", "m005"
        ]
    }
};

// ヘルパー関数: IDからカードデータを取得（参照渡し防止のためコピーを返す）
function getCardData(cardId) {
    if (!MASTER_CARDS[cardId]) return null;
    return JSON.parse(JSON.stringify(MASTER_CARDS[cardId])); // Deep Copy
}
