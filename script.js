(function () {
  'use strict';

  const STORAGE_KEY = 'breathcheck_history_v1';
  const EVENTS_KEY = 'breathcheck_events_v1';

  /* Lightweight local funnel tracking — no third-party service, no signup needed.
     Stored per-browser only; useful for you to eyeball your own usage patterns
     during early testing (open devtools console: JSON.parse(localStorage.getItem('breathcheck_events_v1'))).
     It does NOT aggregate across visitors — for real cross-user analytics,
     a connected service (e.g. Plausible, Fathom) would need to be wired in later. */
  function logEvent(name, meta) {
    try {
      const events = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
      events.push({ name, meta: meta || null, ts: Date.now() });
      localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-500)));
    } catch (e) { /* storage unavailable, ignore */ }
  }

  /* ---------- section refs ---------- */
  const heroSection = document.querySelector('.hero');
  const whyMattersSection = document.getElementById('why-matters');
  const workdaySection = document.getElementById('workday');
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
    logEvent('test_started');
    heroSection.style.display = 'none';
    whyMattersSection.style.display = 'none';
    workdaySection.style.display = 'none';
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
    workdaySection.style.display = '';
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

  /* ================= MODAL ACCESSIBILITY (shared) =================
     Handles focus trapping, Escape-to-close, and returning focus to the
     element that opened the dialog — used by every modal/overlay below. */
  let modalReturnFocus = null;
  let modalKeydownHandler = null;

  function activateModalA11y(modalEl, onEscape) {
    modalReturnFocus = document.activeElement;
    const getFocusables = () => Array.from(modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => el.offsetParent !== null); /* excludes anything currently hidden/display:none */
    const initial = getFocusables();
    if (initial.length) initial[0].focus();
    modalKeydownHandler = function (e) {
      if (e.key === 'Escape') {
        onEscape();
      } else if (e.key === 'Tab') {
        const focusables = getFocusables();
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', modalKeydownHandler);
  }

  function deactivateModalA11y() {
    if (modalKeydownHandler) { document.removeEventListener('keydown', modalKeydownHandler); modalKeydownHandler = null; }
    if (modalReturnFocus) { modalReturnFocus.focus(); modalReturnFocus = null; }
  }

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
    activateModalA11y(confirmModal, hideConfirm);
  }

  function hideConfirm() {
    confirmModal.hidden = true;
    pendingConfirmAction = null;
    deactivateModalA11y();
  }

  confirmCancelBtn.addEventListener('click', hideConfirm);
  confirmExitBtn.addEventListener('click', () => {
    const action = pendingConfirmAction;
    hideConfirm();
    if (action) action();
  });

  /* ---- medical boundary info modal (simple info panel, no confirm/cancel choice) ---- */
  const medicalModal = document.getElementById('medical-modal');
  function closeMedicalModal() { medicalModal.hidden = true; deactivateModalA11y(); }
  document.getElementById('medical-note-link').addEventListener('click', () => {
    medicalModal.hidden = false;
    activateModalA11y(medicalModal, closeMedicalModal);
  });
  document.getElementById('medical-modal-close-btn').addEventListener('click', closeMedicalModal);

  /* ---- "how is this calculated" info modal ---- */
  const calcModal = document.getElementById('calc-modal');
  function closeCalcModal() { calcModal.hidden = true; deactivateModalA11y(); }
  document.getElementById('calc-link').addEventListener('click', () => {
    calcModal.hidden = false;
    activateModalA11y(calcModal, closeCalcModal);
  });
  document.getElementById('calc-modal-close-btn').addEventListener('click', closeCalcModal);


  /* Exit the scored assessment at any point — no result is saved */
  document.getElementById('exit-assessment-btn').addEventListener('click', () => {
    showConfirm("Exit the test now? Your progress on this attempt won't be saved.", () => {
      clearInterval(rateInterval);
      clearInterval(holdInterval);
      clearTimeout(boxTimeout);
      returnToHome();
    });
  });

  /* ================= SESSION TIPS (shared rotation engine) =================
     Used during genuinely idle waiting time — the 60s resting-rate count and
     longer bedtime sessions — so that dead time carries something useful
     instead of just watching a timer. Deliberately NOT shown during active
     paced-breathing rounds (box/4-7-8/etc.), where the point is following
     the rhythm, not reading. */
  const GENERAL_TIPS = [
    "Most people breathe 12–18 times a minute at rest. There's no need to force a number — just count what's natural.",
    "Shallow, chest-led breathing is common at a desk. Notice whether your shoulders are doing most of the work right now.",
    "One reading doesn't say much on its own — it's the pattern over days and weeks that actually tells you something.",
    "This isn't a performance test. There's no score for holding still or counting perfectly.",
    "Curious what a busy workday does to your breathing? <a href=\"blog/\" target=\"_blank\" rel=\"noopener\">Read more on the blog</a>."
  ];
  const BEDTIME_TIPS = [
    "Slower breathing before bed is one of the simplest ways to cue your body that it's time to wind down.",
    "There's no need to breathe deeply here — just let each exhale be a little longer and softer than the last.",
    "If your mind wanders, that's normal. Just gently come back to the rhythm whenever you notice.",
    "A dim screen and slow breathing work well together — if you can, lower your screen brightness too."
  ];

  function startTipRotation(el, tips, intervalMs) {
    let i = 0;
    function showNext() {
      el.classList.remove('visible');
      setTimeout(() => {
        el.innerHTML = tips[i % tips.length];
        el.hidden = false;
        el.classList.add('visible');
        i += 1;
      }, 400);
    }
    showNext();
    return setInterval(showNext, intervalMs);
  }

  function stopTipRotation(intervalId, el) {
    clearInterval(intervalId);
    if (el) { el.classList.remove('visible'); el.hidden = true; }
  }

  /* ================= STAGE 1: resting rate ================= */
  const rateTimerEl = document.getElementById('rate-timer');
  const rateCountEl = document.getElementById('rate-count');
  const rateTapBtn = document.getElementById('rate-tap-btn');
  const rateStartBtn = document.getElementById('rate-start-btn');
  const rateTipEl = document.getElementById('rate-tip');

  let rateInterval = null;
  let rateTipInterval = null;
  let rateSecondsLeft = 60;
  let rateBreaths = 0;
  let rateRunning = false;

  function resetStage1() {
    clearInterval(rateInterval);
    stopTipRotation(rateTipInterval, rateTipEl);
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
    rateTipInterval = startTipRotation(rateTipEl, GENERAL_TIPS, 15000);
    rateInterval = setInterval(() => {
      rateSecondsLeft -= 1;
      rateTimerEl.textContent = String(rateSecondsLeft);
      if (rateSecondsLeft <= 0) {
        clearInterval(rateInterval);
        stopTipRotation(rateTipInterval, rateTipEl);
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
    logEvent('stage1_completed', { rate: rateBreaths });
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
      logEvent('stage2_completed', { hold: session.hold });
      setTimeout(() => { resetStage3(); goToStage(3); }, 700);
    }
  });

  document.getElementById('hold-skip-btn').addEventListener('click', () => {
    clearInterval(holdInterval);
    session.hold = null;
    session.holdSkipped = true;
    logEvent('stage2_skipped');
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
        logEvent('stage3_completed');
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

  function scoreLabel(score) {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 55) return 'Fair';
    return 'Room to improve';
  }

  function computeScores() {
    const rateScore = scoreFromRate(session.rate ?? 16);
    const holdScore = scoreFromHold(session.hold ?? 20);
    /* Overall only ever blends what was actually measured. If the hold was
       skipped, the score is based on resting rate alone — never a fixed
       stand-in value for the unmeasured guided-practice round. */
    const overall = session.holdSkipped
      ? Math.max(30, Math.min(98, rateScore))
      : Math.max(30, Math.min(98, Math.round((rateScore + holdScore) / 2)));

    const history = loadHistory();
    const consistency = computeConsistency(history, overall);

    return {
      rate: session.rate ?? 16,
      hold: session.hold ?? 0,
      holdSkipped: !!session.holdSkipped,
      rateScore,
      holdScore,
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

  function overallDescriptor(overall) {
    if (overall >= 80) return 'Strong';
    if (overall >= 60) return 'Good';
    if (overall >= 45) return 'Fair';
    return 'Needs attention';
  }

  function verdictText(overall, weakName, strongName) {
    if (overall >= 80) return `Your breathing looks strong today. Your strongest area was ${strongName}.`;
    if (overall >= 60) return `Your breathing is looking good today. Your strongest area was ${strongName}.`;
    if (overall >= 45) return `Your breathing has some room to improve today, mainly around ${weakName}.`;
    return `There's a clear opportunity to improve today, mainly around ${weakName}.`;
  }

  function rateContext(breaths) {
    if (breaths >= 12 && breaths <= 18) return 'Steady';
    if (breaths > 18) return 'Above the typical adult resting range';
    return 'Below the typical adult resting range';
  }

  function weakestArea(scores) {
    const areas = [
      { key: 'rate', name: 'resting rate', score: scores.rateScore, exercise: 'coherent' },
      { key: 'control', name: 'breath control', score: scores.holdScore, exercise: '478' }
    ];
    /* exclude breath control from being singled out if the test was skipped —
       we don't have a real reading to base a recommendation on */
    const usable = scores.holdSkipped ? areas.filter(a => a.key !== 'control') : areas;
    if (usable.length === 1) return { weak: usable[0], strong: usable[0] };
    usable.sort((a, b) => a.score - b.score);
    return { weak: usable[0], strong: usable[usable.length - 1] };
  }

  function nextStepFor(scores) {
    const { weak } = weakestArea(scores);
    /* when the overall session was strong, recommend maintaining it rather than
       chasing whichever of two close scores happened to be mathematically lowest */
    if (scores.overall >= 75) {
      return {
        eyebrow: 'Build on your strong breathing today',
        text: 'Try slow, steady breathing.',
        sub: '5 minutes · a slow, comfortable rhythm',
        exercise: 'coherent'
      };
    }
    const map = {
      'resting rate': { eyebrow: 'Focus on your resting rate', text: 'Try slow, steady breathing to help bring your resting rate down.', sub: '5 minutes · a slow, comfortable rhythm', exercise: 'coherent' },
      'breath control': { eyebrow: 'Focus on your breath control', text: 'Practice 4-7-8 breathing to build a bit more control.', sub: '4 rounds · about 2 minutes', exercise: '478' }
    };
    return map[weak.name] || map['resting rate'];
  }

  /* ================= RESULTS + STORAGE ================= */
  function showResults() {
    showOnly(resultsSection);
    const scores = computeScores();
    const { weak, strong } = weakestArea(scores);
    logEvent('result_viewed', { overall: scores.overall });

    document.getElementById('score-overall').textContent = scores.overall;
    document.getElementById('result-descriptor').textContent = overallDescriptor(scores.overall);
    document.getElementById('result-verdict').textContent = verdictText(scores.overall, weak.name, strong.name);

    document.getElementById('strong-area-name').textContent = strong.name.charAt(0).toUpperCase() + strong.name.slice(1);
    document.getElementById('strong-area-score').textContent = scoreLabel(strong.score);
    document.getElementById('weak-area-name').textContent = weak.name.charAt(0).toUpperCase() + weak.name.slice(1);

    document.getElementById('row-rate-value').textContent = scores.rate;
    document.getElementById('row-rate-label').textContent = rateContext(scores.rate);

    if (scores.holdSkipped) {
      document.getElementById('row-control-value').textContent = '—';
      document.getElementById('row-control-label').textContent = 'Skipped for safety';
    } else {
      document.getElementById('row-control-value').textContent = scores.hold + 's';
      document.getElementById('row-control-label').textContent = 'Gentle self-check · not a fitness measurement';
    }

    document.getElementById('row-paced-value').textContent = 'Completed';
    document.getElementById('row-paced-label').textContent = 'Guided practice, not scored';

    if (scores.consistency === null) {
      document.getElementById('row-consistency-value').textContent = '—';
      document.getElementById('row-consistency-label').textContent = 'Not enough data yet';
    } else {
      document.getElementById('row-consistency-value').textContent = scores.consistency + '/100';
      document.getElementById('row-consistency-label').textContent = scoreLabel(scores.consistency);
    }

    const nextStep = nextStepFor(scores);
    document.getElementById('next-step-eyebrow').textContent = nextStep.eyebrow;
    document.getElementById('next-step-text').textContent = nextStep.text;
    document.getElementById('next-step-sub').textContent = nextStep.sub;
    const nextStepBtn = document.getElementById('next-step-btn');
    nextStepBtn.onclick = () => {
      logEvent('recommended_exercise_started', { exercise: nextStep.exercise });
      openExercisePlayer(nextStep.exercise);
    };

    const history = loadHistory();
    const today = todayKey();
    const recentAvg = recentAverage(history, today, 7);

    const comparePanel = document.getElementById('compare-panel');
    const compareRows = document.getElementById('compare-rows');
    if (recentAvg) {
      comparePanel.hidden = false;
      compareRows.innerHTML = '';
      addCompareRow(compareRows, 'Breathing snapshot', recentAvg.overall, scores.overall);
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

  /* Local-date helpers. toISOString() is UTC-based, which can put a session
     on the wrong calendar day for anyone not near UTC+0 (e.g. late-evening
     sessions in India could land on the previous or next day). These use
     the browser's local calendar consistently for both formatting and
     re-parsing stored date keys. */
  function localDateKey(date) {
    date = date || new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  function parseLocalDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function todayKey() {
    return localDateKey();
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
    let cursor = parseLocalDateKey(history[0].date);
    const last = parseLocalDateKey(history[history.length - 1].date);
    while (cursor <= last) {
      const key = localDateKey(cursor);
      if (dates.has(key)) { run += 1; best = Math.max(best, run); }
      else { run = 0; }
      cursor.setDate(cursor.getDate() + 1);
    }
    // current streak: count back from today
    let current = 0;
    let d = new Date();
    while (dates.has(localDateKey(d))) {
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
    workdaySection.style.display = '';
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

  /* ---- mobile hamburger menu ---- */
  const navToggleBtn = document.getElementById('nav-toggle-btn');
  const topnav = document.getElementById('topnav');

  function closeMobileNav() {
    topnav.classList.remove('open');
    navToggleBtn.setAttribute('aria-expanded', 'false');
  }

  navToggleBtn.addEventListener('click', () => {
    const isOpen = topnav.classList.toggle('open');
    navToggleBtn.setAttribute('aria-expanded', String(isOpen));
  });

  topnav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && topnav.classList.contains('open')) closeMobileNav();
  });

  function revealProgress() {
    progressSection.hidden = false;
    progressSection.scrollIntoView({ behavior: 'smooth' });
  }

  navProgressLink.addEventListener('click', (e) => {
    e.preventDefault();
    revealProgress();
  });

  document.getElementById('progress-cta-link').addEventListener('click', revealProgress);

  /* init: if returning user has history, reveal progress nav */
  if (loadHistory().length) {
    navProgressLink.hidden = false;
    progressSection.hidden = false;
    renderProgress();
    logEvent('return_visit');
  }

  /* ================= GUIDED EXERCISES (Box / 4-7-8 / Slow / Diaphragmatic / Extended / Bedtime) ================= */

  const exercisePlayer = document.getElementById('exercise-player');
  const exercisePlayerTitle = document.getElementById('exercise-player-title');
  const exercisePlayerPurpose = document.getElementById('exercise-player-purpose');
  const exercisePlayerEstimate = document.getElementById('exercise-player-estimate');
  const durationPicker = document.getElementById('duration-picker');
  const exerciseLungVisual = document.getElementById('exercise-lung-visual');
  const exercisePhaseLabel = document.getElementById('exercise-phase-label');
  const exercisePhaseCue = document.getElementById('exercise-phase-cue');
  const exerciseRoundLabel = document.getElementById('exercise-round-label');
  const exerciseSessionTimer = document.getElementById('exercise-session-timer');
  const exerciseBeginBtn = document.getElementById('exercise-begin-btn');
  const exerciseExitBtn = document.getElementById('exercise-exit-btn');
  const exerciseCloseBtn = document.getElementById('exercise-close-btn');
  const musicToggleBtn = document.getElementById('music-toggle-btn');
  const voiceToggleBtn = document.getElementById('voice-toggle-btn');
  const iconSoundOn = document.getElementById('icon-sound-on');
  const iconSoundOff = document.getElementById('icon-sound-off');
  const exerciseTipEl = document.getElementById('exercise-tip');
  const progressDotsEl = document.getElementById('progress-dots');
  const progressBarTrack = document.getElementById('progress-bar-track');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const sessionChrome = document.getElementById('session-chrome');
  const playerViewIntro = document.getElementById('player-view-intro');
  const playerViewSession = document.getElementById('player-view-session');
  const playerViewComplete = document.getElementById('player-view-complete');
  const completeTitle = document.getElementById('complete-title');
  const completeStats = document.getElementById('complete-stats');
  const completeNextText = document.getElementById('complete-next-text');
  const moodOptions = document.getElementById('mood-options');
  let exerciseTipInterval = null;

  const EXERCISE_DEFS = {
    box: {
      title: 'Box breathing',
      purpose: 'A steady, even rhythm — good before anything that needs focus.',
      phases: [
        { label: 'Inhale', seconds: 4, action: 'inhale', cue: "Let your belly expand, not just your chest." },
        { label: 'Hold', seconds: 4, action: 'hold', cue: "Stay relaxed here. No need to strain." },
        { label: 'Exhale', seconds: 4, action: 'exhale', cue: "Let the breath go at the same steady pace." },
        { label: 'Hold', seconds: 4, action: 'hold', cue: "Rest for a moment before the next round." }
      ],
      roundAwareness: [
        "Find your rhythm. Follow the pace, don't force it.",
        "Relax your shoulders. Let them drop away from your ears.",
        "Soften your jaw. You don't need to hold tension there.",
        "Notice the difference. Has your breathing started to feel easier?"
      ],
      completionNote: "You're ready to get back to work.",
      rounds: 4,
      theme: 'light',
      music: false,
      durationPicker: false
    },
    '478': {
      title: '4-7-8 breathing',
      purpose: 'A longer exhale that helps settle the body before rest.',
      phases: [
        { label: 'Inhale', seconds: 4, action: 'inhale', cue: "Breathe in gently through your nose." },
        { label: 'Hold', seconds: 7, action: 'hold', cue: "Stay comfortable here. Don't strain." },
        { label: 'Exhale', seconds: 8, action: 'exhale', cue: "Let the air leave slowly, without forcing it." }
      ],
      roundAwareness: [
        "Find your rhythm. There's no need to rush the exhale.",
        "Relax your shoulders and let your jaw soften.",
        "Let each exhale get a little easier.",
        "Notice how your body feels right now."
      ],
      completionNote: "A good moment to pause before your next task.",
      rounds: 4,
      theme: 'light',
      music: false,
      durationPicker: false
    },
    coherent: {
      title: 'Slow, steady breathing',
      purpose: 'An easy, even rhythm with no holds — good for a calm reset.',
      phases: [
        { label: 'Inhale', seconds: 5, action: 'inhale', cue: "A smooth, easy breath in." },
        { label: 'Exhale', seconds: 6, action: 'exhale', cue: "Let it fall away slowly." }
      ],
      roundAwareness: [
        "Settle into the rhythm.",
        "Let your shoulders soften.",
        "No need to control the breath — just follow it.",
        "Notice how steady this feels."
      ],
      completionNote: "You're ready to get back to work.",
      rounds: 27, /* ~5 minutes at roughly 5.5 breaths/min, no holds */
      theme: 'light',
      music: false,
      durationPicker: false
    },
    diaphragmatic: {
      title: 'Diaphragmatic breathing',
      purpose: 'Breathe naturally at your own pace — just notice your belly rise and fall.',
      phases: [
        { label: 'Breathe in', seconds: 4, action: 'inhale', cue: "Feel your belly rise, not your shoulders." },
        { label: 'Breathe out', seconds: 5, action: 'exhale', cue: "Let your belly fall naturally." }
      ],
      roundAwareness: [
        "Rest one hand on your belly if that helps.",
        "There's no need to breathe deeply — just naturally.",
        "Notice the rise and fall, nothing more.",
        "Let your breathing find its own pace."
      ],
      completionNote: "A small reset before you carry on with your day.",
      rounds: 20, /* ~3 minutes, natural comfortable pace, no holds */
      theme: 'light',
      music: false,
      durationPicker: false
    },
    extended: {
      title: 'Extended exhale',
      purpose: 'A comfortable inhale, a slightly longer exhale — good for tense moments.',
      phases: [
        { label: 'Inhale', seconds: 4, action: 'inhale', cue: "A comfortable breath in, nothing forced." },
        { label: 'Exhale', seconds: 6, action: 'exhale', cue: "Let this breath out a little longer than usual." }
      ],
      roundAwareness: [
        "Find your rhythm. Let the exhale lead.",
        "Relax your shoulders as you breathe out.",
        "Let your jaw soften with each exhale.",
        "Notice if anything feels a little less tense."
      ],
      completionNote: "Take a moment before you go back to what you were doing.",
      rounds: 15, /* ~3 minutes, no holds */
      theme: 'light',
      music: false,
      durationPicker: false
    },
    bedtime: {
      title: 'Bedtime wind down',
      purpose: 'A longer, dimmed session to help you wind down before sleep.',
      phases: [
        { label: 'Inhale', seconds: 4, action: 'inhale', cue: "Breathe in slowly." },
        { label: 'Hold', seconds: 7, action: 'hold', cue: "Just rest here a moment." },
        { label: 'Exhale', seconds: 8, action: 'exhale', cue: "Let the day go with this breath." }
      ],
      roundAwareness: [
        "Let your shoulders sink.",
        "Soften your face and jaw.",
        "There's nowhere else to be right now.",
        "Notice your body getting heavier."
      ],
      completionNote: "Your workday is done. Give yourself a few quiet minutes before reaching for another screen.",
      rounds: 16, /* default, recalculated from duration picker */
      theme: 'dark',
      music: true,
      durationPicker: true,
      tips: true
    }
  };

  let activeExercise = null;
  let exTimeout = null;
  let exPhaseIndex = 0;
  let exRound = 1;
  let selectedMinutes = 5;
  let sessionSecondsRemaining = 0;
  let sessionTimerInterval = null;
  let sessionElapsedSeconds = 0;
  let sessionElapsedInterval = null;
  let voiceEnabled = false;
  let focusDimTimeout = null;

  function showPlayerView(view) {
    playerViewIntro.hidden = view !== 'intro';
    playerViewSession.hidden = view !== 'session';
    playerViewComplete.hidden = view !== 'complete';
  }

  function buildProgressIndicator(totalRounds) {
    progressDotsEl.innerHTML = '';
    if (totalRounds <= 8) {
      progressDotsEl.hidden = false;
      progressBarTrack.hidden = true;
      for (let i = 0; i < totalRounds; i++) {
        const dot = document.createElement('span');
        dot.className = 'progress-dot';
        progressDotsEl.appendChild(dot);
      }
    } else {
      progressDotsEl.hidden = true;
      progressBarTrack.hidden = false;
      progressBarFill.style.width = '0%';
    }
  }

  function updateProgressIndicator(round, totalRounds) {
    if (totalRounds <= 8) {
      const dots = progressDotsEl.querySelectorAll('.progress-dot');
      dots.forEach((dot, i) => {
        dot.classList.toggle('done', i < round - 1);
        dot.classList.toggle('current', i === round - 1);
      });
    } else {
      progressBarFill.style.width = Math.round(((round - 1) / totalRounds) * 100) + '%';
    }
  }

  /* ---- focus/dim mode: fade non-essential chrome after a few idle seconds ---- */
  function resetFocusDim() {
    exercisePlayer.classList.remove('focus-dim');
    clearTimeout(focusDimTimeout);
    if (!playerViewSession.hidden) {
      focusDimTimeout = setTimeout(() => { exercisePlayer.classList.add('focus-dim'); }, 8000);
    }
  }
  ['mousemove', 'touchstart', 'keydown'].forEach(evt => {
    exercisePlayer.addEventListener(evt, () => { if (!exercisePlayer.hidden) resetFocusDim(); });
  });

  function openExercisePlayer(key) {
    const def = EXERCISE_DEFS[key];
    logEvent('exercise_selected', { exercise: key });
    activeExercise = key;
    exPhaseIndex = 0;
    exRound = 1;
    sessionElapsedSeconds = 0;

    exercisePlayerTitle.textContent = def.title;
    exercisePlayerPurpose.textContent = def.purpose;
    exercisePlayer.classList.remove('theme-light', 'theme-dark', 'focus-dim');
    exercisePlayer.classList.add('theme-' + def.theme);
    exercisePhaseLabel.textContent = 'get ready';
    exercisePhaseCue.textContent = '';
    exerciseRoundLabel.textContent = '';
    setLungPhaseClass(exerciseLungVisual, null);
    stopTipRotation(exerciseTipInterval, exerciseTipEl);
    moodOptions.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));

    durationPicker.hidden = !def.durationPicker;
    exerciseSessionTimer.hidden = !def.durationPicker;
    if (def.durationPicker) {
      selectedMinutes = 5;
      durationPicker.querySelectorAll('.duration-opt').forEach(btn => {
        btn.classList.toggle('selected', Number(btn.dataset.minutes) === selectedMinutes);
      });
      exerciseSessionTimer.textContent = formatTime(selectedMinutes * 60);
    }

    const cycleSeconds = def.phases.reduce((sum, p) => sum + p.seconds, 0);
    if (def.durationPicker) {
      exercisePlayerEstimate.textContent = 'Pick a length below';
    } else {
      exercisePlayerEstimate.textContent = `${def.rounds} rounds · ~${formatTime(def.rounds * cycleSeconds)} min`;
    }

    musicToggleBtn.hidden = !def.music;
    musicEnabled = true;
    musicToggleBtn.setAttribute('aria-pressed', 'true');
    iconSoundOn.hidden = false;
    iconSoundOff.hidden = true;

    voiceEnabled = false;
    voiceToggleBtn.setAttribute('aria-pressed', 'false');

    exerciseBeginBtn.textContent = 'Begin';
    buildProgressIndicator(def.durationPicker ? 16 : def.rounds);

    showPlayerView('intro');
    exercisePlayer.hidden = false;
    activateModalA11y(exercisePlayer, () => exerciseExitBtn.click());
  }

  function closeExercisePlayer() {
    clearTimeout(exTimeout);
    clearInterval(sessionTimerInterval);
    clearInterval(sessionElapsedInterval);
    clearTimeout(focusDimTimeout);
    exercisePlayer.classList.remove('focus-dim');
    stopTipRotation(exerciseTipInterval, exerciseTipEl);
    stopAmbientTone();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    exercisePlayer.hidden = true;
    activeExercise = null;
    deactivateModalA11y();
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.round(totalSeconds % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  durationPicker.querySelectorAll('.duration-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMinutes = Number(btn.dataset.minutes);
      durationPicker.querySelectorAll('.duration-opt').forEach(b => b.classList.toggle('selected', b === btn));
      exerciseSessionTimer.textContent = formatTime(selectedMinutes * 60);
      const def = EXERCISE_DEFS[activeExercise];
      const cycleSeconds = def.phases.reduce((sum, p) => sum + p.seconds, 0);
      const estRounds = Math.max(3, Math.round((selectedMinutes * 60) / cycleSeconds));
      buildProgressIndicator(estRounds);
    });
  });

  document.querySelectorAll('[data-exercise]').forEach(btn => {
    btn.addEventListener('click', () => openExercisePlayer(btn.dataset.exercise));
  });

  exerciseExitBtn.addEventListener('click', () => {
    /* only confirm if a session is actually in progress */
    if (!playerViewSession.hidden) {
      /* release the exercise player's own trap first so the confirm modal's
         trap doesn't stack a second keydown listener on top of it */
      deactivateModalA11y();
      showConfirm('End this session now?', closeExercisePlayer);
    } else {
      closeExercisePlayer();
    }
  });

  exerciseCloseBtn.addEventListener('click', closeExercisePlayer);

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
    buildProgressIndicator(rounds);
    sessionElapsedSeconds = 0;
    sessionElapsedInterval = setInterval(() => { sessionElapsedSeconds += 1; }, 1000);

    if (def.music) startAmbientTone();
    if (def.tips) exerciseTipInterval = startTipRotation(exerciseTipEl, BEDTIME_TIPS, 20000);

    showPlayerView('session');
    resetFocusDim();
    logEvent('exercise_started', { exercise: activeExercise });
    runExercisePhase(def, rounds);
  });

  function runExercisePhase(def, totalRounds) {
    const phaseInRound = exPhaseIndex % def.phases.length;
    const phase = def.phases[phaseInRound];
    exercisePhaseLabel.textContent = phase.label.toLowerCase();
    exerciseRoundLabel.textContent = `round ${exRound} of ${totalRounds}`;
    updateProgressIndicator(exRound, totalRounds);
    setLungPhaseClass(exerciseLungVisual, phase.action);

    /* on the first phase of each round, show the round-level awareness prompt;
       every other phase shows the normal per-phase coaching cue */
    let cueText = phase.cue || '';
    if (phaseInRound === 0 && def.roundAwareness && def.roundAwareness.length) {
      cueText = def.roundAwareness[(exRound - 1) % def.roundAwareness.length];
    }
    exercisePhaseCue.textContent = cueText;

    if (voiceEnabled) speakPhase(phase.label);

    if (phase.action === 'inhale') setToneLevel(0.05, phase.seconds);
    else if (phase.action === 'exhale') setToneLevel(0.015, phase.seconds);

    exTimeout = setTimeout(() => {
      exPhaseIndex += 1;
      if (exPhaseIndex % def.phases.length === 0) {
        exRound += 1;
      }
      if (exRound > totalRounds) {
        finishExercise(def, totalRounds);
        return;
      }
      runExercisePhase(def, totalRounds);
    }, phase.seconds * 1000);
  }

  function finishExercise(def, totalRounds) {
    logEvent('exercise_completed', { exercise: activeExercise, seconds: sessionElapsedSeconds });
    clearInterval(sessionTimerInterval);
    clearInterval(sessionElapsedInterval);
    clearTimeout(focusDimTimeout);
    exercisePlayer.classList.remove('focus-dim');
    stopTipRotation(exerciseTipInterval, exerciseTipEl);
    stopAmbientTone();

    completeTitle.textContent = def.title + ' complete';
    completeStats.textContent = `${totalRounds} rounds · ${formatTime(sessionElapsedSeconds)} min`;
    completeNextText.textContent = def.completionNote;
    moodOptions.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));

    showPlayerView('complete');
  }

  moodOptions.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      moodOptions.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      logEvent('mood_after_exercise', { exercise: activeExercise, mood: btn.dataset.mood });
    });
  });

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

  /* ---- optional spoken voice cues via the browser's built-in speech synthesis
     (no external service, no license needed) — off by default ---- */
  voiceToggleBtn.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    voiceToggleBtn.setAttribute('aria-pressed', String(voiceEnabled));
    if (!voiceEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
    else if (voiceEnabled && window.speechSynthesis) {
      /* speak a near-silent utterance now, while still inside the click gesture,
         so mobile browsers "unlock" speech synthesis for later scheduled calls */
      const unlock = new SpeechSynthesisUtterance(' ');
      unlock.volume = 0;
      window.speechSynthesis.speak(unlock);
    }
  });

  function speakPhase(label) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(label);
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  }

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
