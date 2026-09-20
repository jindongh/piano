// Score Parser — parses MusicXML and creates internal score model

/**
 * Internal score data model:
 * { title, tempo, timeSignature, keySignature, measures: [{ number, notes: [{ pitch, midi, duration, beats, startBeat }] }] }
 */

export function createEmptyScore() {
  return {
    title: '未命名乐曲',
    tempo: 120,
    timeSignature: { beats: 4, beatType: 4 },
    keySignature: 'C',
    measures: []
  };
}

/**
 * Parse MusicXML string into internal score model
 */
export function parseMusicXML(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const score = createEmptyScore();

  // Title
  const titleEl = doc.querySelector('work-title') || doc.querySelector('movement-title');
  if (titleEl) score.title = titleEl.textContent.trim();

  // Parts — take first part
  const parts = doc.querySelectorAll('part');
  if (parts.length === 0) return score;
  const part = parts[0];

  const measures = part.querySelectorAll('measure');
  let currentTempo = 120;
  let currentDivisions = 1;

  measures.forEach((measureEl, idx) => {
    const measure = { number: idx + 1, notes: [] };
    let currentBeat = 0;

    // Check for attributes
    const attrs = measureEl.querySelector('attributes');
    if (attrs) {
      const div = attrs.querySelector('divisions');
      if (div) currentDivisions = parseInt(div.textContent);

      const timeEl = attrs.querySelector('time');
      if (timeEl) {
        const b = timeEl.querySelector('beats');
        const bt = timeEl.querySelector('beat-type');
        if (b && bt) {
          score.timeSignature = { beats: parseInt(b.textContent), beatType: parseInt(bt.textContent) };
        }
      }

      const keyEl = attrs.querySelector('key fifths');
      if (keyEl) {
        const fifths = parseInt(keyEl.textContent);
        const keyMap = { '-7':'Cb','-6':'Gb','-5':'Db','-4':'Ab','-3':'Eb','-2':'Bb','-1':'F','0':'C','1':'G','2':'D','3':'A','4':'E','5':'B','6':'F#','7':'C#' };
        score.keySignature = keyMap[fifths] || 'C';
      }
    }

    // Check for tempo
    const directionEl = measureEl.querySelector('direction sound[tempo]');
    if (directionEl) {
      currentTempo = parseFloat(directionEl.getAttribute('tempo'));
      score.tempo = currentTempo;
    }

    // Notes
    const noteEls = measureEl.querySelectorAll('note');
    noteEls.forEach(noteEl => {
      const isRest = noteEl.querySelector('rest');
      const isChord = noteEl.querySelector('chord');
      const durationEl = noteEl.querySelector('duration');
      const durationVal = durationEl ? parseInt(durationEl.textContent) : currentDivisions;
      const beats = durationVal / currentDivisions;

      if (!isChord && !isRest) {
        currentBeat += 0; // will be set after push
      }

      if (!isRest) {
        const pitchEl = noteEl.querySelector('pitch');
        if (pitchEl) {
          const step = pitchEl.querySelector('step')?.textContent || 'C';
          const octave = parseInt(pitchEl.querySelector('octave')?.textContent || '4');
          const alterEl = pitchEl.querySelector('alter');
          const alter = alterEl ? parseInt(alterEl.textContent) : 0;

          let noteName = step;
          if (alter === 1) noteName += '#';
          else if (alter === -1) noteName += 'b';

          const midi = noteNameToMidi(noteName, octave);
          const typeEl = noteEl.querySelector('type');
          const durationType = typeEl ? typeEl.textContent : 'quarter';

          if (isChord && measure.notes.length > 0) {
            // Chord note shares startBeat with previous note
            measure.notes.push({
              pitch: `${noteName}${octave}`,
              midi,
              duration: durationType,
              beats,
              startBeat: measure.notes[measure.notes.length - 1].startBeat
            });
          } else {
            measure.notes.push({
              pitch: `${noteName}${octave}`,
              midi,
              duration: durationType,
              beats,
              startBeat: currentBeat
            });
          }
        }
      }

      if (!isChord) {
        currentBeat += beats;
      }
    });

    score.measures.push(measure);
  });

  return score;
}

function noteNameToMidi(name, octave) {
  const noteMap = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'Fb': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11 };
  const n = noteMap[name];
  if (n == null) return 60;
  return (octave + 1) * 12 + n;
}

/**
 * Get all notes in the score as a flat timeline (for grading)
 */
export function getScoreTimeline(score) {
  const timeline = [];
  let measureStartBeat = 0;

  score.measures.forEach(measure => {
    measure.notes.forEach(note => {
      timeline.push({
        ...note,
        absoluteBeat: measureStartBeat + note.startBeat,
        measureNumber: measure.number
      });
    });
    measureStartBeat += score.timeSignature.beats;
  });

  return timeline.sort((a, b) => a.absoluteBeat - b.absoluteBeat);
}

/**
 * Built-in demo scores
 */
export function getDemoScores() {
  return [
    {
      id: 'twinkle',
      title: '小星星 (Twinkle Twinkle)',
      difficulty: '初级',
      score: buildTwinkle()
    },
    {
      id: 'ode-to-joy',
      title: '欢乐颂 (Ode to Joy)',
      difficulty: '初级',
      score: buildOdeToJoy()
    },
    {
      id: 'scale-c',
      title: 'C 大调音阶',
      difficulty: '入门',
      score: buildCScale()
    }
  ];
}

function buildCScale() {
  const notes = ['C4','D4','E4','F4','G4','A4','B4','C5','C5','B4','A4','G4','F4','E4','D4','C4'];
  return buildSimpleScore('C 大调音阶', 100, notes);
}

function buildTwinkle() {
  const notes = [
    'C4','C4','G4','G4','A4','A4','G4',null,
    'F4','F4','E4','E4','D4','D4','C4',null,
    'G4','G4','F4','F4','E4','E4','D4',null,
    'G4','G4','F4','F4','E4','E4','D4',null,
    'C4','C4','G4','G4','A4','A4','G4',null,
    'F4','F4','E4','E4','D4','D4','C4',null
  ];
  return buildSimpleScore('小星星', 110, notes);
}

function buildOdeToJoy() {
  const notes = [
    'E4','E4','F4','G4','G4','F4','E4','D4',
    'C4','C4','D4','E4','E4',null,'D4','D4',null,null,
    'E4','E4','F4','G4','G4','F4','E4','D4',
    'C4','C4','D4','E4','D4',null,'C4','C4',null,null
  ];
  return buildSimpleScore('欢乐颂', 108, notes);
}

function buildSimpleScore(title, tempo, notePitches) {
  const score = createEmptyScore();
  score.title = title;
  score.tempo = tempo;

  let measureNotes = [];
  let currentBeat = 0;
  let measureNum = 1;

  notePitches.forEach(pitch => {
    if (pitch === null) {
      // Half note rest — advance beat
      currentBeat += 1;
    } else {
      const midi = noteNameToMidi(pitch.replace(/\d/, ''), parseInt(pitch.slice(-1)));
      measureNotes.push({
        pitch,
        midi,
        duration: 'quarter',
        beats: 1,
        startBeat: currentBeat
      });
      currentBeat += 1;
    }

    if (currentBeat >= 4) {
      score.measures.push({ number: measureNum++, notes: measureNotes });
      measureNotes = [];
      currentBeat = 0;
    }
  });

  if (measureNotes.length > 0) {
    score.measures.push({ number: measureNum, notes: measureNotes });
  }

  return score;
}
