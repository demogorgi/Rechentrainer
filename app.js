"use strict";

const SETTINGS = Object.freeze({
  totalQuestions: 10,
  maxTimeSeconds: 90,
  penaltySeconds: 5,
  minFactor: 2,
  maxFactor: 9,
  countdownSeconds: 3,
  countdownStepMs: 800,
  yellowCountdownMs: 400,
  greenLightMs: 500,
  questionPreviewMs: 500,
  chartEntries: 10,
});

const STORAGE_KEYS = Object.freeze({
  scores: "rechentrainer-kleines-einmaleins-scores-v1",
  playerName: "rechentrainer-kleines-einmaleins-player-v1",
});

const AUDIO_FILES = Object.freeze({
  readySetGo: "./isabellovesfoxes-ready-set-go-sound-268353.mp3",
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
  prestartPhase: "countdown",
  countdownValue: SETTINGS.countdownSeconds,
  countdownTimeoutId: null,
  feedbackText: "",
  feedbackTone: "",
  lastResult: null,
  startSequenceAudio: null,
  audioContext: null,
  activeTones: [],
};

const elements = {
  playerNameInput: document.getElementById("playerNameInput"),
  startButton: document.getElementById("startButton"),
  resetScoresButton: document.getElementById("resetScoresButton"),
  modePill: document.getElementById("modePill"),
  gameSurface: document.getElementById("gameSurface"),
  questionLabel: document.getElementById("questionLabel"),
  questionText: document.getElementById("questionText"),
  countdownPanel: document.getElementById("countdownPanel"),
  trafficLight: document.getElementById("trafficLight"),
  countdownValue: document.getElementById("countdownValue"),
  answerBoard: document.getElementById("answerBoard"),
  answerInput: document.getElementById("answerInput"),
  answerActions: document.getElementById("answerActions"),
  submitAnswerButton: document.getElementById("submitAnswerButton"),
  hintText: document.getElementById("hintText"),
  feedbackText: document.getElementById("feedbackText"),
  resultSummary: document.getElementById("resultSummary"),
  resultMessage: document.getElementById("resultMessage"),
  rewardBadge: document.getElementById("rewardBadge"),
  rawTimeResult: document.getElementById("rawTimeResult"),
  mistakesResult: document.getElementById("mistakesResult"),
  unansweredResult: document.getElementById("unansweredResult"),
  totalTimeResult: document.getElementById("totalTimeResult"),
  chartPanel: document.getElementById("chartPanel"),
  personalList: document.getElementById("personalList"),
  personalSectionLabel: document.getElementById("personalSectionLabel"),
};

init();

function init() {
  state.scores = loadScores();
  state.playerName = loadPlayerName();
  state.startSequenceAudio = createStartSequenceAudio();
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

    renderGameSurface();
    renderResultSummary();
    renderRankings();
  });

  elements.startButton.addEventListener("click", () => {
    elements.startButton.blur();
    startGame();
    focusAnswerInput({ preventScroll: true });
  });

  elements.resetScoresButton.addEventListener("click", () => {
    elements.resetScoresButton.blur();
    resetScores();
  });

  elements.answerInput.addEventListener("input", handleAnswerInput);
  elements.answerInput.addEventListener("keydown", handleAnswerInputKeydown);

  elements.submitAnswerButton.addEventListener("click", () => {
    submitAnswer();

    if (state.mode === "playing") {
      focusAnswerInput({ preventScroll: true });
    }
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

function handleAnswerInput() {
  const sanitized = elements.answerInput.value.replace(/\D+/g, "").slice(0, 3);

  if (state.mode !== "playing") {
    if (elements.answerInput.value) {
      elements.answerInput.value = "";
    }

    return;
  }

  if (elements.answerInput.value !== sanitized) {
    elements.answerInput.value = sanitized;
  }

  state.answerBuffer = sanitized;
  clearFeedback();
  renderGameSurface();
}

function handleAnswerInputKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    submitAnswer();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    clearAnswerBuffer();
  }
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
  state.prestartPhase = "countdown";
  state.countdownValue = SETTINGS.countdownSeconds;
  state.feedbackText = "Achte auf die Ampel – bei Grün startet dein Mathe-Run.";
  state.feedbackTone = "";

  elements.playerNameInput.blur();
  centerGameSurface();
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
  state.prestartPhase = "countdown";
  tickCountdown(SETTINGS.countdownSeconds);
}

function tickCountdown(value) {
  if (state.mode !== "countdown" || state.prestartPhase !== "countdown") {
    return;
  }

  state.countdownValue = value;
  playCountdownTone(value);
  renderGameSurface();
  const stepDelay = value === 1 ? SETTINGS.yellowCountdownMs : SETTINGS.countdownStepMs;

  if (value > 1) {
    state.countdownTimeoutId = window.setTimeout(() => {
      tickCountdown(value - 1);
    }, stepDelay);
    return;
  }

  state.countdownTimeoutId = window.setTimeout(() => {
    showGreenLight();
  }, stepDelay);
}

function showGreenLight() {
  if (state.mode !== "countdown") {
    return;
  }

  state.prestartPhase = "green";
  state.feedbackText = "Grün! Gleich startet die Aufgabe.";
  state.feedbackTone = "success";
  playGoTone();
  renderGameSurface();

  state.countdownTimeoutId = window.setTimeout(() => {
    showQuestionPreview();
  }, SETTINGS.greenLightMs);
}

function showQuestionPreview() {
  if (state.mode !== "countdown") {
    return;
  }

  state.prestartPhase = "preview";
  state.feedbackText = "Erste Aufgabe im Blick – die Zeit startet sofort.";
  state.feedbackTone = "";
  renderGameSurface();

  state.countdownTimeoutId = window.setTimeout(() => {
    beginRound();
  }, SETTINGS.questionPreviewMs);
}

function beginRound() {
  if (state.mode !== "countdown") {
    return;
  }

  clearCountdown();

  const now = performance.now();

  state.mode = "playing";
  state.startedAt = now;
  state.feedbackText = "Los! Hol dir direkt die ersten richtigen Antworten.";
  state.feedbackTone = "success";

  startTimer();
  render();
  focusAnswerInput({ preventScroll: true });
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

    renderGameSurface();
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

  stopStartSequenceAudio();
  stopActiveTones();
  state.prestartPhase = "countdown";
  state.countdownValue = SETTINGS.countdownSeconds;
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
  blurAnswerInput();
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
  blurAnswerInput();
}

function render() {
  renderControls();
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

function renderGameSurface() {
  const question = state.questions[state.questionIndex];
  const hasAnswer = Boolean(state.answerBuffer);
  renderCountdownPanel();

  elements.feedbackText.textContent = state.feedbackText;
  elements.feedbackText.className = `feedback${state.feedbackTone ? ` ${state.feedbackTone}` : ""}`;
  elements.answerActions.hidden = state.mode !== "playing";
  elements.submitAnswerButton.disabled = state.mode !== "playing";

  if (state.mode === "countdown") {
    if (state.prestartPhase === "green") {
      elements.modePill.textContent = "Grün";
      elements.questionLabel.textContent = "Ampelstart";
      elements.questionText.textContent = "\u00A0";
      setAnswerBoardValue("", { placeholder: true, editable: true });
      elements.hintText.textContent = "Die grüne Ampel bleibt kurz sichtbar. Auf Handy oder Tablet bleibt das Zahlenfeld direkt bereit.";
      return;
    }

    if (state.prestartPhase === "preview" && question) {
      elements.modePill.textContent = "Achtung";
      elements.questionLabel.textContent = "Erste Aufgabe";
      elements.questionText.textContent = `${question.a} × ${question.b}`;
      setAnswerBoardValue("", { placeholder: true, editable: true });
      elements.hintText.textContent = "Noch eine halbe Sekunde merken, dann startet die Zeit. Das Antwortfeld ist schon aktiv.";
      return;
    }

    elements.modePill.textContent = "Startet gleich";
    elements.questionLabel.textContent = "Ampelstart";
    elements.questionText.textContent = "\u00A0";
    setAnswerBoardValue("", { placeholder: true, editable: true });
    elements.hintText.textContent = "Kurz warten: Erst kommt Grün, dann kurz die erste Aufgabe, dann startet die Zeit. Auf Handy oder Tablet ist die Zahlentastatur jetzt schon nutzbar.";
    return;
  }

  if (state.mode === "playing" && question) {
    elements.modePill.textContent = "Läuft";
    elements.questionLabel.textContent = `Aufgabe ${state.questionIndex + 1} von ${SETTINGS.totalQuestions} · noch ${formatSeconds(getRemainingSeconds(), 1)} · ${state.errors} Fehler`;
    elements.questionText.textContent = `${question.a} × ${question.b}`;
    setAnswerBoardValue(state.answerBuffer, { placeholder: !hasAnswer, editable: true });
    elements.hintText.textContent = "Antwort direkt tippen – Rücktaste korrigiert, Prüfen oder Enter bestätigt.";
    return;
  }

  if (state.mode === "finished" && state.lastResult) {
    elements.modePill.textContent = state.lastResult.reason === "timeout" ? "Zeit um" : "Fertig";
    elements.questionLabel.textContent = `${state.lastResult.mistakes} Fehler · ${state.lastResult.unanswered} offen · Enter oder Los geht's startet neu`;
    elements.questionText.textContent = `${state.playerName}, stark gespielt!`;
    setAnswerBoardValue(formatSeconds(state.lastResult.finalTime), { placeholder: false, editable: false });
    elements.hintText.textContent = "Enter oder Los geht's startet die nächste Runde wieder mit kurzem Rennstart.";
    return;
  }

  elements.modePill.textContent = "Bereit";
  elements.questionLabel.textContent = "10 Aufgaben · 90 Sekunden · +5 Sekunden pro Fehler";
  elements.questionText.textContent = "Drücke Enter oder tippe auf Los geht's.";
  setAnswerBoardValue("", { placeholder: true, editable: false });
  elements.hintText.textContent = "Vor jeder Runde gibt es einen kurzen Rennstart mit Ampel und Startsignal. Auf Handy oder Tablet öffnet ein Tipp ins Antwortfeld die Zahlentastatur.";
}

function renderCountdownPanel() {
  const shouldShow = state.mode === "countdown";

  elements.countdownPanel.hidden = !shouldShow;

  if (!shouldShow) {
    elements.countdownPanel.dataset.phase = "idle";
    elements.trafficLight.dataset.phase = "idle";
    return false;
  }

  const phase = state.prestartPhase === "green" || state.prestartPhase === "preview"
    ? "green"
    : getCountdownPhase(state.countdownValue);
  const label = state.prestartPhase === "green" || state.prestartPhase === "preview"
    ? "\u00A0"
    : String(state.countdownValue);

  elements.countdownPanel.dataset.phase = phase;
  elements.trafficLight.dataset.phase = phase;
  elements.countdownValue.textContent = label;

  return shouldShow;
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
  renderBestChart();
  renderPersonalList();
}

function renderBestChart() {
  const currentPlayer = getSelectedPlayerName();
  const topEntries = getTopEntries();

  if (!topEntries.length) {
    elements.chartPanel.innerHTML = `<div class="placeholder-card">Noch keine Zeiten gespeichert.</div>`;
    return;
  }

  const slowest = Math.max(...topEntries.map((entry) => entry.zeit));

  elements.chartPanel.innerHTML = `
    <div class="chart-grid">
      ${topEntries.map((entry, index) => {
        const width = slowest <= 0 ? 0 : (entry.zeit / slowest) * 100;

        return `
          <div class="chart-row${getEntryHighlightClasses(entry, currentPlayer)}">
            <div class="chart-head">
              <div class="chart-title-row">
                <span class="rank-badge">${index + 1}</span>
                <div class="chart-label">
                  <div class="entry-line">
                    <span class="chart-name">${escapeHtml(entry.name)}</span>
                    ${renderEntryFlags(entry, currentPlayer)}
                  </div>
                  <span class="entry-meta">${escapeHtml(formatDisplayDate(entry.datum))}</span>
                </div>
              </div>
              <span class="chart-value">${formatSeconds(entry.zeit)}</span>
            </div>
            <div class="chart-bar-track" aria-hidden="true">
              <div class="chart-bar" style="width: ${width.toFixed(1)}%"></div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
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
  if (state.startSequenceAudio) {
    try {
      state.startSequenceAudio.load();
    } catch {
      // Ignorieren – der Browser lädt die Datei sonst bei Bedarf.
    }
  }

  const audioContext = getAudioContext();

  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {
      // Stille Fallback-Lösung, falls der Browser Audio blockiert.
    });
  }
}

function createStartSequenceAudio() {
  try {
    const audio = new Audio(AUDIO_FILES.readySetGo);

    audio.preload = "auto";
    audio.volume = 0.95;

    return audio;
  } catch {
    return null;
  }
}

function playStartSequenceAudio() {
  if (!state.startSequenceAudio) {
    return false;
  }

  try {
    state.startSequenceAudio.pause();
    state.startSequenceAudio.currentTime = 0;

    const playPromise = state.startSequenceAudio.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Wenn der Browser blockiert, bleibt die visuelle Startsequenz erhalten.
      });
    }

    return true;
  } catch {
    return false;
  }
}

function stopStartSequenceAudio() {
  if (!state.startSequenceAudio) {
    return;
  }

  try {
    state.startSequenceAudio.pause();
    state.startSequenceAudio.currentTime = 0;
  } catch {
    // Bereits gestoppt.
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
  if (state.startSequenceAudio) {
    if (step === SETTINGS.countdownSeconds) {
      playStartSequenceAudio();
    }

    return;
  }

  const audioContext = getPreparedAudioContext();

  if (!audioContext) {
    return;
  }

  const presetByStep = {
    3: [
      { frequency: 659.25, slideTo: 622.25, type: "square", duration: 0.08, volume: 0.06 },
      { frequency: 1318.5, slideTo: 1244.51, type: "square", duration: 0.07, volume: 0.024, delay: 0.004 },
      { frequency: 164.81, slideTo: 146.83, type: "triangle", duration: 0.12, volume: 0.014, delay: 0.006 },
    ],
    2: [
      { frequency: 659.25, slideTo: 622.25, type: "square", duration: 0.08, volume: 0.068 },
      { frequency: 1318.5, slideTo: 1244.51, type: "square", duration: 0.07, volume: 0.026, delay: 0.004 },
      { frequency: 174.61, slideTo: 155.56, type: "triangle", duration: 0.12, volume: 0.016, delay: 0.006 },
    ],
    1: [
      { frequency: 783.99, slideTo: 880, type: "square", duration: 0.1, volume: 0.082 },
      { frequency: 1567.98, slideTo: 1760, type: "square", duration: 0.09, volume: 0.03, delay: 0.004 },
      { frequency: 196, slideTo: 174.61, type: "triangle", duration: 0.14, volume: 0.018, delay: 0.008 },
    ],
  };

  for (const tone of presetByStep[step] || []) {
    playSynthTone(audioContext, tone);
  }
}

function playGoTone() {
  if (state.startSequenceAudio) {
    return;
  }

  const audioContext = getPreparedAudioContext();

  if (!audioContext) {
    return;
  }

  const tones = [
    { frequency: 783.99, slideTo: 880, type: "square", duration: 0.09, volume: 0.075 },
    { frequency: 987.77, slideTo: 1046.5, type: "square", duration: 0.09, volume: 0.078, delay: 0.05 },
    { frequency: 1174.66, slideTo: 1318.51, type: "square", duration: 0.12, volume: 0.082, delay: 0.1 },
    { frequency: 1567.98, slideTo: 1760, type: "square", duration: 0.16, volume: 0.05, delay: 0.14 },
    { frequency: 392, slideTo: 261.63, type: "triangle", duration: 0.22, volume: 0.03, delay: 0.02 },
    { frequency: 130.81, slideTo: 98, type: "sawtooth", duration: 0.24, volume: 0.016, delay: 0.01 },
  ];

  for (const tone of tones) {
    playSynthTone(audioContext, tone);
  }
}

function getPreparedAudioContext() {
  const audioContext = getAudioContext();

  if (!audioContext) {
    return null;
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {
      // Ignorieren – die visuelle Startsequenz läuft trotzdem.
    });
  }

  return audioContext;
}

function playSynthTone(
  audioContext,
  {
    frequency,
    slideTo = frequency,
    type = "sine",
    duration = 0.16,
    volume = 0.08,
    delay = 0,
  }
) {
  const tone = {
    oscillator: audioContext.createOscillator(),
    gainNode: audioContext.createGain(),
  };
  const now = audioContext.currentTime;
  const startAt = now + delay;
  const stopAt = startAt + duration;

  tone.oscillator.type = type;
  tone.oscillator.frequency.setValueAtTime(Math.max(1, frequency), startAt);
  tone.oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), stopAt);

  tone.gainNode.gain.setValueAtTime(0.0001, startAt);
  tone.gainNode.gain.exponentialRampToValueAtTime(volume, startAt + Math.min(0.018, duration / 3));
  tone.gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

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

  tone.oscillator.start(startAt);
  tone.oscillator.stop(stopAt + 0.02);
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

function centerGameSurface() {
  if (!elements.gameSurface) {
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  window.requestAnimationFrame(() => {
    elements.gameSurface.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
      inline: "nearest",
    });
  });
}

function setAnswerBoardValue(value, { placeholder = false, editable = false } = {}) {
  elements.answerBoard.hidden = false;
  elements.answerBoard.classList.toggle("placeholder", placeholder);
  elements.answerInput.readOnly = !editable;
  elements.answerInput.placeholder = placeholder ? "–" : "";

  if (elements.answerInput.value !== value) {
    elements.answerInput.value = value;
  }
}

function focusAnswerInput({ preventScroll = false } = {}) {
  if (state.mode !== "playing" && state.mode !== "countdown") {
    return;
  }

  try {
    elements.answerInput.focus({ preventScroll });
  } catch {
    elements.answerInput.focus();
  }

  if (typeof elements.answerInput.setSelectionRange === "function") {
    const caretPosition = elements.answerInput.value.length;
    elements.answerInput.setSelectionRange(caretPosition, caretPosition);
  }
}

function blurAnswerInput() {
  elements.answerInput.blur();
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