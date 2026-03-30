document.addEventListener("DOMContentLoaded", () => {
  console.log("DOODLE JUMP — GLASS STYLE");

  // DOM элементы
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreSpan = document.getElementById("scoreValue");
  const balanceSpan = document.getElementById("balanceValue");
  const comboBox = document.getElementById("comboBox");
  const comboValue = document.getElementById("comboValue");
  const restartBtn = document.getElementById("restartButton");
  const infoBtn = document.getElementById("infoBtn");
  const modal = document.getElementById("infoModal");
  const modalClose = document.querySelector(".modal-close");
  const fullscreenBtn = document.getElementById("fullscreenBtn");

  canvas.width = 360;
  canvas.height = 540;

  if (fullscreenBtn) {
    fullscreenBtn.onclick = () => {
      if (canvas.requestFullscreen) canvas.requestFullscreen();
      else if (canvas.webkitRequestFullscreen) canvas.webkitRequestFullscreen();
    };
  }

  // Состояние
  let gameRunning = true;
  let score = 0;
  let bestScore = localStorage.getItem("bestScore") || 0;
  let gamesPlayed = parseInt(localStorage.getItem("gamesPlayed")) || 0;
  let combo = 0;
  let multiplier = 1;
  let playerBalance = 100;
  let gameHistory = [];

  // Игрок
  const player = {
    x: canvas.width / 2 - 14,
    y: canvas.height - 100,
    width: 28,
    height: 28,
    vy: 0,
    vx: 0,
    gravity: 0.28,
    jumpPower: -8.5,
  };

  let platforms = [];
  const platformW = 60,
    platformH = 12,
    gap = 80;
  const platformTypes = { NORMAL: "normal", GOLD: "gold", BOUNCE: "bounce" };

  let coins = [];
  let floatingTexts = [];
  let cameraY = 0;

  // Фон
  let stars = [];
  for (let i = 0; i < 40; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.5,
      size: 1 + Math.random() * 2,
      twinkle: Math.random() * Math.PI * 2,
    });
  }

  function updateBalance() {
    balanceSpan.textContent = playerBalance;
  }

  function addHistory(desc) {
    gameHistory.unshift({ desc, date: new Date().toLocaleString() });
    if (gameHistory.length > 20) gameHistory.pop();
    renderHistory();
  }

  function finishGame(score) {
    gamesPlayed++;
    localStorage.setItem("gamesPlayed", gamesPlayed);
    addHistory(`Тренировка: ${score} очков`);
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem("bestScore", bestScore);
    }
  }

  function renderHistory() {
    const container = document.getElementById("historyContainer");
    if (!container) return;
    container.innerHTML =
      gameHistory
        .slice(0, 8)
        .map((h) => `<div class="history-item">${h.desc}</div>`)
        .join("") || '<div class="empty">📭 No history yet</div>';
  }

  // Платформы
  function addRandomPlatform(y) {
    const x = 20 + Math.random() * (canvas.width - platformW - 40);
    let type = platformTypes.NORMAL;
    const r = Math.random();
    if (r < 0.1) type = platformTypes.GOLD;
    else if (r < 0.2) type = platformTypes.BOUNCE;
    platforms.push({ x, y, w: platformW, h: platformH, type });
    if (Math.random() < 0.3) {
      coins.push({
        x: x + platformW / 2 - 5,
        y: y - 10,
        w: 10,
        h: 10,
        collected: false,
        rot: 0,
      });
    }
  }

  function initGame() {
    gameRunning = true;
    score = 0;
    combo = 0;
    multiplier = 1;
    updateScore();
    updateCombo();
    player.x = canvas.width / 2 - 14;
    player.y = canvas.height - 100;
    player.vy = 0;
    player.vx = 0;
    cameraY = 0;
    platforms = [];
    coins = [];
    floatingTexts = [];
    platforms.push({
      x: canvas.width / 2 - platformW / 2,
      y: canvas.height - 50,
      w: platformW,
      h: platformH,
      type: platformTypes.NORMAL,
    });
    for (let i = 1; i < 8; i++) addRandomPlatform(canvas.height - 50 - i * gap);
    restartBtn.style.display = "none";
  }

  // Управление
  canvas.style.touchAction = "none";
  let touchStartX = 0;
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    touchStartX = (e.touches[0].clientX - rect.left) * scale;
  });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!gameRunning) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    let currentX = (e.touches[0].clientX - rect.left) * scale;
    let newX = player.x + (currentX - touchStartX);
    newX = Math.max(0, Math.min(canvas.width - player.width, newX));
    player.x = newX;
    touchStartX = currentX;
  });

  let mouseDrag = false;
  canvas.addEventListener("mousedown", (e) => {
    mouseDrag = true;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    let mx = (e.clientX - rect.left) * scale;
    player.x = Math.max(
      0,
      Math.min(canvas.width - player.width, mx - player.width / 2),
    );
  });
  canvas.addEventListener("mousemove", (e) => {
    if (!mouseDrag || !gameRunning) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    let mx = (e.clientX - rect.left) * scale;
    player.x = Math.max(
      0,
      Math.min(canvas.width - player.width, mx - player.width / 2),
    );
  });
  canvas.addEventListener("mouseup", () => (mouseDrag = false));

  // Физика
  function updatePhysics() {
    player.vy += player.gravity;
    player.y += player.vy;

    if (player.x + player.width < 0) player.x = canvas.width;
    if (player.x > canvas.width) player.x = -player.width;

    let onPlat = false;
    for (let p of platforms) {
      if (
        player.vy > 0 &&
        player.y + player.height >= p.y &&
        player.y + player.height <= p.y + p.h + 6 &&
        player.x + player.width > p.x &&
        player.x < p.x + p.w
      ) {
        let power = player.jumpPower;
        if (p.type === platformTypes.GOLD) {
          power *= 0.85;
          score += 50 * multiplier;
          updateScore();
          addFloatingText("+50", p.x + p.w / 2, p.y, "#ffaa44");
          p.type = platformTypes.NORMAL;
        } else if (p.type === platformTypes.BOUNCE) {
          power *= 1.65;
          addFloatingText("BOUNCE!", p.x + p.w / 2, p.y, "#ff8844");
        }
        player.vy = power;
        player.y = p.y - player.height;
        onPlat = true;
        combo++;
        multiplier = 1 + Math.floor(combo / 8);
        if (multiplier > 5) multiplier = 5;
        updateCombo();
        if (multiplier > 1)
          addFloatingText(
            `x${multiplier} COMBO!`,
            player.x + player.width / 2,
            player.y,
            "#ffaa66",
          );
        break;
      }
    }
    if (!onPlat && player.vy > 0) {
      combo = 0;
      multiplier = 1;
      updateCombo();
    }
    if (player.y > canvas.height && gameRunning) {
      gameRunning = false;
      finishGame(Math.floor(score));
      restartBtn.style.display = "block";
    }
    if (player.y < 0) {
      player.y = 0;
      if (player.vy < 0) player.vy = 0;
    }
  }

  function updateCoins() {
    for (let c of coins) {
      c.rot += 0.1;
      if (
        !c.collected &&
        player.x + player.width > c.x &&
        player.x < c.x + c.w &&
        player.y + player.height > c.y &&
        player.y < c.y + c.h
      ) {
        c.collected = true;
        score += 10 * multiplier;
        updateScore();
        addFloatingText("+10", c.x + c.w / 2, c.y, "#ffcc44");
      }
    }
    coins = coins.filter((c) => !c.collected);
  }

  function addFloatingText(text, x, y, color) {
    floatingTexts.push({ text, x, y, life: 1, color, vy: -2 });
  }

  function updateCamera() {
    if (!gameRunning) return;
    if (player.y < canvas.height / 3) {
      const diff = canvas.height / 3 - player.y;
      player.y += diff;
      score += Math.floor(diff * 0.5);
      updateScore();
      for (let p of platforms) p.y += diff;
      for (let c of coins) c.y += diff;
      platforms = platforms.filter((p) => p.y < canvas.height);
      coins = coins.filter((c) => c.y < canvas.height);
      while (platforms.length < 8) {
        const highest = Math.min(...platforms.map((p) => p.y));
        addRandomPlatform(highest - gap);
      }
    }
  }

  // Отрисовка
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#0a2f3a");
    grad.addColorStop(0.6, "#2c5a4a");
    grad.addColorStop(1, "#4a784a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let s of stars) {
      ctx.fillStyle = `rgba(255,255,200,${0.3 + Math.sin(Date.now() * 0.002 + s.twinkle) * 0.2})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let p of platforms) {
      let color =
        p.type === platformTypes.GOLD
          ? "#DAA520"
          : p.type === platformTypes.BOUNCE
            ? "#C46A3A"
            : "#8B5A2B";
      ctx.fillStyle = color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle =
        p.type === platformTypes.GOLD
          ? "#FFD700"
          : p.type === platformTypes.BOUNCE
            ? "#E88A5A"
            : "#A87A3A";
      ctx.fillRect(p.x + 4, p.y + 3, p.w - 8, 3);
    }

    for (let c of coins) {
      ctx.save();
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.rotate(c.rot);
      ctx.fillStyle = "#FFD700";
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFA500";
      ctx.beginPath();
      ctx.ellipse(0, 0, 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    ctx.fillStyle = "#FF69B4";
    ctx.beginPath();
    ctx.ellipse(0, 0, player.width / 2, player.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(-5, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(-5, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 2, 7, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    for (let ft of floatingTexts) {
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${Math.floor(12 + 8 * (1 - ft.life))}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(ft.text, ft.x, ft.y + ft.vy * (1 - ft.life));
      ft.life -= 0.02;
      ft.y -= 0.8;
    }
    floatingTexts = floatingTexts.filter((ft) => ft.life > 0);
    ctx.globalAlpha = 1;

    if (!gameRunning) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.font = "bold 26px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 30);
      ctx.fillStyle = "#FFD966";
      ctx.font = "20px system-ui";
      ctx.fillText(
        `${Math.floor(score)}`,
        canvas.width / 2,
        canvas.height / 2 + 15,
      );
    }
    ctx.textAlign = "left";
  }

  function updateScore() {
    scoreSpan.textContent = Math.floor(score);
  }
  function updateCombo() {
    if (multiplier > 1) {
      comboBox.style.display = "flex";
      comboValue.textContent = `x${multiplier}`;
    } else {
      comboBox.style.display = "none";
    }
  }

  // UI
  function showProfile() {
    const level = Math.floor(bestScore / 100) + 1;
    alert(
      `👤 PROFILE\n\n💰 BALANCE: ${playerBalance}⭐\n🏆 BEST SCORE: ${bestScore}\n🎮 GAMES: ${gamesPlayed}\n⭐ LEVEL: ${level}`,
    );
  }

  function showSeason() {
    alert(
      `📅 SEASON 1\n\n🏆 TOP PLAYERS:\n1. Bearr1025 - 431\n2. Lx - 229\n3. Robzi here? - 135\n\n🏆 YOUR RANK: #${Math.floor(Math.random() * 50) + 1}`,
    );
  }

  // Навигация
  document.querySelectorAll(".nav").forEach((btn) => {
    btn.onclick = () => {
      document
        .querySelectorAll(".nav")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.nav;
      if (tab === "profile") showProfile();
      else if (tab === "season") showSeason();
      else if (tab === "game") {
        document.querySelector(".mode-bar").style.display = "flex";
        document.getElementById("tournamentPanel").classList.remove("active");
      } else if (tab === "tournament") {
        document.querySelector(".mode-bar").style.display = "flex";
        document.getElementById("tournamentPanel").classList.add("active");
      }
    };
  });

  document.querySelectorAll(".mode").forEach((btn) => {
    btn.onclick = () => {
      document
        .querySelectorAll(".mode")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });

  if (infoBtn && modal && modalClose) {
    infoBtn.onclick = () => modal.classList.add("active");
    modalClose.onclick = () => modal.classList.remove("active");
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove("active");
    };
  }

  restartBtn.onclick = () => initGame();

  // Турнирная панель (заглушка)
  document.getElementById("createTournamentBtn").onclick = () =>
    alert("Tournament mode coming soon!");
  document.getElementById("tournamentsContainer").innerHTML =
    '<div class="empty">✨ No active tournaments</div>';
  document.getElementById("myTournamentsContainer").innerHTML =
    '<div class="empty">📭 You are not participating</div>';
  renderHistory();

  updateBalance();
  initGame();

  function gameLoop() {
    if (gameRunning) {
      updatePhysics();
      updateCoins();
      updateCamera();
    }
    draw();
    requestAnimationFrame(gameLoop);
  }
  gameLoop();

  // Проверка Telegram WebApp
  if (window.Telegram?.WebApp) {
    console.log("Telegram WebApp detected");
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  } else {
    console.log("Not in Telegram");
  }
});
