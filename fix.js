const fs = require('fs');
let c = fs.readFileSync('cards.js', 'utf8');

// icon: "Gi...", の行を削除
c = c.replace(/icon:\s*"Gi[^"]+",\r?\n\s*/g, '');

// s020 〜 s027, m032 〜 m042 などの対象カードで image: "img/..." がなければ追加する
// id の行の直後に挿入する
c = c.replace(/(id:\s*"([^"]+)",\r?\n)(\s*)(name:)/g, (match, p1, id, p3, p4) => {
    // 既に image: がある場合はそのまま
    if (match.includes('image:')) return match;
    
    // image を追加
    return p1 + p3 + `image: "img/${id}.webp",\n` + p3 + p4;
});

fs.writeFileSync('cards.js', c);
console.log("Done");
