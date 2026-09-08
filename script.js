(function () {
  'use strict';

  const STORAGE_KEY = 'breathcheck_history_v1';

  /* ---------- section refs ---------- */
  const heroSection = document.querySelector('.hero');
  const whyMattersSection = document.getElementById('why-matters');
  const introSection = document.getElementById('how-it-works');
  const exercisesSection = document.getElementById('exercises');
  const assessmentSection = document.getElementById('assessment');
  const resultsSection = document.getElementById('results');
  const progressSection = document.getElementById('progress');
  const navProgressLink = document.getElementById('nav-progress');
  const navCtaBtn = document.getElementById('nav-cta');
  const stageProgressFill = document.getElementById('stage-progress-fill');

  const session = { rate: null, hold: null, holdSkipped: false, box: true };

  function showOnly(section) {
    [assessmentSection, resultsSection].forEach(s => { if (s) s.hidden = true; });
    if (section) section.hidden = false;
  }

  function setStageProgress(stageNumber) {
    const pct = ((stageNumber - 1) / 3) * 100;
    stageProgressFill.style.width = pct + '%';
  }

  function goToStage(n) {
    document.querySelectorAll('.stage').forEach(s => { s.hidden = s.dataset.stage != n; });
    setStageProgress(n);
  }

  function startAssessment() {
    heroSection.style.display = 'none';
    whyMattersSection.style.display = 'none';
    introSection.style.display = 'none';
    exercisesSection.style.display = 'none';
    showOnly(assessmentSection);
    session.rate = null;
    session.hold = null;
    session.holdSkipped = false;
    resetStage1();
    goToStage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function returnToHome() {
    heroSection.style.display = '';
    whyMattersSection.style.display = '';
    introSection.style.display = '';
    exercisesSection.style.display = '';
    showOnly(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('start-test-btn').addEventListener('click', startAssessment);
  navCtaBtn.addEventListener('click', () => {
    if (assessmentSection.hidden && resultsSection.hidden) startAssessment();
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ================= CONFIRM MODAL (shared) ================= */
  const confirmModal = document.getElementById('confirm-modal');
  const confirmModalText = document.getElementById('confirm-modal-text');
  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  const confirmExitBtn = document.getElementById('confirm-exit-btn');
  let pendingConfirmAction = null;

  function showConfirm(message, onConfirm) {
    confirmModalText.textContent = message;
    pendingConfirmAction = onConfirm;
    confirmModal.hidden = false;
  }

  function hideConfirm() {
    confirmModal.hidden = true;
    pendingConfirmAction = null;
  }

  confirmCancelBtn.addEventListener('click', hideConfirm);
  confirmExitBtn.addEventListener('click', () => {
    const action = pendingConfirmAction;
    hideConfirm();
    if (action) action();
  });

  /* ---- medical boundary info modal (simple info panel, no confirm/cancel choice) ---- */
  const medicalModal = document.getElementById('medical-modal');
  document.getElementById('medical-note-link').addEventListener('click', () => { medicalModal.hidden = false; });
  document.getElementById('medical-modal-close-btn').addEventListener('click', () => { medicalModal.hidden = true; });

  /* Exit the scored assessment at any point — no result is saved */
  document.getElementById('exit-assessment-btn').addEventListener('click', () => {
    showConfirm("Exit the test now? Your progress on this attempt won't be saved.", () => {
      clearInterval(rateInterval);
      clearInterval(holdInterval);
      clearTimeout(boxTimeout);
      returnToHome();
    });
  });

  /* ================= STAGE 1: resting rate ================= */
  const rateTimerEl = document.getElementById('rate-timer');
  const rateCountEl = document.getElementById('rate-count');
  const rateTapBtn = document.getElementById('rate-tap-btn');
  const rateStartBtn = document.getElementById('rate-start-btn');

  let rateInterval = null;
  let rateSecondsLeft = 60;
  let rateBreaths = 0;
  let rateRunning = false;

  function resetStage1() {
    clearInterval(rateInterval);
    rateSecondsLeft = 60;
    rateBreaths = 0;
    rateRunning = false;
    rateTimerEl.textContent = '60';
    rateCountEl.textContent = '0';
    rateTapBtn.disabled = true;
    rateStartBtn.textContent = 'Start 60s timer';
    rateStartBtn.disabled = false;
  }

  rateStartBtn.addEventListener('click', () => {
    if (rateRunning) return;
    rateRunning = true;
    rateTapBtn.disabled = false;
    rateStartBtn.disabled = true;
    rateInterval = setInterval(() => {
      rateSecondsLeft -= 1;
      rateTimerEl.textContent = String(rateSecondsLeft);
      if (rateSecondsLeft <= 0) {
        clearInterval(rateInterval);
        rateTapBtn.disabled = true;
        finishStage1();
      }
    }, 1000);
  });

  rateTapBtn.addEventListener('click', () => {
    if (!rateRunning) return;
    rateBreaths += 1;
    rateCountEl.textContent = String(rateBreaths);
  });

  function finishStage1() {
    session.rate = rateBreaths;
    resetStage2();
    goToStage(2);
  }

  /* ================= STAGE 2: breath hold control (BOLT-style) ================= */
  const holdTimerEl = document.getElementById('hold-timer');
  const holdToggleBtn = document.getElementById('hold-toggle-btn');

  let holdInterval = null;
  let holdStart = 0;
  let holdRunning = false;

  function resetStage2() {
    clearInterval(holdInterval);
    holdRunning = false;
    holdTimerEl.textContent = '0.0s';
    holdToggleBtn.textContent = 'Start hold';
  }

  holdToggleBtn.addEventListener('click', () => {
    if (!holdRunning) {
      holdRunning = true;
      holdStart = performance.now();
      holdToggleBtn.textContent = 'Stop';
      holdInterval = setInterval(() => {
        const elapsed = (performance.now() - holdStart) / 1000;
        holdTimerEl.textContent = elapsed.toFixed(1) + 's';
      }, 100);
    } else {
      holdRunning = false;
      clearInterval(holdInterval);
      const elapsed = (performance.now() - holdStart) / 1000;
      holdTimerEl.textContent = elapsed.toFixed(1) + 's';
      session.hold = Math.round(elapsed * 10) / 10;
      setTimeout(() => { resetStage3(); goToStage(3); }, 700);
    }
  });

  document.getElementById('hold-skip-btn').addEventListener('click', () => {
    clearInterval(holdInterval);
    session.hold = null;
    session.holdSkipped = true;
    resetStage3();
    goToStage(3);
  });

  /* ================= STAGE 3: box breathing (scored assessment) ================= */
  const boxStartBtn = document.getElementById('box-start-btn');
  const boxPhaseLabel = document.getElementById('box-phase-label');
  const boxRoundLabel = document.getElementById('box-round-label');
  const boxLungVisual = document.getElementById('box-lung-visual');

  const PHASES = ['Inhale', 'Hold', 'Exhale', 'Hold'];
  const TOTAL_ROUNDS = 4;
  let boxTimeout = null;
  let boxPhaseIndex = 0;
  let boxRound = 1;

  function resetStage3() {
    clearTimeout(boxTimeout);
    boxPhaseIndex = 0;
    boxRound = 1;
    boxPhaseLabel.textContent = 'get ready';
    boxRoundLabel.textContent = 'round 1 of 4';
    setLungPhaseClass(boxLungVisual, null);
    boxStartBtn.hidden = false;
    boxStartBtn.textContent = 'Begin box breathing';
  }

  function setLungPhaseClass(visualEl, phaseAction) {
    visualEl.classList.remove('phase-inhale', 'phase-exhale', 'phase-hold');
    if (phaseAction) visualEl.classList.add('phase-' + phaseAction);
  }

  function runBoxPhase() {
    const phase = PHASES[boxPhaseIndex % 4];
    boxPhaseLabel.textContent = phase.toLowerCase();
    boxRoundLabel.textContent = `round ${boxRound} of ${TOTAL_ROUNDS}`;
    setLungPhaseClass(boxLungVisual, phase.toLowerCase());

    boxTimeout = setTimeout(() => {
      boxPhaseIndex += 1;
      if (boxPhaseIndex % 4 === 0) {
        boxRound += 1;
      }
      if (boxRound > TOTAL_ROUNDS) {
        boxPhaseLabel.textContent = 'well done';
        session.box = true;
        setTimeout(showResults, 900);
        return;
      }
      runBoxPhase();
    }, 4000);
  }

  boxStartBtn.addEventListener('click', () => {
    boxStartBtn.hidden = true;
    runBoxPhase();
  });

  /* ================= SCORING ================= */
  function scoreFromRate(breaths) {
    // Healthy resting rate ~12-18 breaths/min
    if (breaths >= 12 && breaths <= 18) return 90;
    if (breaths >= 10 && breaths <= 20) return 75;
    if (breaths >= 8 && breaths <= 24) return 60;
    return 40;
  }

  function scoreFromHold(seconds) {
    /* Bands follow the standard BOLT / Buteyko Control Pause scale:
       under 10s = disrupted breathing pattern, 40s+ = excellent control */
    if (seconds >= 40) return 95;
    if (seconds >= 30) return 82;
    if (seconds >= 20) return 68;
    if (seconds >= 10) return 50;
    return 30;
  }

  function rateLabel(breaths) {
    if (breaths >= 12 && breaths <= 18) return 'Good';
    if (breaths > 18) return 'Elevated';
    return 'Low';
  }

  function scoreLabel(score) {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 55) return 'Fair';
    return 'Room to improve';
  }

  function computeScores() {
    const rateScore = scoreFromRate(session.rate ?? 16);
    /* if the hold was skipped, use a neutral mid-value so it doesn't unfairly tank the score */
    const holdScore = scoreFromHold(session.hold ?? 20);
    const pacedScore = Math.round((rateScore * 0.5) + (holdScore * 0.5));
    const overall = Math.max(30, Math.min(98, Math.round((rateScore + holdScore + 80) / 3)));

    const history = loadHistory();
    const consistency = computeConsistency(history, overall);

    return {
      rate: session.rate ?? 16,
      hold: session.hold ?? 0,
      holdSkipped: !!session.holdSkipped,
      rateScore,
      holdScore,
      pacedScore,
      consistency,
      overall
    };
  }

  function computeConsistency(history, todayOverall) {
    const recent = history.slice(-4).map(h => h.overall).concat([todayOverall]);
    if (recent.length < 3) return null; /* not enough sessions yet to judge consistency */
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((a, b) => a + Math.abs(b - avg), 0) / recent.length;
    return Math.max(30, Math.min(95, Math.round(92 - variance * 2)));
  }

  function verdictText(overall) {
    if (overall >= 80) return 'Your breathing is looking strong.';
    if (overall >= 60) return 'Your breathing is looking good.';
    if (overall >= 45) return 'Your breathing has some room to improve.';
    return "There's a clear opportunity to improve your breathing.";
  }

  function weakestArea(scores) {
    const areas = [
      { key: 'rate', name: 'resting rate', score: scores.rateScore, exercise: '478' },
      { key: 'control', name: 'breath control', score: scores.holdScore, exercise: '478' },
      { key: 'paced', name: 'paced breathing', score: scores.pacedScore, exercise: 'box' }
    ];
    /* exclude the hold-derived areas from being singled out if the test was skipped —
       we don't have a real reading to base a recommendation on */
    const usable = scores.holdSkipped ? areas.filter(a => a.key !== 'control') : areas;
    usable.sort((a, b) => a.score - b.score);
    return { weak: usable[0], strong: usable[usable.length - 1] };
  }

  function buildInterpretation(scores) {
    const { weak, strong } = weakestArea(scores);
    if (weak.name === strong.name) {
      return `Your ${strong.name} looked steady today.`;
    }
    return `Your ${strong.name} looked solid today. Your main opportunity right now is your ${weak.name}.`;
  }

  function nextStepFor(scores) {
    const { weak } = weakestArea(scores);
    const map = {
      'resting rate': { text: 'Try 5 minutes of slow 4-7-8 breathing today to bring your resting rate down.', exercise: '478' },
      'breath control': { text: 'Practice 4-7-8 breathing today to build a bit more breath control.', exercise: '478' },
      'paced breathing': { text: 'Try box breathing today to sharpen your paced rhythm.', exercise: 'box' }
    };
    return map[weak.name] || map['paced breathing'];
  }

  /* ================= RESULTS + STORAGE ================= */
  function showResults() {
    showOnly(resultsSection);
    const scores = computeScores();

    document.getElementById('score-overall').textContent = scores.overall;
    document.getElementById('result-verdict').textContent = verdictText(scores.overall);
    document.getElementById('result-interpretation').textContent = buildInterpretation(scores);

    document.getElementById('row-rate-value').textContent = scores.rate;
    document.getElementById('row-rate-label').textContent = rateLabel(scores.rate);

    if (scores.holdSkipped) {
      document.getElementById('row-control-value').textContent = 'Skipped';
      document.getElementById('row-control-sub').textContent = '';
      document.getElementById('row-control-label').textContent = 'Skipped for safety';
    } else {
      document.getElementById('row-control-value').textContent = scores.holdScore + '/100';
      document.getElementById('row-control-sub').textContent = scores.hold + 's hold';
      document.getElementById('row-control-label').textContent = scoreLabel(scores.holdScore);
    }

    document.getElementById('row-paced-value').textContent = scores.pacedScore + '/100';
    document.getElementById('row-paced-label').textContent = scoreLabel(scores.pacedScore);

    if (scores.consistency === null) {
      document.getElementById('row-consistency-value').textContent = '—';
      document.getElementById('row-consistency-label').textContent = 'Not enough data yet';
    } else {
      document.getElementById('row-consistency-value').textContent = scores.consistency + '/100';
      document.getElementById('row-consistency-label').textContent = scoreLabel(scores.consistency);
    }

    const nextStep = nextStepFor(scores);
    document.getElementById('next-step-text').textContent = nextStep.text;
    const nextStepBtn = document.getElementById('next-step-btn');
    nextStepBtn.onclick = () => openExercisePlayer(nextStep.exercise);

    const history = loadHistory();
    const today = todayKey();
    const recentAvg = recentAverage(history, today, 7);

    const comparePanel = document.getElementById('compare-panel');
    const compareRows = document.getElementById('compare-rows');
    if (recentAvg) {
      comparePanel.hidden = false;
      compareRows.innerHTML = '';
      addCompareRow(compareRows, 'Overall wellness', recentAvg.overall, scores.overall);
      if (!scores.holdSkipped) addCompareRow(compareRows, 'Breath hold', recentAvg.hold, scores.hold, 's');
    } else {
      comparePanel.hidden = true;
    }

    saveTodayEntry(today, scores);
    renderProgress();
    navProgressLink.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function recentAverage(history, excludeDateKey, days) {
    const relevant = history.filter(h => h.date !== excludeDateKey).slice(-days);
    if (!relevant.length) return null;
    const avgOverall = relevant.reduce((a, h) => a + h.overall, 0) / relevant.length;
    const avgHold = relevant.reduce((a, h) => a + (h.hold || 0), 0) / relevant.length;
    return { overall: Math.round(avgOverall), hold: Math.round(avgHold * 10) / 10 };
  }

  function addCompareRow(container, label, prev, curr, suffix) {
    suffix = suffix || '';
    const diff = Math.round((curr - prev) * 10) / 10;
    const row = document.createElement('div');
    row.className = 'compare-row';
    const arrow = diff > 0 ? '▲' : (diff < 0 ? '▼' : '—');
    const cls = diff > 0 ? 'delta-up' : (diff < 0 ? 'delta-down' : '');
    row.innerHTML = `<span>${label}</span><span class="${cls}">${curr}${suffix} ${arrow} ${Math.abs(diff)}${suffix}</span>`;
    container.appendChild(row);
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }
  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveTodayEntry(dateKey, scores) {
    const history = loadHistory().filter(h => h.date !== dateKey);
    history.push({ date: dateKey, overall: scores.overall, hold: scores.holdSkipped ? 0 : scores.hold, control: scores.holdScore, rateScore: scores.rateScore });
    history.sort((a, b) => a.date.localeCompare(b.date));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) { /* storage unavailable, ignore */ }
  }

  function computeStreak(history) {
    if (!history.length) return { current: 0, best: 0 };
    const dates = new Set(history.map(h => h.date));
    let best = 0, run = 0;
    let cursor = new Date(history[0].date);
    const last = new Date(history[history.length - 1].date);
    while (cursor <= last) {
      const key = cursor.toISOString().slice(0, 10);
      if (dates.has(key)) { run += 1; best = Math.max(best, run); }
      else { run = 0; }
      cursor.setDate(cursor.getDate() + 1);
    }
    // current streak: count back from today
    let current = 0;
    let d = new Date();
    while (dates.has(d.toISOString().slice(0, 10))) {
      current += 1;
      d.setDate(d.getDate() - 1);
    }
    return { current, best };
  }

  function renderProgress() {
    const history = loadHistory();
    const { current, best } = computeStreak(history);
    document.getElementById('streak-current').textContent = current;
    document.getElementById('streak-best').textContent = best;

    const list = document.getElementById('history-list');
    list.innerHTML = '';
    history.slice().reverse().slice(0, 14).forEach(h => {
      const row = document.createElement('div');
      row.className = 'history-row';
      row.innerHTML = `<span class="history-date">${h.date}</span><span class="history-score">${h.overall}/100</span>`;
      list.appendChild(row);
    });
  }

  document.getElementById('retake-btn').addEventListener('click', () => {
    heroSection.style.display = '';
    whyMattersSection.style.display = '';
    introSection.style.display = '';
    exercisesSection.style.display = '';
    showOnly(null);
    session.rate = null;
    session.hold = null;
    session.holdSkipped = false;
    resetStage1();
    goToStage(1);
    showOnly(assessmentSection);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  navProgressLink.addEventListener('click', (e) => {
    e.preventDefault();
    progressSection.hidden = false;
    progressSection.scrollIntoView({ behavior: 'smooth' });
  });

  /* init: if returning user has history, reveal progress nav */
  if (loadHistory().length) {
    navProgressLink.hidden = false;
    progressSection.hidden = false;
    renderProgress();
  }

  /* ================= GUIDED EXERCISES (Box / 4-7-8 / Bedtime) ================= */

  const exercisePlayer = document.getElementById('exercise-player');
  const exercisePlayerTitle = document.getElementById('exercise-player-title');
  const durationPicker = document.getElementById('duration-picker');
  const exerciseLungVisual = document.getElementById('exercise-lung-visual');
  const exercisePhaseLabel = document.getElementById('exercise-phase-label');
  const exerciseRoundLabel = document.getElementById('exercise-round-label');
  const exerciseSessionTimer = document.getElementById('exercise-session-timer');
  const exerciseBeginBtn = document.getElementById('exercise-begin-btn');
  const exerciseExitBtn = document.getElementById('exercise-exit-btn');
  const musicToggleBtn = document.getElementById('music-toggle-btn');
  const iconSoundOn = document.getElementById('icon-sound-on');
  const iconSoundOff = document.getElementById('icon-sound-off');

  const EXERCISE_DEFS = {
    box: {
      title: 'Box breathing',
      phases: [
        { label: 'Inhale', seconds: 4, action: 'inhale' },
        { label: 'Hold', seconds: 4, action: 'hold' },
        { label: 'Exhale', seconds: 4, action: 'exhale' },
        { label: 'Hold', seconds: 4, action: 'hold' }
      ],
      rounds: 4,
      theme: 'light',
      music: false,
      durationPicker: false
    },
    '478': {
      title: '4-7-8 breathing',
      phases: [
        { label: 'Inhale', seconds: 4, action: 'inhale' },
        { label: 'Hold', seconds: 7, action: 'hold' },
        { label: 'Exhale', seconds: 8, action: 'exhale' }
      ],
      rounds: 4,
      theme: 'light',
      music: false,
      durationPicker: false
    },
    bedtime: {
      title: 'Bedtime wind down',
      phases: [
        { label: 'Inhale', seconds: 4, action: 'inhale' },
        { label: 'Hold', seconds: 7, action: 'hold' },
        { label: 'Exhale', seconds: 8, action: 'exhale' }
      ],
      rounds: 16, /* default, recalculated from duration picker */
      theme: 'dark',
      music: true,
      durationPicker: true
    }
  };

  let activeExercise = null;
  let exTimeout = null;
  let exPhaseIndex = 0;
  let exRound = 1;
  let selectedMinutes = 5;
  let sessionSecondsRemaining = 0;
  let sessionTimerInterval = null;

  function openExercisePlayer(key) {
    const def = EXERCISE_DEFS[key];
    activeExercise = key;
    exPhaseIndex = 0;
    exRound = 1;

    exercisePlayerTitle.textContent = def.title;
    exercisePlayer.classList.remove('theme-light', 'theme-dark');
    exercisePlayer.classList.add('theme-' + def.theme);
    exercisePhaseLabel.textContent = 'get ready';
    exerciseRoundLabel.textContent = '';
    setLungPhaseClass(exerciseLungVisual, null);

    durationPicker.hidden = !def.durationPicker;
    exerciseSessionTimer.hidden = !def.durationPicker;
    if (def.durationPicker) {
      selectedMinutes = 5;
      durationPicker.querySelectorAll('.duration-opt').forEach(btn => {
        btn.classList.toggle('selected', Number(btn.dataset.minutes) === selectedMinutes);
      });
      exerciseSessionTimer.textContent = formatTime(selectedMinutes * 60);
    }

    musicToggleBtn.hidden = !def.music;
    musicEnabled = true;
    musicToggleBtn.setAttribute('aria-pressed', 'true');
    iconSoundOn.hidden = false;
    iconSoundOff.hidden = true;

    exerciseBeginBtn.hidden = false;
    exerciseBeginBtn.textContent = 'Begin';

    exercisePlayer.hidden = false;
  }

  function closeExercisePlayer() {
    clearTimeout(exTimeout);
    clearInterval(sessionTimerInterval);
    stopAmbientTone();
    exercisePlayer.hidden = true;
    activeExercise = null;
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  durationPicker.querySelectorAll('.duration-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMinutes = Number(btn.dataset.minutes);
      durationPicker.querySelectorAll('.duration-opt').forEach(b => b.classList.toggle('selected', b === btn));
      exerciseSessionTimer.textContent = formatTime(selectedMinutes * 60);
    });
  });

  document.querySelectorAll('[data-exercise]').forEach(btn => {
    btn.addEventListener('click', () => openExercisePlayer(btn.dataset.exercise));
  });

  exerciseExitBtn.addEventListener('click', () => {
    /* only confirm if a session is actually in progress (Begin was already clicked) */
    if (exerciseBeginBtn.hidden) {
      showConfirm('End this session now?', closeExercisePlayer);
    } else {
      closeExercisePlayer();
    }
  });

  exerciseBeginBtn.addEventListener('click', () => {
    const def = EXERCISE_DEFS[activeExercise];
    let rounds = def.rounds;
    const cycleSeconds = def.phases.reduce((sum, p) => sum + p.seconds, 0);
    if (def.durationPicker) {
      rounds = Math.max(3, Math.round((selectedMinutes * 60) / cycleSeconds));
      sessionSecondsRemaining = selectedMinutes * 60;
      exerciseSessionTimer.textContent = formatTime(sessionSecondsRemaining);
      sessionTimerInterval = setInterval(() => {
        sessionSecondsRemaining = Math.max(0, sessionSecondsRemaining - 1);
        exerciseSessionTimer.textContent = formatTime(sessionSecondsRemaining);
        if (sessionSecondsRemaining <= 0) clearInterval(sessionTimerInterval);
      }, 1000);
    }
    exerciseBeginBtn.hidden = true;
    durationPicker.hidden = true;
    if (def.music) startAmbientTone();
    runExercisePhase(def, rounds);
  });

  function runExercisePhase(def, totalRounds) {
    const phase = def.phases[exPhaseIndex % def.phases.length];
    exercisePhaseLabel.textContent = phase.label.toLowerCase();
    exerciseRoundLabel.textContent = `round ${exRound} of ${totalRounds}`;
    setLungPhaseClass(exerciseLungVisual, phase.action);

    if (phase.action === 'inhale') setToneLevel(0.05, phase.seconds);
    else if (phase.action === 'exhale') setToneLevel(0.015, phase.seconds);

    exTimeout = setTimeout(() => {
      exPhaseIndex += 1;
      if (exPhaseIndex % def.phases.length === 0) {
        exRound += 1;
      }
      if (exRound > totalRounds) {
        exercisePhaseLabel.textContent = 'well done';
        exerciseRoundLabel.textContent = '';
        clearInterval(sessionTimerInterval);
        stopAmbientTone();
        setTimeout(closeExercisePlayer, 1600);
        return;
      }
      runExercisePhase(def, totalRounds);
    }, phase.seconds * 1000);
  }

  musicToggleBtn.addEventListener('click', () => {
    musicEnabled = !musicEnabled;
    musicToggleBtn.setAttribute('aria-pressed', String(musicEnabled));
    iconSoundOn.hidden = !musicEnabled;
    iconSoundOff.hidden = musicEnabled;
    if (!musicEnabled && gainNode) {
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    }
  });

  /* ---- synthesized ambient tone via Web Audio API (no licensed audio needed) ---- */
  let audioCtx = null;
  let oscNodes = [];
  let gainNode = null;
  let musicEnabled = true;

  function startAmbientTone() {
    if (!audioCtx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return; /* unsupported browser, fail silently */
      audioCtx = new AudioCtor();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.0001;
    gainNode.connect(audioCtx.destination);

    const freqs = [110, 164.81]; /* soft low interval, A2 + E3 */
    oscNodes = freqs.map(f => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.connect(gainNode);
      osc.start();
      return osc;
    });
  }

  function stopAmbientTone() {
    if (gainNode && audioCtx) {
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);
    }
    const nodesToStop = oscNodes;
    setTimeout(() => { nodesToStop.forEach(o => { try { o.stop(); } catch (e) {} }); }, 700);
    oscNodes = [];
    gainNode = null;
  }

  function setToneLevel(target, rampSeconds) {
    if (!gainNode || !audioCtx || !musicEnabled) return;
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(target, now + Math.max(0.5, rampSeconds));
  }

})();
