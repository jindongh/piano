// Sheet Display Component — renders sheet music using VexFlow
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';

export class SheetDisplay {
  constructor(container) {
    this.container = container;
    this.score = null;
    this.renderer = null;
    this.context = null;
    this.noteElements = []; // track rendered note groups for highlighting
    this.currentHighlight = -1;
  }

  /**
   * Render a score model to sheet music
   */
  render(score) {
    this.score = score;
    this.container.innerHTML = '';
    this.noteElements = [];

    if (!score || !score.measures || score.measures.length === 0) {
      this.container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎵</div><p>暂无乐谱，请先导入</p></div>';
      return;
    }

    const width = Math.max(this.container.clientWidth - 40, 600);
    const measuresPerLine = Math.max(2, Math.floor(width / 300));
    const lines = Math.ceil(score.measures.length / measuresPerLine);
    const lineHeight = 140;
    const totalHeight = lines * lineHeight + 80;
    const measureWidth = Math.floor((width - 20) / measuresPerLine);

    // Create renderer
    const div = document.createElement('div');
    div.id = 'vexflow-output';
    this.container.appendChild(div);

    this.renderer = new Renderer(div, Renderer.Backends.SVG);
    this.renderer.resize(width, totalHeight);
    this.context = this.renderer.getContext();
    this.context.setFont('Inter', 10);

    // Title
    this.context.fillText(score.title, width / 2 - score.title.length * 5, 25);

    let noteGlobalIndex = 0;

    score.measures.forEach((measure, mIdx) => {
      const lineIdx = Math.floor(mIdx / measuresPerLine);
      const colIdx = mIdx % measuresPerLine;
      const x = 10 + colIdx * measureWidth;
      const y = 50 + lineIdx * lineHeight;

      const stave = new Stave(x, y, measureWidth - 5);

      if (colIdx === 0) {
        stave.addClef('treble');
        if (mIdx === 0) {
          stave.addTimeSignature(`${score.timeSignature.beats}/${score.timeSignature.beatType}`);
        }
      }

      stave.setContext(this.context).draw();

      if (measure.notes.length === 0) return;

      // Convert to VexFlow notes
      const vfNotes = [];
      let currentBeat = 0;

      // Group notes by startBeat for chords
      const beatGroups = {};
      measure.notes.forEach(note => {
        const key = note.startBeat.toFixed(2);
        if (!beatGroups[key]) beatGroups[key] = [];
        beatGroups[key].push(note);
      });

      const sortedBeats = Object.keys(beatGroups).sort((a, b) => parseFloat(a) - parseFloat(b));

      sortedBeats.forEach(beatKey => {
        const group = beatGroups[beatKey];
        const firstNote = group[0];

        const keys = group.map(n => {
          const name = n.pitch.replace(/\d+$/, '');
          const octave = n.pitch.match(/\d+$/)?.[0] || '4';
          const vfName = name.replace('#', '#').replace('b', 'b').toLowerCase();
          return `${vfName}/${octave}`;
        });

        const vfDuration = beatsToVfDuration(firstNote.beats);

        try {
          const staveNote = new StaveNote({ keys, duration: vfDuration });

          // Add accidentals
          group.forEach((n, i) => {
            if (n.pitch.includes('#')) {
              staveNote.addModifier(new Accidental('#'), i);
            } else if (n.pitch.includes('b')) {
              staveNote.addModifier(new Accidental('b'), i);
            }
          });

          vfNotes.push(staveNote);

          // Track for highlighting
          group.forEach(() => {
            this.noteElements.push({
              staveNote,
              globalIndex: noteGlobalIndex++,
              measureIndex: mIdx
            });
          });
        } catch (e) {
          // Skip malformed notes
          console.warn('VexFlow note error:', e);
        }
      });

      if (vfNotes.length === 0) return;

      // Fill remaining beats with rests if needed
      const totalBeats = score.timeSignature.beats;
      let usedBeats = sortedBeats.reduce((sum, key) => {
        return sum + beatGroups[key][0].beats;
      }, 0);

      while (usedBeats < totalBeats) {
        const remainingBeats = totalBeats - usedBeats;
        const restDuration = beatsToVfDuration(Math.min(remainingBeats, 1));
        try {
          vfNotes.push(new StaveNote({ keys: ['b/4'], duration: `${restDuration}r` }));
        } catch(e) {
          break;
        }
        usedBeats += Math.min(remainingBeats, 1);
        if (usedBeats >= totalBeats) break;
      }

      try {
        const voice = new Voice({ num_beats: score.timeSignature.beats, beat_value: score.timeSignature.beatType })
          .setStrict(false)
          .addTickables(vfNotes);

        new Formatter().joinVoices([voice]).format([voice], measureWidth - 50);
        voice.draw(this.context, stave);
      } catch (e) {
        console.warn('VexFlow voice error:', e);
      }
    });
  }

  /**
   * Highlight a specific note by global index
   */
  highlightNote(globalIndex, color = '#7c5cfc') {
    // Remove previous highlight
    if (this.currentHighlight >= 0) {
      this.clearNoteHighlight(this.currentHighlight);
    }

    const noteEl = this.noteElements.find(n => n.globalIndex === globalIndex);
    if (noteEl && noteEl.staveNote) {
      try {
        noteEl.staveNote.setStyle({ fillStyle: color, strokeStyle: color });
        // Force re-render by accessing the SVG
        const svgEl = noteEl.staveNote.getSVGElement?.();
        if (svgEl) {
          svgEl.querySelectorAll('*').forEach(el => {
            el.setAttribute('fill', color);
            el.setAttribute('stroke', color);
          });
        }
      } catch (e) { /* silent */ }
    }
    this.currentHighlight = globalIndex;
  }

  /**
   * Clear highlight from a note
   */
  clearNoteHighlight(globalIndex) {
    const noteEl = this.noteElements.find(n => n.globalIndex === globalIndex);
    if (noteEl && noteEl.staveNote) {
      try {
        noteEl.staveNote.setStyle({ fillStyle: '#f0f0f8', strokeStyle: '#f0f0f8' });
      } catch (e) { /* silent */ }
    }
  }

  /**
   * Mark a note as correct/wrong
   */
  markNote(globalIndex, status) {
    const colors = { correct: '#4ade80', wrong: '#f87171', timing: '#fbbf24' };
    this.highlightNote(globalIndex, colors[status] || '#f0f0f8');
  }

  destroy() {
    this.container.innerHTML = '';
    this.noteElements = [];
  }
}

function beatsToVfDuration(beats) {
  if (beats >= 4) return 'w';
  if (beats >= 3) return 'hd';
  if (beats >= 2) return 'h';
  if (beats >= 1.5) return 'qd';
  if (beats >= 1) return 'q';
  if (beats >= 0.75) return '8d';
  if (beats >= 0.5) return '8';
  if (beats >= 0.25) return '16';
  return '32';
}
