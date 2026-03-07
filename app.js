"use strict";

const SETTINGS = Object.freeze({
  totalQuestions: 10,
  maxTimeSeconds: 90,
  penaltySeconds: 5,
  minFactor: 2,
  maxFactor: 9,
  countdownSeconds: 3,
  countdownStepMs: 800,
  goFlashMs: 600,
  chartEntries: 10,
});

const STORAGE_KEYS = Object.freeze({
  scores: "rechentrainer-kleines-einmaleins-scores-v1",
  playerName: "rechentrainer-kleines-einmaleins-player-v1",
});

const SEEDED_SCORES = Object.freeze([
  { zeit: 51.16, datum: "2026-02-11 19:32:50", name: "till" },
  { zeit: 62.9, datum: "2026-02-11 20:53:03", name: "till" },
  { zeit: 68.24, datum: "2026-02-11 21:01:21", name: "till" },
  { zeit: 43.27, datum: "2026-02-11 21:03:57", name: "till" },
  { zeit: 49.28, datum: "2026-02-12 16:10:28", name: "till" },
  { zeit: 46.57, datum: "2026-02-12 16:24:30", name: "till" },
  { zeit: 46.93, datum: "2026-02-12 16:27:23", name: "till" },
  { zeit: 50.68, datum: "2026-02-12 16:32:01", name: "till" },
  { zeit: 52.53, datum: "2026-02-12 16:33:57", name: "till" },
  { zeit: 75.24, datum: "2026-02-12 16:37:54", name: "till" },
  { zeit: 110.07, datum: "2026-02-12 17:09:07", name: "lia" },
  { zeit: 71.48, datum: "2026-02-12 17:13:29", name: "merle" },
  { zeit: 47.75, datum: "2026-02-12 17:15:03", name: "till" },
  { zeit: 58.83, datum: "2026-02-12 17:17:14", name: "till" },
  { zeit: 34.08, datum: "2026-02-13 15:37:26", name: "till" },
  { zeit: 98.97, datum: "2026-02-13 15:39:54", name: "till" },
  { zeit: 72.13, datum: "2026-02-13 15:42:04", name: "till" },
  { zeit: 41.0, datum: "2026-02-13 15:43:59", name: "till" },
  { zeit: 41.09, datum: "2026-02-13 15:45:51", name: "till" },
  { zeit: 38.88, datum: "2026-02-13 15:47:39", name: "till" },
  { zeit: 38.14, datum: "2026-02-13 15:49:16", name: "till" }
]);

const COPY = Object.freeze({
  success: [
    "Stark!",
    "Mega!",
    "Super gerechnet!",
    "Yes!",
    "Richtig gut!",
  ],
  comeback: [
    "Stark zurückgeholt.",
    "Yes, jetzt sitzt es!",
    "Super verbessert.",
  ],
  streak: [
    "Wow, du bist gerade richtig im Flow!",
    "Mega-Serie – weiter so!",
    "Raketenmodus!",
  ],
  retry: [
    "Fast! Dieselbe Aufgabe kommt gleich noch einmal andersherum.",
    "Knapp daneben – du bekommst direkt eine zweite Chance.",
    "Nicht schlimm – dieselbe Aufgabe kommt noch einmal andersherum.",
  ],
  reveal: [
    "Nicht schlimm – richtig wäre %product%.",
    "Weiter geht's – die Lösung ist %product%.",
    "Das war knapp. Richtig wäre %product%.",
  ],
});

const state = {
  mode: "ready",
  scores: [],
  playerName: "Gast",
  questions: [],
  questionIndex: 0,
  errors: 0,
  correctStreak: 0,
  bestStreak: 0,
  answerBuffer: "",
  startedAt: 0,
  finishedAt: 0,
  timerId: null,
  countdownValue: SETTINGS.countdownSeconds,
  countdownTimeoutId: null,
  goFlashTimerId: null,
  goFlashUntil: 0,
  feedbackText: "",
  feedbackTone: "",
  lastResult: null,
  chartOpen: false,
  audioContext: null,
  activeTones: [],
};

const elements = {
  playerNameInput: document.getElementById("playerNameInput"),
  startButton: document.getElementById("startButton"),
  resetScoresButton: document.getElementById("resetScoresButton"),
  playerStat: document.getElementById("playerStat"),
  progressStat: document.getElementById("progressStat"),
  timeStat: document.getElementById("timeStat"),
  errorsStat: document.getElementById("errorsStat"),
  overallBestStat: document.getElementById("overallBestStat"),
  personalBestStat: document.getElementById("personalBestStat"),
  progressFill: document.getElementById("progressFill"),
  motivationKicker: document.getElementById("motivationKicker"),
  motivationText: document.getElementById("motivationText"),
  modePill: document.getElementById("modePill"),
  streakPill: document.getElementById("streakPill"),
  questionLabel: document.getElementById("questionLabel"),
  questionText: document.getElementById("questionText"),
  countdownPanel: document.getElementById("countdownPanel"),
  trafficLight: document.getElementById("trafficLight"),
  countdownValue: document.getElementById("countdownValue"),
  answerBoard: document.getElementById("answerBoard"),
  hintText: document.getElementById("hintText"),
  feedbackText: document.getElementById("feedbackText"),
  resultSummary: document.getElementById("resultSummary"),
  resultMessage: document.getElementById("resultMessage"),
  rewardBadge: document.getElementById("rewardBadge"),
  rawTimeResult: document.getElementById("rawTimeResult"),
  mistakesResult: document.getElementById("mistakesResult"),
  unansweredResult: document.getElementById("unansweredResult"),
  totalTimeResult: document.getElementById("totalTimeResult"),
  topList: document.getElementById("topList"),
  toggleChartButton: document.getElementById("toggleChartButton"),
  chartPanel: document.getElementById("chartPanel"),
  personalList: document.getElementById("personalList"),
  personalSectionLabel: document.getElementById("personalSectionLabel"),
  historyList: document.getElementById("historyList"),
};

init();

function init() {
  state.scores = loadScores();
  state.playerName = loadPlayerName();
  elements.playerNameInput.value = state.playerName === "Gast" ? "" : state.playerName;

  bindEvents();
  render();
}

function bindEvents() {
  window.addEventListener("keydown", handleGlobalKeydown, true);

  elements.playerNameInput.addEventListener("input", () => {
    const cleaned = normalizeName(elements.playerNameInput.value, { allowEmpty: true });

    if (elements.playerNameInput.value !== cleaned) {
      elements.playerNameInput.value = cleaned;
    }

    if (cleaned) {
      savePlayerName(cleaned);
      state.playerName = cleaned;
    } else if (state.mode !== "playing") {
      state.playerName = "Gast";
      removeStoredPlayerName();
    }

    renderStats();
    renderRankings();
  });

  elements.startButton.addEventListener("click", () => {
    elements.startButton.blur();
    startGame();
  });

  elements.resetScoresButton.addEventListener("click", () => {
    elements.resetScoresButton.blur();
    resetScores();
  });

  elements.toggleChartButton.addEventListener("click", () => {
    state.chartOpen = !state.chartOpen;
    elements.toggleChartButton.blur();
    renderChartPanel();
  });
}

function handleGlobalKeydown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  if (state.mode === "playing") {
    const handled = handleAnswerKey(event.key);

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }

    return;
  }

  if (state.mode === "countdown") {
    if (event.key === " " || event.key === "Enter" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
    }

    return;
  }

  if (event.key === "Enter") {
    if (event.target instanceof HTMLButtonElement) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    startGame();
    return;
  }

  if (event.key === " " && !isEditableTarget(event.target) && !(event.target instanceof HTMLButtonElement)) {
    event.preventDefault();
    event.stopPropagation();
    startGame();
  }
}

function handleAnswerKey(key) {
  if (/^\d$/.test(key)) {
    appendDigit(key);
    return true;
  }

  if (key === "Backspace") {
    state.answerBuffer = state.answerBuffer.slice(0, -1);
    clearFeedback();
    renderGameSurface();
    return true;
  }

  if (key === "Escape" || key === "Delete") {
    clearAnswerBuffer();
    return true;
  }

  if (key === "Enter") {
    submitAnswer();
    return true;
  }

  return false;
}

function appendDigit(digit) {
  if (state.answerBuffer.length >= 3) {
    return;
  }

  state.answerBuffer = state.answerBuffer === "0"
    ? digit
    : `${state.answerBuffer}${digit}`;

  clearFeedback();
  renderGameSurface();
}

function clearAnswerBuffer() {
  state.answerBuffer = "";
  clearFeedback();
  renderGameSurface();
}

function startGame() {
  if (state.mode === "playing" || state.mode === "countdown") {
    const confirmed = window.confirm(
      state.mode === "countdown"
        ? "Die Startsequenz abbrechen und neu starten?"
        : "Die laufende Runde abbrechen und neu starten?"
    );

    if (!confirmed) {
      return;
    }
  }

  clearTimer();
  clearCountdown();

  state.playerName = normalizeName(elements.playerNameInput.value);
  elements.playerNameInput.value = state.playerName === "Gast" ? "" : state.playerName;
  savePlayerName(state.playerName);

  state.mode = "countdown";
  state.questions = createQuestions();
  state.questionIndex = 0;
  state.errors = 0;
  state.correctStreak = 0;
  state.bestStreak = 0;
  state.answerBuffer = "";
  state.startedAt = 0;
  state.finishedAt = 0;
  state.countdownValue = SETTINGS.countdownSeconds;
  state.feedbackText = "Achte auf die Ampel – bei Grün startet dein Mathe-Run.";
  state.feedbackTone = "";
  state.goFlashUntil = 0;

  elements.playerNameInput.blur();
  primeAudioContext();
  render();
  startCountdown();
}

function createQuestions() {
  const pool = [];

  for (let a = SETTINGS.minFactor; a <= SETTINGS.maxFactor; a += 1) {
    for (let b = a; b <= SETTINGS.maxFactor; b += 1) {
      if (Math.random() < 0.5) {
        pool.push({ a, b, product: a * b, retryUsed: false });
      } else {
        pool.push({ a: b, b: a, product: a * b, retryUsed: false });
      }
    }
  }

  shuffle(pool);
  return pool.slice(0, SETTINGS.totalQuestions);
}

function startCountdown() {
  clearCountdown();
  tickCountdown(SETTINGS.countdownSeconds);
}

function tickCountdown(value) {
  if (state.mode !== "countdown") {
    return;
  }

  state.countdownValue = value;
  playCountdownTone(value);
  renderGameSurface();

  if (value > 1) {
    state.countdownTimeoutId = window.setTimeout(() => {
      tickCountdown(value - 1);
    }, SETTINGS.countdownStepMs);
    return;
  }

  state.countdownTimeoutId = window.setTimeout(() => {
    beginRound();
  }, SETTINGS.countdownStepMs);
}

function beginRound() {
  if (state.mode !== "countdown") {
    return;
  }

  clearCountdown();

  const now = performance.now();

  state.mode = "playing";
  state.startedAt = now;
  state.goFlashUntil = now + SETTINGS.goFlashMs;
  state.feedbackText = "Los! Hol dir direkt die ersten richtigen Antworten.";
  state.feedbackTone = "success";

  startTimer();
  render();

  state.goFlashTimerId = window.setTimeout(() => {
    if (state.mode === "playing") {
      renderGameSurface();
    }
  }, SETTINGS.goFlashMs);
}

function startTimer() {
  clearTimer();

  state.timerId = window.setInterval(() => {
    if (state.mode !== "playing") {
      return;
    }

    if (getRemainingSeconds() <= 0) {
      finishGame("timeout");
      return;
    }

    renderStats();
  }, 100);
}

function clearTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function clearCountdown() {
  if (state.countdownTimeoutId) {
    window.clearTimeout(state.countdownTimeoutId);
    state.countdownTimeoutId = null;
  }

  if (state.goFlashTimerId) {
    window.clearTimeout(state.goFlashTimerId);
    state.goFlashTimerId = null;
  }

  stopActiveTones();
  state.countdownValue = SETTINGS.countdownSeconds;
  state.goFlashUntil = 0;
}

function submitAnswer() {
  if (state.mode !== "playing") {
    return;
  }

  if (getRemainingSeconds() <= 0) {
    finishGame("timeout");
    return;
  }

  if (!state.answerBuffer) {
    state.feedbackText = "Tippe zuerst deine Antwort ein.";
    state.feedbackTone = "warning";
    renderGameSurface();
    return;
  }

  const question = state.questions[state.questionIndex];
  const answer = Number(state.answerBuffer);

  state.answerBuffer = "";

  if (answer === question.product) {
    state.correctStreak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.correctStreak);
    state.feedbackText = getSuccessFeedback(question.retryUsed);
    state.feedbackTone = "success";
    state.questionIndex += 1;

    if (state.questionIndex >= SETTINGS.totalQuestions) {
      finishGame("completed");
      return;
    }

    render();
    return;
  }

  state.errors += 1;
  state.correctStreak = 0;

  if (!question.retryUsed) {
    question.retryUsed = true;
    [question.a, question.b] = [question.b, question.a];
    state.feedbackText = getRetryFeedback();
    state.feedbackTone = "warning";
    render();
    return;
  }

  state.feedbackText = getRevealFeedback(question.product);
  state.feedbackTone = "error";
  state.questionIndex += 1;

  if (state.questionIndex >= SETTINGS.totalQuestions) {
    finishGame("completed");
    return;
  }

  render();
}

function finishGame(reason) {
  if (state.mode !== "playing") {
    return;
  }

  clearTimer();

  const previousOverallBest = getOverallBest(state.scores);
  const previousPersonalBest = getPersonalBest(state.playerName, state.scores);
  const finishedAt = reason === "timeout"
    ? state.startedAt + SETTINGS.maxTimeSeconds * 1000
    : performance.now();
  const rawTime = (finishedAt - state.startedAt) / 1000;
  const unanswered = SETTINGS.totalQuestions - state.questionIndex;
  const mistakePenalty = state.errors * SETTINGS.penaltySeconds;
  const unansweredPenalty = unanswered * SETTINGS.penaltySeconds;
  const finalTime = Number((rawTime + mistakePenalty + unansweredPenalty).toFixed(2));
  const entry = {
    zeit: finalTime,
    datum: formatTimestamp(new Date()),
    name: state.playerName,
  };

  state.finishedAt = finishedAt;
  state.mode = "finished";
  state.scores = dedupeScores([...state.scores, entry]);
  saveScores(state.scores);

  const overallBest = getOverallBest(state.scores);
  const personalBest = getPersonalBest(state.playerName, state.scores);

  state.lastResult = {
    entryId: getEntryId(entry),
    reason,
    rawTime,
    finalTime,
    unanswered,
    mistakes: state.errors,
    bestStreak: state.bestStreak,
    isNewOverallBest: previousOverallBest === null || finalTime < previousOverallBest,
    isNewPersonalBest: previousPersonalBest === null || finalTime < previousPersonalBest,
    overallBest,
    personalBest,
  };

  state.feedbackText = reason === "timeout"
    ? "Zeit um – trotzdem stark durchgezogen."
    : "Stark gemacht – Runde gespeichert.";
  state.feedbackTone = reason === "timeout" ? "warning" : "success";
  state.answerBuffer = "";

  render();
}

function resetScores() {
  const confirmed = window.confirm("Alle lokal gespeicherten Zeiten zurücksetzen?");

  if (!confirmed) {
    return;
  }

  state.scores = cloneScores(SEEDED_SCORES);
  saveScores(state.scores);
  state.lastResult = null;
  state.correctStreak = 0;
  state.bestStreak = 0;

  if (state.mode === "finished") {
    state.mode = "ready";
  }

  render();
}

function render() {
  renderControls();
  renderStats();
  renderMotivation();
  renderGameSurface();
  renderResultSummary();
  renderRankings();
}

function renderControls() {
  elements.playerNameInput.readOnly = state.mode === "playing" || state.mode === "countdown";

  if (state.mode === "playing" || state.mode === "countdown") {
    elements.startButton.textContent = "Neu starten";
  } else if (state.mode === "finished") {
    elements.startButton.textContent = "Noch eine Runde";
  } else {
    elements.startButton.textContent = "Los geht's";
  }
}

function renderMotivation() {
  const { kicker, text } = getMotivationCopy();
  const progress = getRoundProgressPercent();
  const displayStreak = state.mode === "finished" && state.lastResult
    ? state.lastResult.bestStreak
    : state.correctStreak;

  elements.progressFill.style.width = `${progress.toFixed(1)}%`;
  elements.motivationKicker.textContent = kicker;
  elements.motivationText.textContent = text;

  let streakLabel = "Serie 0";

  if (state.mode === "countdown") {
    streakLabel = "Auf die Plätze";
  } else if (state.mode === "playing") {
    streakLabel = displayStreak > 1 ? `Serie ${displayStreak}` : "Runde läuft";
  } else if (state.mode === "finished" && state.lastResult) {
    streakLabel = displayStreak > 1
      ? `Beste Serie ${displayStreak}`
      : "Runde geschafft";
  }

  elements.streakPill.textContent = streakLabel;
  elements.streakPill.className = `streak-pill${displayStreak >= 3 ? " is-hot" : ""}`;
}

function renderStats() {
  const playerName = getSelectedPlayerName();
  const overallBest = getOverallBest(state.scores);
  const personalBest = getPersonalBest(playerName, state.scores);
  const answeredCount = state.mode === "finished" && state.lastResult
    ? SETTINGS.totalQuestions - state.lastResult.unanswered
    : state.mode === "playing"
      ? state.questionIndex + 1
      : 0;
  const remaining = state.mode === "playing"
    ? getRemainingSeconds()
    : state.mode === "finished" && state.lastResult
      ? Math.max(0, SETTINGS.maxTimeSeconds - state.lastResult.rawTime)
      : SETTINGS.maxTimeSeconds;

  elements.playerStat.textContent = playerName;
  elements.progressStat.textContent = `${Math.min(answeredCount, SETTINGS.totalQuestions)} / ${SETTINGS.totalQuestions}`;
  elements.timeStat.textContent = formatSeconds(remaining, 1);
  elements.errorsStat.textContent = String(state.errors);
  elements.overallBestStat.textContent = overallBest === null ? "–" : formatSeconds(overallBest);
  elements.personalBestStat.textContent = personalBest === null ? "–" : formatSeconds(personalBest);
}

function renderGameSurface() {
  const question = state.questions[state.questionIndex];
  const hasAnswer = Boolean(state.answerBuffer);
  const showGoFlash = renderCountdownPanel();

  elements.feedbackText.textContent = state.feedbackText;
  elements.feedbackText.className = `feedback${state.feedbackTone ? ` ${state.feedbackTone}` : ""}`;

  elements.answerBoard.hidden = state.mode === "countdown";

  if (state.mode === "countdown") {
    elements.modePill.textContent = "Startet gleich";
    elements.questionLabel.textContent = "Die erste Aufgabe erscheint erst bei Grün.";
    elements.questionText.textContent = `${state.playerName}, gleich geht dein Mathe-Run los.`;
    elements.answerBoard.textContent = "–";
    elements.answerBoard.classList.add("placeholder");
    elements.hintText.textContent = "Kurz warten: Aufgabe und Zeit starten erst nach dem 3-2-1-Countdown.";
    return;
  }

  if (state.mode === "playing" && question) {
    elements.modePill.textContent = showGoFlash ? "Los!" : "Läuft";
    elements.questionLabel.textContent = `Aufgabe ${state.questionIndex + 1} von ${SETTINGS.totalQuestions}`;
    elements.questionText.textContent = `${question.a} × ${question.b}`;
    elements.answerBoard.textContent = hasAnswer ? state.answerBuffer : "–";
    elements.answerBoard.classList.toggle("placeholder", !hasAnswer);
    elements.hintText.textContent = showGoFlash
      ? "Los! Antwort direkt tippen – Backspace korrigiert, Enter bestätigt."
      : "Antwort direkt tippen – Backspace korrigiert, Enter bestätigt.";
    return;
  }

  if (state.mode === "finished" && state.lastResult) {
    elements.modePill.textContent = state.lastResult.reason === "timeout" ? "Zeit um" : "Fertig";
    elements.questionLabel.textContent = "Enter startet die nächste Runde mit kurzem Countdown";
    elements.questionText.textContent = `${state.playerName}, stark gespielt!`;
    elements.answerBoard.hidden = false;
    elements.answerBoard.textContent = formatSeconds(state.lastResult.finalTime);
    elements.answerBoard.classList.remove("placeholder");
    elements.hintText.textContent = "Die nächste Runde startet wieder mit viel Tempo, Lob und klarem Fokus auf Aufgabe und Antwort.";
    return;
  }

  elements.modePill.textContent = "Bereit";
  elements.questionLabel.textContent = "10 Aufgaben · 90 Sekunden · +5 Sekunden pro Fehler · Start mit Countdown";
  elements.questionText.textContent = "Bereit für deine nächste Mathe-Mission?";
  elements.answerBoard.hidden = false;
  elements.answerBoard.textContent = "–";
  elements.answerBoard.classList.add("placeholder");
  elements.hintText.textContent = "Vor jeder Runde gibt es eine kurze Ampel mit 3-2-1-Countdown. Danach heißt es: tippen, freuen, schneller werden.";
}

function renderCountdownPanel() {
  const showGoFlash = state.mode === "playing" && performance.now() < state.goFlashUntil;
  const shouldShow = state.mode === "countdown" || showGoFlash;

  elements.countdownPanel.hidden = !shouldShow;

  if (!shouldShow) {
    elements.countdownPanel.dataset.phase = "idle";
    elements.trafficLight.dataset.phase = "idle";
    return false;
  }

  const phase = state.mode === "countdown"
    ? getCountdownPhase(state.countdownValue)
    : "green";
  const label = state.mode === "countdown"
    ? String(state.countdownValue)
    : "LOS!";

  elements.countdownPanel.dataset.phase = phase;
  elements.trafficLight.dataset.phase = phase;
  elements.countdownValue.textContent = label;

  return showGoFlash;
}

function getCountdownPhase(value) {
  if (value >= SETTINGS.countdownSeconds) {
    return "red";
  }

  if (value === 2) {
    return "ready";
  }

  if (value === 1) {
    return "yellow";
  }

  return "green";
}

function getSuccessFeedback(retryUsed) {
  if (retryUsed) {
    return pickFromList(COPY.comeback, state.questionIndex + state.correctStreak);
  }

  if (state.correctStreak >= 3) {
    return pickFromList(COPY.streak, state.correctStreak + state.questionIndex);
  }

  return pickFromList(COPY.success, state.questionIndex + state.errors);
}

function getRetryFeedback() {
  return pickFromList(COPY.retry, state.errors + state.questionIndex);
}

function getRevealFeedback(product) {
  return pickFromList(COPY.reveal, state.errors + state.questionIndex)
    .replace("%product%", String(product));
}

function getMotivationCopy() {
  if (state.mode === "countdown") {
    return {
      kicker: "Auf die Plätze",
      text: "Bei Grün geht's los – hol dir 10 starke Antworten.",
    };
  }

  if (state.mode === "playing") {
    if (state.correctStreak >= 5) {
      return {
        kicker: `Mega-Serie ${state.correctStreak}`,
        text: "Du bist gerade blitzschnell unterwegs.",
      };
    }

    if (state.correctStreak >= 3) {
      return {
        kicker: `Flow-Moment ${state.correctStreak}`,
        text: "Richtig stark – bleib genau so dran.",
      };
    }

    if (state.questionIndex >= SETTINGS.totalQuestions - 2) {
      return {
        kicker: "Fast im Ziel",
        text: "Nur noch wenige Aufgaben bis zur Ziellinie.",
      };
    }

    if (state.questionIndex === 0) {
      return {
        kicker: "Erste Mission",
        text: "Ruhig starten und dann Tempo aufnehmen.",
      };
    }

    return {
      kicker: `${state.questionIndex} von ${SETTINGS.totalQuestions} geschafft`,
      text: "Eine Aufgabe nach der anderen – du schaffst das.",
    };
  }

  if (state.mode === "finished" && state.lastResult) {
    if (state.lastResult.isNewOverallBest) {
      return {
        kicker: "Raketen-Rekord",
        text: "Neue absolute Bestzeit. Das war überragend.",
      };
    }

    if (state.lastResult.isNewPersonalBest) {
      return {
        kicker: "Persönlicher Rekord",
        text: "Yes! Du wirst sichtbar schneller.",
      };
    }

    if (state.lastResult.reason === "timeout") {
      return {
        kicker: "Dranbleiben zählt",
        text: "Jede Runde trainiert dein Tempo – gleich nochmal?",
      };
    }

    return {
      kicker: "Stark gemacht",
      text: "Jede Runde macht dich sicherer und schneller.",
    };
  }

  return {
    kicker: "Mathe-Mission",
    text: "Kurze Runde, viel Lob und mit jeder Aufgabe mehr Tempo.",
  };
}

function getRoundProgressPercent() {
  if (state.mode === "finished") {
    return 100;
  }

  if (state.mode !== "playing") {
    return 0;
  }

  return (state.questionIndex / SETTINGS.totalQuestions) * 100;
}

function getRewardBadge() {
  if (!state.lastResult) {
    return {
      label: "🌟 Stark gemacht",
      tone: "default",
    };
  }

  if (state.lastResult.isNewOverallBest) {
    return {
      label: "🏆 Raketen-Rekord",
      tone: "record",
    };
  }

  if (state.lastResult.isNewPersonalBest) {
    return {
      label: "⚡ Persönlicher Turbo",
      tone: "personal",
    };
  }

  if (state.lastResult.mistakes === 0) {
    return {
      label: "🎯 Fehlerfrei",
      tone: "perfect",
    };
  }

  if (state.lastResult.bestStreak >= 4) {
    return {
      label: "🔥 Mega-Serie",
      tone: "streak",
    };
  }

  if (state.lastResult.reason === "timeout") {
    return {
      label: "💛 Dranbleiber",
      tone: "warm",
    };
  }

  return {
    label: "🌈 Stark gespielt",
    tone: "default",
  };
}

function renderResultSummary() {
  if (!state.lastResult || state.mode === "playing" || state.mode === "countdown") {
    elements.resultSummary.hidden = true;
    return;
  }

  let message = "Runde gespeichert.";

  if (state.lastResult.isNewOverallBest) {
    message = "Boom! Neue absolute Bestzeit!";
  } else if (state.lastResult.isNewPersonalBest) {
    message = "Yes! Neue persönliche Bestzeit!";
  } else if (state.lastResult.reason === "timeout") {
    message = "Stark drangeblieben – unbeantwortete Aufgaben wurden mitgerechnet.";
  } else if (state.lastResult.mistakes === 0) {
    message = "Fehlerfrei durchgezogen – richtig stark!";
  } else {
    message = "Stark gemacht – jede Runde bringt mehr Tempo.";
  }

  elements.resultSummary.hidden = false;
  elements.resultMessage.textContent = message;
  renderRewardBadge();
  elements.rawTimeResult.textContent = formatSeconds(state.lastResult.rawTime);
  elements.mistakesResult.textContent = `${state.lastResult.mistakes} (${state.lastResult.mistakes * SETTINGS.penaltySeconds} s Strafe)`;
  elements.unansweredResult.textContent = `${state.lastResult.unanswered} (${state.lastResult.unanswered * SETTINGS.penaltySeconds} s Strafe)`;
  elements.totalTimeResult.textContent = formatSeconds(state.lastResult.finalTime);
}

function renderRewardBadge() {
  const { label, tone } = getRewardBadge();

  elements.rewardBadge.textContent = label;
  elements.rewardBadge.dataset.tone = tone;
}

function renderRankings() {
  renderTopList();
  renderPersonalList();
  renderHistory();
  renderChartPanel();
}

function renderTopList() {
  const currentPlayer = getSelectedPlayerName();
  const topEntries = getTopEntries();

  if (!topEntries.length) {
    elements.topList.innerHTML = `<li class="placeholder-card">Noch keine Zeiten gespeichert.</li>`;
    return;
  }

  elements.topList.innerHTML = topEntries
    .map((entry, index) => `
      <li class="ranking-item${getEntryHighlightClasses(entry, currentPlayer)}">
        <span class="rank-badge">${index + 1}</span>
        <div>
          <div class="entry-line">
            <span class="entry-name">${escapeHtml(entry.name)}</span>
            ${renderEntryFlags(entry, currentPlayer)}
          </div>
          <span class="entry-meta">${escapeHtml(formatDisplayDate(entry.datum))}</span>
        </div>
        <span class="entry-time">${formatSeconds(entry.zeit)}</span>
      </li>
    `)
    .join("");
}

function renderPersonalList() {
  const currentPlayer = getSelectedPlayerName();
  const personalEntries = state.scores
    .filter((entry) => entry.name === currentPlayer)
    .sort((left, right) => left.zeit - right.zeit)
    .slice(0, 5);

  elements.personalSectionLabel.textContent = `für ${currentPlayer}`;

  if (!personalEntries.length) {
    elements.personalList.innerHTML = `
      <li class="placeholder-card">
        Für ${escapeHtml(currentPlayer)} gibt es noch keine gespeicherten Zeiten.
      </li>
    `;
    return;
  }

  elements.personalList.innerHTML = personalEntries
    .map((entry, index) => `
      <li class="ranking-item${getEntryHighlightClasses(entry, currentPlayer, { highlightPlayer: false })}">
        <span class="rank-badge">${index + 1}</span>
        <div>
          <div class="entry-line">
            <span class="entry-name">${escapeHtml(entry.name)}</span>
            ${renderEntryFlags(entry, currentPlayer, { highlightPlayer: false, showPlayerFlag: false })}
          </div>
          <span class="entry-meta">${escapeHtml(formatDisplayDate(entry.datum))}</span>
        </div>
        <span class="entry-time">${formatSeconds(entry.zeit)}</span>
      </li>
    `)
    .join("");
}

function renderHistory() {
  const currentPlayer = getSelectedPlayerName();
  const recentEntries = [...state.scores]
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const rightTime = parseStoredDate(right.entry.datum)?.getTime() ?? right.index;
      const leftTime = parseStoredDate(left.entry.datum)?.getTime() ?? left.index;
      return rightTime - leftTime;
    })
    .slice(0, 10)
    .map((item) => item.entry);

  if (!recentEntries.length) {
    elements.historyList.innerHTML = `<div class="placeholder-card">Noch keine Runden im Verlauf.</div>`;
    return;
  }

  const times = recentEntries.map((entry) => entry.zeit);
  const fastest = Math.min(...times);
  const slowest = Math.max(...times);

  elements.historyList.innerHTML = recentEntries
    .map((entry) => {
      const width = fastest === slowest
        ? 100
        : 30 + ((slowest - entry.zeit) / (slowest - fastest)) * 70;

      return `
        <article class="history-item${getEntryHighlightClasses(entry, currentPlayer)}">
          <div class="history-head">
            <div>
              <div class="history-name-line">
                <div class="history-name">${escapeHtml(entry.name)}</div>
                ${renderEntryFlags(entry, currentPlayer)}
              </div>
              <div class="history-meta">${escapeHtml(formatDisplayDate(entry.datum))}</div>
            </div>
            <div class="history-time">${formatSeconds(entry.zeit)}</div>
          </div>
          <div class="history-track">
            <div class="history-fill" style="width: ${width.toFixed(1)}%"></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderChartPanel() {
  const topEntries = getTopEntries();
  const currentPlayer = getSelectedPlayerName();

  elements.toggleChartButton.textContent = state.chartOpen ? "Diagramm ausblenden" : "Diagramm anzeigen";
  elements.toggleChartButton.setAttribute("aria-expanded", String(state.chartOpen));
  elements.chartPanel.hidden = !state.chartOpen;

  if (!state.chartOpen) {
    return;
  }

  if (!topEntries.length) {
    elements.chartPanel.innerHTML = `<div class="placeholder-card">Noch keine Zeiten für ein Diagramm gespeichert.</div>`;
    return;
  }

  const times = topEntries.map((entry) => entry.zeit);
  const fastest = Math.min(...times);
  const slowest = Math.max(...times);

  elements.chartPanel.innerHTML = `
    <p class="chart-copy">
      Balkendiagramm der aktuell schnellsten ${topEntries.length} Zeiten. Längere Balken bedeuten schnellere Runden.
    </p>
    <div class="chart-legend">
      <span class="legend-chip player">dein Name</span>
      <span class="legend-chip last">letzte Runde</span>
    </div>
    <div class="chart-grid">
      ${topEntries.map((entry, index) => {
        const width = fastest === slowest
          ? 100
          : 30 + ((slowest - entry.zeit) / (slowest - fastest)) * 70;

        return `
          <div class="chart-row${getEntryHighlightClasses(entry, currentPlayer)}">
            <div class="chart-label">
              <span class="chart-rank">#${index + 1}</span>
              <div class="entry-line">
                <span class="chart-name">${escapeHtml(entry.name)}</span>
                ${renderEntryFlags(entry, currentPlayer)}
              </div>
              <span class="entry-meta">${escapeHtml(formatDisplayDate(entry.datum))}</span>
            </div>
            <div class="chart-bar-track" aria-hidden="true">
              <div class="chart-bar" style="width: ${width.toFixed(1)}%"></div>
            </div>
            <span class="chart-value">${formatSeconds(entry.zeit)}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function getTopEntries(limit = SETTINGS.chartEntries) {
  return [...state.scores]
    .sort((left, right) => left.zeit - right.zeit)
    .slice(0, limit);
}

function getEntryFlags(entry, currentPlayer, { highlightPlayer = true, highlightLast = true } = {}) {
  return {
    isPlayer: highlightPlayer && entry.name === currentPlayer,
    isLast: highlightLast && Boolean(state.lastResult && getEntryId(entry) === state.lastResult.entryId),
  };
}

function getEntryHighlightClasses(entry, currentPlayer, options) {
  const { isPlayer, isLast } = getEntryFlags(entry, currentPlayer, options);

  return `${isPlayer ? " is-player" : ""}${isLast ? " is-last" : ""}`;
}

function renderEntryFlags(
  entry,
  currentPlayer,
  {
    highlightPlayer = true,
    highlightLast = true,
    showPlayerFlag = true,
    showLastFlag = true,
  } = {}
) {
  const { isPlayer, isLast } = getEntryFlags(entry, currentPlayer, { highlightPlayer, highlightLast });
  const flags = [];

  if (isPlayer && showPlayerFlag) {
    flags.push('<span class="entry-flag player">Du</span>');
  }

  if (isLast && showLastFlag) {
    flags.push('<span class="entry-flag last">Letzte Runde</span>');
  }

  if (!flags.length) {
    return "";
  }

  return `<span class="entry-flags">${flags.join("")}</span>`;
}

function loadScores() {
  const seeded = cloneScores(SEEDED_SCORES);

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.scores);

    if (!raw) {
      saveScores(seeded);
      return seeded;
    }

    const parsed = JSON.parse(raw);
    const sanitized = sanitizeScores(parsed);
    const merged = dedupeScores([...seeded, ...sanitized]);
    saveScores(merged);
    return merged;
  } catch {
    return seeded;
  }
}

function saveScores(scores) {
  try {
    localStorage.setItem(STORAGE_KEYS.scores, JSON.stringify(scores));
  } catch {
    // Lokale Speicherung kann in restriktiven Browser-Umgebungen blockiert sein.
  }
}

function loadPlayerName() {
  try {
    const storedName = localStorage.getItem(STORAGE_KEYS.playerName);
    return normalizeName(storedName, { allowEmpty: false });
  } catch {
    return "Gast";
  }
}

function savePlayerName(name) {
  try {
    localStorage.setItem(STORAGE_KEYS.playerName, normalizeName(name));
  } catch {
    // Kein Fehler nach außen – der Trainer läuft auch ohne gespeicherten Namen.
  }
}

function removeStoredPlayerName() {
  try {
    localStorage.removeItem(STORAGE_KEYS.playerName);
  } catch {
    // Ignorieren.
  }
}

function sanitizeScores(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => ({
      zeit: Number(entry?.zeit),
      datum: typeof entry?.datum === "string" ? entry.datum : "",
      name: normalizeName(entry?.name, { allowEmpty: false }),
    }))
    .filter((entry) => Number.isFinite(entry.zeit) && entry.zeit > 0 && entry.datum);
}

function cloneScores(scores) {
  return scores.map((entry) => ({ ...entry }));
}

function dedupeScores(scores) {
  const byId = new Map();

  for (const entry of sanitizeScores(scores)) {
    byId.set(getEntryId(entry), entry);
  }

  return [...byId.values()];
}

function getOverallBest(scores) {
  if (!scores.length) {
    return null;
  }

  return scores.reduce((best, entry) => Math.min(best, entry.zeit), Number.POSITIVE_INFINITY);
}

function getPersonalBest(name, scores) {
  const personalScores = scores.filter((entry) => entry.name === name);

  if (!personalScores.length) {
    return null;
  }

  return personalScores.reduce((best, entry) => Math.min(best, entry.zeit), Number.POSITIVE_INFINITY);
}

function getSelectedPlayerName() {
  return normalizeName(elements.playerNameInput.value, { allowEmpty: false });
}

function getRemainingSeconds() {
  const deadline = state.startedAt + SETTINGS.maxTimeSeconds * 1000;
  return Math.max(0, (deadline - performance.now()) / 1000);
}

function normalizeName(rawName, { allowEmpty = false } = {}) {
  const cleaned = String(rawName ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);

  return cleaned || (allowEmpty ? "" : "Gast");
}

function formatSeconds(value, digits = 2) {
  return `${Number(value).toFixed(digits).replace(".", ",")} s`;
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDisplayDate(storedDate) {
  const parsed = parseStoredDate(storedDate);

  if (!parsed) {
    return storedDate;
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function parseStoredDate(storedDate) {
  if (typeof storedDate !== "string" || !storedDate.trim()) {
    return null;
  }

  const candidate = new Date(storedDate.replace(" ", "T"));
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function primeAudioContext() {
  const audioContext = getAudioContext();

  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {
      // Stille Fallback-Lösung, falls der Browser Audio blockiert.
    });
  }
}

function getAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  if (!state.audioContext) {
    state.audioContext = new AudioContextConstructor();
  }

  return state.audioContext;
}

function playCountdownTone(step) {
  const audioContext = getAudioContext();

  if (!audioContext) {
    return;
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {
      // Ignorieren – die visuelle Startsequenz läuft trotzdem.
    });
  }

  const tone = {
    oscillator: audioContext.createOscillator(),
    gainNode: audioContext.createGain(),
  };
  const frequencyByStep = {
    3: 523.25,
    2: 659.25,
    1: 783.99,
  };
  const now = audioContext.currentTime;
  const duration = step === 1 ? 0.26 : 0.2;

  tone.oscillator.type = step === 1 ? "triangle" : "sine";
  tone.oscillator.frequency.setValueAtTime(frequencyByStep[step] || 523.25, now);

  tone.gainNode.gain.setValueAtTime(0.0001, now);
  tone.gainNode.gain.exponentialRampToValueAtTime(step === 1 ? 0.12 : 0.09, now + 0.02);
  tone.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  tone.oscillator.connect(tone.gainNode);
  tone.gainNode.connect(audioContext.destination);

  state.activeTones.push(tone);

  tone.oscillator.onended = () => {
    state.activeTones = state.activeTones.filter((activeTone) => activeTone !== tone);

    try {
      tone.oscillator.disconnect();
      tone.gainNode.disconnect();
    } catch {
      // Bereits getrennt.
    }
  };

  tone.oscillator.start(now);
  tone.oscillator.stop(now + duration + 0.02);
}

function stopActiveTones() {
  for (const tone of state.activeTones) {
    try {
      tone.oscillator.stop();
    } catch {
      // Der Ton kann bereits beendet sein.
    }

    try {
      tone.oscillator.disconnect();
      tone.gainNode.disconnect();
    } catch {
      // Bereits getrennt.
    }
  }

  state.activeTones = [];
}

function clearFeedback() {
  state.feedbackText = "";
  state.feedbackTone = "";
}

function pickFromList(values, seed = 0) {
  if (!values.length) {
    return "";
  }

  const index = Math.abs(seed) % values.length;
  return values[index];
}

function getEntryId(entry) {
  return `${entry.name}|${entry.datum}|${entry.zeit}`;
}

function shuffle(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  return values;
}

function isEditableTarget(target) {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || Boolean(target?.isContentEditable);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}