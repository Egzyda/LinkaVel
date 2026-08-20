import sys
import re

def patch_btn(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the btn.onclick inside selectHandCardsUI
    pattern = r"btn\.onclick = \(\) => \{\s*if \(selectedIndices\.length === count\) \{\s*modal\.style\.display = \"none\";\s*resolve\(selectedIndices\);\s*\}\s*\};"
    new_btn = """btn.onclick = () => {
            if (selectedIndices.length === count) {
                modal.style.display = "none";
                if (GAME_STATE.isOnlineMatch) NetworkManager.sendAction('HAND_CARDS_SELECTED', { result: selectedIndices });
                resolve(selectedIndices);
            }
        };"""
    content = re.sub(pattern, new_btn, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched btn!")

if __name__ == '__main__':
    patch_btn('main.js')
