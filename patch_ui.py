import re

with open('main.js', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r"function selectPlayerDeck\(deckId, type\) \{\s*_pendingPlayerDeck = \{ deckId, type \};"
replacement = """function selectPlayerDeck(deckId, type) {
    if (typeof NetworkManager !== 'undefined' && NetworkManager.roomId) {
        confirmDeckSelection(deckId, type, 'random', 'random');
        return;
    }
    _pendingPlayerDeck = { deckId, type };"""

content = re.sub(pattern, replacement, content)

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched selectPlayerDeck!")
