/* ============================================================
   DividendIQ Pro — Shared App Logic
   All API calls, state, utilities, and navigation helpers
   ============================================================ */

'use strict';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CONFIG = {
  DEMO_MODE:    true,
  FINNHUB_KEY:  'd955ophr01qihq3k1i50d955ophr01qihq3k1i5g',
  BACKEND_URL:  'https://api.dividendiq.info',
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON:'your-supabase-anon-key',
  ANTHROPIC_MODEL: 'claude-sonnet-4-6',
};

// ── DEMO PROFILE ──────────────────────────────────────────────────────────────
const DEMO_PROFILE = {
  user_id:'demo-001', name:'Robert Anderson', email:'demo@dividendiq.info',
  age:64, ret_age:65, portfolio:47884, monthly:100,
  broker:'Charles Schwab', ss_income:1800, ss_age:66,
  income_goal:3000, other_income:0, risk:'moderate',
};

// ── MODEL HOLDINGS ────────────────────────────────────────────────────────────
const MODEL_HOLDINGS = [
  {ticker:'SCHD', name:'Schwab US Dividend Equity',   shares:333.62, price:31.85,  yield:3.5,  sleeve:'Dividend Growth',   color:'var(--amber)',  bg:'var(--amber-lt)'},
  {ticker:'JEPI', name:'JPMorgan Equity Premium Inc.',shares:108.90, price:56.12,  yield:8.5,  sleeve:'ETF Income',         color:'var(--teal)',   bg:'var(--teal-lt)'},
  {ticker:'JEPQ', name:'JPMorgan Nasdaq Premium Inc.',shares:68.27,  price:56.12,  yield:10.0, sleeve:'ETF Income',         color:'var(--teal)',   bg:'var(--teal-lt)'},
  {ticker:'ARCC', name:'Ares Capital BDC',            shares:209.89, price:18.25,  yield:9.5,  sleeve:'REITs & BDCs',       color:'var(--red)',    bg:'var(--red-lt)'},
  {ticker:'MAIN', name:'Main Street Capital BDC',     shares:42.25,  price:68.01,  yield:8.5,  sleeve:'REITs & BDCs',       color:'var(--red)',    bg:'var(--red-lt)'},
  {ticker:'FSK',  name:'FS KKR Capital BDC',          shares:114.07, price:16.79,  yield:12.0, sleeve:'REITs & BDCs',       color:'var(--red)',    bg:'var(--red-lt)'},
  {ticker:'O',    name:'Realty Income REIT',          shares:65.10,  price:58.85,  yield:5.5,  sleeve:'REITs & BDCs',       color:'var(--red)',    bg:'var(--red-lt)'},
  {ticker:'KBWY', name:'Invesco High-Yield REIT ETF', shares:64.70,  price:37.00,  yield:7.5,  sleeve:'REITs & BDCs',       color:'var(--red)',    bg:'var(--red-lt)'},
  {ticker:'VCIT', name:'Vanguard Corp Bond ETF',      shares:69.90,  price:82.19,  yield:4.2,  sleeve:'Bonds & Preferred',  color:'var(--gray)',   bg:'var(--gray-lt)'},
  {ticker:'PFFD', name:'Global X Preferred Stock ETF',shares:41.16,  price:46.53,  yield:6.5,  sleeve:'Bonds & Preferred',  color:'var(--gray)',   bg:'var(--gray-lt)'},
  {ticker:'GLD',  name:'SPDR Gold Shares',            shares:6.46,   price:370.60, yield:0.0,  sleeve:'Inflation Hedge',    color:'var(--gold)',   bg:'var(--gold-lt)'},
  {ticker:'SGOV', name:'iShares 0-3M Treasury ETF',   shares:14.32,  price:100.40, yield:5.2,  sleeve:'Cash Equivalent',    color:'var(--blue)',   bg:'var(--blue-lt)'},
];

// ── STATE MANAGER ─────────────────────────────────────────────────────────────
const State = {
  _data: {},
  get(key, def) {
    if (key in this._data) return this._data[key];
    try { const v = localStorage.getItem('diq_' + key); return v !== null ? JSON.parse(v) : def; } catch { return def; }
  },
  set(key, val) {
    this._data[key] = val;
    try { localStorage.setItem('diq_' + key, JSON.stringify(val)); } catch {}
  },
  profile() { return this.get('profile', DEMO_PROFILE); },
  holdings(){ return this.get('holdings', MODEL_HOLDINGS); },
  plan()    { return this.get('plan', CONFIG.DEMO_MODE ? 'pro' : 'free'); },
  token()   { return this.get('token', CONFIG.DEMO_MODE ? 'demo' : null); },
  chatHistory() { return this.get('chat_history', []); },
  setChatHistory(h) { this.set('chat_history', h.slice(-30)); },
};

if (CONFIG.DEMO_MODE) {
  State.set('profile', DEMO_PROFILE);
  State.set('holdings', MODEL_HOLDINGS);
  State.set('plan', 'pro');
  State.set('token', 'demo');
}

// ── FORMATTERS ────────────────────────────────────────────────────────────────
const fmt  = (n) => '$' + Math.round(+n || 0).toLocaleString();
const fmtK = (n) => { n = +n || 0; return n >= 1000000 ? '$' + (n/1000000).toFixed(1) + 'M' : n >= 1000 ? '$' + (n/1000).toFixed(0) + 'K' : fmt(n); };
const sfx  = (n, d=1) => (+n || 0).toFixed(d);
const pct  = (n) => sfx(n, 1) + '%';
const dateStr = (d) => new Date(d).toLocaleDateString('en-US', {month:'short', day:'numeric'});
const scoreColor = (s) => s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--amber)' : 'var(--red)';

// ── PORTFOLIO CALCULATIONS ────────────────────────────────────────────────────
function calcPortfolio(holdings) {
  const totalVal = holdings.reduce((s, h) => s + h.shares * (h.livePrice || h.price), 0);
  const totalInc = holdings.reduce((s, h) => s + h.shares * (h.livePrice || h.price) * h.yield / 100 / 12, 0);
  const blended  = totalVal > 0 ? holdings.reduce((s, h) => s + h.shares * (h.livePrice || h.price) * h.yield, 0) / totalVal : 0;
  return { totalVal, totalInc, blended };
}

function calcScore(profile, totalInc, blended, holdings) {
  const goal    = profile.income_goal || 3000;
  const ss      = profile.ss_income   || 1800;
  const totalMo = totalInc + ss;
  const gap     = Math.max(0, goal - totalMo);

  const incomeScore = Math.min(100, Math.round((totalMo / goal) * 85));
  const yieldScore  = Math.min(100, Math.round((blended / 6) * 80));
  const divScore    = Math.min(100, Math.round((holdings.filter(h => h.yield > 0).length / holdings.length) * 90));
  const safetyScore = Math.min(100, holdings.reduce((s, h) => {
    const pct = h.shares * (h.livePrice || h.price) / Math.max(1, holdings.reduce((a,x)=>a+x.shares*(x.livePrice||x.price),0)) * 100;
    return s + (pct < 15 ? 10 : pct < 10 ? 12 : 6);
  }, 0));
  const growthScore = Math.min(100, Math.round(blended * 10));
  const ssScore     = Math.min(100, Math.round((ss / goal) * 80));
  const retirementReadiness = profile.age >= profile.ret_age - 1 ? 70 : 85;
  const consistencyScore    = Math.min(100, Math.round(divScore * 0.9));

  const overall = Math.min(100, Math.round(
    incomeScore * 0.25 + yieldScore * 0.15 + divScore * 0.15 +
    safetyScore * 0.15 + growthScore * 0.10 + ssScore * 0.10 +
    retirementReadiness * 0.05 + consistencyScore * 0.05
  ));

  const confidence = Math.min(100, Math.round((totalMo / goal) * 100));

  return { overall, confidence, incomeScore, yieldScore, divScore, safetyScore, growthScore, ssScore, gap };
}

// ── INCOME PROJECTION ─────────────────────────────────────────────────────────
function projectIncome(opts) {
  const { portfolio, monthly=0, returnRate=9, yieldRate=6.2, ssIncome=1800, ssAge=66, currentAge=64, drip=true, otherIncome=0, inflation=3, ssGrowth=2.5, years=20 } = opts;
  let bal = portfolio;
  const rows = [];
  for (let yr = 1; yr <= years; yr++) {
    const age    = currentAge + yr;
    const divInc = bal * yieldRate / 100;
    const growth = bal * returnRate / 100;
    bal = drip ? bal + growth + (monthly * 12) : bal + (growth - divInc) + (monthly * 12);
    const ssYr   = age >= ssAge ? ssIncome * Math.pow(1 + ssGrowth/100, Math.max(0, age - ssAge)) : 0;
    const divMo  = Math.round(drip ? bal * yieldRate / 100 / 12 : divInc / 12);
    const totalMo= Math.round(divMo + ssYr + otherIncome);
    const realMo = Math.round(totalMo / Math.pow(1 + inflation/100, yr));
    rows.push({ yr, age, bal: Math.round(bal), divMo, totalMo, realMo, ss: Math.round(ssYr * 12) });
  }
  return rows;
}

// ── API HELPERS ───────────────────────────────────────────────────────────────
async function fetchQuote(ticker) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${CONFIG.FINNHUB_KEY}`);
    const d = await r.json();
    return { price: d.c, prev: d.pc, pct: d.pc ? ((d.c - d.pc) / d.pc * 100) : 0, ok: !!d.c };
  } catch { return { price: 0, pct: 0, ok: false }; }
}

async function fetchMarketNews() {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/news?category=general&minId=0&token=${CONFIG.FINNHUB_KEY}`);
    const arr = await r.json();
    return (arr || []).slice(0, 20).map(n => ({
      id: n.id, headline: n.headline, summary: n.summary,
      source: n.source, url: n.url,
      time: new Date(n.datetime * 1000).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}),
    }));
  } catch { return []; }
}

async function fetchFredSeries(id) {
  try {
    const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=ab0a7afe3b11cf5f7b4e9f89bd8acca2&limit=2&sort_order=desc&file_type=json`);
    const d = await r.json();
    const obs = (d.observations || []).filter(o => o.value !== '.');
    return obs.length > 0 ? parseFloat(obs[0].value) : null;
  } catch { return null; }
}

async function callClaude(messages, systemPrompt, maxTokens=1000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content || []).map(b => b.type === 'text' ? b.text : '').join('').trim();
}

// ── WORLD-CLASS AI SYSTEM PROMPT ──────────────────────────────────────────────
const AI_SYSTEM = [
  'You are the DividendIQ Retirement Income Advisor -- a world-class AI built specifically for',
  'near-retirement dividend income investors aged 55-75. You combine the knowledge of a CFP,',
  'a CFA charterholder, and a 30-year dividend income specialist into one highly accurate,',
  'personalized advisor.',
  '',
  'EXPERTISE: Covered call ETFs (JEPI/JEPQ VIX mechanics), BDCs (NAV, coverage ratios),',
  'Dividend Aristocrats (consecutive raise streaks), REITs (FFO vs EPS), Preferred stocks',
  '(cumulative vs non-cumulative, call dates), mREITs (interest rate sensitivity), CEFs.',
  '',
  'RETIREMENT MATH: 4% withdrawal rule limitations, sequence-of-returns risk, DRIP compounding,',
  'Social Security optimization, RMDs at age 73, Medicare IRMAA surcharges, qualified vs ordinary',
  'dividend tax treatment, Roth conversion ladders, tax-loss harvesting.',
  '',
  'CURRENT MARKET (July 2026): JEPI yield ~8.3%, ARCC Q1 NII $0.55 vs $0.48 dividend (well covered),',
  'MAIN raised dividend 4% Feb 2026, AGNC affirmed $0.12/share July 2026, defense +18% YTD,',
  'nuclear/CEG +55% YTD, gold +25% YTD, energy -12% YTD, SGOV yielding 5.2%,',
  'VYM outperforming VIG 13% vs 9% YTD 2026, 10yr treasury 4.3-4.6%.',
  '',
  'HOW TO ANSWER: Always personalize to the client. Always include specific tickers, share counts,',
  'dollar amounts -- never vague. Show your math. Flag assumptions explicitly. Structure as:',
  'Summary -> Analysis -> Specific Action -> Caveats.',
  'When yield >12% proactively explain the risk. Give clear recommendations with reasoning,',
  'then list what could make you wrong.',
  '',
  'COMPLIANCE: End every response with exactly:',
  'For informational purposes only -- not personalized financial advice. Verify with your brokerage.',
].join(' ');

// ── DOM HELPERS ───────────────────────────────────────────────────────────────
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];

function el(tag, cls='', html='') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function showToast(msg, type='success', dur=3000) {
  let t = $('#global-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'global-toast';
    t.className = 'toast hidden';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast ${type}`;
  if (t._timer) clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast hidden', dur);
}

function spinner(size=20) {
  const s = document.createElement('div');
  s.className = 'spinner';
  s.style.width = size + 'px';
  s.style.height = size + 'px';
  return s;
}

function buildNav(activePage) {
  const pages = [
    { href: 'index.html',      label: 'Home' },
    { href: 'advisor.html',    label: 'Advisor' },
    { href: 'calculator.html', label: 'Calculator' },
    { href: 'markets.html',    label: 'Markets' },
    { href: 'learn.html',      label: 'Learn' },
    { href: 'portfolio.html',  label: 'Portfolio' },
  ];

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = `
    <a href="index.html" class="nav-logo" style="gap:0;">
      <img src="./logo-square.png" alt="DividendIQ" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0;"/>
      <span style="margin-left:8px;">Dividend<span style="color:var(--green);">IQ</span></span>
    </a>
    <div class="nav-links">
      ${pages.map(p => `<a href="${p.href}" class="nav-link${p.label === activePage ? ' active' : ''}">${p.label}</a>`).join('')}
      <a href="plans.html" class="nav-link nav-cta">Get Pro</a>
    </div>`;
  return nav;
}

function buildBottomNav(activePage) {
  const items = [
    { href:'index.html',      icon:'&#127968;', label:'Home' },
    { href:'advisor.html',    icon:'&#129504;', label:'Advisor' },
    { href:'markets.html',    icon:'&#128202;', label:'Markets' },
    { href:'calculator.html', icon:'&#128200;', label:'Calc' },
    { href:'learn.html',      icon:'&#127979;', label:'Learn' },
  ];
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.innerHTML = items.map(it => `
    <a href="${it.href}" class="bottom-nav-item${it.label === activePage ? ' active' : ''}">
      <span class="bottom-nav-icon">${it.icon}</span>
      <span class="bottom-nav-label">${it.label}</span>
      <div class="bottom-nav-dot"></div>
    </a>`).join('');
  return nav;
}

// ── SCORE RING SVG ────────────────────────────────────────────────────────────
function buildScoreRing(score, size=140) {
  const r = 46, cx = 72, cy = 72;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * (score / 100);
  const color  = score >= 80 ? '#3AAA35' : score >= 60 ? '#D97706' : '#DC2626';
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 144 144">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(13,43,94,0.08)" stroke-width="10"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="10"
        stroke-dasharray="${filled} ${circumference - filled}"
        stroke-dashoffset="${circumference * 0.25}" stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="Manrope,sans-serif"
        font-size="32" font-weight="800" fill="#0D2B5E">${score}</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="11" fill="#64748B">/100</text>
      <text x="${cx}" y="${cy + 26}" text-anchor="middle" font-size="8" fill="#64748B">DividendIQ Score</text>
    </svg>`;
}

// ── DISCLAIMER HTML ───────────────────────────────────────────────────────────
function disclaimerHTML() {
  return `<div class="disclaimer">
    <strong>For informational purposes only.</strong>
    DividendIQ Pro is not a registered investment advisor and does not provide personalized financial advice.
    All analysis is educational. Always consult a qualified fiduciary advisor before making investment decisions.
    Past performance does not guarantee future results.
  </div>`;
}

// ── PRO GATE ──────────────────────────────────────────────────────────────────
function isProUser() { return ['pro','advisor'].includes(State.plan()); }

function proGateHTML(featureName) {
  return `
    <div class="card text-center" style="margin:20px 0;">
      <div style="font-size:32px;margin-bottom:12px;">&#128274;</div>
      <div style="font-size:16px;font-weight:700;color:var(--navy);margin-bottom:8px;">Pro feature</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:16px;line-height:1.7;">
        ${featureName} is available on the Pro plan.
        Upgrade to unlock unlimited AI advisor access, deep portfolio audit, tax intelligence, and more.
      </div>
      <a href="plans.html" class="btn primary full">Upgrade to Pro &mdash; $19/mo</a>
      <div style="font-size:11px;color:var(--muted);margin-top:10px;">14-day free trial &mdash; Cancel anytime</div>
    </div>`;
}

// ── SECTOR ETF DATA ───────────────────────────────────────────────────────────
const SECTOR_ETFS = [
  {key:'XLK', label:'Technology',      icon:'&#128187;', color:'#7C3AED'},
  {key:'XLF', label:'Financials',      icon:'&#128176;', color:'#0D2B5E'},
  {key:'XLV', label:'Healthcare',      icon:'&#128138;', color:'#DC2626'},
  {key:'XLE', label:'Energy',          icon:'&#9889;',   color:'#D97706'},
  {key:'XLI', label:'Industrials',     icon:'&#9881;',   color:'#64748B'},
  {key:'XLC', label:'Comm Services',   icon:'&#128225;', color:'#1B75BC'},
  {key:'XLY', label:'Consumer Disc.',  icon:'&#128717;', color:'#F59E0B'},
  {key:'XLP', label:'Consumer Staples',icon:'&#127978;', color:'#3AAA35'},
  {key:'XLU', label:'Utilities',       icon:'&#128161;', color:'#00A89D'},
  {key:'XLRE',label:'Real Estate',     icon:'&#127968;', color:'#B45309'},
  {key:'XLB', label:'Materials',       icon:'&#129504;', color:'#6B7280'},
  {key:'ITA', label:'Defense',         icon:'&#128737;', color:'#1e40af'},
];

// ── SCREENER UNIVERSE ─────────────────────────────────────────────────────────
const SCREENER = [
  {t:'SCHD', name:'Schwab Dividend ETF',        yield:3.5,  payout:65,  safety:90, sector:'ETF',       growth:'Growing',  sleeve:'Dividend Growth'},
  {t:'JEPI', name:'JPMorgan Equity Premium',    yield:8.5,  payout:95,  safety:85, sector:'ETF',       growth:'Stable',   sleeve:'ETF Income'},
  {t:'JEPQ', name:'JPMorgan Nasdaq Premium',    yield:10,   payout:95,  safety:82, sector:'ETF',       growth:'Stable',   sleeve:'ETF Income'},
  {t:'ARCC', name:'Ares Capital BDC',           yield:9.5,  payout:88,  safety:80, sector:'BDC',       growth:'Stable',   sleeve:'REITs & BDCs'},
  {t:'MAIN', name:'Main Street Capital',        yield:8.5,  payout:85,  safety:85, sector:'BDC',       growth:'Growing',  sleeve:'REITs & BDCs'},
  {t:'FSK',  name:'FS KKR Capital',            yield:12,   payout:90,  safety:70, sector:'BDC',       growth:'Stable',   sleeve:'REITs & BDCs'},
  {t:'O',    name:'Realty Income REIT',         yield:5.5,  payout:75,  safety:88, sector:'REIT',      growth:'Growing',  sleeve:'REITs & BDCs'},
  {t:'CVX',  name:'Chevron Corporation',        yield:4.1,  payout:55,  safety:85, sector:'Energy',    growth:'Growing',  sleeve:'High-Dividend'},
  {t:'XOM',  name:'ExxonMobil Corporation',     yield:3.5,  payout:48,  safety:87, sector:'Energy',    growth:'Growing',  sleeve:'High-Dividend'},
  {t:'T',    name:'AT&T Inc',                   yield:6.5,  payout:72,  safety:75, sector:'Telecom',   growth:'Stable',   sleeve:'High-Dividend'},
  {t:'VZ',   name:'Verizon Communications',     yield:6.8,  payout:75,  safety:74, sector:'Telecom',   growth:'Stable',   sleeve:'High-Dividend'},
  {t:'MO',   name:'Altria Group',               yield:8.2,  payout:78,  safety:72, sector:'Consumer',  growth:'Growing',  sleeve:'High-Dividend'},
  {t:'KO',   name:'Coca-Cola Company',          yield:3.0,  payout:68,  safety:92, sector:'Consumer',  growth:'Growing',  sleeve:'Dividend Growth'},
  {t:'JNJ',  name:'Johnson & Johnson',          yield:3.1,  payout:44,  safety:92, sector:'Healthcare',growth:'Growing',  sleeve:'Dividend Growth'},
  {t:'RTX',  name:'RTX Corporation',            yield:2.2,  payout:38,  safety:88, sector:'Defense',   growth:'Growing',  sleeve:'Dividend Growth'},
  {t:'NEE',  name:'NextEra Energy',             yield:3.2,  payout:58,  safety:82, sector:'Utilities', growth:'Growing',  sleeve:'Bonds & Preferred'},
  {t:'D',    name:'Dominion Energy',            yield:4.8,  payout:82,  safety:76, sector:'Utilities', growth:'Stable',   sleeve:'Bonds & Preferred'},
  {t:'SGOV', name:'iShares 0-3M Treasury',      yield:5.2,  payout:100, safety:99, sector:'Bonds',     growth:'Stable',   sleeve:'Bonds & Preferred'},
  {t:'PFFD', name:'Global X Preferred Stock',   yield:6.5,  payout:100, safety:80, sector:'Preferred', growth:'Stable',   sleeve:'Bonds & Preferred'},
  {t:'VCIT', name:'Vanguard Corp Bond ETF',     yield:4.2,  payout:100, safety:88, sector:'Bonds',     growth:'Stable',   sleeve:'Bonds & Preferred'},
  {t:'AGNC', name:'AGNC Investment mREIT',      yield:13.1, payout:91,  safety:55, sector:'mREIT',     growth:'Declining',sleeve:'High-Dividend'},
  {t:'NLY',  name:'Annaly Capital mREIT',       yield:14.0, payout:90,  safety:52, sector:'mREIT',     growth:'Declining',sleeve:'High-Dividend'},
];

// ── STRATEGIES DATA ───────────────────────────────────────────────────────────
const STRATEGIES = [
  {
    key:'coveredcall', icon:'&#128200;', title:'Covered Call ETFs',
    badge:'Hot in 2026', badgeColor:'var(--green)', color:'var(--purple)', bg:'var(--purple-lt)',
    yield:'8-12%', risk:'Low-Medium', payFreq:'Monthly', riskLevel:1,
    tickers:['JEPI','JEPQ','QQQI','SPYI','DIVO'],
    headline:'The most talked-about retirement income strategy of 2025-2026',
    why:'Covered call ETFs sell options on stocks they already own, collecting premium income on top of dividends. In 2026\'s volatile market, elevated VIX levels mean fatter premiums -- which means higher income for you.',
    currentState:'JEPI yielding ~8.3%, JEPQ yielding ~11.98% as of May 2026. 2026 volatility has been ideal for covered call premium generation.',
    topPick:'JEPI for stability. JEPQ for higher yield with tech exposure.',
    pros:['JEPI paid $0.42-0.45/share April-May 2026 -- above 2025 average','Monthly income with no dividend cut risk','JEPI: $44B in assets, never missed monthly payment since 2020','Best downside protection: JEPI down only 3.5% in 2022 vs S&P 18%'],
    cons:['Income varies month to month based on VIX','Payments ranged $0.33-$0.54/share in 2025 -- 66% swing','You give up upside when markets rip higher','JEPQ has 42% tech concentration'],
    allocation:'Core income sleeve: 15-25% of retirement portfolio. Hold JEPI in Roth IRA.',
    bestFor:'Investors who want monthly income NOW and can tolerate payment variability.',
  },
  {
    key:'bdcs', icon:'&#127959;', title:'BDCs -- Business Development Companies',
    badge:'10%+ Yields', badgeColor:'var(--red)', color:'var(--red)', bg:'var(--red-lt)',
    yield:'8-13%', risk:'Medium', payFreq:'Quarterly/Monthly', riskLevel:2,
    tickers:['ARCC','MAIN','BXSL','CSWC','FSK'],
    headline:'Legally required to pay 90%+ of income as dividends -- some of the highest legal yields available',
    why:'BDCs lend money to mid-size private companies and collect high floating-rate interest, passing nearly all of it to shareholders.',
    currentState:'ARCC Q1 2026 NII $0.55 vs $0.48 dividend (well covered). Trading at 7% NAV discount. MAIN raised dividend 4% Feb 2026.',
    topPick:'ARCC for safety and scale. MAIN for monthly income and consistent raises.',
    pros:['ARCC: largest BDC, $13.6B market cap, dividend held steady 8 straight quarters','MAIN pays monthly AND special dividends','Floating rate loans: when rates stay high, BDC income stays high'],
    cons:['2026 BDC headwinds: AI disruption threatening some software borrowers','Rate cuts would reduce floating-rate loan income','Distributions taxed as ordinary income'],
    allocation:'Income sleeve: 10-20% of portfolio. ARCC + MAIN is the classic pairing.',
    bestFor:'Investors comfortable with medium risk who want yields that bonds cannot match.',
  },
  {
    key:'dividendgrowth', icon:'&#127793;', title:'Dividend Growth -- Aristocrats',
    badge:'25+ Year Raisers', badgeColor:'var(--amber)', color:'var(--amber)', bg:'var(--amber-lt)',
    yield:'2-4%', risk:'Low', payFreq:'Quarterly', riskLevel:1,
    tickers:['SCHD','KO','JNJ','PEP','RTX','CVX'],
    headline:'Lower yield today, higher yield tomorrow -- the compounding engine of retirement portfolios',
    why:'A stock yielding 3% that raises its dividend 8% per year doubles your income in 9 years without buying a single additional share.',
    currentState:'T. Rowe Price made 40th consecutive increase Feb 2026. McCormick raised 6.7% Nov 2025. SCHD remains the gold standard.',
    topPick:'SCHD ETF for instant diversification. RTX for defense + dividend growth combination.',
    pros:['SCHD: 10+ years of dividend growth, 3.5% current yield','Qualified dividend tax treatment -- taxed at lower capital gains rates','Lower volatility than high-yield strategies during market stress'],
    cons:['Current yield is low -- 3% on $50,000 is only $1,500/yr','Takes years for compounding to produce meaningful income','Requires more capital to generate same income as higher-yield strategies'],
    allocation:'Core foundation: 20-30% of retirement portfolio. Use DRIP during accumulation.',
    bestFor:'Investors with 5+ years before needing full income.',
  },
  {
    key:'reits', icon:'&#127962;', title:'REITs -- Real Estate Investment Trusts',
    badge:'Monthly Income', badgeColor:'var(--blue)', color:'var(--blue)', bg:'var(--blue-lt)',
    yield:'4-10%', risk:'Low-Medium', payFreq:'Monthly/Quarterly', riskLevel:2,
    tickers:['O','KBWY','NNN','VICI','AMT','PLD'],
    headline:'Own commercial real estate without a landlord headache -- collect rent checks monthly',
    why:'REITs must distribute 90%+ of taxable income. Realty Income (O) has made 650+ consecutive monthly payments and raised its dividend 126 times since 1994.',
    currentState:'REITs recovering in 2026 as rate-cut expectations grow. Data center REITs surging on AI demand. Monthly payers like O remain retirement staples.',
    topPick:'Realty Income (O) for the gold standard. Avoid office REITs entirely.',
    pros:['O: 30 years of consecutive dividend payments, 5.5% yield','Monthly payers: O, MAIN, STAG -- income every 30 days','Data center REITs surging in 2025-2026 on AI infrastructure demand'],
    cons:['Rising interest rates hurt REIT valuations','Office REITs remain structurally challenged post-COVID','Distributions often taxed as ordinary income'],
    allocation:'Income sleeve: 10-20% of portfolio. Focus on monthly payers.',
    bestFor:'Investors who want real asset backing for their income.',
  },
  {
    key:'bonds', icon:'&#127970;', title:'Bonds, Preferred Stocks & Treasuries',
    badge:'Safety First', badgeColor:'var(--gray)', color:'var(--gray)', bg:'var(--gray-lt)',
    yield:'4-7%', risk:'Low', payFreq:'Monthly/Semiannual', riskLevel:1,
    tickers:['SGOV','VCIT','PFFD','TLT','BND','AGG'],
    headline:'Best time to own bonds in over a decade -- SGOV paying 5.2% risk-free',
    why:'After a decade of near-zero rates, the Fed rate cycle has created genuine income opportunities. SGOV yields 5.2% with essentially zero risk.',
    currentState:'SGOV yielding 5.2% as of mid-2026. 10-year treasury hovering 4.3-4.6%. PFFD ETF paying 6.5% monthly from diversified preferred stocks.',
    topPick:'SGOV for risk-free yield. VCIT for investment-grade corporates. PFFD for preferred.',
    pros:['SGOV: 5.2% yield from 0-3M treasuries -- essentially risk-free, monthly income','Bond ladder: predictable income regardless of stock market','Treasury bond interest exempt from state and local taxes'],
    cons:['Rising rates hurt bond prices','Fixed income: no dividend growth, income stays flat as inflation rises','Corporate bonds carry credit risk'],
    allocation:'Stability sleeve: 15-25% of portfolio. Scale up as you approach retirement.',
    bestFor:'Capital preservation with income. Essential ballast for any retirement portfolio.',
  },
  {
    key:'energydividend', icon:'&#9889;', title:'Energy Dividends -- Oil Majors & Pipelines',
    badge:'4-6% Yields', badgeColor:'var(--amber)', color:'var(--amber)', bg:'var(--amber-lt)',
    yield:'4-7%', risk:'Medium', payFreq:'Quarterly', riskLevel:2,
    tickers:['CVX','XOM','ENB','EPD','ET','MPLX'],
    headline:'Steady cash flows from energy infrastructure that pay dividends regardless of oil price swings',
    why:'CVX has raised dividends 37 consecutive years. XOM 42 years. Pipeline companies earn fee-based income regardless of commodity prices.',
    currentState:'Energy sector down 12% YTD 2025 but CVX and XOM outperformed peers. Both raised dividends in 2025. Pipeline sector more stable.',
    topPick:'CVX for dividend growth and safety. ENB for highest yield. XOM for global scale.',
    pros:['CVX: 37 consecutive years of dividend increases, 4.1% yield','ENB: 6.8% yield, 29 years consecutive growth, pipeline toll model','Natural inflation hedge: energy prices historically rise with inflation'],
    cons:['Energy sector down 12% YTD 2025','Commodity price risk if oil falls below $60/barrel','Pipeline MLPs have complex K-1 tax forms'],
    allocation:'Income sleeve: 5-15% of portfolio. Focus on integrated majors and fee-based pipelines.',
    bestFor:'Investors who want inflation protection alongside income.',
  },
  {
    key:'mreits', icon:'&#127968;', title:'Mortgage REITs -- mREITs',
    badge:'13-14% Yields', badgeColor:'var(--red)', color:'var(--red)', bg:'var(--red-lt)',
    yield:'12-15%', risk:'High', payFreq:'Monthly', riskLevel:4,
    tickers:['AGNC','NLY','RITM','TWO','MFA'],
    headline:'The highest legal yield in public markets -- but comes with real complexity and risk',
    why:'mREITs borrow short-term at low rates and invest in long-term mortgage-backed securities at higher rates. AGNC allocates 89% to Agency MBS backed by Fannie Mae/Freddie Mac.',
    currentState:'AGNC affirmed $0.12/share monthly dividend for July 2026. Up 8.93% past month. Rate environment is the critical variable.',
    topPick:'AGNC for scale and government-backed portfolio. Size small -- 5-10% maximum.',
    pros:['AGNC: 13.1% yield, pays $0.12/share monthly, affirmed July 2026','89% Agency MBS -- government-backed, no default risk from individual mortgages','At current prices around $11.22, potentially trading below fair value'],
    cons:['Dividend has trended DOWN for over a decade','7.4x leverage: rising rates hit book value hard','Do NOT rely on this for fixed living expenses','Payout ratio 91% expected 2026 -- very high'],
    allocation:'Aggressive income sleeve: 5-10% maximum. Dollar-cost average. Hold in Roth IRA.',
    bestFor:'Investors with genuine risk tolerance who understand interest rate mechanics.',
  },
  {
    key:'cefs', icon:'&#128230;', title:'Closed-End Funds -- CEFs',
    badge:'10-20% Yields', badgeColor:'var(--purple)', color:'var(--purple)', bg:'var(--purple-lt)',
    yield:'8-18%', risk:'Medium-High', payFreq:'Monthly', riskLevel:3,
    tickers:['PDI','GOF','ECC','UTF','AWF','RQI'],
    headline:'Professionally managed funds that use leverage to generate outsized income -- buy at a discount',
    why:'CEFs trade at discounts to NAV, meaning you can buy $1.00 of assets for $0.90 and collect income on the full $1.00. Combined with leverage, CEFs can yield 10-18%.',
    currentState:'CEF environment improving in 2026 as yield curve steepens. PIMCO funds remain best-in-class. Many still trading at discounts to NAV.',
    topPick:'PDI (PIMCO Dynamic Income) for best-in-class bond management. UTF for infrastructure.',
    pros:['Can buy at discount to NAV -- structural advantage not available in ETFs','PDI (PIMCO): managed by world-class bond team, 11%+ yield','Monthly distributions: most major CEFs pay monthly'],
    cons:['Leverage magnifies losses during stress','Distribution cuts happen -- check if yield is return of capital','CLM (Cornerstone): 18% yield but NAV declining 6.8%/yr -- a trap','Higher expense ratios than ETFs (often 1.5-2.5% including leverage)'],
    allocation:'Aggressive income sleeve: 10-15% maximum. Spread across 2-3 different managers.',
    bestFor:'Investors willing to research beyond the yield number. Monitor coverage ratios annually.',
  },
  {
    key:'preferredstocks', icon:'&#11088;', title:'Individual Preferred Stocks',
    badge:'6-8% Fixed', badgeColor:'var(--blue)', color:'var(--blue)', bg:'var(--blue-lt)',
    yield:'6-9%', risk:'Medium', payFreq:'Quarterly/Monthly', riskLevel:2,
    tickers:['BAC-PL','JPM-PC','WFC-PZ','USB-PH','PFFD','PFF'],
    headline:'Fixed-rate income from the biggest banks in America -- senior to common stock',
    why:'Preferred stocks pay a fixed dividend and trade on the stock exchange. Big bank preferred stocks (BofA, JPMorgan, Wells Fargo) pay 6-8% fixed with institutional stability behind them.',
    currentState:'Many big bank preferred stocks trading at or below $25 par in mid-2026. PFFD ETF yielding 6.5% monthly. Good entry point.',
    topPick:'PFFD ETF for simplicity. For individual issues, focus on BAC, JPM, WFC, USB.',
    pros:['Fixed dividend: predictable income that does not fluctuate like covered calls','Priority over common shareholders','Big bank issuers: among the safest corporate issuers in the world','Many trading at or below $25 par -- potential price appreciation if rates fall'],
    cons:['Callable: company can redeem at $25, capping upside','Rate sensitive: preferred prices drop when rates rise','Non-cumulative preferred can skip dividends with no obligation to catch up'],
    allocation:'Income sleeve: 5-15% of portfolio. PFFD or PFF ETFs for diversification.',
    bestFor:'Investors who want bond-like income stability with slightly higher yield than bonds.',
  },
  {
    key:'growthplusyield', icon:'&#128640;', title:'Growth + Yield -- The Aggressive Income Builder',
    badge:'Total Return', badgeColor:'var(--amber)', color:'var(--amber)', bg:'var(--amber-lt)',
    yield:'2-5% + capital gains', risk:'Medium-High', payFreq:'Quarterly', riskLevel:3,
    tickers:['MP','CEG','RTX','MSFT','COST','VYM','VIG','DGRO'],
    headline:'Accept lower current yield in exchange for higher total return -- income that doubles in 7 years',
    why:'CEG (Constellation Energy) is up 55% YTD 2025 while paying a growing dividend. MP Materials up 85% YTD. RTX up 18% YTD. The dividend starts low but total return significantly outperforms static high-yield over 7-10 years.',
    currentState:'VYM leading VIG 13% to 9% in 2026 YTD. Defense, nuclear energy, and critical minerals creating multi-year compounding opportunities.',
    topPick:'CEG for nuclear energy renaissance. RTX for defense compounding. VYM for diversified high-yield.',
    pros:['CEG (Constellation Energy): up 55% YTD 2025 on nuclear/AI data center demand','MP Materials: up 85% YTD 2025 on critical minerals demand','RTX (Raytheon): up 18% YTD 2025 as global defense spending surges','VYM led VIG 13% to 9% in 2026 YTD returns'],
    cons:['Low current income -- 2-3% yield means $1,000/yr per $50,000 invested today','Requires patience -- compounding takes years to produce meaningful income','Stock market risk: growth stocks can fall 30-50% in downturns'],
    allocation:'Growth sleeve: 20-30% of portfolio for investors with 5+ year horizon.',
    bestFor:'Investors with 5+ years before needing full income. Also for managing a parent portfolio.',
  },
];

// ── MACRO INDICATORS ──────────────────────────────────────────────────────────
const MACRO_SERIES = [
  {id:'FEDFUNDS',   label:'Fed Funds Rate',   unit:'%', icon:'&#127970;', important:true},
  {id:'CPIAUCSL',   label:'CPI Inflation',    unit:'%', icon:'&#128200;', important:true},
  {id:'UNRATE',     label:'Unemployment',     unit:'%', icon:'&#128101;', important:false},
  {id:'DGS10',      label:'10-Yr Treasury',   unit:'%', icon:'&#128196;', important:true},
  {id:'DGS2',       label:'2-Yr Treasury',    unit:'%', icon:'&#128196;', important:false},
  {id:'DGS30',      label:'30-Yr Treasury',   unit:'%', icon:'&#128196;', important:false},
  {id:'T10Y2Y',     label:'Yield Curve',      unit:'%', icon:'&#128201;', important:true},
  {id:'DTWEXBGS',   label:'US Dollar Index',  unit:'',  icon:'&#128178;', important:false},
  {id:'MORTGAGE30US',label:'30-Yr Mortgage',  unit:'%', icon:'&#127968;', important:false},
];

// ── EXPORT for use in page scripts ────────────────────────────────────────────
window.DQ = {
  CONFIG, DEMO_PROFILE, MODEL_HOLDINGS, State, STRATEGIES, SCREENER,
  SECTOR_ETFS, MACRO_SERIES, AI_SYSTEM,
  fmt, fmtK, sfx, pct, dateStr, scoreColor,
  calcPortfolio, calcScore, projectIncome,
  fetchQuote, fetchMarketNews, fetchFredSeries, callClaude,
  $, $$, el, showToast, spinner,
  buildNav, buildBottomNav, buildScoreRing, disclaimerHTML, isProUser, proGateHTML,
};
