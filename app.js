(() => {
  const STORAGE_KEY = "ali-ayaan-hero-times-v1";
  const CHILD = "Ali Ayaan";
  const MASTERY_STREAK = 5;

  const DIFFICULTY = {
    easy: 5,
    medium: 10,
    hard: 12,
    expert: 15,
  };

  const HEROES = [
    { id: "spark", icon: "⚡", name: "Spark Kid", need: 0 },
    { id: "bolt", icon: "🦸", name: "Bolt Buddy", need: 25 },
    { id: "cosmo", icon: "🌌", name: "Cosmo Cap", need: 75 },
    { id: "flame", icon: "🔥", name: "Flame Fist", need: 150 },
    { id: "nova", icon: "🌟", name: "Nova Knight", need: 300 },
    { id: "legend", icon: "🏆", name: "Legend Ace", need: 500 },
  ];

  const BADGES = [
    { id: "first", icon: "🎯", name: "First Pow", desc: "Get 1 correct answer", check: (s) => s.totalCorrect >= 1 },
    { id: "streak5", icon: "🔥", name: "Hot Streak", desc: "Reach a streak of 5", check: (s) => s.bestStreak >= 5 },
    { id: "streak10", icon: "💫", name: "Power 10", desc: "Reach a streak of 10", check: (s) => s.bestStreak >= 10 },
    { id: "stars50", icon: "⭐", name: "Star Collector", desc: "Earn 50 stars", check: (s) => s.stars >= 50 },
    { id: "stars200", icon: "🌠", name: "Galaxy Stars", desc: "Earn 200 stars", check: (s) => s.stars >= 200 },
    { id: "table5", icon: "5️⃣", name: "Table Titan 5", desc: "Master the 5 times table", check: (s) => isTableMastered(s, 5) },
    { id: "table10", icon: "🔟", name: "Table Titan 10", desc: "Master the 10 times table", check: (s) => isTableMastered(s, 10) },
    { id: "missions5", icon: "🚀", name: "Mission Pro", desc: "Finish 5 missions", check: (s) => s.missionsCompleted >= 5 },
  ];

  const CHEERS = [
    "You got this!",
    "Hero mode!",
    "Power punch!",
    "Lightning brain!",
    "Keep flying!",
    "Super focus!",
  ];

  const WIN_LINES = [
    "POW! Correct!",
    "Boom! Nailed it!",
    "Yes! Hero hit!",
    "Zap! Perfect!",
  ];

  /** @type {ReturnType<typeof defaultState>} */
  let state = loadState();
  /** @type {null | {
   *  operation: string,
   *  difficulty: string,
   *  digitLevel: string,
   *  mode: string,
   *  shuffle: boolean,
   *  tables: number[],
   *  problemType: string,
   *  max: number,
   *  asked: number,
   *  target: number | null,
   *  correct: number,
   *  firstTryCorrect: number,
   *  attemptsOnCurrent: number,
   *  sessionStars: number,
   *  current: {a:number,b:number,key:string,promptType:string,expected:number,display:string} | null,
   *  ended: boolean,
   *  timerId: number | null,
   *  timeLeft: number,
   * }} */
  let session = null;

  const $ = (id) => document.getElementById(id);

  function rangeTables(max) {
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  function opSymbol(operation) {
    if (operation === "add") return "+";
    if (operation === "sub") return "−";
    return "×";
  }

  function computeResult(a, b, operation) {
    if (operation === "add") return a + b;
    if (operation === "sub") return a - b;
    return a * b;
  }

  function defaultState() {
    return {
      stars: 0,
      streak: 0,
      bestStreak: 0,
      totalCorrect: 0,
      totalAttempts: 0,
      missionsCompleted: 0,
      badges: {},
      unlockedHeroes: { spark: true },
      activeHero: "spark",
      facts: {},
      settings: {
        operation: "multiply",
        difficulty: "medium",
        digitLevel: "single",
        mode: "endless",
        shuffle: true,
        tables: rangeTables(10),
        problemType: "product",
      },
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      const merged = {
        ...base,
        ...parsed,
        settings: {
          ...base.settings,
          ...(parsed.settings || {}),
        },
        facts: parsed.facts || {},
        badges: parsed.badges || {},
        unlockedHeroes: { ...base.unlockedHeroes, ...(parsed.unlockedHeroes || {}) },
      };
      if (!Array.isArray(merged.settings.tables) || !merged.settings.tables.length) {
        const max = DIFFICULTY[merged.settings.difficulty] || 10;
        merged.settings.tables = rangeTables(max);
      }
      merged.settings.tables = merged.settings.tables
        .map(Number)
        .filter((n) => n >= 1 && n <= 15);
      return merged;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function factKey(a, b, operation = "multiply") {
    if (operation === "add") {
      const x = Math.min(a, b);
      const y = Math.max(a, b);
      return `+:${x}+${y}`;
    }
    if (operation === "sub") {
      return `-:${a}-${b}`;
    }
    const x = Math.min(a, b);
    const y = Math.max(a, b);
    return `${x}x${y}`;
  }

  function ensureFact(key) {
    if (!state.facts[key]) {
      state.facts[key] = {
        weight: 1,
        correctStreak: 0,
        wrongs: 0,
        corrects: 0,
        mastered: false,
      };
    }
    return state.facts[key];
  }

  function isTableMastered(s, n) {
    const maxOther = Math.max(DIFFICULTY.easy, ...Object.values(DIFFICULTY).filter(() => true));
    // Master table n within 1..12 range for badge fairness
    const limit = Math.min(12, maxOther);
    for (let i = 1; i <= limit; i++) {
      const f = s.facts[factKey(n, i)];
      if (!f || !f.mastered) return false;
    }
    return true;
  }

  function levelFromStars(stars) {
    return Math.floor(stars / 25) + 1;
  }

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
    $(`screen-${name}`).classList.add("active");
    if (name === "home") renderHome();
    if (name === "map") renderMap();
    if (name === "badges") renderBadges();
    if (name === "parent") renderParent();
  }

  function renderHome() {
    $("stat-stars").textContent = String(state.stars);
    $("stat-streak").textContent = String(state.bestStreak);
    $("stat-level").textContent = String(levelFromStars(state.stars));
    if ($("operation")) $("operation").value = state.settings.operation || "multiply";
    if ($("difficulty")) $("difficulty").value = state.settings.difficulty;
    if ($("digit-level")) $("digit-level").value = state.settings.digitLevel || "single";
    if ($("mode")) $("mode").value = state.settings.mode;
    if ($("problem-type")) $("problem-type").value = state.settings.problemType || "product";
    if ($("shuffle")) $("shuffle").checked = !!state.settings.shuffle;
    renderTableChips();
    syncOperationUI();
    updateHeroAvatar();
  }

  function syncOperationUI() {
    const op = $("operation")?.value || state.settings.operation || "multiply";
    const isMult = op === "multiply";
    if ($("difficulty-wrap")) $("difficulty-wrap").hidden = !isMult;
    if ($("table-picker")) $("table-picker").hidden = !isMult;
    if ($("digit-wrap")) $("digit-wrap").hidden = isMult;

    const tag = $("home-tagline");
    if (tag) {
      if (op === "add") tag.textContent = "Power up your addition!";
      else if (op === "sub") tag.textContent = "Power up your subtraction!";
      else tag.textContent = "Power up your multiplication!";
    }

    updateProblemTypeOptions(op);
  }

  function updateProblemTypeOptions(operation) {
    const select = $("problem-type");
    if (!select) return;
    const current = select.value || state.settings.problemType || "product";
    const sym = opSymbol(operation);
    const samples =
      operation === "add"
        ? { a: 4, b: 3, r: 7 }
        : operation === "sub"
          ? { a: 12, b: 4, r: 8 }
          : { a: 4, b: 3, r: 12 };

    const options = [
      ["product", `${samples.a} ${sym} ${samples.b} = ____`],
      ["missing-b", `${samples.a} ${sym} ____ = ${samples.r}`],
      ["missing-a", `____ ${sym} ${samples.b} = ${samples.r}`],
      ["mix", "Mix all styles"],
    ];

    select.innerHTML = "";
    for (const [value, label] of options) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    }
    select.value = options.some(([v]) => v === current) ? current : "product";
  }

  function currentMax() {
    return DIFFICULTY[$("difficulty")?.value || state.settings.difficulty] || 10;
  }

  function getSelectedTables() {
    const max = currentMax();
    return [...document.querySelectorAll(".table-chip[aria-pressed='true']")]
      .map((btn) => Number(btn.dataset.table))
      .filter((n) => n >= 1 && n <= max);
  }

  function renderTableChips() {
    const host = $("table-chips");
    if (!host) return;

    const max = currentMax();
    let selected = (state.settings.tables || [])
      .map(Number)
      .filter((n) => n >= 1 && n <= max);
    if (!selected.length) selected = rangeTables(max);
    const selectedSet = new Set(selected);

    const chips = [...host.querySelectorAll(".table-chip")];
    if (!chips.length) {
      // Fallback: build chips if HTML is empty / outdated cache
      host.innerHTML = "";
      for (let n = 1; n <= 15; n++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "table-chip";
        btn.dataset.table = String(n);
        btn.textContent = `${n}×`;
        host.appendChild(btn);
      }
    }

    host.querySelectorAll(".table-chip").forEach((btn) => {
      const n = Number(btn.dataset.table);
      const inRange = n >= 1 && n <= max;
      btn.hidden = !inRange;
      if (!inRange) {
        btn.setAttribute("aria-pressed", "false");
        return;
      }
      btn.setAttribute("aria-pressed", selectedSet.has(n) ? "true" : "false");
    });
  }

  function updateHeroAvatar() {
    const hero = HEROES.find((h) => h.id === state.activeHero) || HEROES[0];
    const el = $("hero-avatar");
    if (el) {
      el.dataset.hero = hero.id;
      el.textContent = hero.icon;
    }
  }

  function unlockRewards() {
    for (const hero of HEROES) {
      if (state.stars >= hero.need) state.unlockedHeroes[hero.id] = true;
    }
    const unlocked = HEROES.filter((h) => state.unlockedHeroes[h.id]);
    state.activeHero = unlocked[unlocked.length - 1].id;

    for (const badge of BADGES) {
      if (!state.badges[badge.id] && badge.check(state)) {
        state.badges[badge.id] = { earnedAt: Date.now() };
      }
    }
  }

  function digitRange(digitLevel) {
    if (digitLevel === "dual") return { min: 10, max: 99 };
    return { min: 1, max: 9 };
  }

  function buildPool(operation, max, tables, digitLevel) {
    const pool = [];
    const seen = new Set();

    const pushPair = (a, b) => {
      const id = `${a}:${b}`;
      if (seen.has(id)) return;
      seen.add(id);
      const key = factKey(a, b, operation);
      const fact = ensureFact(key);
      const weight = fact.mastered ? 0.35 : Math.max(1, fact.weight);
      pool.push({ a, b, key, weight });
    };

    if (operation === "multiply") {
      const focus = (tables && tables.length ? tables : rangeTables(max))
        .map(Number)
        .filter((n) => n >= 1 && n <= max);
      for (const a of focus) {
        for (let b = 1; b <= max; b++) pushPair(a, b);
      }
      return pool;
    }

    const { min, max: hi } = digitRange(digitLevel || "single");
    for (let a = min; a <= hi; a++) {
      for (let b = min; b <= hi; b++) {
        if (operation === "sub" && a < b) continue;
        pushPair(a, b);
      }
    }
    return pool;
  }

  function pickQuestion(operation, max, shuffle, tables, digitLevel) {
    const pool = buildPool(operation, max, tables, digitLevel);
    if (!pool.length) return { a: 1, b: 1, key: factKey(1, 1, operation) };

    if (!shuffle) {
      pool.sort((x, y) => {
        if (x.a !== y.a) return x.a - y.a;
        return x.b - y.b;
      });
    }

    const filtered =
      session?.current && pool.length > 1
        ? pool.filter((p) => !(p.a === session.current.a && p.b === session.current.b) || p.weight > 3)
        : pool;

    const use = filtered.length ? filtered : pool;
    const total = use.reduce((sum, p) => sum + p.weight, 0);
    let r = Math.random() * total;
    for (const p of use) {
      r -= p.weight;
      if (r <= 0) return { a: p.a, b: p.b, key: p.key };
    }
    const last = use[use.length - 1];
    return { a: last.a, b: last.b, key: last.key };
  }

  function choosePromptType(problemType) {
    if (problemType === "mix") {
      const kinds = ["product", "missing-b", "missing-a"];
      return kinds[Math.floor(Math.random() * kinds.length)];
    }
    return problemType || "product";
  }

  function formatProblem(a, b, promptType, operation) {
    const sym = opSymbol(operation);
    const result = computeResult(a, b, operation);

    if (promptType === "missing-b") {
      return {
        display: `${a} ${sym} ____ = ${result}`,
        expected: b,
      };
    }
    if (promptType === "missing-a") {
      return {
        display: `____ ${sym} ${b} = ${result}`,
        expected: a,
      };
    }
    return {
      display: `${a} ${sym} ${b} = ____`,
      expected: result,
    };
  }

  function startMission(opts) {
    stopTimer();
    const operation = opts.operation || "multiply";
    const max = DIFFICULTY[opts.difficulty] || 10;
    const digitLevel = opts.digitLevel || "single";
    let tables = (opts.tables || [])
      .map(Number)
      .filter((n) => n >= 1 && n <= max);
    if (!tables.length) tables = rangeTables(max);
    const problemType = opts.problemType || "product";

    session = {
      operation,
      difficulty: opts.difficulty,
      digitLevel,
      mode: opts.mode,
      shuffle: opts.shuffle,
      tables,
      problemType,
      max,
      asked: 0,
      target: opts.mode === "10" || opts.mode === "20" ? Number(opts.mode) : null,
      correct: 0,
      firstTryCorrect: 0,
      attemptsOnCurrent: 0,
      sessionStars: 0,
      current: null,
      ended: false,
      timerId: null,
      timeLeft: 60,
    };

    state.settings = {
      operation,
      difficulty: opts.difficulty,
      digitLevel,
      mode: opts.mode,
      shuffle: opts.shuffle,
      tables,
      problemType,
    };
    saveState();

    $("play-stars").textContent = "0";
    $("live-streak").textContent = String(state.streak);
    $("feedback").textContent = "";
    $("feedback").className = "feedback";
    updateHeroAvatar();
    $("hero-cheer").textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];

    const timerEl = $("play-timer");
    if (opts.mode === "timed") {
      timerEl.hidden = false;
      timerEl.textContent = "60s";
      session.timerId = window.setInterval(() => {
        session.timeLeft -= 1;
        timerEl.textContent = `${session.timeLeft}s`;
        if (session.timeLeft <= 0) endMission("Time’s up!");
      }, 1000);
    } else {
      timerEl.hidden = true;
    }

    showScreen("play");
    nextQuestion();
  }

  function stopTimer() {
    if (session?.timerId) {
      clearInterval(session.timerId);
      session.timerId = null;
    }
  }

  function nextQuestion() {
    if (!session || session.ended) return;

    if (session.target != null && session.asked >= session.target) {
      endMission("Mission complete!");
      return;
    }

    const picked = pickQuestion(
      session.operation,
      session.max,
      session.shuffle,
      session.tables,
      session.digitLevel
    );
    const promptType = choosePromptType(session.problemType);
    const formatted = formatProblem(picked.a, picked.b, promptType, session.operation);
    session.current = {
      ...picked,
      promptType,
      expected: formatted.expected,
      display: formatted.display,
    };
    session.attemptsOnCurrent = 0;
    session.asked += 1;

    const problemEl = $("problem-text");
    problemEl.textContent = session.current.display;
    problemEl.classList.toggle("equation", true);
    $("answer").value = "";
    $("feedback").textContent = "";
    $("feedback").className = "feedback";
    $("problem-card").classList.remove("shake", "pop");

    if (session.target != null) {
      $("play-progress").textContent = `Q ${session.asked} / ${session.target}`;
    } else if (session.mode === "timed") {
      $("play-progress").textContent = `Solved ${session.correct}`;
    } else {
      $("play-progress").textContent = `Q ${session.asked}`;
    }

    $("answer").focus();
  }

  function onWrong() {
    const card = $("problem-card");
    card.classList.remove("shake");
    void card.offsetWidth;
    card.classList.add("shake");
    $("feedback").textContent = "Not yet — try again!";
    $("feedback").className = "feedback wrong";
    $("hero-cheer").textContent = "Shake it off. Try once more!";

    state.streak = 0;
    $("live-streak").textContent = "0";

    const fact = ensureFact(session.current.key);
    if (session.attemptsOnCurrent === 1) {
      // First miss on this prompt: bump frequency hard
      fact.weight = Math.min(20, fact.weight + 4);
      fact.correctStreak = 0;
      fact.wrongs += 1;
      fact.mastered = false;
    } else {
      fact.weight = Math.min(20, fact.weight + 1);
    }
    state.totalAttempts += 1;
    saveState();
  }

  function onCorrect() {
    const firstTry = session.attemptsOnCurrent === 1;
    const fact = ensureFact(session.current.key);

    fact.corrects += 1;
    fact.correctStreak += 1;
    if (fact.correctStreak >= MASTERY_STREAK) {
      fact.mastered = true;
      fact.weight = 0.5;
    } else {
      // Still reinforce until mastery, but ease a bit after success
      fact.weight = Math.max(1, fact.weight - 1);
    }

    state.totalCorrect += 1;
    state.totalAttempts += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);

    const starGain = firstTry ? 2 : 1;
    state.stars += starGain;
    session.sessionStars += starGain;
    session.correct += 1;
    if (firstTry) session.firstTryCorrect += 1;

    unlockRewards();
    saveState();

    $("play-stars").textContent = String(session.sessionStars);
    $("live-streak").textContent = String(state.streak);
    $("feedback").textContent = WIN_LINES[Math.floor(Math.random() * WIN_LINES.length)];
    $("feedback").className = "feedback right";
    $("hero-cheer").textContent = fact.mastered
      ? `${session.current.a}${opSymbol(session.operation)}${session.current.b} mastered!`
      : CHEERS[Math.floor(Math.random() * CHEERS.length)];

    const card = $("problem-card");
    card.classList.remove("pop");
    void card.offsetWidth;
    card.classList.add("pop");
    burstStars();

    window.setTimeout(() => {
      if (!session || session.ended) return;
      nextQuestion();
    }, 550);
  }

  function burstStars() {
    const fx = $("fx");
    for (let i = 0; i < 6; i++) {
      const el = document.createElement("div");
      el.className = "star-burst";
      el.textContent = "★";
      el.style.left = `${20 + Math.random() * 60}%`;
      el.style.top = `${40 + Math.random() * 30}%`;
      el.style.color = Math.random() > 0.5 ? "#e6392e" : "#ffc107";
      fx.appendChild(el);
      window.setTimeout(() => el.remove(), 900);
    }
  }

  function endMission(title) {
    if (!session || session.ended) return;
    session.ended = true;
    stopTimer();
    state.missionsCompleted += 1;
    unlockRewards();
    saveState();

    $("results-title").textContent = title;
    $("results-sub").textContent = `${CHILD} powered through another mission.`;

    const accuracy =
      session.correct + (session.asked ? 0 : 0) === 0 && session.correct === 0
        ? 0
        : Math.round((session.firstTryCorrect / Math.max(1, session.correct)) * 100);

    $("results-grid").innerHTML = `
      <div class="stat-card"><strong>${session.sessionStars}</strong>stars earned</div>
      <div class="stat-card"><strong>${session.correct}</strong>solved</div>
      <div class="stat-card"><strong>${session.firstTryCorrect}</strong>first-try hits</div>
      <div class="stat-card"><strong>${state.bestStreak}</strong>best streak</div>
    `;

    void accuracy;
    showScreen("results");
  }

  function tableMasteryPercent(n, maxCheck) {
    let done = 0;
    const limit = maxCheck;
    for (let i = 1; i <= limit; i++) {
      const f = state.facts[factKey(n, i)];
      if (f?.mastered) done += 1;
    }
    return Math.round((done / limit) * 100);
  }

  function renderMap() {
    const max = DIFFICULTY[state.settings.difficulty] || 10;
    const grid = $("map-grid");
    grid.innerHTML = "";
    for (let n = 1; n <= max; n++) {
      const pct = tableMasteryPercent(n, max);
      const cell = document.createElement("div");
      cell.className = "map-cell";
      if (pct >= 100) cell.classList.add("mastered");
      else if (pct > 0) cell.classList.add("training");
      else cell.classList.add("locked");
      cell.innerHTML = `<span class="table-n">${n}s</span>${pct}%`;
      grid.appendChild(cell);
    }
  }

  function renderBadges() {
    const grid = $("badge-grid");
    grid.innerHTML = "";

    for (const hero of HEROES) {
      const unlocked = !!state.unlockedHeroes[hero.id];
      const card = document.createElement("div");
      card.className = `badge-card${unlocked ? "" : " locked"}`;
      card.innerHTML = `
        <span class="icon">${hero.icon}</span>
        <h3>${hero.name}</h3>
        <p>${unlocked ? "Unlocked hero" : `Need ${hero.need} stars`}</p>
      `;
      grid.appendChild(card);
    }

    for (const badge of BADGES) {
      const earned = !!state.badges[badge.id];
      const card = document.createElement("div");
      card.className = `badge-card${earned ? "" : " locked"}`;
      card.innerHTML = `
        <span class="icon">${badge.icon}</span>
        <h3>${badge.name}</h3>
        <p>${badge.desc}</p>
      `;
      grid.appendChild(card);
    }
  }

  function weakFacts(limit = 8) {
    return Object.entries(state.facts)
      .filter(([, f]) => f.wrongs > 0 || (!f.mastered && f.corrects + f.wrongs > 0))
      .sort((a, b) => b[1].weight - a[1].weight || b[1].wrongs - a[1].wrongs)
      .slice(0, limit);
  }

  function renderParent() {
    const weak = weakFacts();
    const mastered = Object.values(state.facts).filter((f) => f.mastered).length;
    const accuracy =
      state.totalAttempts === 0
        ? 0
        : Math.round((state.totalCorrect / state.totalAttempts) * 100);

    $("parent-summary").innerHTML = `
      <div class="parent-card">
        <h3>Overview</h3>
        <ul>
          <li>Stars: ${state.stars}</li>
          <li>Best streak: ${state.bestStreak}</li>
          <li>Missions finished: ${state.missionsCompleted}</li>
          <li>Facts mastered: ${mastered}</li>
          <li>Lifetime accuracy: ${accuracy}%</li>
          <li>Hero level: ${levelFromStars(state.stars)}</li>
          <li>Focus tables: ${(state.settings.tables || []).map((n) => `${n}×`).join(", ") || "all"}</li>
          <li>Skill: ${
            state.settings.operation === "add"
              ? "Addition"
              : state.settings.operation === "sub"
                ? "Subtraction"
                : "Multiplication"
          }${
            state.settings.operation !== "multiply"
              ? ` · ${state.settings.digitLevel === "dual" ? "dual digit" : "single digit"}`
              : ""
          }</li>
        </ul>
      </div>
      <div class="parent-card">
        <h3>Needs more practice</h3>
        ${
          weak.length
            ? `<ul>${weak
                .map(([key, f]) => {
                  const pretty = key
                    .replace(/^.:/, "")
                    .replace("x", " × ")
                    .replace("+", " + ")
                    .replace("-", " − ");
                  return `<li>${pretty} · weight ${f.weight.toFixed(1)} · ${f.correctStreak}/${MASTERY_STREAK} streak</li>`;
                })
                .join("")}</ul>`
            : "<p>No weak facts yet — start a mission!</p>"
        }
      </div>
      <div class="parent-card">
        <h3>How mastery works</h3>
        <p style="margin:0;font-weight:700;color:var(--muted)">
          Missed facts show up more often. A fact is mastered after ${MASTERY_STREAK} correct answers in a row.
          Wrong answers must be retried until correct (no hint).
        </p>
      </div>
    `;
  }

  // Events
  $("setup-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const operation = $("operation")?.value || "multiply";
    const tables = operation === "multiply" ? getSelectedTables() : state.settings.tables || rangeTables(10);
    if (operation === "multiply" && !tables.length) {
      alert("Pick at least one times table (like 2× or 7×).");
      return;
    }
    startMission({
      operation,
      difficulty: $("difficulty")?.value || "medium",
      digitLevel: $("digit-level")?.value || "single",
      mode: $("mode")?.value || "endless",
      shuffle: !!$("shuffle")?.checked,
      tables,
      problemType: $("problem-type")?.value || "product",
    });
  });

  $("operation")?.addEventListener("change", () => {
    syncOperationUI();
  });

  $("difficulty")?.addEventListener("change", () => {
    const max = currentMax();
    state.settings.tables = getSelectedTables().filter((n) => n <= max);
    if (!state.settings.tables.length) state.settings.tables = rangeTables(max);
    renderTableChips();
  });

  $("table-chips")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".table-chip");
    if (!btn || btn.hidden) return;
    e.preventDefault();
    const on = btn.getAttribute("aria-pressed") === "true";
    btn.setAttribute("aria-pressed", on ? "false" : "true");
  });

  $("tables-all")?.addEventListener("click", () => {
    document.querySelectorAll(".table-chip").forEach((btn) => {
      if (btn.hidden) return;
      btn.setAttribute("aria-pressed", "true");
    });
  });

  $("tables-none")?.addEventListener("click", () => {
    document.querySelectorAll(".table-chip").forEach((btn) => {
      btn.setAttribute("aria-pressed", "false");
    });
  });

  $("answer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!session || session.ended || !session.current) return;

    const raw = $("answer").value.trim();
    if (!/^\d+$/.test(raw)) {
      $("feedback").textContent = "Type a number";
      $("feedback").className = "feedback wrong";
      return;
    }

    const guess = Number(raw);
    const expected = session.current.expected;
    session.attemptsOnCurrent += 1;

    if (guess === expected) onCorrect();
    else {
      onWrong();
      $("answer").value = "";
      $("answer").focus();
    }
  });

  $("btn-quit").addEventListener("click", () => {
    if (!session || session.ended) {
      showScreen("home");
      return;
    }
    if (confirm("Quit this mission?")) {
      endMission("Mission paused");
    }
  });

  $("btn-again").addEventListener("click", () => {
    startMission({
      operation: state.settings.operation || "multiply",
      difficulty: state.settings.difficulty,
      digitLevel: state.settings.digitLevel || "single",
      mode: state.settings.mode,
      shuffle: state.settings.shuffle,
      tables: state.settings.tables,
      problemType: state.settings.problemType || "product",
    });
  });

  function resetProgress() {
    if (!confirm("Reset all progress for Ali Ayaan?")) return;
    state = defaultState();
    saveState();
    renderParent();
    renderHome();
    showScreen("home");
  }

  $("btn-reset").addEventListener("click", resetProgress);
  $("btn-reset-results").addEventListener("click", resetProgress);

  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => showScreen(btn.getAttribute("data-go")));
  });

  // iPad: keep input usable
  $("answer").addEventListener("focus", () => {
    window.setTimeout(() => {
      $("answer").scrollIntoView({ block: "center", behavior: "smooth" });
    }, 300);
  });

  renderHome();
})();
