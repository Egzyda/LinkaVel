import sys
import re

def patch_surrender(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    pattern = r"if \(await window\.showCustomConfirm\(\"本当に降参しますか.\"\)\) \{\s*endGameSequence\(\"opponent\"\);\s*\}"
    new_code = """if (await window.showCustomConfirm("本当に降参しますか？")) {
                if (GAME_STATE.isOnlineMatch) {
                    NetworkManager.sendAction('SURRENDER', {});
                }
                endGameSequence("opponent");
            }"""
    
    content = re.sub(pattern, new_code, content)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched surrender!")

if __name__ == '__main__':
    patch_surrender('main.js')
