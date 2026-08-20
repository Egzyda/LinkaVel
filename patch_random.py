import sys

def replace_random(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace('Math.random', 'GameRandom')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    replace_random('main.js')
    replace_random('effect_logic.js')
