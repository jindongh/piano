// Camera Scanner Component — mocks OCR logic for sheet music
import { showToast } from '../utils/toast.js';
import { getDemoScores } from '../engine/score-parser.js';

export class CameraScanner {
  constructor(container, onScanComplete) {
    this.container = container;
    this.onScanComplete = onScanComplete;
    this.stream = null;
    this.overlay = null;
  }

  async start() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'camera-overlay animate-in';
    this.overlay.innerHTML = `
      <div class="camera-header">
        <h3>拍照扫描乐谱</h3>
        <button class="btn btn-icon" id="btn-close-camera">❌</button>
      </div>
      <div class="camera-viewfinder">
        <video id="camera-video" autoplay playsinline></video>
        <div class="scan-line" id="scan-line" style="display: none; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--accent-primary); box-shadow: 0 0 10px var(--accent-primary);"></div>
      </div>
      <div class="camera-controls">
        <button class="capture-btn" id="btn-capture"></button>
      </div>
    `;
    this.container.appendChild(this.overlay);

    document.getElementById('btn-close-camera').addEventListener('click', () => this.stop());
    
    const video = document.getElementById('camera-video');
    const captureBtn = document.getElementById('btn-capture');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = this.stream;
    } catch (err) {
      showToast('无法访问摄像头', 'error');
      console.warn('Camera error:', err);
      // Fallback for devices without camera or when permission is denied
      video.style.background = '#222';
      video.insertAdjacentHTML('afterend', '<p style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#888;">无法访问摄像头，将模拟扫描</p>');
    }

    captureBtn.addEventListener('click', () => this.simulateScan());
  }

  simulateScan() {
    const scanLine = document.getElementById('scan-line');
    const captureBtn = document.getElementById('btn-capture');
    
    if (scanLine) {
      scanLine.style.display = 'block';
      scanLine.style.transition = 'top 2s linear';
      setTimeout(() => scanLine.style.top = '100%', 50);
    }
    
    if (captureBtn) captureBtn.disabled = true;
    showToast('正在分析乐谱图像...', 'info', 2000);

    setTimeout(() => {
      this.stop();
      // Simulate returning a scanned score (using a demo score for now)
      const demos = getDemoScores();
      const demo = demos[1]; // Ode to Joy as mock scanned result
      demo.score.title = '扫描的乐谱 - ' + demo.score.title;
      this.onScanComplete(demo.score);
    }, 2000);
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}
