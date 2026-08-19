/**
 * LinkaVel Card Game - Master Data (Ver.1.2)
 * * [更新履歴]
 * - 無属性汎用カード (m024 - m029, s016 - s018) 追加
 * - 聖界・冥界 新規モンスター (m030, m031) 追加
 * - 全スターターデッキを30枚構成に最適化
 */

const MASTER_CARDS = {
    // =================================================================
    // 火属性 (Fire)
    // =================================================================
    "m001": {
        id: "m001",
        image: "img/m001.webp",
        name: "フレイムタイガー",
        type: "monster",
        subType: "effect",
        attribute: "火",
        level: 1,
        power: 300,
        categories: [],
        text: "このモンスターは相手ターンの間のみ、パワーが500アップする。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "buff", trigger: "always", condition: "is_opponent_turn", target: "self", value: 500 }]
    },
    "m002": {
        id: "m002",
        image: "img/m002.webp",
        name: "炎界の指揮官 モエス",
        type: "monster",
        subType: "effect",
        attribute: "火",
        level: 2,
        power: 800,
        categories: ["炎界"],
        text: "このモンスターを召喚・特殊召喚した時、デッキからレベル1のモンスターをランダムに1体特殊召喚する",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "special_summon", trigger: "on_summon", source: "deck", count: 1, filter: { level: 1 }, targetSelect: "random", optional: true }]
    },
    "m003": {
        id: "m003",
        image: "img/m003.webp",
        name: "炎界の鼠 チューチャン",
        type: "monster",
        subType: "normal",
        attribute: "火",
        level: 1,
        power: 500,
        categories: ["炎界"],
        text: "",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: []
    },
    "m004": {
        id: "m004",
        image: "img/m004.webp",
        name: "炎界の戦士 ブレイズ",
        type: "monster",
        subType: "effect",
        attribute: "火",
        level: 3,
        power: 1200,
        categories: ["炎界"],
        text: "このモンスターを召喚・特殊召喚した時、自分のトラッシュからレベル1のモンスター2体をランダムに特殊召喚する。",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: [{ type: "special_summon", trigger: "on_summon", source: "trash", count: 2, filter: { level: 1 }, targetSelect: "random", optional: false }]
    },
    "m005": {
        id: "m005",
        image: "img/m005.webp",
        name: "炎界王 ヴァルトガス",
        type: "monster",
        subType: "effect",
        attribute: "火",
        level: 4,
        power: 2000,
        categories: ["炎界"],
        text: "①1ターンに1度、自分のデッキからレベル2以下の【炎界】モンスター1体をランダムに特殊召喚する。\n②このモンスターがフィールドに存在する限り、自分の火属性モンスターのパワーは300アップする。",
        summonRequirement: { type: "normal", costCount: 3, costFilter: { minLevel: 1 } },
        logic: [
            { type: "special_summon", trigger: "ignition", countLimit: "once_per_turn", source: "deck", count: 1, filter: { category: "炎界", maxLevel: 2 }, targetSelect: "random" },
            { type: "global_buff", trigger: "always", targetSide: "self", filter: { attribute: "火" }, value: 300 }
        ]
    },
    "s001": {
        id: "s001",
        image: "img/s001.webp",
        name: "炎界召集",
        type: "magic",
        subType: "normal",
        attribute: "火",
        categories: ["炎界"],
        text: "自分のデッキからレベル1の炎属性モンスターをランダムに1体特殊召喚する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "special_summon", trigger: "on_activate", source: "deck", count: 1, filter: { level: 1, attribute: "火" }, targetSelect: "random" }]
    },
    "s002": {
        id: "s002",
        image: "img/s002.webp",
        name: "炎界蘇生",
        type: "magic",
        subType: "normal",
        attribute: "火",
        categories: ["炎界"],
        text: "自分のトラッシュからレベル2の【炎界】モンスター1体をランダムに特殊召喚する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "special_summon", trigger: "on_activate", source: "trash", count: 1, filter: { level: 2, category: "炎界" }, targetSelect: "random" }]
    },
    "s003": {
        id: "s003",
        image: "img/s003.webp",
        name: "フレイムラッシュ",
        type: "magic",
        subType: "normal",
        attribute: "火",
        categories: [],
        text: "自分フィールドの火属性モンスター1体のパワーを500アップする。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "buff", trigger: "on_activate", targetSelect: "manual", filter: { attribute: "火" }, value: 500, duration: "permanent" }]
    },

    // =================================================================
    // 水属性 (Water)
    // =================================================================
    "m006": {
        id: "m006",
        image: "img/m006.webp",
        name: "アクア・キャット",
        type: "monster",
        subType: "effect",
        attribute: "水",
        level: 1,
        power: 200,
        categories: [],
        text: "このモンスターがトラッシュに送られた時、1枚ドローする。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "draw_card", trigger: "on_sent_to_trash", count: 1 }]
    },
    "m007": {
        id: "m007",
        image: "img/m007.webp",
        name: "海界の稚魚 クリオ",
        type: "monster",
        subType: "effect",
        attribute: "水",
        level: 1,
        power: 100,
        categories: ["海界"],
        text: "このモンスターがトラッシュに送られた時、自分のデッキから水属性のレベル1モンスター2体をランダムに特殊召喚する。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "special_summon", trigger: "on_sent_to_trash", source: "deck", count: 2, filter: { attribute: "水", level: 1 }, targetSelect: "random" }]
    },
    "m008": {
        id: "m008",
        image: "img/m008.webp",
        name: "海界の戦士 アトラス",
        type: "monster",
        subType: "normal",
        attribute: "水",
        level: 2,
        power: 1000,
        categories: ["海界"],
        text: "",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: []
    },
    "m009": {
        id: "m009",
        image: "img/m009.webp",
        name: "海界の槍騎士 スピア",
        type: "monster",
        subType: "effect",
        attribute: "水",
        level: 2,
        power: 900,
        categories: ["海界"],
        text: "このモンスターがトラッシュに送られた時、自分のトラッシュからランダムに【海界】魔術を1枚手札に加える。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "salvage", trigger: "on_sent_to_trash", source: "trash", count: 1, filter: { category: "海界", type: "magic" }, targetSelect: "random" }]
    },
    "m010": {
        id: "m010",
        image: "img/m010.webp",
        name: "海界王 シータイド",
        type: "monster",
        subType: "effect",
        attribute: "水",
        level: 4,
        power: 2400,
        categories: ["海界"],
        text: "このモンスターがトラッシュに送られた時、自分のデッキ・トラッシュからレベル2以下の【海界】モンスターをランダムに2体特殊召喚する。",
        summonRequirement: { type: "normal", costCount: 3, costFilter: { minLevel: 1 } },
        logic: [{ type: "special_summon", trigger: "on_sent_to_trash", source: "choice_deck_or_trash", count: 2, filter: { category: "海界", maxLevel: 2 }, targetSelect: "random" }]
    },
    "s004": {
        id: "s004",
        image: "img/s004.webp",
        name: "海の突撃",
        type: "magic",
        subType: "normal",
        attribute: "水",
        categories: [],
        text: "自分の水属性モンスター1体を選択する。このターン、そのモンスターと戦闘を行った相手フィールドのモンスターを戦闘後に破壊する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "apply_combat_effect", trigger: "on_activate", targetSelect: "manual", filter: { attribute: "水" }, effect: "destroy_opponent_after_combat", duration: "until_end_turn" }]
    },
    "s005": {
        id: "s005",
        image: "img/s005.webp",
        name: "海界への帰還",
        type: "magic",
        subType: "normal",
        attribute: "水",
        categories: ["海界"],
        text: "自分のトラッシュからレベル1の水属性モンスター2体をランダムに特殊召喚する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "special_summon", trigger: "on_activate", source: "trash", count: 2, filter: { attribute: "水", level: 1 }, targetSelect: "random" }]
    },
    "s006": {
        id: "s006",
        image: "img/s006.webp",
        name: "アクア・サルベージ",
        type: "magic",
        subType: "permanent",
        attribute: "水",
        categories: [],
        text: "1ターンに1度、自分の水属性モンスターがトラッシュに送られた時、1枚ドローする。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "draw_card", trigger: "on_other_sent_to_trash", filter: { attribute: "水" }, countLimit: "once_per_turn", count: 1 }]
    },

    // =================================================================
    // 草属性 (Grass)
    // =================================================================
    "m011": {
        id: "m011",
        image: "img/m011.webp",
        name: "グリーン・リザード",
        type: "monster",
        subType: "normal",
        attribute: "草",
        level: 1,
        power: 500,
        categories: [],
        text: "",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: []
    },
    "m012": {
        id: "m012",
        image: "img/m012.webp",
        name: "森界の弓兵 モリファス",
        type: "monster",
        subType: "effect",
        attribute: "草",
        level: 1,
        power: 300,
        categories: ["森界"],
        text: "このモンスターを召喚・特殊召喚した時、相手フィールドのモンスター1体のパワーを300ダウンさせる。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "buff", trigger: "on_summon", targetSelect: "manual", targetSide: "opponent", value: -300, duration: "until_end_turn" }]
    },
    "m013": {
        id: "m013",
        image: "img/m013.webp",
        name: "森界の番人 ボルフ",
        type: "monster",
        subType: "effect",
        attribute: "草",
        level: 2,
        power: 800,
        categories: ["森界"],
        text: "このモンスターを召喚・特殊召喚した時、相手フィールドのモンスター全てのパワーを300ダウンさせる。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "global_buff", trigger: "on_summon", targetSide: "opponent", value: -300, duration: "until_end_turn" }]
    },
    "m014": {
        id: "m014",
        image: "img/m014.webp",
        name: "森界の剣闘士 クジャシ",
        type: "monster",
        subType: "effect",
        attribute: "草",
        level: 3,
        power: 1400,
        categories: ["森界"],
        text: "1ターンに1度、デッキから【森界】魔術を1枚ランダムに手札に加える。",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: [{ type: "search", trigger: "ignition", countLimit: "once_per_turn", count: 1, filter: { category: "森界", type: "magic" }, targetSelect: "random" }]
    },
    "m015": {
        id: "m015",
        image: "img/m015.webp",
        name: "森界王 シルヴァス",
        type: "monster",
        subType: "effect",
        attribute: "草",
        level: 4,
        power: 2100,
        categories: ["森界"],
        text: "このモンスターを召喚・特殊召喚した時、相手フィールドのモンスター全てのパワーを500ダウンさせる。",
        summonRequirement: { type: "normal", costCount: 3, costFilter: { minLevel: 1 } },
        logic: [{ type: "global_buff", trigger: "on_summon", targetSide: "opponent", value: -500, duration: "until_end_turn" }]
    },
    "s007": {
        id: "s007",
        image: "img/s007.webp",
        name: "森界の怒り",
        type: "magic",
        subType: "normal",
        attribute: "草",
        categories: ["森界"],
        text: "パワーが元々の数値より低下している相手フィールドのモンスター1体を選択して破壊する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "destroy", trigger: "on_activate", targetSelect: "manual", targetSide: "opponent", condition: "is_weakened" }]
    },
    "s008": {
        id: "s008",
        image: "img/s008.webp",
        name: "新緑召集",
        type: "magic",
        subType: "normal",
        attribute: "草",
        categories: [],
        text: "自分のデッキからレベル1の草属性モンスターをランダムに2枚手札に加える。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "search", trigger: "on_activate", count: 2, filter: { level: 1, attribute: "草" }, targetSelect: "random" }]
    },
    "s009": {
        id: "s009",
        image: "img/s009.webp",
        name: "森界の門",
        type: "magic",
        subType: "permanent",
        attribute: "草",
        categories: ["森界"],
        text: "自分フィールド上に【森界】モンスターが存在する限り、相手フィールドのモンスターのパワーは200ダウンする。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "global_buff", trigger: "always", condition: "has_category_on_field", category: "森界", targetSide: "opponent", value: -200 }]
    },

    // =================================================================
    // 光属性 (Light)
    // =================================================================
    "m016": {
        id: "m016",
        image: "img/m016.webp",
        name: "聖界の精霊 ピック",
        type: "monster",
        subType: "effect",
        attribute: "光",
        level: 1,
        power: 400,
        categories: ["聖界"],
        text: "このモンスターを召喚・特殊召喚した時、自分のLPを500回復する。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "heal", trigger: "on_summon", value: 500 }]
    },
    "m017": {
        id: "m017",
        image: "img/m017.webp",
        name: "聖界の盾兵 シルディン",
        type: "monster",
        subType: "effect",
        attribute: "光",
        level: 1,
        power: 400,
        categories: ["聖界"],
        text: "このモンスターは1ターンに1度だけ、戦闘では破壊されない。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "battle_protection", trigger: "always", countLimit: "once_per_turn", target: "self" }]
    },
    "m018": {
        id: "m018",
        image: "img/m018.webp",
        name: "聖界の騎士 ジャスティス",
        type: "monster",
        subType: "effect",
        attribute: "光",
        level: 2,
        power: 800,
        categories: ["聖界"],
        text: "このモンスターがフィールドに存在する限り、自分フィールドの光属性モンスターはそれぞれ1ターンに1度だけ戦闘では破壊されない。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "global_protection", trigger: "always", filter: { attribute: "光" }, countLimit: "once_per_turn" }]
    },
    "m019": {
        id: "m019",
        image: "img/m019.webp",
        name: "聖界王 レオニダス",
        type: "monster",
        subType: "effect",
        attribute: "光",
        level: 4,
        power: 2000,
        categories: ["聖界"],
        text: "①このカードが召喚・特殊召喚した時、自分のLPを1000回復する。\n②1ターンに1度、自分のLPが回復した時、自分の光属性モンスター全てのパワーを300アップする。",
        summonRequirement: { type: "normal", costCount: 3, costFilter: { minLevel: 1 } },
        logic: [
            { type: "heal", trigger: "on_summon", value: 1000 },
            { type: "global_buff", trigger: "on_lp_gain", targetSide: "self", filter: { attribute: "光" }, value: 300, duration: "permanent", countLimit: "once_per_turn" }
        ]
    },
    "m030": {
        id: "m030",
        image: "img/m030.webp",
        name: "聖界の祈祷師 ウラーウェス",
        type: "monster",
        subType: "effect",
        attribute: "光",
        level: 2,
        power: 800,
        categories: ["聖界"],
        text: "1ターンに1度、自分のLPを600回復する。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "heal", trigger: "ignition", value: 600, countLimit: "once_per_turn" }]
    },
    "s010": {
        id: "s010",
        image: "img/s010.webp",
        name: "聖なる祈り",
        type: "magic",
        subType: "normal",
        attribute: "光",
        categories: [],
        text: "自分のLPを500回復し、自分のデッキからレベル1の光属性モンスターをランダムに2体手札に加える。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "heal", trigger: "on_activate", value: 500 }, { type: "search", trigger: "on_activate", count: 2, filter: { level: 1, attribute: "光" }, targetSelect: "random" }]
    },
    "s011": {
        id: "s011",
        image: "img/s011.webp",
        name: "聖界の結界",
        type: "magic",
        subType: "permanent",
        attribute: "光",
        categories: ["聖界"],
        text: "自分フィールドに聖界モンスターが存在する限り、自分が受ける戦闘ダメージを300ダウンする。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "damage_reduction", trigger: "always", condition: "has_category_on_field", category: "聖界", value: 300 }]
    },
    "s012": {
        id: "s012",
        image: "img/s012.webp",
        name: "光の導き",
        type: "magic",
        subType: "normal",
        attribute: "光",
        categories: [],
        text: "自分のトラッシュからレベル2の光属性モンスター1体をランダムに特殊召喚する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "special_summon", trigger: "on_activate", source: "trash", count: 1, filter: { level: 2, attribute: "光" }, targetSelect: "random" }]
    },

    // =================================================================
    // 闇属性 (Dark)
    // =================================================================
    "m020": {
        id: "m020",
        image: "img/m020.webp",
        name: "冥界の番犬 ボスディ",
        type: "monster",
        subType: "effect",
        attribute: "闇",
        level: 1,
        power: 400,
        categories: ["冥界"],
        text: "このモンスターを召喚・特殊召喚した時、自分のデッキの上から3枚トラッシュする。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "mill", trigger: "on_summon", count: 3 }]
    },
    "m021": {
        id: "m021",
        image: "img/m021.webp",
        name: "冥界騎士 ゾグドルゴス",
        type: "monster",
        subType: "effect",
        attribute: "闇",
        level: 1,
        power: 400,
        categories: ["冥界"],
        text: "このモンスターを召喚・特殊召喚した時、自分のトラッシュから【冥界】魔術をランダムに1枚手札に加える。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "salvage", trigger: "on_summon", filter: { category: "冥界", type: "magic" }, targetSelect: "random" }]
    },
    "m022": {
        id: "m022",
        image: "img/m022.webp",
        name: "冥界の魔術師 ソルン",
        type: "monster",
        subType: "effect",
        attribute: "闇",
        level: 2,
        power: 900,
        categories: ["冥界"],
        text: "1ターンに1度、自分のデッキの上から3枚トラッシュする。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "mill", trigger: "ignition", count: 3, countLimit: "once_per_turn" }]
    },
    "m023": {
        id: "m023",
        image: "img/m023.webp",
        name: "冥界王 ハイヤデスード",
        type: "monster",
        subType: "effect",
        attribute: "闇",
        level: 4,
        power: 2300,
        categories: ["冥界"],
        text: "1ターンに1度、【冥界】モンスターが自分のトラッシュに送られた時、相手フィールドのモンスター1体をランダムに破壊する。",
        summonRequirement: { type: "normal", costCount: 3, costFilter: { minLevel: 1 } },
        logic: [{ type: "destroy", trigger: "on_card_trashed", triggerFilter: { category: "冥界", type: "monster" }, targetSide: "opponent", targetSelect: "random", count: 1, countLimit: "once_per_turn" }]
    },
    "m031": {
        id: "m031",
        image: "img/m031.webp",
        name: "冥界の亡霊 ソルゴス",
        type: "monster",
        subType: "effect",
        attribute: "闇",
        level: 3,
        power: 1300,
        categories: ["冥界"],
        text: "このモンスターを召喚・特殊召喚した時、デッキの上から3枚トラッシュする。その後、トラッシュからレベル2以下の【冥界】モンスター1体をランダムに特殊召喚する。",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: [
            { type: "mill", trigger: "on_summon", count: 3 },
            { type: "special_summon", trigger: "on_summon", source: "trash", count: 1, filter: { category: "冥界", maxLevel: 2 }, targetSelect: "random" }
        ]
    },
    "s013": {
        id: "s013",
        image: "img/s013.webp",
        name: "闇の生贄",
        type: "magic",
        subType: "normal",
        attribute: "闇",
        categories: [],
        text: "自分のデッキの上から5枚トラッシュする。その後、自分のトラッシュから闇属性モンスター1枚を手札に加える。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "mill", trigger: "on_activate", count: 5 }, { type: "salvage", trigger: "on_activate", filter: { attribute: "闇", type: "monster" }, targetSelect: "random" }]
    },
    "s014": {
        id: "s014",
        image: "img/s014.webp",
        name: "冥界からの迎え",
        type: "magic",
        subType: "normal",
        attribute: "闇",
        categories: ["冥界"],
        text: "自分と相手フィールドのモンスターを1体ずつ選択して破壊する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "destroy", trigger: "on_activate", targetSide: "self", targetSelect: "manual", count: 1 }, { type: "destroy", trigger: "on_activate", targetSide: "opponent", targetSelect: "manual", count: 1 }]
    },
    "s015": {
        id: "s015",
        image: "img/s015.webp",
        name: "冥界の呼び声",
        type: "magic",
        subType: "normal",
        attribute: "闇",
        categories: ["冥界"],
        text: "自分のトラッシュからレベル2の【冥界】モンスター1体をランダムに特殊召喚する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "special_summon", trigger: "on_activate", source: "trash", count: 1, filter: { category: "冥界", level: 2 }, targetSelect: "random" }]
    },

    // =================================================================
    // 無属性 (Neutral)
    // =================================================================
    "m024": {
        id: "m024",
        image: "img/m024.webp",
        name: "スカウト・ドローン",
        type: "monster",
        subType: "normal",
        attribute: "無",
        level: 1,
        power: 500,
        categories: [],
        text: "",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: []
    },
    "m025": {
        id: "m025",
        image: "img/m025.webp",
        name: "ガード・メカニクス",
        type: "monster",
        subType: "normal",
        attribute: "無",
        level: 2,
        power: 1000,
        categories: [],
        text: "",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: []
    },
    "m026": {
        id: "m026",
        image: "img/m026.webp",
        name: "アサルト・フレーム",
        type: "monster",
        subType: "normal",
        attribute: "無",
        level: 3,
        power: 1500,
        categories: [],
        text: "",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: []
    },
    "m027": {
        id: "m027",
        image: "img/m027.webp",
        name: "リサーチ・ポッド",
        type: "monster",
        subType: "effect",
        attribute: "無",
        level: 1,
        power: 200,
        categories: [],
        text: "このモンスターが召喚・特殊召喚した時、2枚ドローし、その後手札を1枚選択して捨てる。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "draw_and_discard", trigger: "on_summon", drawCount: 2, discardCount: 1, discardType: "manual" }]
    },
    "m028": {
        id: "m028",
        image: "img/m028.webp",
        name: "バリア・ジェネレーター",
        type: "monster",
        subType: "effect",
        attribute: "無",
        level: 2,
        power: 800,
        categories: [],
        text: "このモンスターは1ターンに1度だけ、戦闘では破壊されない。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "battle_protection", trigger: "always", countLimit: "once_per_turn", target: "self" }]
    },
    "m029": {
        id: "m029",
        image: "img/m029.webp",
        name: "ブースター・メカ",
        type: "monster",
        subType: "effect",
        attribute: "無",
        level: 2,
        power: 800,
        categories: [],
        text: "このカードが召喚・特殊召喚した時、自分フィールドのモンスター1体のパワーをターン終了時まで300アップする。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "buff", trigger: "on_summon", targetSelect: "manual", value: 300, duration: "until_end_turn" }]
    },
    "s016": {
        id: "s016",
        image: "img/s016.webp",
        name: "パワー・ブースト",
        type: "magic",
        subType: "normal",
        attribute: "無",
        categories: [],
        text: "自分フィールドのモンスター1体のパワーを300アップする。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "buff", trigger: "on_activate", targetSelect: "manual", value: 300, duration: "until_end_turn" }]
    },
    "s017": {
        id: "s017",
        image: "img/s017.webp",
        name: "ウィークネス・レイ",
        type: "magic",
        subType: "normal",
        attribute: "無",
        categories: [],
        text: "相手フィールドのモンスター1体のパワーを300ダウンさせる。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "buff", trigger: "on_activate", targetSide: "opponent", targetSelect: "manual", value: -300, duration: "until_end_turn" }]
    },
    "s018": {
        id: "s018",
        image: "img/s018.webp",
        name: "マインド・リサーチ",
        type: "magic",
        subType: "normal",
        attribute: "無",
        categories: [],
        text: "2枚ドローし、その後手札を2枚選択して捨てる。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "draw_and_discard", trigger: "on_activate", drawCount: 2, discardCount: 2, discardType: "manual" }]
    },

    // =================================================================
    // 追加カード (通常魔術・罠魔術)
    // 罠魔術は伏せて設置し、条件を満たした瞬間に強制発動する。
    // =================================================================
    "s019": {
        id: "s019",
        image: "img/s019.webp",
        icon: "GiAngelWings",
        name: "奇跡の復活",
        type: "magic",
        subType: "normal",
        attribute: "無",
        categories: [],
        text: "自分のトラッシュからレベル3以下のモンスター1体をランダムに特殊召喚する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "special_summon", trigger: "on_activate", source: "trash", count: 1, filter: { maxLevel: 3 }, targetSelect: "random" }]
    },
    "s020": {
        id: "s020",
        image: "img/s020.webp",
        icon: "GiBouncingSpring",
        name: "スモール・スプリング",
        type: "magic",
        subType: "trap",
        attribute: "無",
        categories: [],
        text: "相手がレベル1のモンスター1体以上を召喚・特殊召喚した時に発動する。そのモンスターを全て持ち主の手札に戻す。",
        summonRequirement: { type: "magic_activation" },
        logic: [{
            type: "bounce",
            trigger: "on_opponent_summon",
            condition: { summonedFilter: { level: 1 } },
            targetSelect: "event",
            filter: { level: 1 }
        }]
    },
    "s021": {
        id: "s021",
        image: "img/s021.webp",
        icon: "GiTerror",
        name: "威圧の罠",
        type: "magic",
        subType: "trap",
        attribute: "無",
        categories: [],
        text: "相手がレベル3以上のモンスターで攻撃した時に発動する。そのモンスターのパワーを500ダウンさせる。",
        summonRequirement: { type: "magic_activation" },
        logic: [{
            type: "buff",
            trigger: "on_opponent_attack",
            condition: { attackerFilter: { minLevel: 3 } },
            targetSelect: "event_attacker",
            value: -500,
            duration: "until_end_turn"
        }]
    },
    "s022": {
        id: "s022",
        image: "img/s022.webp",
        icon: "GiFireShield",
        name: "炎界の加護",
        type: "magic",
        subType: "trap",
        attribute: "火",
        categories: ["炎界"],
        text: "相手が自分の火属性モンスターに攻撃した時に発動する。その自分モンスターのパワーを500アップさせる。",
        summonRequirement: { type: "magic_activation" },
        logic: [{
            type: "buff",
            trigger: "on_opponent_attack",
            condition: { defenderFilter: { attribute: "火" } },
            targetSelect: "event_defender",
            value: 500,
            duration: "until_end_turn"
        }]
    },
    "s023": {
        id: "s023",
        image: "img/s023.webp",
        icon: "GiBigWave",
        name: "海界の奇跡",
        type: "magic",
        subType: "trap",
        attribute: "水",
        categories: ["海界"],
        text: "自分のレベル2以上の水属性モンスターが破壊され、トラッシュに送られた時に発動する。そのモンスターを特殊召喚する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{
            type: "special_summon",
            trigger: "on_own_monster_destroyed",
            condition: { destroyedFilter: { attribute: "水", minLevel: 2 } },
            source: "event"
        }]
    },
    "s024": {
        id: "s024",
        image: "img/s024.webp",
        icon: "GiThornyVine",
        name: "森界の壁",
        type: "magic",
        subType: "trap",
        attribute: "草",
        categories: ["森界"],
        text: "相手が攻撃した時、そのモンスターのパワーが元々のパワーより300以上ダウンしている場合に発動する。その攻撃モンスターを破壊する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{
            type: "destroy",
            trigger: "on_opponent_attack",
            condition: { attackerWeakenedBy: 300 },
            targetSelect: "event_attacker"
        }]
    },
    "s025": {
        id: "s025",
        image: "img/s025.webp",
        icon: "GiHolyWater",
        name: "聖界の雫",
        type: "magic",
        subType: "trap",
        attribute: "光",
        categories: ["聖界"],
        text: "相手が攻撃した時に発動する。自分のLPを500回復する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "heal", trigger: "on_opponent_attack", value: 500 }]
    },
    "s026": {
        id: "s026",
        image: "img/s026.webp",
        icon: "GiVortex",
        name: "冥界の歪み",
        type: "magic",
        subType: "trap",
        attribute: "闇",
        categories: ["冥界"],
        text: "相手がモンスターを召喚・特殊召喚した時に発動する。自分のデッキの上から5枚をトラッシュする。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "mill", trigger: "on_opponent_summon", count: 5 }]
    },

    // =================================================================
    // 拡張セット: 各カテゴリのレベル2・3を補強するモンスター
    // 画像未作成のカードには icon を設定してある（card_art_fallback で表示）
    // =================================================================

    // --- 無属性（機械） ---
    "m032": {
        id: "m032",
        image: "img/m032.webp",
        icon: "GiSniffingDog",
        name: "セキュリティ・ハウンド",
        type: "monster",
        subType: "effect",
        attribute: "無",
        level: 1,
        power: 300,
        categories: [],
        text: "1ターンに1度、自分の手札を1枚トラッシュに送って発動できる。相手フィールドの魔術1枚を選択して破壊する。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{
            type: "destroy_magic",
            trigger: "ignition",
            countLimit: "once_per_turn",
            targetSide: "opponent",
            targetSelect: "manual",
            count: 1,
            cost: { discardHand: 1 }
        }]
    },

    // --- 火属性（炎界） ---
    "m033": {
        id: "m033",
        image: "img/m033.webp",
        icon: "GiTrumpet",
        name: "炎界の伝令 フレアス",
        type: "monster",
        subType: "effect",
        attribute: "火",
        level: 2,
        power: 900,
        categories: ["炎界"],
        text: "このモンスターを召喚・特殊召喚した時、自分のデッキから【炎界】魔術1枚をランダムに手札に加える。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "search", trigger: "on_summon", count: 1, filter: { category: "炎界", type: "magic" }, targetSelect: "random" }]
    },
    "m034": {
        id: "m034",
        image: "img/m034.webp",
        icon: "GiCannon",
        name: "炎界の砲手 ドラグバレル",
        type: "monster",
        subType: "effect",
        attribute: "火",
        level: 3,
        power: 1200,
        categories: ["炎界"],
        text: "このモンスターが召喚・特殊召喚した時、自分の炎属性モンスター1体のパワーを500アップする。",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: [{ type: "buff", trigger: "on_summon", targetSelect: "manual", filter: { attribute: "火" }, value: 500, duration: "permanent" }]
    },

    // --- 水属性（海界） ---
    "m035": {
        id: "m035",
        image: "img/m035.webp",
        icon: "GiTrident",
        name: "海界の潮騎士 タイダル",
        type: "monster",
        subType: "effect",
        attribute: "水",
        level: 3,
        power: 1200,
        categories: ["海界"],
        text: "①このモンスターを召喚・特殊召喚した時、自分のデッキの上から2枚をトラッシュする。\n②このモンスターがトラッシュに送られた時、自分のトラッシュからレベル2以下の【海界】モンスター1体をランダムに特殊召喚する。",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: [
            { type: "mill", trigger: "on_summon", count: 2 },
            { type: "special_summon", trigger: "on_sent_to_trash", source: "trash", count: 1, filter: { category: "海界", maxLevel: 2 }, targetSelect: "random" }
        ]
    },
    "m036": {
        id: "m036",
        image: "img/m036.webp",
        icon: "GiCompass",
        name: "海界の羅針 ナビス",
        type: "monster",
        subType: "effect",
        attribute: "水",
        level: 2,
        power: 900,
        categories: ["海界"],
        text: "このモンスターを召喚・特殊召喚した時、自分のデッキの上から2枚をトラッシュする。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "mill", trigger: "on_summon", count: 2 }]
    },

    // --- 草属性（森界） ---
    "m037": {
        id: "m037",
        image: "img/m037.webp",
        icon: "GiSpiderWeb",
        name: "森界の罠師 ヴァイン",
        type: "monster",
        subType: "effect",
        attribute: "草",
        level: 2,
        power: 900,
        categories: ["森界"],
        text: "このモンスターを召喚・特殊召喚した時、自分のデッキから罠魔術を1枚ランダムに手札に加える。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "search", trigger: "on_summon", count: 1, filter: { type: "magic", subType: "trap" }, targetSelect: "random" }]
    },
    "m038": {
        id: "m038",
        image: "img/m038.webp",
        icon: "GiOak",
        name: "森界の巨木 エルドラント",
        type: "monster",
        subType: "effect",
        attribute: "草",
        level: 3,
        power: 1000,
        categories: ["森界"],
        text: "このモンスターを召喚・特殊召喚した時、相手フィールドのモンスター全てのパワーを300ダウンする。その後、パワーが元々の数値より低下している相手フィールドのモンスター1体を選択して破壊する。",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: [
            { type: "global_buff", trigger: "on_summon", targetSide: "opponent", value: -300, duration: "permanent" },
            { type: "destroy", trigger: "on_summon", targetSide: "opponent", targetSelect: "manual", condition: "is_weakened", count: 1 }
        ]
    },

    // --- 光属性（聖界） ---
    "m039": {
        id: "m039",
        image: "img/m039.webp",
        icon: "GiHealing",
        name: "聖界の癒し手 ルミナ",
        type: "monster",
        subType: "effect",
        attribute: "光",
        level: 2,
        power: 800,
        categories: ["聖界"],
        text: "①このモンスターを召喚・特殊召喚した時、自分のLPを400回復する。\n②1ターンに1度、自分のLPが回復した時、自分のデッキから【聖界】カード1枚をランダムに手札に加える。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [
            { type: "heal", trigger: "on_summon", value: 400 },
            { type: "search", trigger: "on_lp_gain", count: 1, filter: { category: "聖界" }, targetSelect: "random", countLimit: "once_per_turn" }
        ]
    },
    "m040": {
        id: "m040",
        image: "img/m040.webp",
        icon: "GiScales",
        name: "聖界の審判者 セラフィム",
        type: "monster",
        subType: "effect",
        attribute: "光",
        level: 3,
        power: 1200,
        categories: ["聖界"],
        text: "①このモンスターを召喚・特殊召喚した時、自分のLPを800回復する。\n②このモンスターが自分フィールドに存在する限り、自分のモンスターは相手の魔術の効果を受けない。",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: [
            { type: "heal", trigger: "on_summon", value: 800 },
            { type: "resist_magic", trigger: "always", targetSide: "self" }
        ]
    },

    // --- 闇属性（冥界） ---
    "m041": {
        id: "m041",
        image: "img/m041.webp",
        icon: "GiTombstone",
        name: "冥界の墓守 グレイヴ",
        type: "monster",
        subType: "effect",
        attribute: "闇",
        level: 2,
        power: 900,
        categories: ["冥界"],
        text: "このモンスターを召喚・特殊召喚した時、自分のデッキの上から3枚トラッシュする。その後、自分のトラッシュから【冥界】魔術を1枚ランダムに手札に加える。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [
            { type: "mill", trigger: "on_summon", count: 3 },
            { type: "salvage", trigger: "on_summon", count: 1, filter: { category: "冥界", type: "magic" }, targetSelect: "random" }
        ]
    },
    "m042": {
        id: "m042",
        image: "img/m042.webp",
        icon: "GiCrownedSkull",
        name: "冥界の骸兵長 ネクローズ",
        type: "monster",
        subType: "effect",
        attribute: "闇",
        level: 3,
        power: 1100,
        categories: ["冥界"],
        text: "このモンスターを召喚・特殊召喚した時、自分のトラッシュのカード3枚を除外して発動できる。相手フィールドのモンスター1体を選択して破壊する。",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: [{
            type: "destroy",
            trigger: "on_summon",
            targetSide: "opponent",
            targetSelect: "manual",
            count: 1,
            cost: { banishTrash: 3 }
        }]
    },

    // --- 汎用魔術 ---
    "s027": {
        id: "s027",
        image: "img/s027.webp",
        icon: "GiFishingHook",
        name: "トラップ・サルベージ",
        type: "magic",
        subType: "normal",
        attribute: "無",
        categories: [],
        text: "自分のトラッシュから罠魔術を1枚ランダムに手札に加える。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "salvage", trigger: "on_activate", count: 1, filter: { type: "magic", subType: "trap" }, targetSelect: "random" }]
    },
    
    // --- 新規追加カード ---
    "m043": {
        id: "m043",
        icon: "GiAngelWings",
        name: "メタリック・ワイバーン",
        type: "monster",
        subType: "normal",
        attribute: "無",
        level: 4,
        power: 2500,
        categories: [],
        text: "全身が硬い金属で覆われたワイバーン。その一撃は岩を砕く。",
        summonRequirement: { type: "normal", costCount: 3, costFilter: { minLevel: 1 } }
    },
    "m044": {
        id: "m044",
        icon: "GiFireShield",
        name: "ジェネラル・フォートレス",
        type: "monster",
        subType: "normal",
        attribute: "無",
        level: 5,
        power: 3000,
        categories: [],
        text: "難攻不落の巨大な要塞。圧倒的な防御力と火力を誇る。",
        summonRequirement: { type: "normal", costCount: 3, costFilter: { type: "monster", subType: "normal", minLevel: 1 } }
    },
    "s028": {
        id: "s028",
        icon: "GiCannon",
        name: "炎界加熱式砲台",
        type: "magic",
        subType: "permanent",
        attribute: "火",
        categories: ["炎界"],
        text: "1ターンに1度、自分の火属性モンスターのパワーがアップした時、1枚ドローする。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "draw_card", trigger: "on_power_up", targetSide: "self", filter: { attribute: "火" }, count: 1, countLimit: "once_per_turn" }]
    },
    "s029": {
        id: "s029",
        icon: "GiVortex",
        name: "海界の儀式",
        type: "magic",
        subType: "normal",
        attribute: "水",
        categories: ["海界"],
        text: "自分のデッキからレベル3以上の【海界】モンスター2枚をランダムに手札に加え、その後手札を2枚選択して捨てる。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "search", trigger: "on_activate", count: 2, filter: { category: "海界", type: "monster", minLevel: 3 }, targetSelect: "random", followUp: { type: "discard", count: 2, targetSelect: "manual" } }]
    },
    "s030": {
        id: "s030",
        icon: "GiOak",
        name: "森界転生",
        type: "magic",
        subType: "normal",
        attribute: "草",
        categories: ["森界"],
        text: "自分フィールドまたは手札から【森界】カード1枚をトラッシュし、2枚ドローする。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "draw_card", trigger: "on_activate", count: 2, cost: { sendToTrash: 1, filter: { category: "森界" }, location: ["field", "hand"] } }]
    },
    "s031": {
        id: "s031",
        icon: "GiHolyWater",
        name: "聖界光波",
        type: "magic",
        subType: "normal",
        attribute: "光",
        categories: ["聖界"],
        text: "自分のLPを2000払い、相手のモンスター1体を選択して除外する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "banish", trigger: "on_activate", targetSide: "opponent", targetSelect: "manual", count: 1, cost: { payLp: 2000 } }]
    },
    "s032": {
        id: "s032",
        icon: "GiTombstone",
        name: "冥界の命綱",
        type: "magic",
        subType: "permanent",
        attribute: "闇",
        categories: ["冥界"],
        text: "1ターンに1度、闇属性のカードが自分のデッキからトラッシュに送られた時、自分のトラッシュから闇属性のカードをランダムに2枚手札に加える。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "salvage", trigger: "on_deck_trashed", filter: { attribute: "闇" }, count: 2, targetSelect: "random", countLimit: "once_per_turn" }]
    },
    "s033": {
        id: "s033",
        icon: "GiTerror",
        name: "魔術破壊",
        type: "magic",
        subType: "normal",
        attribute: "無",
        categories: [],
        text: "自分の手札1枚をトラッシュし、相手フィールドの魔術1枚を破壊する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "destroy_magic", trigger: "on_activate", targetSide: "opponent", targetSelect: "manual", count: 1, cost: { discardHand: 1 } }]
    }
};



/**
 * IDからカードデータのディープコピーを取得する
 * @param {string} cardId
 * @returns {Object|null}
 */
function getCardData(cardId) {
    if (!MASTER_CARDS[cardId]) return null;
    return JSON.parse(JSON.stringify(MASTER_CARDS[cardId]));
}

/**
 * 魔術カードの種別表記を返す
 * @param {string} subType - "normal" | "permanent" | "trap"
 */
function getMagicTypeLabel(subType) {
    switch (subType) {
        case 'permanent': return '永続魔術';
        case 'trap': return '罠魔術';
        default: return '通常魔術';
    }
}
