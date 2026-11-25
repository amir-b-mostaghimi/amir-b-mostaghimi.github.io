/* ============================================================================
   Interactive Scientific Simulations & Portfolio Controls
   1. 2e-ORR (H2O2) Sabatier Volcano Plot & CHE Free-Energy Diagram
   2. 1D Bayesian Optimization (Gaussian Process + UCB / EI) Explorer
   3. Publication Topic Filter
   ============================================================================ */

(function () {
  "use strict";

  const COLORS = {
    ink: "#18181b",
    muted: "#71717a",
    grid: "#ebe8e0",
    axis: "#a1a1aa",
    cobalt: "#1e3a5f",
    cobaltFill: "rgba(30, 58, 95, 0.13)",
    copper: "#9a3412",
    copperFill: "rgba(154, 52, 18, 0.14)",
    sage: "#275d47",
    surface: "#ffffff"
  };

  function setupCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(280, Math.round(rect.width));
    const h = Math.max(220, Math.round(rect.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  /* --------------------------------------------------------------------------
     SIMULATOR 1: 2e-ORR (H2O2) Sabatier Volcano & CHE Free-Energy Diagram
     Thermodynamics:
       O2 + 2(H+ + e-) -> H2O2  (U0 = 0.70 V vs. RHE; dG(O2) = 4.92 eV, dG(H2O2) = 3.52 eV)
       Optimal dG(*OOH) = 4.22 eV -> UL = 0.70 V, eta = 0.00 V
       Strong-binding leg (dG_OOH < 4.22): limited by *OOH -> H2O2, UL = dG_OOH - 3.52
       Weak-binding leg   (dG_OOH > 4.22): limited by O2 -> *OOH,   UL = 4.92 - dG_OOH
     -------------------------------------------------------------------------- */
  const O2_LEVEL = 4.92;
  const H2O2_LEVEL = 3.52;
  const U_EQ = 0.70;
  const OPT_OOH = 4.22;

  const PRESETS = [
    { name: "Ideal 2e-ORR Peak", ooh: 4.22, u: 0.70, note: "Zero theoretical overpotential apex (4.22 eV)" },
    { name: "Au@Pd Nanowire (JACS 2024)", ooh: 4.29, u: 0.55, note: "Weak-binding near-optimal regime (~0.07 V overpotential)" },
    { name: "Pd/Defect C (Nat. Comm. 2020)", ooh: 4.14, u: 0.55, note: "Slightly strong-binding Pd-C site (~0.08 V overpotential)" },
    { name: "Holey Graphene (EcoMat 2023)", ooh: 4.38, u: 0.50, note: "Weak-binding oxygen-functionalized carbon edge" },
    { name: "Strong-Binding Metal (Pt-like)", ooh: 3.78, u: 0.40, note: "Overbinds *OOH; prone to O-O cleavage toward 4e-ORR (H2O)" }
  ];

  const oohSlider = document.getElementById("slider-ooh");
  const uSlider = document.getElementById("slider-u");
  const oohValEl = document.getElementById("val-ooh");
  const uValEl = document.getElementById("val-u");
  const volcanoCanvas = document.getElementById("canvas-volcano");
  const cheCanvas = document.getElementById("canvas-che");

  const outUL = document.getElementById("out-ul");
  const outEta = document.getElementById("out-eta");
  const outPds = document.getElementById("out-pds");
  const outRegime = document.getElementById("out-regime");

  function computeUL(dgOOH) {
    return Math.min(O2_LEVEL - dgOOH, dgOOH - H2O2_LEVEL);
  }

  function drawVolcano(dgOOH, uApplied) {
    if (!volcanoCanvas) return;
    const { ctx, w, h } = setupCanvas(volcanoCanvas);
    const pad = { l: 54, r: 22, t: 22, b: 44 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;

    const xMin = 3.4, xMax = 5.0;
    const yMin = -0.1, yMax = 0.85;
    const sx = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * pw;
    const sy = (y) => pad.t + ph - ((y - yMin) / (yMax - yMin)) * ph;

    ctx.clearRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 3.6; x <= 4.81; x += 0.2) {
      ctx.beginPath();
      ctx.moveTo(sx(x), pad.t);
      ctx.lineTo(sx(x), pad.t + ph);
      ctx.stroke();
    }
    for (let y = 0.0; y <= 0.81; y += 0.2) {
      ctx.beginPath();
      ctx.moveTo(pad.l, sy(y));
      ctx.lineTo(pad.l + pw, sy(y));
      ctx.stroke();
    }

    // Equilibrium dashed line (U = 0.70 V)
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = COLORS.sage;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(pad.l, sy(U_EQ));
    ctx.lineTo(pad.l + pw, sy(U_EQ));
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = COLORS.sage;
    ctx.font = "600 10.5px 'JetBrains Mono', monospace";
    ctx.fillText("U° = 0.70 V (H₂O₂ eq.)", pad.l + 6, sy(U_EQ) - 6);

    // Shaded volcano interior
    ctx.beginPath();
    ctx.moveTo(sx(3.52), sy(0));
    ctx.lineTo(sx(OPT_OOH), sy(U_EQ));
    ctx.lineTo(sx(4.92), sy(0));
    ctx.closePath();
    ctx.fillStyle = COLORS.cobaltFill;
    ctx.fill();

    // Volcano lines
    ctx.strokeStyle = COLORS.cobalt;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(sx(3.42), sy(computeUL(3.42)));
    ctx.lineTo(sx(OPT_OOH), sy(U_EQ));
    ctx.lineTo(sx(4.98), sy(computeUL(4.98)));
    ctx.stroke();

    // Applied potential horizontal reference
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = "rgba(154, 52, 18, 0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pad.l, sy(uApplied));
    ctx.lineTo(pad.l + pw, sy(uApplied));
    ctx.stroke();
    ctx.restore();

    // Preset reference dots
    PRESETS.slice(1).forEach((p) => {
      const px = sx(p.ooh);
      const py = sy(computeUL(p.ooh));
      ctx.beginPath();
      ctx.arc(px, py, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = COLORS.cobalt;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    });

    // Active catalyst marker + overpotential bar
    const ul = computeUL(dgOOH);
    const cx = sx(dgOOH);
    const cy = sy(ul);

    if (U_EQ - ul > 0.01) {
      ctx.strokeStyle = COLORS.copper;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, sy(U_EQ));
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.copper;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + ph);
    ctx.lineTo(pad.l + pw, pad.t + ph);
    ctx.stroke();

    // Tick labels
    ctx.fillStyle = COLORS.muted;
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    for (let x = 3.6; x <= 4.81; x += 0.3) {
      ctx.fillText(x.toFixed(1), sx(x), pad.t + ph + 16);
    }
    ctx.textAlign = "right";
    for (let y = 0.0; y <= 0.81; y += 0.2) {
      ctx.fillText(y.toFixed(1), pad.l - 8, sy(y) + 4);
    }

    // Axis titles
    ctx.fillStyle = COLORS.ink;
    ctx.font = "600 11.5px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ΔG(*OOH)  [eV]", pad.l + pw / 2, h - 8);
    ctx.save();
    ctx.translate(15, pad.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Limiting Potential U_L  [V vs. RHE]", 0, 0);
    ctx.restore();
  }

  function drawCHE(dgOOH, uApplied) {
    if (!cheCanvas) return;
    const { ctx, w, h } = setupCanvas(cheCanvas);
    const pad = { l: 54, r: 22, t: 22, b: 44 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;

    // Relative to H2O2 = 0 at U = 0:
    // G0(O2) = 1.40 - 2*U
    // G1(*OOH) = (dgOOH - 3.52) - 1*U
    // G2(H2O2) = 0
    const g0 = 1.40 - 2 * uApplied;
    const g1 = (dgOOH - H2O2_LEVEL) - uApplied;
    const g2 = 0.0;

    const yMin = -0.7, yMax = 1.85;
    const sy = (y) => pad.t + ph - ((y - yMin) / (yMax - yMin)) * ph;

    ctx.clearRect(0, 0, w, h);

    // Horizontal grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let y = -0.5; y <= 1.51; y += 0.5) {
      ctx.beginPath();
      ctx.moveTo(pad.l, sy(y));
      ctx.lineTo(pad.l + pw, sy(y));
      ctx.stroke();
    }

    // Zero line
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.axis;
    ctx.beginPath();
    ctx.moveTo(pad.l, sy(0));
    ctx.lineTo(pad.l + pw, sy(0));
    ctx.stroke();
    ctx.restore();

    const segW = pw / 3;
    const gap = 16;
    const levels = [
      { g: g0, label: "O₂ + 2(H⁺+e⁻)", x0: pad.l + gap, x1: pad.l + segW - gap },
      { g: g1, label: "*OOH + (H⁺+e⁻)", x0: pad.l + segW + gap, x1: pad.l + 2 * segW - gap },
      { g: g2, label: "H₂O₂(aq)", x0: pad.l + 2 * segW + gap, x1: pad.l + 3 * segW - gap }
    ];

    const dG1 = g1 - g0;
    const dG2 = g2 - g1;

    // Connecting transitions
    const trans = [
      { a: levels[0], b: levels[1], dg: dG1 },
      { a: levels[1], b: levels[2], dg: dG2 }
    ];
    trans.forEach((t) => {
      const uphill = t.dg > 0.005;
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = uphill ? COLORS.copper : COLORS.cobalt;
      ctx.lineWidth = uphill ? 2.2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(t.a.x1, sy(t.a.g));
      ctx.lineTo(t.b.x0, sy(t.b.g));
      ctx.stroke();
      ctx.restore();

      const mx = (t.a.x1 + t.b.x0) / 2;
      const my = (sy(t.a.g) + sy(t.b.g)) / 2;
      ctx.fillStyle = uphill ? COLORS.copper : COLORS.sage;
      ctx.font = "600 10.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText((t.dg >= 0 ? "+" : "") + t.dg.toFixed(2) + " eV", mx, my - 8);
    });

    // Energy plateaus
    levels.forEach((lv) => {
      ctx.strokeStyle = COLORS.cobalt;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(lv.x0, sy(lv.g));
      ctx.lineTo(lv.x1, sy(lv.g));
      ctx.stroke();

      ctx.fillStyle = COLORS.ink;
      ctx.font = "600 10.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(lv.g.toFixed(2) + " eV", (lv.x0 + lv.x1) / 2, sy(lv.g) - 8);

      ctx.fillStyle = COLORS.muted;
      ctx.font = "11px 'Inter', sans-serif";
      ctx.fillText(lv.label, (lv.x0 + lv.x1) / 2, pad.t + ph + 18);
    });

    // Axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + ph);
    ctx.lineTo(pad.l + pw, pad.t + ph);
    ctx.stroke();

    ctx.fillStyle = COLORS.muted;
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    for (let y = -0.5; y <= 1.51; y += 0.5) {
      ctx.fillText(y.toFixed(1), pad.l - 8, sy(y) + 4);
    }

    ctx.fillStyle = COLORS.ink;
    ctx.font = "600 11.5px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Reaction Coordinate  (U = " + uApplied.toFixed(2) + " V vs. RHE)", pad.l + pw / 2, h - 8);
    ctx.save();
    ctx.translate(15, pad.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Free Energy ΔG  [eV]", 0, 0);
    ctx.restore();
  }

  function updateVolcanoSim() {
    if (!oohSlider || !uSlider) return;
    const dgOOH = parseFloat(oohSlider.value);
    const uApplied = parseFloat(uSlider.value);
    oohValEl.textContent = dgOOH.toFixed(2) + " eV";
    uValEl.textContent = uApplied.toFixed(2) + " V";

    const ul = computeUL(dgOOH);
    const eta = Math.max(0, U_EQ - ul);

    outUL.textContent = ul.toFixed(2) + " V";
    outEta.textContent = eta.toFixed(2) + " V";
    if (Math.abs(dgOOH - OPT_OOH) < 0.015) {
      outPds.textContent = "Balanced (Apex)";
      outRegime.textContent = "Optimal Sabatier Peak";
    } else if (dgOOH > OPT_OOH) {
      outPds.textContent = "O₂ → *OOH";
      outRegime.textContent = "Weak Binding (Selective)";
    } else {
      outPds.textContent = "*OOH → H₂O₂";
      outRegime.textContent = "Strong Binding (4e⁻ Risk)";
    }

    drawVolcano(dgOOH, uApplied);
    drawCHE(dgOOH, uApplied);
  }

  const presetContainer = document.getElementById("volcano-presets");
  if (presetContainer) {
    PRESETS.forEach((p, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn" + (idx === 1 ? " active" : "");
      btn.textContent = p.name;
      btn.title = p.note;
      btn.addEventListener("click", () => {
        presetContainer.querySelectorAll(".chip-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        oohSlider.value = p.ooh.toFixed(2);
        uSlider.value = p.u.toFixed(2);
        updateVolcanoSim();
      });
      presetContainer.appendChild(btn);
    });
  }

  if (oohSlider && uSlider) {
    oohSlider.addEventListener("input", updateVolcanoSim);
    uSlider.addEventListener("input", updateVolcanoSim);
  }

  /* --------------------------------------------------------------------------
     SIMULATOR 2: 1D Bayesian Optimization (Gaussian Process + UCB / EI)
     -------------------------------------------------------------------------- */
  const boCanvas = document.getElementById("canvas-bo");
  const boStepBtn = document.getElementById("bo-step");
  const boAutoBtn = document.getElementById("bo-auto");
  const boResetBtn = document.getElementById("bo-reset");
  const boAcqBtn = document.getElementById("bo-acq");
  const kappaSlider = document.getElementById("slider-kappa");
  const kappaValEl = document.getElementById("val-kappa");

  const outBoRound = document.getElementById("out-bo-round");
  const outBoBest = document.getElementById("out-bo-best");
  const outBoRand = document.getElementById("out-bo-rand");
  const outBoOpt = document.getElementById("out-bo-opt");

  const GRID_N = 140;
  const xsGrid = Array.from({ length: GRID_N }, (_, i) => i / (GRID_N - 1));

  let boState = {
    seed: 1,
    acq: "UCB",
    kappa: 2.0,
    trueY: [],
    trueOpt: 0,
    obsX: [],
    obsY: [],
    randBest: 0,
    autoTimer: null
  };

  function makeLandscape(seed) {
    const a1 = 0.18 + ((seed * 37) % 17) / 100;
    const c1 = 0.22 + ((seed * 19) % 25) / 100;
    const c2 = 0.62 + ((seed * 29) % 25) / 100;
    const raw = xsGrid.map((x) => {
      const g1 = 0.58 * Math.exp(-Math.pow((x - c1) / 0.13, 2));
      const g2 = 0.88 * Math.exp(-Math.pow((x - c2) / 0.10, 2));
      const wave = 0.12 * Math.sin(11 * x + a1 * 6) + 0.06 * Math.cos(19 * x);
      return 0.14 + g1 + g2 + wave;
    });
    const mn = Math.min(...raw);
    const mx = Math.max(...raw);
    return raw.map((v) => 0.12 + 0.82 * ((v - mn) / (mx - mn)));
  }

  function evalTrue(x) {
    const idx = Math.max(0, Math.min(GRID_N - 1, Math.round(x * (GRID_N - 1))));
    return boState.trueY[idx];
  }

  function rbf(x1, x2, l = 0.11, sf2 = 0.12) {
    const d = x1 - x2;
    return sf2 * Math.exp(-(d * d) / (2 * l * l));
  }

  function cholesky(A) {
    const n = A.length;
    const L = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = A[i][j];
        for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
        if (i === j) L[i][j] = Math.sqrt(Math.max(1e-10, sum));
        else L[i][j] = sum / L[j][j];
      }
    }
    return L;
  }

  function solveCholesky(L, b) {
    const n = L.length;
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = b[i];
      for (let k = 0; k < i; k++) s -= L[i][k] * y[k];
      y[i] = s / L[i][i];
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k];
      x[i] = s / L[i][i];
    }
    return x;
  }

  function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
    return sign * y;
  }

  function normCdf(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function normPdf(z) { return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI); }

  function fitGP() {
    const n = boState.obsX.length;
    const priorMean = 0.45;
    const noise = 1e-3;
    const K = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => rbf(boState.obsX[i], boState.obsX[j]) + (i === j ? noise : 0))
    );
    const L = cholesky(K);
    const yCentered = boState.obsY.map((y) => y - priorMean);
    const alpha = solveCholesky(L, yCentered);

    const mu = new Array(GRID_N);
    const sd = new Array(GRID_N);
    const acq = new Array(GRID_N);
    const bestY = Math.max(...boState.obsY);

    for (let g = 0; g < GRID_N; g++) {
      const xg = xsGrid[g];
      const kStar = boState.obsX.map((xi) => rbf(xg, xi));
      let m = priorMean;
      for (let i = 0; i < n; i++) m += kStar[i] * alpha[i];

      // Solve L v = kStar
      const v = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        let s = kStar[i];
        for (let k = 0; k < i; k++) s -= L[i][k] * v[k];
        v[i] = s / L[i][i];
      }
      const v2 = v.reduce((acc, val) => acc + val * val, 0);
      const variance = Math.max(1e-6, rbf(xg, xg) - v2);
      const s = Math.sqrt(variance);
      mu[g] = m;
      sd[g] = s;

      if (boState.acq === "UCB") {
        acq[g] = m + boState.kappa * s;
      } else {
        const imp = m - bestY - 0.01;
        const z = imp / s;
        acq[g] = imp * normCdf(z) + s * normPdf(z);
      }
    }
    return { mu, sd, acq };
  }

  function drawBO() {
    if (!boCanvas) return;
    const { ctx, w, h } = setupCanvas(boCanvas);
    const pad = { l: 54, r: 22, t: 20, b: 40 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;

    const sx = (x) => pad.l + x * pw;
    const sy = (y) => pad.t + ph - (Math.max(0, Math.min(1.1, y)) / 1.1) * ph;

    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let y = 0.2; y <= 1.01; y += 0.2) {
      ctx.beginPath();
      ctx.moveTo(pad.l, sy(y));
      ctx.lineTo(pad.l + pw, sy(y));
      ctx.stroke();
    }

    const { mu, sd, acq } = fitGP();

    // Find next recommended point
    let nextIdx = 0;
    for (let i = 1; i < GRID_N; i++) {
      if (acq[i] > acq[nextIdx]) nextIdx = i;
    }

    // Acquisition strip at bottom (scaled to 0..0.24 visual band)
    const acqMin = Math.min(...acq);
    const acqMax = Math.max(...acq);
    const acqSpan = Math.max(1e-6, acqMax - acqMin);
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(0));
    for (let i = 0; i < GRID_N; i++) {
      const normA = (acq[i] - acqMin) / acqSpan;
      ctx.lineTo(sx(xsGrid[i]), sy(normA * 0.22));
    }
    ctx.lineTo(sx(1), sy(0));
    ctx.closePath();
    ctx.fillStyle = COLORS.copperFill;
    ctx.fill();

    // GP +/- 2 sigma confidence band
    ctx.beginPath();
    for (let i = 0; i < GRID_N; i++) {
      const yTop = Math.min(1.08, mu[i] + 1.96 * sd[i]);
      if (i === 0) ctx.moveTo(sx(xsGrid[i]), sy(yTop));
      else ctx.lineTo(sx(xsGrid[i]), sy(yTop));
    }
    for (let i = GRID_N - 1; i >= 0; i--) {
      const yBot = Math.max(0.0, mu[i] - 1.96 * sd[i]);
      ctx.lineTo(sx(xsGrid[i]), sy(yBot));
    }
    ctx.closePath();
    ctx.fillStyle = COLORS.cobaltFill;
    ctx.fill();

    // True latent reaction yield (dashed subtle curve)
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < GRID_N; i++) {
      if (i === 0) ctx.moveTo(sx(xsGrid[i]), sy(boState.trueY[i]));
      else ctx.lineTo(sx(xsGrid[i]), sy(boState.trueY[i]));
    }
    ctx.stroke();
    ctx.restore();

    // GP Posterior mean
    ctx.strokeStyle = COLORS.cobalt;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < GRID_N; i++) {
      if (i === 0) ctx.moveTo(sx(xsGrid[i]), sy(mu[i]));
      else ctx.lineTo(sx(xsGrid[i]), sy(mu[i]));
    }
    ctx.stroke();

    // Next suggested query vertical line
    const nx = sx(xsGrid[nextIdx]);
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = COLORS.copper;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(nx, pad.t);
    ctx.lineTo(nx, pad.t + ph);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = COLORS.copper;
    ctx.font = "600 10px 'JetBrains Mono', monospace";
    ctx.textAlign = nx > w - 110 ? "right" : "left";
    ctx.fillText("Next " + boState.acq + " query", nx + (nx > w - 110 ? -6 : 6), pad.t + 14);

    // Observed experiments
    boState.obsX.forEach((ox, idx) => {
      const px = sx(ox);
      const py = sy(boState.obsY[idx]);
      ctx.beginPath();
      ctx.arc(px, py, 5.2, 0, Math.PI * 2);
      ctx.fillStyle = idx === boState.obsX.length - 1 ? COLORS.copper : COLORS.cobalt;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.8;
      ctx.stroke();
    });

    // Axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + ph);
    ctx.lineTo(pad.l + pw, pad.t + ph);
    ctx.stroke();

    ctx.fillStyle = COLORS.muted;
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    for (let y = 0.2; y <= 1.01; y += 0.2) {
      ctx.fillText((y * 100).toFixed(0) + "%", pad.l - 8, sy(y) + 4);
    }

    ctx.fillStyle = COLORS.ink;
    ctx.font = "600 11.5px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Descriptor / Reaction Condition Space  (click anywhere to test manually)", pad.l + pw / 2, h - 8);
    ctx.save();
    ctx.translate(14, pad.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Reaction Yield [%]", 0, 0);
    ctx.restore();

    // Update readouts
    const best = Math.max(...boState.obsY);
    outBoRound.textContent = boState.obsX.length + " exp.";
    outBoBest.textContent = (best * 100).toFixed(1) + "%";
    outBoRand.textContent = (boState.randBest * 100).toFixed(1) + "%";
    outBoOpt.textContent = (boState.trueOpt * 100).toFixed(1) + "%";
  }

  function stepBO() {
    if (boState.obsX.length >= 22) return;
    const { acq } = fitGP();
    let bestIdx = 0;
    for (let i = 1; i < GRID_N; i++) {
      if (acq[i] > acq[bestIdx]) bestIdx = i;
    }
    const xNew = xsGrid[bestIdx];
    boState.obsX.push(xNew);
    boState.obsY.push(evalTrue(xNew));
    // Match random search step
    const rx = Math.random();
    boState.randBest = Math.max(boState.randBest, evalTrue(rx));
    drawBO();
  }

  function resetBO(incrementSeed) {
    if (boState.autoTimer) {
      clearInterval(boState.autoTimer);
      boState.autoTimer = null;
    }
    if (incrementSeed) boState.seed += 1;
    boState.trueY = makeLandscape(boState.seed);
    boState.trueOpt = Math.max(...boState.trueY);
    // Start with 2 initial experiments
    boState.obsX = [0.15, 0.85];
    boState.obsY = boState.obsX.map(evalTrue);
    boState.randBest = Math.max(...boState.obsY);
    drawBO();
  }

  if (boStepBtn) boStepBtn.addEventListener("click", stepBO);
  if (boResetBtn) boResetBtn.addEventListener("click", () => resetBO(true));
  if (boAutoBtn) {
    boAutoBtn.addEventListener("click", () => {
      if (boState.autoTimer) return;
      let count = 0;
      boState.autoTimer = setInterval(() => {
        stepBO();
        count += 1;
        if (count >= 8 || boState.obsX.length >= 22) {
          clearInterval(boState.autoTimer);
          boState.autoTimer = null;
        }
      }, 320);
    });
  }
  if (boAcqBtn) {
    boAcqBtn.addEventListener("click", () => {
      boState.acq = boState.acq === "UCB" ? "EI" : "UCB";
      boAcqBtn.textContent = "Acquisition: " + boState.acq;
      drawBO();
    });
  }
  if (kappaSlider) {
    kappaSlider.addEventListener("input", () => {
      boState.kappa = parseFloat(kappaSlider.value);
      kappaValEl.textContent = boState.kappa.toFixed(1);
      drawBO();
    });
  }
  if (boCanvas) {
    boCanvas.addEventListener("click", (e) => {
      const rect = boCanvas.getBoundingClientRect();
      const padL = 54, padR = 22;
      const xNorm = (e.clientX - rect.left - padL) / (rect.width - padL - padR);
      if (xNorm >= 0 && xNorm <= 1 && boState.obsX.length < 25) {
        boState.obsX.push(xNorm);
        boState.obsY.push(evalTrue(xNorm));
        drawBO();
      }
    });
  }

  /* --------------------------------------------------------------------------
     PUBLICATION TOPIC FILTER
     -------------------------------------------------------------------------- */
  const filterBtns = document.querySelectorAll("[data-pub-filter]");
  const pubRows = document.querySelectorAll(".pub-row");
  const pubCountEl = document.getElementById("pub-count");

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const topic = btn.getAttribute("data-pub-filter");
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      let shown = 0;
      pubRows.forEach((row) => {
        const cats = (row.getAttribute("data-topic") || "").split(" ");
        const match = topic === "all" || cats.includes(topic);
        row.classList.toggle("hidden", !match);
        if (match) shown += 1;
      });
      if (pubCountEl) pubCountEl.textContent = "Showing " + shown + " of " + pubRows.length + " publications";
    });
  });

  /* Initial render + resize handling */
  function renderAll() {
    updateVolcanoSim();
    drawBO();
  }

  resetBO(false);
  updateVolcanoSim();

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderAll, 120);
  });
})();
