// Results Page — score display and improvement suggestions
import { navigate } from '../utils/router.js';
import { generateSuggestions } from '../engine/suggestion-engine.js';

export function renderResults(container) {
  const scores = window.__pianoApp.lastResult;
  const score = window.__pianoApp.lastScore;

  if (!scores) {
    container.innerHTML = `
      <div class="results-layout">
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <p>暂无练习记录，先去练习一首吧！</p>
          <button class="btn btn-primary" id="btn-go-practice" style="margin-top:16px;">🎹 去练习</button>
        </div>
      </div>
    `;
    document.getElementById('btn-go-practice')?.addEventListener('click', () => navigate('/practice'));
    return;
  }

  const suggestions = generateSuggestions(scores, score || {});
  const gradeColor = scores.overall >= 80 ? 'var(--success)' : scores.overall >= 60 ? 'var(--warning)' : 'var(--error)';
  const gradeLabel = scores.overall >= 90 ? '优秀' : scores.overall >= 80 ? '良好' : scores.overall >= 60 ? '及格' : '需努力';

  // SVG ring progress
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (scores.overall / 100) * circumference;

  container.innerHTML = `
    <div class="results-layout">
      <div class="result-header animate-in">
        <h1 class="section-title" style="justify-content:center;">📊 练习报告</h1>
        <p style="color:var(--text-secondary);">${score?.title || '练习曲目'}</p>

        <div class="total-score-ring">
          <svg viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="${radius}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="12" />
            <circle cx="100" cy="100" r="${radius}" fill="none" stroke="${gradeColor}" stroke-width="12"
              stroke-linecap="round"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${circumference}"
              id="score-ring-fill"
              style="transition: stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1);" />
          </svg>
          <div class="score-text">
            <div class="score-number" style="color:${gradeColor};" id="score-number">0</div>
            <div class="score-suffix">${gradeLabel}</div>
          </div>
        </div>
      </div>

      <div class="score-breakdown animate-in">
        ${renderBreakdownCard('🎯 音准', scores.pitch, '--success')}
        ${renderBreakdownCard('⏱️ 节奏', scores.rhythm, '--accent-secondary')}
        ${renderBreakdownCard('💪 力度', scores.dynamics, '--warning')}
        ${renderBreakdownCard('📝 完整度', scores.completeness, '--accent-primary')}
      </div>

      <div style="text-align:center; color:var(--text-secondary); font-size:0.85rem; margin-bottom:24px;" class="animate-in">
        总音符: ${scores.totalNotes} · 命中: ${scores.matchedNotes} · 漏弹: ${scores.missedNotes} · 多弹: ${scores.extraNotes}
      </div>

      <h2 class="section-title animate-in">💡 改进建议</h2>
      <div class="suggestions-list animate-in">
        ${suggestions.map(s => `
          <div class="glass-card suggestion-item">
            <span class="suggestion-icon">${s.icon}</span>
            <div class="suggestion-content">
              <h4>${s.title}</h4>
              <p>${s.description}</p>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="display:flex; justify-content:center; gap:16px; margin-top:32px; padding-bottom:32px;" class="animate-in">
        <button class="btn btn-primary" id="btn-retry">🔄 再练一次</button>
        <button class="btn btn-secondary" id="btn-home">🏠 返回首页</button>
      </div>
    </div>
  `;

  // Animate score ring & number
  requestAnimationFrame(() => {
    setTimeout(() => {
      const ring = document.getElementById('score-ring-fill');
      if (ring) ring.setAttribute('stroke-dashoffset', offset);

      // Animate number
      const numEl = document.getElementById('score-number');
      if (numEl) animateNumber(numEl, 0, scores.overall, 1500);

      // Animate breakdown bars
      document.querySelectorAll('.bar-fill').forEach(bar => {
        const target = bar.dataset.value;
        setTimeout(() => { bar.style.width = `${target}%`; }, 300);
      });
    }, 100);
  });

  document.getElementById('btn-retry')?.addEventListener('click', () => navigate('/practice'));
  document.getElementById('btn-home')?.addEventListener('click', () => navigate('/'));
}

function renderBreakdownCard(label, value, colorVar) {
  const color = `var(${colorVar})`;
  return `
    <div class="glass-card breakdown-card">
      <div class="breakdown-label">${label}</div>
      <div class="breakdown-value" style="color:${color};">${value}<small style="font-size:0.6em;color:var(--text-muted);"> /100</small></div>
      <div class="breakdown-bar">
        <div class="bar-fill" data-value="${value}" style="width:0%; background:${color};"></div>
      </div>
    </div>
  `;
}

function animateNumber(el, from, to, duration) {
  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.round(from + (to - from) * eased);
    el.textContent = current;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}
