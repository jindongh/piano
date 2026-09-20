// Grading Engine — compares played notes against score and computes scores

/**
 * GradingSession: manages a live grading session
 *
 * Scoring dimensions (total 100):
 *   - Pitch accuracy: 40%
 *   - Rhythm accuracy: 30%
 *   - Dynamics: 15%
 *   - Completeness: 15%
 */

export class GradingSession {
  constructor(scoreTimeline, tempo, options = {}) {
    this.timeline = scoreTimeline; // from getScoreTimeline()
    this.tempo = tempo;
    this.toleranceMs = options.toleranceMs || 300; // timing tolerance
    this.playedNotes = [];
    this.matchResults = []; // { expected, played, pitchCorrect, timingDiffMs }
    this.currentIndex = 0;
    this.startTime = null;
    this.isActive = false;
  }

  start() {
    this.startTime = performance.now();
    this.isActive = true;
    this.playedNotes = [];
    this.matchResults = [];
    this.currentIndex = 0;
  }

  stop() {
    this.isActive = false;
  }

  /**
   * Record a played note and attempt to match it to expected
   */
  recordNote(midi, velocity, timestamp) {
    if (!this.isActive || !this.startTime) return null;

    const elapsedMs = timestamp - this.startTime;
    const played = { midi, velocity, timestamp: elapsedMs };
    this.playedNotes.push(played);

    // Find best matching expected note near current position
    const beatDurationMs = (60 / this.tempo) * 1000;
    let bestMatch = null;
    let bestDiff = Infinity;
    const searchRange = 4; // look ahead/behind

    for (let i = Math.max(0, this.currentIndex - 2); i < Math.min(this.timeline.length, this.currentIndex + searchRange); i++) {
      const expected = this.timeline[i];
      const expectedTimeMs = expected.absoluteBeat * beatDurationMs;
      const timeDiff = Math.abs(elapsedMs - expectedTimeMs);

      if (timeDiff < bestDiff && timeDiff < beatDurationMs * 2) {
        bestDiff = timeDiff;
        bestMatch = { index: i, expected, timeDiff: elapsedMs - expectedTimeMs };
      }
    }

    if (bestMatch) {
      const pitchCorrect = bestMatch.expected.midi === midi;
      const timingOk = Math.abs(bestMatch.timeDiff) <= this.toleranceMs;

      const result = {
        expected: bestMatch.expected,
        played,
        pitchCorrect,
        timingDiffMs: bestMatch.timeDiff,
        timingOk,
        velocityRatio: velocity / 80 // normalize around expected 80
      };

      this.matchResults.push(result);

      // Advance current index
      if (bestMatch.index >= this.currentIndex) {
        this.currentIndex = bestMatch.index + 1;
      }

      return result;
    }

    // Extra note (not matched)
    this.matchResults.push({
      expected: null,
      played,
      pitchCorrect: false,
      timingDiffMs: 0,
      timingOk: false,
      extra: true
    });

    return { extra: true, played };
  }

  /**
   * Get current progress (0-1)
   */
  getProgress() {
    if (this.timeline.length === 0) return 0;
    return Math.min(1, this.currentIndex / this.timeline.length);
  }

  /**
   * Calculate current expected note index based on elapsed time
   */
  getCurrentExpectedIndex(currentTime) {
    if (!this.startTime) return 0;
    const elapsedMs = currentTime - this.startTime;
    const beatDurationMs = (60 / this.tempo) * 1000;
    const currentBeat = elapsedMs / beatDurationMs;

    for (let i = 0; i < this.timeline.length; i++) {
      if (this.timeline[i].absoluteBeat > currentBeat) {
        return Math.max(0, i - 1);
      }
    }
    return this.timeline.length - 1;
  }

  /**
   * Compute final scores
   */
  computeScores() {
    const total = this.timeline.length;
    if (total === 0) return { pitch: 100, rhythm: 100, dynamics: 100, completeness: 100, overall: 100, details: [] };

    const matched = this.matchResults.filter(r => !r.extra);
    const extras = this.matchResults.filter(r => r.extra);

    // Pitch accuracy (40%)
    const correctPitch = matched.filter(r => r.pitchCorrect).length;
    const pitchScore = total > 0 ? (correctPitch / total) * 100 : 0;

    // Rhythm accuracy (30%)
    const goodTiming = matched.filter(r => r.timingOk).length;
    const rhythmScore = matched.length > 0 ? (goodTiming / matched.length) * 100 : 0;

    // Dynamics (15%) — how consistent the velocity is
    const velocities = matched.map(r => r.velocityRatio);
    let dynamicsScore = 100;
    if (velocities.length > 1) {
      const avg = velocities.reduce((a, b) => a + b, 0) / velocities.length;
      const variance = velocities.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / velocities.length;
      // Lower variance = more consistent = higher score (for simple pieces)
      dynamicsScore = Math.max(0, 100 - variance * 100);
    }

    // Completeness (15%)
    const missedNotes = total - matched.length;
    const extraPenalty = extras.length * 2;
    const completenessScore = Math.max(0, ((total - missedNotes) / total) * 100 - extraPenalty);

    // Overall weighted score
    const overall = Math.round(
      pitchScore * 0.4 +
      rhythmScore * 0.3 +
      dynamicsScore * 0.15 +
      completenessScore * 0.15
    );

    return {
      pitch: Math.round(pitchScore),
      rhythm: Math.round(rhythmScore),
      dynamics: Math.round(dynamicsScore),
      completeness: Math.round(completenessScore),
      overall: Math.min(100, Math.max(0, overall)),
      totalNotes: total,
      matchedNotes: matched.length,
      extraNotes: extras.length,
      missedNotes,
      details: this.matchResults
    };
  }

  /**
   * Get real-time score snapshot
   */
  getLiveScore() {
    const matched = this.matchResults.filter(r => !r.extra);
    if (matched.length === 0) return { pitch: 0, rhythm: 0, combo: 0 };

    const recentN = Math.min(10, matched.length);
    const recent = matched.slice(-recentN);

    const pitchHits = recent.filter(r => r.pitchCorrect).length;
    const rhythmHits = recent.filter(r => r.timingOk).length;

    // Combo — consecutive correct notes
    let combo = 0;
    for (let i = matched.length - 1; i >= 0; i--) {
      if (matched[i].pitchCorrect) combo++;
      else break;
    }

    return {
      pitch: Math.round((pitchHits / recentN) * 100),
      rhythm: Math.round((rhythmHits / recentN) * 100),
      combo,
      progress: this.getProgress()
    };
  }
}
