/**
 * LinkaVel Card Game - Master Data
 * * 拡張性を考慮したデータ構造を採用しています。
 * - logic: カードの効果をプログラムが解釈するための定義
 * - summonRequirement: 召喚に必要なコストや条件
 * - categories: 「炎界」などのカテゴリタグ
 */

const MASTER_CARDS = {
    // =================================================================
    // モンスターカード (m001 - m010)
    // =================================================================

    "m001": {
        id: "m001",
        name: "フレイムタイガー",
        type: "monster",
        subType: "effect",
        attribute: "火",
        level: 1,
        power: 300,
        categories: [],
        text: "このモンスターは相手ターンの間のみ、パワーが500アップする。",
        summonRequirement: {
            type: "normal",
            costCount: 0,
            costFilter: null
        },
        logic: [
            {
                type: "passive_buff",
                trigger: "always",
                condition: "is_opponent_turn",
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
        categories: ["炎界"],
        text: "このモンスターを召喚・特殊召喚した時、デッキからレベル1のモンスターをランダムに2体特殊召喚できる。",
        summonRequirement: {
            type: "normal",
            costCount: 1,
            costFilter: { minLevel: 1 }
        },
        logic: [
            {
                type: "special_summon",
                trigger: "on_summon",
                source: "deck",
                count: 2,
                filter: { level: 1 },
                optional: true
            }
        ]
    },

    "m003": {
        id: "m003",
        name: "炎界の鼠 チューチャン",
        type: "monster",
        subType: "normal",
        attribute: "火",
        level: 1,
        power: 500,
        categories: ["炎界"],
        text: "",
        summonRequirement: {
            type: "normal",
            costCount: 0,
            costFilter: null
        },
        logic: []
    },

    "m004": {
        id: "m004",
        name: "炎界の戦士 ブレイズ",
        type: "monster",
        subType: "effect",
        attribute: "火",
        level: 3,
        power: 1000,
        categories: ["炎界"],
        text: "このモンスターを召喚・特殊召喚した時、自分のトラッシュからレベル1のモンスターを2体ランダムに特殊召喚する。",
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
                optional: false
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
        categories: ["炎界"],
        text: "①1ターンに1度、自分のデッキかトラッシュかを選び、その中からランダムで【炎界】モンスターを1体特殊召喚する。\n②このモンスターがフィールドに存在する限り、自分の炎属性モンスターのパワーは500アップする。",
        summonRequirement: {
            type: "normal",
            costCount: 3,
            costFilter: { minLevel: 1 }
        },
        logic: [
            {
                type: "special_summon",
                trigger: "ignition",
                countLimit: "once_per_turn",
                source: "choice_deck_or_trash",
                count: 1,
                filter: { category: "炎界" }
            },
            {
                type: "global_buff",
                trigger: "always",
                targetSide: "self",
                filter: { attribute: "火" },
                value: 500
            }
        ]
    },

    "m006": {
        id: "m006",
        name: "アクア・キャット",
        type: "monster",
        subType: "effect",
        attribute: "水",
        level: 1,
        power: 400,
        categories: [],
        text: "このモンスターが戦闘で破壊された時、自分はデッキから1枚ドローする。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [
            { type: "draw_card", trigger: "on_destroyed_by_battle", count: 1 }
        ]
    },

    "m007": {
        id: "m007",
        name: "海界の稚魚 クリオ",
        type: "monster",
        subType: "effect",
        attribute: "水",
        level: 1,
        power: 300,
        categories: ["海界"],
        text: "このモンスターが戦闘で破壊された時、自分のデッキから水属性のレベル1モンスターを1体ランダムに特殊召喚する。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [
            { type: "special_summon", trigger: "on_destroyed_by_battle", source: "deck", count: 1, filter: { attribute: "水", level: 1 } }
        ]
    },

    "m008": {
        id: "m008",
        name: "海界の戦士 アトラス",
        type: "monster",
        subType: "normal",
        attribute: "水",
        level: 2,
        power: 800,
        categories: ["海界"],
        text: "このモンスターが戦闘で破壊された時、自分のデッキ・トラッシュからレベル1の海界モンスター2体をランダムに特殊召喚する。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [
            { type: "special_summon", trigger: "on_destroyed_by_battle", source: "choice_deck_or_trash", count: 2, filter: { category: "海界", level: 1 } }
        ]
    },

    "m009": {
        id: "m009",
        name: "海界の槍騎士 スピア",
        type: "monster",
        subType: "effect",
        attribute: "水",
        level: 3,
        power: 1400,
        categories: ["海界"],
        text: "このモンスターが戦闘で破壊された時、自分のトラッシュからランダムに【海界】魔術カードを1枚手札に加える。",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: [
            { type: "salvage", trigger: "on_destroyed_by_battle", source: "trash", count: 1, filter: { category: "海界", type: "magic" } }
        ]
    },

    "m010": {
        id: "m010",
        name: "海界王 シータイド",
        type: "monster",
        subType: "effect",
        attribute: "水",
        level: 4,
        power: 2400,
        categories: ["海界"],
        text: "このモンスターが戦闘で破壊された時、自分のデッキ・トラッシュからレベル2以下の【海界】モンスターをランダムに可能な限り特殊召喚する。",
        summonRequirement: { type: "normal", costCount: 3, costFilter: { minLevel: 1 } },
        logic: [
            { type: "special_summon", trigger: "on_destroyed_by_battle", source: "choice_deck_or_trash", count: 3, filter: { category: "海界", maxLevel: 2 } }
        ]
    },

    // =================================================================
    // 魔術カード (s001 - s006)
    // =================================================================

    "s001": {
        id: "s001",
        name: "炎界召集",
        type: "magic",
        subType: "normal",
        attribute: "火",
        categories: ["炎界"],
        text: "自分のデッキからレベル1の炎属性モンスターをランダムに2体特殊召喚する。",
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
                targetSelect: "manual"
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
                duration: "until_opponent_end"
            }
        ]
    },

    "s004": {
        id: "s004",
        name: "海の突撃",
        type: "magic",
        subType: "normal",
        attribute: "水",
        categories: [],
        text: "自分の水属性モンスターを1体選択する。このターン、そのモンスターと戦闘を行った相手モンスターを戦闘後に破壊する。",
        summonRequirement: { type: "magic_activation", cost: { type: "discard", count: 1 } },
        logic: [
            { type: "apply_combat_effect", trigger: "on_activate", targetSelect: "manual", filter: { attribute: "水" }, effect: "destroy_opponent_after_combat" }
        ]
    },

    "s005": {
        id: "s005",
        name: "海界への帰還",
        type: "magic",
        subType: "normal",
        attribute: "水",
        categories: ["海界"],
        text: "自分のトラッシュから【海界】モンスター2体まで選択して手札に加える。",
        summonRequirement: { type: "magic_activation" },
        logic: [
            { type: "salvage", trigger: "on_activate", source: "trash", count: 2, filter: { category: "海界" }, targetSelect: "manual" }
        ]
    },

    "s006": {
        id: "s006",
        name: "アクア・バリア",
        type: "magic",
        subType: "permanent",
        attribute: "水",
        categories: [],
        text: "自分フィールドに水属性モンスターが存在する限り、自分への戦闘ダメージは半分になる。",
        summonRequirement: { type: "magic_activation" },
        logic: [
            { type: "damage_cut", trigger: "always", condition: "water_exists_on_field", value: 0.5 }
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
            "m001", "m001", "m001",
            "m002", "m002", "m002",
            "m003", "m003", "m003",
            "s001", "s001", "s001",
            "s002", "s002", "s002",
            "s003", "s003", "s003",
            "m005", "m005"
        ]
    },
    "starter_water": {
        name: "静かなる海界",
        cards: [
            "m006", "m006", "m006", 
            "m007", "m007", "m007", 
            "m008", "m008", "m008",
            "s004", "s004", "s004", 
            "s005", "s005", "s005", 
            "s006", "s006", "s006",
            "m010", "m010"
        ]
    }
};

// ヘルパー関数: IDからカードデータを取得（参照渡し防止のためコピーを返す）
function getCardData(cardId) {
    if (!MASTER_CARDS[cardId]) return null;
    return JSON.parse(JSON.stringify(MASTER_CARDS[cardId])); // Deep Copy
}
