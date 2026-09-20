// Home Page
import { navigate } from '../utils/router.js';

export function renderHome(container) {
  container.innerHTML = `
    <div class="page-container">
      <section class="home-hero animate-in">
        <h1>
          智能<span class="gradient-text">钢琴练习</span><br/>平台
        </h1>
        <p>导入乐谱、连接 MIDI 键盘、实时评分与改进建议，让每次练习都更有效</p>
        <div class="hero-actions">
          <button class="btn btn-primary" id="btn-start-practice">
            🎹 开始练习
          </button>
          <button class="btn btn-secondary" id="btn-import-score">
            📄 导入乐谱
          </button>
        </div>
      </section>

      <section class="feature-grid">
        <div class="glass-card feature-card animate-in" id="feature-scan">
          <span class="feature-icon">📷</span>
          <h3>扫描乐谱</h3>
          <p>用手机摄像头拍摄乐谱，自动识别音符。也支持上传 MusicXML 和 MIDI 文件。</p>
        </div>
        <div class="glass-card feature-card animate-in" id="feature-midi">
          <span class="feature-icon">🎹</span>
          <h3>MIDI 键盘</h3>
          <p>连接 USB/蓝牙 MIDI 键盘进行弹奏，也可使用电脑键盘或屏幕虚拟键盘。</p>
        </div>
        <div class="glass-card feature-card animate-in" id="feature-score">
          <span class="feature-icon">📊</span>
          <h3>智能评分</h3>
          <p>从音准、节奏、力度、完整度四个维度实时评分，给出针对性改进建议。</p>
        </div>
      </section>

      <section style="margin-top: 48px;">
        <h2 class="section-title animate-in">🎵 示例乐曲</h2>
        <div class="feature-grid" id="demo-scores-grid"></div>
      </section>
    </div>
  `;

  // Load demo scores
  import('../engine/score-parser.js').then(({ getDemoScores }) => {
    const grid = document.getElementById('demo-scores-grid');
    const demos = getDemoScores();
    grid.innerHTML = demos.map(d => `
      <div class="glass-card feature-card animate-in demo-score-card" data-id="${d.id}">
        <span class="feature-icon">🎵</span>
        <h3>${d.title}</h3>
        <p>难度：${d.difficulty} · ${d.score.measures.length} 小节</p>
      </div>
    `).join('');

    grid.querySelectorAll('.demo-score-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const demo = demos.find(d => d.id === id);
        if (demo) {
          window.__pianoApp.currentScore = demo.score;
          navigate('/practice');
        }
      });
    });
  });

  document.getElementById('btn-start-practice')?.addEventListener('click', () => navigate('/practice'));
  document.getElementById('btn-import-score')?.addEventListener('click', () => navigate('/import'));
  document.getElementById('feature-scan')?.addEventListener('click', () => navigate('/import'));
  document.getElementById('feature-midi')?.addEventListener('click', () => navigate('/practice'));
}
