(function () {
  'use strict';

  const STORAGE_KEY = 'breathcheck_history_v1';

  /* ---------- section refs ---------- */
  const heroSection = document.querySelector('.hero');
  const introSection = document.getElementById('how-it-works');
  const assessmentSection = document.getElementById('assessment');
  const resultsSection = document.getElementById('results');
  const progressSection = document.getElementById('progress');
  const navProgressLink = document.getElementById('nav-progress');
  const navCtaBtn = document.getElementById('nav-cta');
  const stageProgressFill = document.getElementById('stage-progress-fill');

  const session = { rate: null, hold: null, box: true };

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
    introSection.style.display = 'none';
    showOnly(assessmentSection);
    session.rate = null;
    session.hold = null;
    resetStage1();
    goToStage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('start-test-btn').addEventListener('click', startAssessment);
  navCtaBtn.addEventListener('click', () => {
    if (assessmentSection.hidden && resultsSection.hidden) startAssessment();
    else window.scrollTo({ top: 0, behavior: 'smooth' });
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

  /* ================= STAGE 2: breath hold ================= */
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

  /* ================= STAGE 3: box breathing ================= */
  const boxStartBtn = document.getElementById('box-start-btn');
  const boxPhaseLabel = document.getElementById('box-phase-label');
  const boxRoundLabel = document.getElementById('box-round-label');
  const boxLungLeft = document.getElementById('box-lung-left');
  const boxLungRight = document.getElementById('box-lung-right');
  const boxAirLeft = document.getElementById('box-air-left');
  const boxAirRight = document.getElementById('box-air-right');

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
    setLungState(0.4, 0.15);
    boxStartBtn.hidden = false;
    boxStartBtn.textContent = 'Begin box breathing';
  }

  function setLungState(scale, fill) {
    [boxLungLeft, boxLungRight].forEach(g => { g.style.transform = `scale(${scale})`; });
    [boxAirLeft, boxAirRight].forEach(r => { r.style.transform = `scaleY(${fill})`; });
  }

  function runBoxPhase() {
    const phase = PHASES[boxPhaseIndex % 4];
    boxPhaseLabel.textContent = phase.toLowerCase();
    boxRoundLabel.textContent = `round ${boxRound} of ${TOTAL_ROUNDS}`;

    if (phase === 'Inhale') setLungState(1.08, 1);
    else if (phase === 'Exhale') setLungState(0.9, 0.22);
    /* Hold phases: lungs stay as they are */

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
    if (seconds >= 60) return 95;
    if (seconds >= 40) return 85;
    if (seconds >= 25) return 70;
    if (seconds >= 15) return 55;
    return 35;
  }

  function computeScores() {
    const rateScore = scoreFromRate(session.rate ?? 16);
    const holdScore = scoreFromHold(session.hold ?? 20);
    const controlScore = Math.round((holdScore * 0.6) + (rateScore * 0.4));
    const overall = Math.round((rateScore * 0.35) + (holdScore * 0.45) + 20 * 0.2 + 0); // baseline relaxation weight placeholder
    const overallClamped = Math.max(30, Math.min(98, Math.round((rateScore + holdScore + 80) / 3)));
    const breathingAge = Math.max(18, Math.min(70, Math.round(45 - (overallClamped - 60) * 0.4)));
    return {
      rate: session.rate ?? 16,
      hold: session.hold ?? 0,
      control: controlScore,
      overall: overallClamped,
      breathingAge
    };
  }

  function planFor(scores) {
    if (scores.overall >= 80) {
      return 'Strong session. Try advanced coherence breathing (5.5 breaths per minute) for five minutes today to build on this.';
    }
    if (scores.rate > 18 || scores.hold < 25) {
      return 'Your breathing is running a little fast or shallow today. Five minutes of slow diaphragmatic breathing this evening will help more than anything else.';
    }
    return 'Solid baseline. A short box-breathing session before anything stressful today will keep this steady.';
  }

  /* ================= RESULTS + STORAGE ================= */
  function showResults() {
    showOnly(resultsSection);
    const scores = computeScores();

    document.getElementById('score-overall').textContent = scores.overall;
    document.getElementById('score-age').textContent = scores.breathingAge;
    document.getElementById('score-control').textContent = scores.control;
    document.getElementById('score-rate').textContent = scores.rate;
    document.getElementById('plan-text').textContent = planFor(scores);

    const history = loadHistory();
    const today = todayKey();
    const yesterday = history.find(h => h.date === yesterdayKey());

    const comparePanel = document.getElementById('compare-panel');
    const compareRows = document.getElementById('compare-rows');
    if (yesterday) {
      comparePanel.hidden = false;
      compareRows.innerHTML = '';
      addCompareRow(compareRows, 'Overall wellness', yesterday.overall, scores.overall);
      addCompareRow(compareRows, 'Breath hold', yesterday.hold, scores.hold, 's');
    } else {
      comparePanel.hidden = true;
    }

    saveTodayEntry(today, scores);
    renderProgress();
    navProgressLink.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    history.push({ date: dateKey, overall: scores.overall, hold: scores.hold, control: scores.control, breathingAge: scores.breathingAge });
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
    introSection.style.display = '';
    showOnly(null);
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

})();
