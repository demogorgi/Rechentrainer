"use strict";

const SETTINGS = Object.freeze({
  totalQuestions: 10,
  maxTimeSeconds: 90,
  penaltySeconds: 5,
  minFactor: 2,
  maxFactor: 9,
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
  { zeit: 33.78, datum: "2026-02-11 21:09:07", name: "claudia" },
  { zeit: 42.34, datum: "2026-02-12 09:25:37", name: "klaus" },
  { zeit: 37.5, datum: "2026-02-12 09:32:28", name: "klaus" },
  { zeit: 49.28, datum: "2026-02-12 16:10:28", name: "till" },
  { zeit: 31.92, datum: "2026-02-12 12:11:20", name: "klaus" },
  { zeit: 46.57, datum: "2026-02-12 16:24:30", name: "till" },
  { zeit: 46.93, datum: "2026-02-12 16:27:23", name: "till" },
  { zeit: 50.68, datum: "2026-02-12 16:32:01", name: "till" },
  { zeit: 52.53, datum: "2026-02-12 16:33:57", name: "till" },
  { zeit: 75.24, datum: "2026-02-12 16:37:54", name: "till" },
  { zeit: 14.65, datum: "2026-02-12 16:40:07", name: "uwe" },
  { zeit: 53.77, datum: "2026-02-12 16:42:56", name: "uwe" },
  { zeit: 110.07, datum: "2026-02-12 17:09:07", name: "lia" },
  { zeit: 18.59, datum: "2026-02-12 17:11:55", name: "uwe" },
  { zeit: 71.48, datum: "2026-02-12 17:13:29", name: "merle" },
  { zeit: 47.75, datum: "2026-02-12 17:15:03", name: "till" },
  { zeit: 58.83, datum: "2026-02-12 17:17:14", name: "till" },
  { zeit: 34.08, datum: "2026-02-13 15:37:26", name: "till" },
  { zeit: 98.97, datum: "2026-02-13 15:39:54", name: "till" },
  { zeit: 72.13, datum: "2026-02-13 15:42:04", name: "till" },
  { zeit: 16.43, datum: "2026-02-13 15:42:52", name: "uwe" },
  { zeit: 41.0, datum: "2026-02-13 15:43:59", name: "till" },
  { zeit: 41.09, datum: "2026-02-13 15:45:51", name: "till" },
  { zeit: 38.88, datum: "2026-02-13 15:47:39", name: "till" },
  { zeit: 38.14, datum: "2026-02-13 15:49:16", name: "till" },
  { zeit: 14.55, datum: "2026-02-13 15:50:23", name: "uwe" },
]);

const state = {
  mode: "ready",
  scores: [],
  playerName: "Gast",
  questions: [],
  questionIndex: 0,
  errors: 0,
  answerBuffer: "",
  startedAt: 0,
  finishedAt: 0,
  timerId: null,
  feedbackText: "",
  feedbackTone: "",
  lastResult: null,
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
  modePill: document.getElementById("modePill"),
  questionLabel: document.getElementById("questionLabel"),
  questionText: document.getElementById("questionText"),
  answerBoard: document.getElementById("answerBoard"),
  hintText: document.getElementById("hintText"),
  feedbackText: document.getElementById("feedbackText"),
  keypad: document.getElementById("keypad"),
  resultSummary: document.getElementById("resultSummary"),
  resultMessage: document.getElementById("resultMessage"),
  rawTimeResult: document.getElementById("rawTimeResult"),
  mistakesResult: document.getElementById("mistakesResult"),
  unansweredResult: document.getElementById("unansweredResult"),
  totalTimeResult: document.getElementById("totalTimeResult"),
  topList: document.getElementById("topList"),
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

  elements.keypad.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("button");

    if (button) {
      event.preventDefault();
    }
  });

  elements.keypad.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-key]");

    if (!button) {
      return;
    }

    handleVirtualKey(button.dataset.key);
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

function handleVirtualKey(key) {
  if (state.mode !== "playing") {
    if (key === "enter") {
      startGame();
    }

    return;
  }

  if (/^\d$/.test(key)) {
    appendDigit(key);
    return;
  }

  if (key === "clear") {
    clearAnswerBuffer();
    return;
  }

  if (key === "enter") {
    submitAnswer();
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
  if (state.mode === "playing") {
    const confirmed = window.confirm("Die laufende Runde abbrechen und neu starten?");

    if (!confirmed) {
      return;
    }
  }

  clearTimer();

  state.playerName = normalizeName(elements.playerNameInput.value);
  elements.playerNameInput.value = state.playerName === "Gast" ? "" : state.playerName;
  savePlayerName(state.playerName);

  state.mode = "playing";
  state.questions = createQuestions();
  state.questionIndex = 0;
  state.errors = 0;
  state.answerBuffer = "";
  state.startedAt = performance.now();
  state.finishedAt = 0;
  state.lastResult = null;
  state.feedbackText = "Zahlen tippen und mit Enter bestätigen.";
  state.feedbackTone = "";

  elements.playerNameInput.blur();
  startTimer();
  render();
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

function submitAnswer() {
  if (state.mode !== "playing") {
    return;
  }

  if (getRemainingSeconds() <= 0) {
    finishGame("timeout");
    return;
  }

  if (!state.answerBuffer) {
    state.feedbackText = "Noch keine Antwort eingegeben.";
    state.feedbackTone = "warning";
    renderGameSurface();
    return;
  }

  const question = state.questions[state.questionIndex];
  const answer = Number(state.answerBuffer);

  state.answerBuffer = "";

  if (answer === question.product) {
    state.feedbackText = question.retryUsed ? "Jetzt sitzt es." : "Richtig.";
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

  if (!question.retryUsed) {
    question.retryUsed = true;
    [question.a, question.b] = [question.b, question.a];
    state.feedbackText = "Fast – dieselbe Aufgabe kommt noch einmal andersherum.";
    state.feedbackTone = "warning";
    render();
    return;
  }

  state.feedbackText = `Richtig wäre ${question.product}.`;
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
    isNewOverallBest: previousOverallBest === null || finalTime < previousOverallBest,
    isNewPersonalBest: previousPersonalBest === null || finalTime < previousPersonalBest,
    overallBest,
    personalBest,
  };

  state.feedbackText = reason === "timeout"
    ? "Zeit abgelaufen – die Runde wurde trotzdem gespeichert."
    : "Runde gespeichert.";
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

  if (state.mode === "finished") {
    state.mode = "ready";
  }

  render();
}

function render() {
  renderControls();
  renderStats();
  renderGameSurface();
  renderResultSummary();
  renderRankings();
}

function renderControls() {
  elements.playerNameInput.readOnly = state.mode === "playing";

  if (state.mode === "playing") {
    elements.startButton.textContent = "Neu starten";
  } else if (state.mode === "finished") {
    elements.startButton.textContent = "Nochmal spielen";
  } else {
    elements.startButton.textContent = "Runde starten";
  }

  elements.keypad.classList.toggle("is-disabled", state.mode !== "playing");
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

  elements.feedbackText.textContent = state.feedbackText;
  elements.feedbackText.className = `feedback${state.feedbackTone ? ` ${state.feedbackTone}` : ""}`;

  if (state.mode === "playing" && question) {
    elements.modePill.textContent = "Läuft";
    elements.questionLabel.textContent = `Aufgabe ${state.questionIndex + 1} von ${SETTINGS.totalQuestions}`;
    elements.questionText.textContent = `${question.a} × ${question.b}`;
    elements.answerBoard.textContent = hasAnswer ? state.answerBuffer : "–";
    elements.answerBoard.classList.toggle("placeholder", !hasAnswer);
    elements.hintText.textContent = "Zahlen einfach tippen – egal, wo der Fokus gerade steht.";
    return;
  }

  if (state.mode === "finished" && state.lastResult) {
    elements.modePill.textContent = state.lastResult.reason === "timeout" ? "Zeit um" : "Fertig";
    elements.questionLabel.textContent = "Enter startet sofort die nächste Runde";
    elements.questionText.textContent = `${state.playerName}, deine Runde ist gespeichert.`;
    elements.answerBoard.textContent = formatSeconds(state.lastResult.finalTime);
    elements.answerBoard.classList.remove("placeholder");
    elements.hintText.textContent = "Die Lösungseingabe bleibt auch in der nächsten Runde feldfrei und direkt auf der Tastatur.";
    return;
  }

  elements.modePill.textContent = "Bereit";
  elements.questionLabel.textContent = "10 Aufgaben · 90 Sekunden · +5 Sekunden pro Fehler";
  elements.questionText.textContent = "Drücke Enter für die nächste Runde.";
  elements.answerBoard.textContent = "–";
  elements.answerBoard.classList.add("placeholder");
  elements.hintText.textContent = "Während der Runde werden Tasten überall auf der Seite erkannt. Kein Wechsel in ein Antwortfeld nötig.";
}

function renderResultSummary() {
  if (!state.lastResult) {
    elements.resultSummary.hidden = true;
    return;
  }

  let message = "Runde gespeichert.";

  if (state.lastResult.isNewOverallBest) {
    message = "Neue absolute Bestzeit!";
  } else if (state.lastResult.isNewPersonalBest) {
    message = "Neue persönliche Bestzeit!";
  } else if (state.lastResult.reason === "timeout") {
    message = "Zeit abgelaufen – unbeantwortete Aufgaben wurden mitgerechnet.";
  }

  elements.resultSummary.hidden = false;
  elements.resultMessage.textContent = message;
  elements.rawTimeResult.textContent = formatSeconds(state.lastResult.rawTime);
  elements.mistakesResult.textContent = `${state.lastResult.mistakes} (${state.lastResult.mistakes * SETTINGS.penaltySeconds} s Strafe)`;
  elements.unansweredResult.textContent = `${state.lastResult.unanswered} (${state.lastResult.unanswered * SETTINGS.penaltySeconds} s Strafe)`;
  elements.totalTimeResult.textContent = formatSeconds(state.lastResult.finalTime);
}

function renderRankings() {
  renderTopList();
  renderPersonalList();
  renderHistory();
}

function renderTopList() {
  const currentPlayer = getSelectedPlayerName();
  const topEntries = [...state.scores]
    .sort((left, right) => left.zeit - right.zeit)
    .slice(0, 10);

  if (!topEntries.length) {
    elements.topList.innerHTML = `<li class="placeholder-card">Noch keine Zeiten gespeichert.</li>`;
    return;
  }

  elements.topList.innerHTML = topEntries
    .map((entry, index) => `
      <li class="ranking-item${entry.name === currentPlayer ? " is-current" : ""}">
        <span class="rank-badge">${index + 1}</span>
        <div>
          <span class="entry-name">${escapeHtml(entry.name)}</span>
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
      <li class="ranking-item${state.lastResult && getEntryId(entry) === state.lastResult.entryId ? " is-current" : ""}">
        <span class="rank-badge">${index + 1}</span>
        <div>
          <span class="entry-name">${escapeHtml(entry.name)}</span>
          <span class="entry-meta">${escapeHtml(formatDisplayDate(entry.datum))}</span>
        </div>
        <span class="entry-time">${formatSeconds(entry.zeit)}</span>
      </li>
    `)
    .join("");
}

function renderHistory() {
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
        <article class="history-item${state.lastResult && getEntryId(entry) === state.lastResult.entryId ? " is-current" : ""}">
          <div class="history-head">
            <div>
              <div class="history-name">${escapeHtml(entry.name)}</div>
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

function clearFeedback() {
  state.feedbackText = "";
  state.feedbackTone = "";
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