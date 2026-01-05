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
        logic: [{ type: "passive_buff", trigger: "always", condition: "is_opponent_turn", target: "self", value: 500 }]
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
        text: "このモンスターを召喚・特殊召喚した時、デッキからレベル1のモンスターをランダムに1体特殊召喚できる。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "special_summon", trigger: "on_summon", source: "deck", count: 1, filter: { level: 1 }, optional: true }]
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
        text: "このモンスターを召喚・特殊召喚した時、自分のトラッシュからレベル1のモンスターを2体ランダムに特殊召喚する。",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: [{ type: "special_summon", trigger: "on_summon", source: "trash", count: 2, filter: { level: 1 }, optional: false }]
    },
    "m005": {
        id: "m005",
        image: "img/m005.webp",
        name: "炎界王 ヴァルトガス",
        type: "monster",
        subType: "effect",
        attribute: "火",
        level: 4,
        power: 1700,
        categories: ["炎界"],
        text: "①1ターンに1度、自分のデッキからレベル2以下の【炎界】モンスターを1体ランダムに特殊召喚する。\n②このモンスターがフィールドに存在する限り、自分の火属性モンスターのパワーは300アップする。",
        summonRequirement: { type: "normal", costCount: 3, costFilter: { minLevel: 1 } },
        logic: [
            { type: "special_summon", trigger: "ignition", countLimit: "once_per_turn", source: "choice_deck_or_trash", count: 1, filter: { category: "炎界" } },
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
        text: "自分のデッキからレベル1の炎属性モンスターをランダムに2体特殊召喚する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "special_summon", trigger: "on_activate", source: "deck", count: 2, filter: { level: 1, attribute: "火" } }]
    },
    "s002": {
        id: "s002",
        image: "img/s002.webp",
        name: "炎界蘇生",
        type: "magic",
        subType: "normal",
        attribute: "火",
        categories: ["炎界"],
        text: "自分のトラッシュからレベル2の【炎界】モンスターを1体ランダムに特殊召喚する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "special_summon", trigger: "on_activate", source: "trash", count: 1, filter: { maxLevel: 3, category: "炎界" }, targetSelect: "manual" }]
    },
    "s003": {
        id: "s003",
        image: "img/s003.webp",
        name: "フレイムラッシュ",
        type: "magic",
        subType: "normal",
        attribute: "火",
        categories: [],
        text: "自分のフィールドの火属性モンスター1体のパワーを、相手ターン終了時まで500アップする。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "buff", trigger: "on_activate", targetSelect: "manual", value: 500, duration: "until_opponent_end" }]
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
        power: 400,
        categories: [],
        text: "このモンスターがトラッシュに送られた時、自分は2枚ドローする。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "draw_card", trigger: "on_destroyed_by_battle", count: 2 }]
    },
    "m007": {
        id: "m007",
        image: "img/m007.webp",
        name: "海界の稚魚 クリオ",
        type: "monster",
        subType: "effect",
        attribute: "水",
        level: 1,
        power: 300,
        categories: ["海界"],
        text: "このモンスターがトラッシュに送られた時、自分のデッキから水属性のレベル1モンスターを2体ランダムに特殊召喚する。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "special_summon", trigger: "on_destroyed_by_battle", source: "deck", count: 2, filter: { attribute: "水", level: 1 } }]
    },
    "m008": {
        id: "m008",
        image: "img/m008.webp",
        name: "海界の戦士 アトラス",
        type: "monster",
        subType: "normal",
        attribute: "水",
        level: 2,
        power: 800,
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
        logic: [{ type: "salvage", trigger: "on_destroyed_by_battle", source: "trash", count: 1, filter: { category: "海界", type: "magic" } }]
    },
    "m010": {
        id: "m010",
        image: "img/m010.webp",
        name: "海界王 シータイド",
        type: "monster",
        subType: "effect",
        attribute: "水",
        level: 4,
        power: 2100,
        categories: ["海界"],
        text: "このモンスターがトラッシュに送られた時、自分のデッキ・トラッシュからレベル2以下の【海界】モンスターをランダムに2体特殊召喚する。",
        summonRequirement: { type: "normal", costCount: 3, costFilter: { minLevel: 1 } },
        logic: [{ type: "special_summon", trigger: "on_destroyed_by_battle", source: "choice_deck_or_trash", count: 2, filter: { category: "海界", maxLevel: 2 } }]
    },
    "s004": {
        id: "s004",
        image: "img/s004.webp",
        name: "海の突撃",
        type: "magic",
        subType: "normal",
        attribute: "水",
        categories: [],
        text: "自分の水属性モンスターを1体選択する。このターン、そのモンスターと戦闘を行った相手モンスターを戦闘後に破壊する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "apply_combat_effect", trigger: "on_activate", targetSelect: "manual", effect: "destroy_opponent_after_combat" }]
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
        logic: [{ type: "salvage", trigger: "on_activate", source: "trash", count: 2, filter: { category: "海界" }, targetSelect: "manual" }]
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
        logic: []
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
        power: 200,
        categories: ["森界"],
        text: "このモンスターを召喚・特殊召喚した時、相手モンスター1体のパワーを400ダウンさせる。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "buff", trigger: "on_summon", targetSelect: "manual", targetSide: "opponent", value: -400, duration: "until_end_turn" }]
    },
    "m013": {
        id: "m013",
        image: "img/m013.webp",
        name: "森界の番人 ボルフ",
        type: "monster",
        subType: "effect",
        attribute: "草",
        level: 2,
        power: 900,
        categories: ["森界"],
        text: "このモンスターを召喚・特殊召喚した時、相手モンスター全てのパワーを400ダウンさせる。",
        summonRequirement: { type: "normal", costCount: 1, costFilter: { minLevel: 1 } },
        logic: [{ type: "global_buff", trigger: "on_summon", targetSide: "opponent", value: -400, duration: "until_end_turn" }]
    },
    "m014": {
        id: "m014",
        image: "img/m013.webp",
        name: "森界の剣闘士 クジャシ",
        type: "monster",
        subType: "effect",
        attribute: "草",
        level: 3,
        power: 1400,
        categories: ["森界"],
        text: "1ターンに1度、デッキから【森界】魔術を1枚ランダムに手札に加える。",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: [{ type: "search", trigger: "ignition", count: 1, filter: { category: "森界", type: "magic" } }]
    },
    "m015": {
        id: "m015",
        image: "img/m015.webp",
        name: "森界王 シルヴァス",
        type: "monster",
        subType: "effect",
        attribute: "草",
        level: 4,
        power: 1700,
        categories: ["森界"],
        text: "このモンスターを召喚・特殊召喚した時、相手モンスター全てのパワーを500ダウンさせる。",
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
        text: "パワーが元々の数値より低下している相手モンスター1体を選択して破壊する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "destroy", trigger: "on_activate", targetSelect: "manual", condition: "is_weakened" }]
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
        logic: [{ type: "search", trigger: "on_activate", count: 2, filter: { level: 1, attribute: "草" } }]
    },
    "s009": {
        id: "s009",
        image: "img/s009.webp",
        name: "森界の門",
        type: "magic",
        subType: "permanent",
        attribute: "草",
        categories: ["森界"],
        text: "自分フィールド上に【森界】モンスターが存在する限り、相手モンスターのパワーは200ダウンする。",
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
        power: 300,
        categories: ["聖界"],
        text: "このモンスターを召喚・特殊召喚した時、自分のLPを500回復する。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "heal", trigger: "on_summon", value: 500 }]
    },
    "m017": {
        id: "m017",
        image: "img/m017.webp",
        name: "聖域の盾兵 シルディン",
        type: "monster",
        subType: "effect",
        attribute: "光",
        level: 1,
        power: 500,
        categories: [],
        text: "このモンスターは1ターンに1度だけ、戦闘では破壊されない。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "battle_protection", countLimit: "once_per_turn", target: "self" }]
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
        text: "このモンスターがフィールドに存在する限り、自分フィールドの光属性モンスターは1ターンに1度だけ戦闘では破壊されない。",
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
        text: "①召喚・特殊召喚時、LPを1000回復する。\n②1ターンに1度、LPが回復した時、ターン終了時まで自身のパワーを700アップする。",
        summonRequirement: { type: "normal", costCount: 3, costFilter: { minLevel: 1 } },
        logic: [
            { type: "heal", trigger: "on_summon", value: 1000 },
            { type: "buff", trigger: "on_lp_gain", target: "self", value: 700, duration: "until_end_turn" }
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
        text: "自分のLPを500回復し、自分のデッキからレベル1の光属性モンスターをランダムに1体手札に加える。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "heal", value: 500 }, { type: "search", count: 1, filter: { level: 1, attribute: "光" } }]
    },
    "s011": {
        id: "s011",
        image: "img/s011.webp",
        name: "聖界の結界",
        type: "magic",
        subType: "permanent",
        attribute: "光",
        categories: ["聖界"],
        text: "自分のフィールドに聖界モンスターが存在する限り、自分が受ける戦闘ダメージを300ダウンする。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "damage_reduction", condition: "has_category_on_field", category: "聖界", value: 300 }]
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
        logic: [{ type: "special_summon", source: "trash", count: 1, filter: { level: 2, attribute: "光" } }]
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
        text: "このモンスターを召喚・特殊召喚した時、自分のデッキの上から3枚をトラッシュする。",
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
        power: 500,
        categories: ["冥界"],
        text: "このモンスターを召喚・特殊召喚した時、自分のトラッシュから【冥界】魔術をランダムに1枚手札に加える。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "salvage", trigger: "on_summon", filter: { category: "冥界", type: "magic" } }]
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
        text: "1ターンに1度、自分のデッキの上から3枚をトラッシュする。",
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
        power: 2000,
        categories: ["冥界"],
        text: "1ターンに1度、自分のトラッシュから闇属性モンスター1体をランダムに特殊召喚できる。",
        summonRequirement: { type: "normal", costCount: 3, costFilter: { minLevel: 1 } },
        logic: [{ type: "special_summon", trigger: "ignition", source: "trash", count: 1, filter: { attribute: "闇" }, countLimit: "once_per_turn" }]
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
        text: "このモンスターを召喚・特殊召喚した時、デッキの上から3枚トラッシュする。その後、トラッシュからレベル2以下の【冥界】1体をランダムに特殊召喚する。",
        summonRequirement: { type: "normal", costCount: 2, costFilter: { minLevel: 1 } },
        logic: [
            { type: "mill", trigger: "on_summon", count: 3 },
            { type: "special_summon", trigger: "on_summon", source: "trash", count: 1, filter: { category: "冥界", maxLevel: 2 } }
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
        text: "自分のデッキの上から5枚をトラッシュする。その後、自分のトラッシュから闇属性モンスター1枚を手札に加える。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "mill", count: 5 }, { type: "salvage", filter: { attribute: "闇", type: "monster" } }]
    },
    "s014": {
        id: "s014",
        image: "img/s014.webp",
        name: "冥界からの迎え",
        type: "magic",
        subType: "normal",
        attribute: "闇",
        categories: ["冥界"],
        text: "自分と相手のフィールドのモンスターを1体ずつ選択して破壊する。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "destroy", targetSelect: "manual", count: 1 }, { type: "destroy", targetSide: "opponent", targetSelect: "manual", count: 1 }]
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
        logic: [{ type: "special_summon", source: "trash", count: 1, filter: { category: "冥界", level: 2 } }]
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
        text: "召喚・特殊召喚時、デッキから2枚ドローし、その後手札を1枚選んで捨てる。",
        summonRequirement: { type: "normal", costCount: 0, costFilter: null },
        logic: [{ type: "draw_and_discard", trigger: "on_summon", drawCount: 2, discardCount: 1 }]
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
        logic: [{ type: "battle_protection", countLimit: "once_per_turn", target: "self" }]
    },
    "m029": {
        id: "m029",
        image: "img/m029.webp",
        name: "ブースター・メカ",
        type: "monster",
        subType: "effect",
        attribute: "無",
        level: 2,
        power: 600,
        categories: [],
        text: "召喚・特殊召喚時、自分のモンスター1体のパワーをターン終了時まで300アップする。",
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
        text: "自分モンスター1体のパワーを300アップする。",
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
        text: "相手モンスター1体のパワーを300ダウンさせる。",
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
        text: "自分のデッキから2枚ドローし、その後手札を2枚選んで捨てる。",
        summonRequirement: { type: "magic_activation" },
        logic: [{ type: "draw_and_discard", trigger: "on_activate", drawCount: 2, discardCount: 2 }]
    }
};

// ==========================================
// デッキレシピ定義 (各30枚)
// ==========================================
const DECK_RECIPES = {
    "starter_fire": {
        name: "燃え盛る炎界",
        cards: [
            "m001", "m001", "m001", // フレイムタイガー
            "m003", "m003", "m003", // 炎界の鼠 チューチャン
            "m027", "m027", "m027", // リサーチ・ポッド
            "m002", "m002", "m002", // 炎界の指揮官 モエス
            "m025", "m025", "m025", // ガード・メカニクス
            "m004", "m004", "m004", // 炎界の戦士 ブレイズ
            "m005", "m005", "m005", // 炎界王 ヴァルトガス
            "s001", "s001", "s001", // 炎界召集
            "s002", "s002", "s002", // 炎界蘇生
            "s003", "s003", "s003"  // フレイムラッシュ
        ]
    },
    "starter_water": {
        name: "静かなる海界",
        cards: [
            "m006", "m006", "m006", // アクア・キャット
            "m007", "m007", "m007", // 海界の稚魚 クリオ
            "m027", "m027", "m027", // リサーチ・ポッド
            "m009", "m009", "m009", // 海界の槍騎士 スピア
            "m028", "m028", "m028", // バリア・ジェネレーター
            "m026", "m026", "m026", // アサルト・フレーム
            "m010", "m010", "m010", // 海界王 シータイド
            "s004", "s004", "s004", // 海の突撃
            "s005", "s005", "s005", // 海界への帰還
            "s006", "s006", "s006"  // アクア・サルベージ
        ]
    },
    "starter_grass": {
        name: "静寂の森界",
        cards: [
            "m011", "m011", "m011", // グリーン・リザード
            "m012", "m012", "m012", // 森界の弓兵 モリファス
            "m027", "m027", "m027", // リサーチ・ポッド
            "m013", "m013", "m013", // 森界の番人 ボルフ
            "m025", "m025", "m025", // ガード・メカニクス
            "m014", "m014", "m014", // 森界の剣闘士 クジャシ
            "m015", "m015", "m015", // 森界王 シルヴァス
            "s007", "s007", "s007", // 森界の怒り
            "s008", "s008", "s008", // 新緑召集
            "s009", "s009", "s009"  // 森界の門
        ]
    },
    "starter_light": {
        name: "輝ける聖界",
        cards: [
            "m016", "m016", "m016", // 聖界の精霊 ピック
            "m017", "m017", "m017", // 聖域の盾兵 シルディン
            "m027", "m027", "m027", // リサーチ・ポッド
            "m030", "m030", "m030", // 聖界の祈祷師 ウラーウェス
            "m018", "m018", "m018", // 聖界の騎士 ジャスティス
            "m026", "m026", "m026", // アサルト・フレーム
            "m019", "m019", "m019", // 聖界王 レオニダス
            "s010", "s010", "s010", // 聖なる祈り
            "s011", "s011", "s011", // 聖界の結界
            "s012", "s012", "s012"  // 光の導き
        ]
    },
    "starter_dark": {
        name: "深淵の冥界",
        cards: [
            "m020", "m020", "m020", // 冥界の番犬 ボスディ
            "m021", "m021", "m021", // 冥界騎士 ゾグドルゴス
            "m027", "m027", "m027", // リサーチ・ポッド
            "m022", "m022", "m022", // 冥界の魔術師 ソルン
            "m028", "m028", "m028", // バリア・ジェネレーター
            "m031", "m031", "m031", // 冥界の亡霊 ソルゴス
            "m023", "m023", "m023", // 冥界王 ハイヤデスード
            "s013", "s013", "s013", // 闇の生贄
            "s014", "s014", "s014", // 冥界からの迎え
            "s015", "s015", "s015"  // 冥界の呼び声
        ]
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
