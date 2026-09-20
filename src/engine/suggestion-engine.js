// Suggestion Engine — analyzes grading results and generates improvement tips

import { midiToNote } from '../utils/note-utils.js';

/**
 * Generate suggestions from grading scores
 * @param {object} scores - from GradingSession.computeScores()
 * @param {object} score - the original score model
 * @returns {Array<{icon, title, description, category}>}
 */
export function generateSuggestions(scores, score) {
  const suggestions = [];

  // Analyze pitch errors
  if (scores.pitch < 90) {
    const wrongNotes = scores.details
      .filter(r => r.expected && !r.pitchCorrect && !r.extra)
      .map(r => ({
        expected: r.expected.pitch,
        played: r.played ? midiToNote(r.played.midi).fullName : '?',
        measure: r.expected.measureNumber
      }));

    // Group errors by measure
    const errorMeasures = {};
    wrongNotes.forEach(w => {
      if (!errorMeasures[w.measure]) errorMeasures[w.measure] = [];
      errorMeasures[w.measure].push(w);
    });

    const problemMeasures = Object.entries(errorMeasures)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3);

    if (problemMeasures.length > 0) {
      const measureList = problemMeasures.map(([m, errs]) =>
        `第${m}小节 (${errs.length}个错音)`
      ).join('、');

      suggestions.push({
        icon: '🎯',
        title: '音准需要加强',
        description: `以下小节错音较多：${measureList}。建议单独慢练这些小节，注意看清谱面上的音符位置。`,
        category: 'pitch'
      });
    }

    // Check for common pitch confusion patterns
    const confusions = {};
    wrongNotes.forEach(w => {
      const key = `${w.expected}->${w.played}`;
      confusions[key] = (confusions[key] || 0) + 1;
    });

    const repeatedErrors = Object.entries(confusions)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1]);

    if (repeatedErrors.length > 0) {
      const errorDesc = repeatedErrors.slice(0, 3).map(([pair, count]) =>
        `${pair.replace('->', ' 弹成了 ')} (${count}次)`
      ).join('；');

      suggestions.push({
        icon: '🔄',
        title: '反复出现的错音',
        description: `${errorDesc}。这些音符容易混淆，建议特别注意练习。`,
        category: 'pitch'
      });
    }
  }

  // Analyze rhythm
  if (scores.rhythm < 85) {
    const timingErrors = scores.details
      .filter(r => r.expected && !r.timingOk && !r.extra)
      .map(r => ({ diff: r.timingDiffMs, measure: r.expected.measureNumber }));

    const avgDiff = timingErrors.reduce((sum, t) => sum + t.diff, 0) / (timingErrors.length || 1);
    const tendency = avgDiff > 50 ? '偏慢（抢拍不足）' : avgDiff < -50 ? '偏快（抢拍）' : '不稳定';

    suggestions.push({
      icon: '⏱️',
      title: '节奏需要改进',
      description: `整体节奏${tendency}，平均偏差 ${Math.abs(Math.round(avgDiff))}ms。建议开启节拍器，从较慢速度（${Math.max(60, score.tempo - 30)} BPM）开始练习，逐渐提速。`,
      category: 'rhythm'
    });
  }

  // Analyze completeness
  if (scores.missedNotes > 0) {
    const missedPct = Math.round((scores.missedNotes / scores.totalNotes) * 100);
    suggestions.push({
      icon: '📝',
      title: `有 ${scores.missedNotes} 个音符未弹奏`,
      description: `漏弹了 ${missedPct}% 的音符。可能是速度太快跟不上，建议降低速度，确保每个音符都能弹到。`,
      category: 'completeness'
    });
  }

  if (scores.extraNotes > 3) {
    suggestions.push({
      icon: '✂️',
      title: `多弹了 ${scores.extraNotes} 个多余音符`,
      description: '弹奏中出现了谱面没有的音符，可能是手指误触。建议放慢速度，注意手型和指法。',
      category: 'completeness'
    });
  }

  // Dynamics
  if (scores.dynamics < 80) {
    suggestions.push({
      icon: '💪',
      title: '力度控制需要改善',
      description: '弹奏力度变化较大或不够均匀。对于这首曲子，尝试保持稳定一致的触键力度。',
      category: 'dynamics'
    });
  }

  // Encouragement
  if (scores.overall >= 90) {
    suggestions.unshift({
      icon: '🌟',
      title: '表现非常优秀！',
      description: '继续保持！可以尝试提高速度或挑战更难的曲目。',
      category: 'encouragement'
    });
  } else if (scores.overall >= 70) {
    suggestions.unshift({
      icon: '👍',
      title: '不错的表现',
      description: '已经掌握了基本框架，继续练习下面的建议项目，会越来越好！',
      category: 'encouragement'
    });
  } else {
    suggestions.unshift({
      icon: '💪',
      title: '加油，多练几遍会更好',
      description: '建议先慢速把每个音弹准确，再逐步加速。熟练来自于重复练习！',
      category: 'encouragement'
    });
  }

  return suggestions;
}
