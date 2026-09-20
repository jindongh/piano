// Import Page — upload MusicXML/MIDI or use demo scores
import { navigate } from '../utils/router.js';
import { parseMusicXML, getDemoScores } from '../engine/score-parser.js';
import { SheetDisplay } from '../components/sheet-display.js';
import { CameraScanner } from '../components/camera-scanner.js';
import { showToast } from '../utils/toast.js';

let sheetPreview = null;

export function renderImport(container) {
  container.innerHTML = `
    <div class="page-container">
      <h1 class="section-title animate-in">📄 导入乐谱</h1>

      <div class="import-options">
        <div class="glass-card import-card animate-in" id="import-file-card">
          <span class="import-icon">📂</span>
          <h3>上传文件</h3>
          <p>支持 MusicXML (.xml, .musicxml) 格式</p>
          <button class="btn btn-secondary" id="btn-choose-file">选择文件</button>
          <input type="file" id="file-input" class="file-input-hidden" accept=".xml,.musicxml,.mxl" />
        </div>

        <div class="glass-card import-card animate-in" id="import-camera-card">
          <span class="import-icon">📷</span>
          <h3>拍照扫描</h3>
          <p>用摄像头拍摄乐谱进行智能识别</p>
          <button class="btn btn-secondary" id="btn-camera-scan">开始扫描</button>
        </div>

        <div class="glass-card import-card animate-in" id="import-demo-card">
          <span class="import-icon">🎵</span>
          <h3>示例乐曲</h3>
          <p>使用内置示例乐曲快速开始练习</p>
          <select class="select-custom" id="demo-select">
            <option value="">选择示例...</option>
          </select>
        </div>
      </div>

      <div class="glass-card preview-area animate-in" id="score-preview" style="margin-top: 24px;">
        <div class="empty-state">
          <div class="empty-icon">🎵</div>
          <p>导入乐谱后将在此处预览</p>
        </div>
      </div>

      <div style="display: flex; justify-content: center; margin-top: 24px; gap: 16px;" id="preview-actions" class="animate-in" hidden>
        <button class="btn btn-primary" id="btn-start-with-score">🎹 开始练习</button>
        <button class="btn btn-secondary" id="btn-clear-preview">清除</button>
      </div>
    </div>
  `;

  // Populate demo select
  const demos = getDemoScores();
  const select = document.getElementById('demo-select');
  demos.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.title} (${d.difficulty})`;
    select.appendChild(opt);
  });

  // File upload
  document.getElementById('btn-choose-file')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
  });

  document.getElementById('file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const score = parseMusicXML(text);
      if (score.measures.length === 0) {
        showToast('解析失败：未找到音符数据', 'error');
        return;
      }
      loadScorePreview(score);
      showToast(`成功导入: ${score.title} (${score.measures.length} 小节)`, 'success');
    } catch (err) {
      showToast('文件解析错误: ' + err.message, 'error');
    }
  });

  // Camera scan
  document.getElementById('btn-camera-scan')?.addEventListener('click', () => {
    const scanner = new CameraScanner(document.body, (score) => {
      loadScorePreview(score);
      showToast(`扫描成功: ${score.title}`, 'success');
    });
    scanner.start();
  });

  // Demo select
  select?.addEventListener('change', (e) => {
    const id = e.target.value;
    if (!id) return;
    const demo = demos.find(d => d.id === id);
    if (demo) {
      loadScorePreview(demo.score);
      showToast(`已加载: ${demo.title}`, 'success');
    }
  });

  // Actions
  document.getElementById('btn-start-with-score')?.addEventListener('click', () => {
    if (window.__pianoApp.currentScore) {
      navigate('/practice');
    }
  });

  document.getElementById('btn-clear-preview')?.addEventListener('click', () => {
    window.__pianoApp.currentScore = null;
    const preview = document.getElementById('score-preview');
    if (preview) {
      preview.innerHTML = '<div class="empty-state"><div class="empty-icon">🎵</div><p>导入乐谱后将在此处预览</p></div>';
    }
    document.getElementById('preview-actions')?.setAttribute('hidden', '');
  });

  // Drop zone on file card
  const fileCard = document.getElementById('import-file-card');
  if (fileCard) {
    fileCard.addEventListener('dragover', (e) => { e.preventDefault(); fileCard.classList.add('drag-over'); });
    fileCard.addEventListener('dragleave', () => fileCard.classList.remove('drag-over'));
    fileCard.addEventListener('drop', async (e) => {
      e.preventDefault();
      fileCard.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) {
        const text = await file.text();
        try {
          const score = parseMusicXML(text);
          loadScorePreview(score);
          showToast(`成功导入: ${score.title}`, 'success');
        } catch (err) {
          showToast('文件解析错误', 'error');
        }
      }
    });
  }
}

function loadScorePreview(score) {
  window.__pianoApp.currentScore = score;
  const preview = document.getElementById('score-preview');
  if (!preview) return;
  preview.innerHTML = '';

  sheetPreview = new SheetDisplay(preview);
  sheetPreview.render(score);

  document.getElementById('preview-actions')?.removeAttribute('hidden');
}
