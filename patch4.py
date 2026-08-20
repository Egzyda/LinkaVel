import sys
import re

def patch_effect_logic(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. line 533
    pattern1 = r"if \(action\.targetSelect === \"manual\" && side === \"player\" && GAME_STATE\.turnPlayer === \"player\"\) \{"
    new1 = 'if (action.targetSelect === "manual" && (side === "player" || GAME_STATE.isOnlineMatch)) {'
    content = re.sub(pattern1, new1, content)

    # 2. line 772 (inside if (select === "manual"))
    pattern2 = r"if \(select === \"manual\"\) \{\s*if \(side === \"player\"\) \{"
    new2 = 'if (select === "manual") {\n            if (side === "player" || GAME_STATE.isOnlineMatch) {'
    content = re.sub(pattern2, new2, content)

    # 3. line 842 discardType manual
    pattern3 = r"if \(side === \"player\" && action\.discardType === \"manual\"\) \{"
    new3 = 'if ((side === "player" || GAME_STATE.isOnlineMatch) && action.discardType === "manual") {'
    content = re.sub(pattern3, new3, content)

    # 4. line 574 selectHandCardsUI inside resolveDrawAndDiscard? Let's check what's there
    pattern4 = r"if \(side === \"player\" && GAME_STATE\.turnPlayer === \"player\" && typeof selectHandCardsUI === \"function\"\) \{"
    new4 = 'if ((side === "player" || GAME_STATE.isOnlineMatch) && typeof selectHandCardsUI === "function") {'
    content = re.sub(pattern4, new4, content)

    # 5. line 992 selectHandCardsUI
    pattern5 = r"if \(side === \"player\" && GAME_STATE\.turnPlayer === \"player\" && typeof selectHandCardsUI === \"function\"\) \{"
    new5 = 'if ((side === "player" || GAME_STATE.isOnlineMatch) && typeof selectHandCardsUI === "function") {'
    content = re.sub(pattern5, new5, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched effect logic!")

if __name__ == '__main__':
    patch_effect_logic('effect_logic.js')
