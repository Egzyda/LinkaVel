/**
 * LinkaVel Card Game - Tutorial (遊び方画面)
 * 役割: タブ切り替えとカード実例の描画
 */

const Tutorial = {
    initialized: false,

    open() {
        showScreen('tutorial-screen');
        if (!this.initialized) {
            this.setupTabs();
            this.renderExamples();
            this.initialized = true;
        }
    },

    setupTabs() {
        const tabs = document.querySelectorAll('.tutorial-tab');
        const sections = document.querySelectorAll('.tutorial-section');
        const body = document.querySelector('.tutorial-body');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                sections.forEach(sec => {
                    sec.classList.toggle('active', sec.dataset.section === tab.dataset.tab);
                });
                if (body) body.scrollTop = 0;
            });
        });
    },

    /** 実際のカードデータを使って例を描画する（main.js の createCardElement を再利用） */
    renderExamples() {
        this.renderCardExample('tut-example-normal', 'm003');    // 通常モンスター
        this.renderCardExample('tut-example-effect', 'm002');    // 効果モンスター
        this.renderCardExample('tut-example-cost', 'm005');      // コスト3の上級モンスター
        this.renderCardExample('tut-example-magic', 's016');     // 通常魔術
        this.renderCardExample('tut-example-permanent', 's009'); // 永続魔術
        this.renderCardExample('tut-example-trap', 's021');      // 罠魔術
    },

    renderCardExample(containerId, cardId) {
        const container = document.getElementById(containerId);
        if (!container || typeof createCardElement !== 'function') return;
        const card = (typeof getCardData === 'function') ? getCardData(cardId) : null;
        if (!card) return;

        container.innerHTML = "";
        const el = createCardElement(card, 'preview');
        container.appendChild(el);
    }
};

function openTutorial() {
    Tutorial.open();
}
