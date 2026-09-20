// Practice Page — core practice experience
import { SheetDisplay } from '../components/sheet-display.js';
import { PianoKeyboard } from '../components/piano-keyboard.js';
import { midiEngine } from '../engine/midi-engine.js';
import { audioEngine } from '../engine/audio-engine.js';
import { GradingSession } from '../engine/grading-engine.js';
import { getScoreTimeline, getDemoScores } from '../engine/score-parser.js';
import { midiToNote } from '../utils/note-utils.js';
import { showToast } from '../utils/toast.js';
import { navigate } from '../utils/router.js';

let sheetDisplay = null;
let keyboard = null;
let gradingSession = null;
let practiceState = 'idle'; // idle | playing | finished
let metronomeOn = false;
let animFrameId = null;

export function renderPractice(container) {
  const score = window.__pianoApp.currentScore;

  container.innerHTML = `
    <div class="practice-layout">
      <div class="practice-toolbar" id="practice-toolbar">
        <div class="toolbar-group">
          <button class="btn btn-secondary btn-icon" id="btn-back" title="返回">←</button>
          <span style="font-weight:600; font-size:0.95rem;" id="score-title">${score ? score.title : '自由弹奏'}</span>
        </div>
        <div class="toolbar-group">
          <label>速度</label>
          <div class="tempo-control">
            <button class="btn btn-secondary btn-icon" id="btn-tempo-down" style="width:30px;height:30px;font-size:0.8rem;">−</button>
            <input type="range" id="tempo-slider" min="40" max="200" value="${score?.tempo || 120}" />
            <button class="btn btn-secondary btn-icon" id="btn-tempo-up" style="width:30px;height:30px;font-size:0.8rem;">+</button>
            <span class="tempo-value" id="tempo-display">${score?.tempo || 120} BPM</span>
          </div>
        </div>
        <div class="toolbar-group">
          <button class="btn btn-secondary" id="btn-metronome" title="节拍器">🔔 节拍器</button>
          <button class="btn btn-primary" id="btn-play">▶ 开始</button>
          <button class="btn btn-secondary" id="btn-stop" hidden>⏹ 结束</button>
        </div>
      </div>

      <div class="sheet-area glass-card" id="sheet-area">
        ${score ? '' : '<div class="empty-state"><div class="empty-icon">🎵</div><p>未加载乐谱 — 自由弹奏模式<br/><small>前往导入页面加载乐谱进行评分练习</small></p></div>'}
      </div>

      <div class="score-bar" id="live-score-bar">
        <div class="score-item">
          <div class="score-label">音准</div>
          <div class="score-value" id="live-pitch">--</div>
        </div>
        <div class="score-item">
          <div class="score-label">节奏</div>
          <div class="score-value" id="live-rhythm">--</div>
        </div>
        <div class="score-item">
          <div class="score-label">连击</div>
          <div class="score-value" id="live-combo">0</div>
        </div>
        <div class="score-item">
          <div class="score-label">进度</div>
          <div class="score-value" id="live-progress">0%</div>
        </div>
      </div>

      <div class="keyboard-area" id="keyboard-area"></div>
    </div>
  `;

  initPractice(score);
}

async function initPractice(score) {
  // Init audio non-blockingly to avoid hanging if user gesture is required
  audioEngine.init().catch(err => console.warn('Audio init delayed:', err));

  // Render sheet music
  if (score) {
    const sheetArea = document.getElementById('sheet-area');
    sheetDisplay = new SheetDisplay(sheetArea);
    sheetDisplay.render(score);
  }

  // Create keyboard
  const kbArea = document.getElementById('keyboard-area');
  keyboard = new PianoKeyboard(kbArea, {
    startMidi: 48,
    endMidi: 84,
    onNoteOn: (midi, vel) => handleNoteOn(midi, vel),
    onNoteOff: (midi) => handleNoteOff(midi)
  });

  // MIDI input handlers
  const onMidiNoteOn = (data) => handleNoteOn(data.midi, data.velocity);
  const onMidiNoteOff = (data) => handleNoteOff(data.midi);
  midiEngine.on('noteon', onMidiNoteOn);
  midiEngine.on('noteoff', onMidiNoteOff);

  // Tempo controls
  const slider = document.getElementById('tempo-slider');
  const display = document.getElementById('tempo-display');

  slider?.addEventListener('input', (e) => {
    const bpm = parseInt(e.target.value);
    display.textContent = `${bpm} BPM`;
    if (metronomeOn) audioEngine.setTempo(bpm);
  });

  document.getElementById('btn-tempo-down')?.addEventListener('click', () => {
    if (slider) { slider.value = Math.max(40, parseInt(slider.value) - 5); slider.dispatchEvent(new Event('input')); }
  });

  document.getElementById('btn-tempo-up')?.addEventListener('click', () => {
    if (slider) { slider.value = Math.min(200, parseInt(slider.value) + 5); slider.dispatchEvent(new Event('input')); }
  });

  // Metronome toggle
  document.getElementById('btn-metronome')?.addEventListener('click', () => {
    metronomeOn = !metronomeOn;
    const btn = document.getElementById('btn-metronome');
    if (metronomeOn) {
      const bpm = parseInt(slider?.value || 120);
      audioEngine.startMetronome(bpm, score?.timeSignature?.beats || 4);
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-secondary');
      btn.textContent = '🔔 节拍器 ON';
    } else {
      audioEngine.stopMetronome();
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
      btn.textContent = '🔔 节拍器';
    }
  });

  // Play/Stop
  document.getElementById('btn-play')?.addEventListener('click', async () => {
    await audioEngine.init();
    startPractice(score);
  });
  document.getElementById('btn-stop')?.addEventListener('click', () => stopPractice());
  document.getElementById('btn-back')?.addEventListener('click', () => {
    cleanup();
    navigate('/');
  });

  // Store cleanup
  window.__pianoApp._practiceCleanup = () => {
    midiEngine.off('noteon', onMidiNoteOn);
    midiEngine.off('noteoff', onMidiNoteOff);
    cleanup();
  };
}

function handleNoteOn(midi, velocity) {
  const note = midiToNote(midi);
  audioEngine.noteOn(note.fullName, velocity / 127);
  keyboard?.highlight(midi, 'active');

  if (practiceState === 'playing' && gradingSession) {
    const result = gradingSession.recordNote(midi, velocity, performance.now());
    if (result && !result.extra) {
      if (result.pitchCorrect) {
        keyboard?.highlight(midi, 'correct');
        sheetDisplay?.markNote(result.expected?.measureNumber || 0, 'correct');
      } else {
        keyboard?.highlight(midi, 'wrong');
      }
    }
    updateLiveScore();
  }
}

function handleNoteOff(midi) {
  const note = midiToNote(midi);
  audioEngine.noteOff(note.fullName);
  keyboard?.unhighlight(midi, 'active');
  keyboard?.unhighlight(midi, 'correct');
  keyboard?.unhighlight(midi, 'wrong');
}

function startPractice(score) {
  if (!score) {
    showToast('自由弹奏模式 — 无需开始/结束', 'info');
    return;
  }

  const tempo = parseInt(document.getElementById('tempo-slider')?.value || score.tempo);
  const timeline = getScoreTimeline(score);

  gradingSession = new GradingSession(timeline, tempo, { toleranceMs: 350 });
  gradingSession.start();
  practiceState = 'playing';

  document.getElementById('btn-play')?.setAttribute('hidden', '');
  document.getElementById('btn-stop')?.removeAttribute('hidden');

  // Start live score update loop
  updateLoop();

  showToast('练习开始！请跟随乐谱弹奏', 'info');

  // Auto-end detection
  const totalDurationMs = (timeline[timeline.length - 1]?.absoluteBeat || 0) * (60 / tempo) * 1000 + 5000;
  setTimeout(() => {
    if (practiceState === 'playing') {
      stopPractice();
    }
  }, totalDurationMs);
}

function updateLoop() {
  if (practiceState !== 'playing') return;
  updateLiveScore();
  animFrameId = requestAnimationFrame(updateLoop);
}

function updateLiveScore() {
  if (!gradingSession) return;
  const live = gradingSession.getLiveScore();

  const pitchEl = document.getElementById('live-pitch');
  const rhythmEl = document.getElementById('live-rhythm');
  const comboEl = document.getElementById('live-combo');
  const progressEl = document.getElementById('live-progress');

  if (pitchEl) {
    pitchEl.textContent = `${live.pitch}%`;
    pitchEl.className = `score-value ${live.pitch >= 80 ? 'good' : live.pitch >= 50 ? 'warning' : 'bad'}`;
  }
  if (rhythmEl) {
    rhythmEl.textContent = `${live.rhythm}%`;
    rhythmEl.className = `score-value ${live.rhythm >= 80 ? 'good' : live.rhythm >= 50 ? 'warning' : 'bad'}`;
  }
  if (comboEl) {
    comboEl.textContent = `${live.combo}`;
    comboEl.className = `score-value ${live.combo >= 10 ? 'good' : ''}`;
  }
  if (progressEl) {
    progressEl.textContent = `${Math.round((live.progress || 0) * 100)}%`;
  }
}

function stopPractice() {
  if (gradingSession) {
    gradingSession.stop();
    const scores = gradingSession.computeScores();
    window.__pianoApp.lastResult = scores;
    window.__pianoApp.lastScore = window.__pianoApp.currentScore;
  }

  practiceState = 'finished';

  document.getElementById('btn-stop')?.setAttribute('hidden', '');
  document.getElementById('btn-play')?.removeAttribute('hidden');

  if (animFrameId) cancelAnimationFrame(animFrameId);

  showToast('练习结束！查看评分结果', 'success');
  setTimeout(() => navigate('/results'), 800);
}

function cleanup() {
  practiceState = 'idle';
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (metronomeOn) {
    audioEngine.stopMetronome();
    metronomeOn = false;
  }
  sheetDisplay?.destroy();
  keyboard?.destroy();
  sheetDisplay = null;
  keyboard = null;
  gradingSession = null;
}

export function cleanupPractice() {
  if (window.__pianoApp._practiceCleanup) {
    window.__pianoApp._practiceCleanup();
  }
}
