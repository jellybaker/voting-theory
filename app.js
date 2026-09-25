/**
 * App.js — Rig the Vote! Narrative Engine
 * 
 * Loads voter CSV, orchestrates the demo flow, renders results.
 */

// ============================================================
//  CANDIDATE DATA
// ============================================================
const CANDIDATES = {
  butter_chicken: { name: 'Butter Chicken', emoji: '🍛', spiciness: 0.4, creaminess: 0.9, sweetness: 0.2, crunchiness: 0.1, richness: 0.9 },
  pad_thai:       { name: 'Pad Thai',       emoji: '🍜', spiciness: 0.6, creaminess: 0.2, sweetness: 0.5, crunchiness: 0.7, richness: 0.5 },
  pizza:          { name: 'Margherita Pizza',emoji: '🍕', spiciness: 0.1, creaminess: 0.6, sweetness: 0.3, crunchiness: 0.5, richness: 0.7 },
  sushi:          { name: 'Sushi Roll',      emoji: '🍣', spiciness: 0.2, creaminess: 0.1, sweetness: 0.3, crunchiness: 0.4, richness: 0.3 },
  tacos:          { name: 'Tacos',           emoji: '🌮', spiciness: 0.8, creaminess: 0.3, sweetness: 0.1, crunchiness: 0.8, richness: 0.6 },
};

const CANDIDATE_IDS = ['butter_chicken', 'pad_thai', 'pizza', 'sushi', 'tacos'];
const ATTRIBUTES = ['spiciness', 'creaminess', 'sweetness', 'crunchiness', 'richness'];
const BEST = 'pizza';
const WORST = 'sushi';

const CANDIDATE_COLORS = {
  butter_chicken: 'var(--color-butter-chicken)',
  pad_thai:       'var(--color-pad-thai)',
  pizza:          'var(--color-pizza)',
  sushi:          'var(--color-sushi)',
  tacos:          'var(--color-tacos)',
};

// ============================================================
//  ROUND DEFINITIONS
// ============================================================
const ROUNDS = [
  {
    id: 'plurality',
    title: '1. Plurality Voting',
    rule: 'Everyone votes for their ONE favorite. The candidate with the most votes wins. Simple — but is it fair?',
    systemFn: (ballots) => VotingSystems.plurality(ballots, CANDIDATE_IDS),
    rigFn: (ballots, str) => Rigger.rigPlurality(ballots, str, CANDIDATE_IDS),
    defaultStrength: 20,
    protest: "That's so unfair! A spoiler stole the election! Let's use a system that considers RANKINGS instead of just first choice.",
    nextSuggestion: 'Borda Count',
  },
  {
    id: 'borda',
    title: '2. Borda Count',
    rule: 'Rank all 5 candidates. 1st place = 4 points, 2nd = 3, 3rd = 2, 4th = 1, last = 0. Highest total score wins.',
    systemFn: (ballots) => VotingSystems.bordaCount(ballots, CANDIDATE_IDS),
    rigFn: (ballots, str) => Rigger.rigBorda(ballots, str, CANDIDATE_IDS),
    defaultStrength: 25,
    protest: "They BURIED our candidate! People lied about their rankings! We need a system where you can't game it by lying.",
    nextSuggestion: 'Ranked Choice (Instant Runoff)',
  },
  {
    id: 'irv',
    title: '3. Ranked Choice (Instant Runoff)',
    rule: 'Rank all candidates. Each round, the one with the fewest 1st-place votes is eliminated and their votes transfer to the next choice. Last one standing wins.',
    systemFn: (ballots) => VotingSystems.instantRunoff(ballots, CANDIDATE_IDS),
    rigFn: (ballots, str) => Rigger.rigIRV(ballots, str, CANDIDATE_IDS),
    defaultStrength: 15,
    protest: "WHAT?! Getting MORE votes made our candidate LOSE?! That's absurd! Let's do simple head-to-head matchups instead.",
    nextSuggestion: 'Head-to-Head Duels (Condorcet)',
  },
  {
    id: 'pairwise',
    title: '4. Head-to-Head Duels (Condorcet)',
    rule: 'Candidates face off in pairs. The winner of each duel advances to face the next challenger. The order of matchups (the "agenda") determines who faces whom first.',
    systemFn: (ballots) => {
      // Honest: use a natural agenda order
      const agenda = ['sushi', 'tacos', 'pad_thai', 'butter_chicken', 'pizza'];
      return VotingSystems.pairwiseAgenda(ballots, CANDIDATE_IDS, agenda);
    },
    rigFn: (ballots, str) => {
      const result = Rigger.rigPairwise(ballots, str, CANDIDATE_IDS);
      return result;
    },
    defaultStrength: 25,
    protest: null, // Last round — goes to Arrow's theorem
    nextSuggestion: null,
  },
];

const STEP_LABELS = ['Plurality', 'Borda', 'IRV', 'Pairwise', 'Arrow\'s'];

// ============================================================
//  STATE
// ============================================================
let voters = [];       // parsed from CSV
let ballots = [];      // derived from voters
let currentRound = -1; // -1 = not started
let phase = 'idle';    // idle, honest-done, rigged-done, protest-shown

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  renderCandidateCards();
  renderStepsBar();
  await loadVoters();
});

// ============================================================
//  CSV LOADING
// ============================================================
async function loadVoters() {
  try {
    const response = await fetch('voters.csv');
    const text = await response.text();
    parseCSV(text);
    renderVoterStats();
  } catch (e) {
    console.error('Failed to load voters.csv:', e);
    // Show error in narrative panel
    document.getElementById('intro-screen').innerHTML = `
      <div class="intro-emoji">⚠️</div>
      <div class="intro-title">voters.csv not found</div>
      <div class="intro-desc">
        Run <code style="background:rgba(255,255,255,0.1);padding:0.2rem 0.5rem;border-radius:4px;">python generate_voters.py</code> first to create the voter data file, then refresh this page.
      </div>
    `;
  }
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  voters = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    const voter = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j].trim();
      const val = vals[j].trim();
      // Parse numeric fields
      if (key.startsWith('w_') || key.startsWith('u_') || key === 'voter_id') {
        voter[key] = parseFloat(val);
      } else {
        voter[key] = val;
      }
    }
    voters.push(voter);
  }
  // Build ballots from rankings
  ballots = voters.map(v => ({
    voterId: v.voter_id,
    ranking: [v.rank_1, v.rank_2, v.rank_3, v.rank_4, v.rank_5],
  }));
}

// ============================================================
//  RENDER: CANDIDATE CARDS
// ============================================================
function renderCandidateCards() {
  const grid = document.getElementById('candidate-grid');
  grid.innerHTML = '';
  for (const id of CANDIDATE_IDS) {
    const c = CANDIDATES[id];
    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.style.setProperty('--card-accent', CANDIDATE_COLORS[id]);

    let badge = '';
    if (id === BEST) badge = '<span class="badge badge--best">👑 Crowd Favorite</span>';
    if (id === WORST) badge = '<span class="badge badge--worst">🎯 Rigger\'s Pick</span>';

    card.innerHTML = `
      <span class="emoji">${c.emoji}</span>
      <div class="name">${c.name}</div>
      ${badge}
      <ul class="attr-list">
        ${ATTRIBUTES.map(attr => `
          <li class="attr-item">
            <span class="attr-label">${attr}</span>
            <div class="attr-bar-track">
              <div class="attr-bar-fill" style="width: ${c[attr] * 100}%"></div>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
    grid.appendChild(card);
  }
}

// ============================================================
//  RENDER: VOTER STATS
// ============================================================
function renderVoterStats() {
  if (voters.length === 0) return;
  const section = document.getElementById('voter-stats-section');
  section.classList.remove('hidden');
  const container = document.getElementById('voter-stats');

  // Count first-choice distribution
  const firstChoice = {};
  for (const id of CANDIDATE_IDS) firstChoice[id] = 0;
  for (const b of ballots) {
    if (b.ranking[0]) firstChoice[b.ranking[0]]++;
  }

  container.innerHTML = CANDIDATE_IDS.map(id => `
    <div class="voter-stat">
      <div class="stat-value" style="color: ${CANDIDATE_COLORS[id]}">${firstChoice[id]}</div>
      <div class="stat-label">${CANDIDATES[id].emoji} ${CANDIDATES[id].name}</div>
    </div>
  `).join('');
}

// ============================================================
//  RENDER: STEPS BAR
// ============================================================
function renderStepsBar() {
  const bar = document.getElementById('steps-bar');
  bar.innerHTML = '';
  for (let i = 0; i < STEP_LABELS.length; i++) {
    const item = document.createElement('div');
    item.className = 'step-item';
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    dot.id = `step-${i}`;
    dot.textContent = i + 1;
    const label = document.createElement('span');
    label.className = 'step-label';
    label.textContent = STEP_LABELS[i];
    dot.appendChild(label);
    item.appendChild(dot);
    if (i < STEP_LABELS.length - 1) {
      const conn = document.createElement('div');
      conn.className = 'step-connector';
      conn.id = `conn-${i}`;
      item.appendChild(conn);
    }
    bar.appendChild(item);
  }
}

function updateStepsBar() {
  for (let i = 0; i < STEP_LABELS.length; i++) {
    const dot = document.getElementById(`step-${i}`);
    dot.classList.remove('active', 'done');
    if (i < currentRound) {
      dot.classList.add('done');
      dot.textContent = '✓';
      // re-add the label
      if (!dot.querySelector('.step-label')) {
        const label = document.createElement('span');
        label.className = 'step-label';
        label.textContent = STEP_LABELS[i];
        dot.appendChild(label);
      }
    } else if (i === currentRound) {
      dot.classList.add('active');
    }
    if (i < STEP_LABELS.length - 1) {
      const conn = document.getElementById(`conn-${i}`);
      conn.classList.toggle('done', i < currentRound);
    }
  }
}

// ============================================================
//  RENDER: BAR CHART
// ============================================================
function renderBarChart(data, winnerId, type = 'votes') {
  // data: { candidateId: value, ... }
  const maxVal = Math.max(...Object.values(data), 1);
  const label = type === 'votes' ? 'votes' : 'pts';

  return `<div class="bar-chart">
    ${CANDIDATE_IDS.filter(id => data[id] !== undefined).map(id => {
      const val = data[id];
      const pct = (val / maxVal) * 100;
      const isWinner = id === winnerId;
      return `
        <div class="bar-row">
          <div class="bar-label">
            <span class="bar-emoji">${CANDIDATES[id].emoji}</span>
            ${CANDIDATES[id].name}
          </div>
          <div class="bar-track">
            <div class="bar-fill ${isWinner ? 'winner' : ''}" 
                 style="width: ${pct}%; background: ${CANDIDATE_COLORS[id]}; --bar-color: ${CANDIDATE_COLORS[id]}"></div>
          </div>
          <div class="bar-value ${isWinner ? 'winner-value' : ''}">${val} ${label}</div>
        </div>`;
    }).join('')}
  </div>`;
}

// ============================================================
//  RENDER: IRV ROUNDS
// ============================================================
function renderIRVResult(result) {
  let html = '<div class="irv-rounds">';
  result.rounds.forEach((round, idx) => {
    const maxVal = Math.max(...Object.values(round.tally), 1);
    html += `<div class="irv-round" style="animation-delay: ${idx * 0.15}s">
      <div class="irv-round__title">Round ${idx + 1}</div>
      <div class="bar-chart">
        ${round.remaining.map(id => {
          const val = round.tally[id];
          const pct = (val / maxVal) * 100;
          const isWinner = idx === result.rounds.length - 1 && id === result.winner;
          return `
            <div class="bar-row">
              <div class="bar-label">
                <span class="bar-emoji">${CANDIDATES[id].emoji}</span>
                ${CANDIDATES[id].name}
              </div>
              <div class="bar-track">
                <div class="bar-fill ${isWinner ? 'winner' : ''}" 
                     style="width: ${pct}%; background: ${CANDIDATE_COLORS[id]}; --bar-color: ${CANDIDATE_COLORS[id]}"></div>
              </div>
              <div class="bar-value ${isWinner ? 'winner-value' : ''}">${val}</div>
            </div>`;
        }).join('')}
      </div>
      ${round.eliminated ? `<div class="irv-eliminated">❌ ${CANDIDATES[round.eliminated].emoji} ${CANDIDATES[round.eliminated].name} is eliminated</div>` : ''}
    </div>`;
  });
  html += '</div>';
  return html;
}

// ============================================================
//  RENDER: PAIRWISE DUELS
// ============================================================
function renderPairwiseResult(result) {
  let html = '<div class="duel-list">';
  result.duels.forEach((duel, idx) => {
    const aIsWinner = duel.winner === duel.a;
    html += `
      <div class="duel-match" style="animation-delay: ${idx * 0.15}s">
        <span class="fighter ${!aIsWinner ? 'loser' : ''}">${CANDIDATES[duel.a].emoji} ${CANDIDATES[duel.a].name}</span>
        <span class="vs">vs</span>
        <span class="fighter ${aIsWinner ? 'loser' : ''}">${CANDIDATES[duel.b].emoji} ${CANDIDATES[duel.b].name}</span>
        <span class="score">${duel.aVotes} – ${duel.bVotes}</span>
      </div>`;
  });
  html += '</div>';
  return html;
}

// ============================================================
//  RENDER: WINNER BANNER
// ============================================================
function renderWinnerBanner(winnerId, isGood) {
  const c = CANDIDATES[winnerId];
  return `
    <div class="winner-banner ${isGood ? 'winner-banner--good' : 'winner-banner--bad'}">
      <span style="font-size:1.5rem">${isGood ? '🎉' : '😈'}</span>
      <span>Winner: ${c.emoji} ${c.name}${isGood ? ' — The people\'s choice!' : ' — The rigger wins!'}</span>
    </div>`;
}

// ============================================================
//  DEMO FLOW
// ============================================================
function showButtons(...ids) {
  ['btn-start', 'btn-honest', 'btn-rig', 'btn-next', 'btn-restart'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  ids.forEach(id => document.getElementById(id).classList.remove('hidden'));
}

function getStrength() {
  return parseInt(document.getElementById('strength-slider').value, 10);
}

// --- Strength slider live update ---
document.getElementById('strength-slider').addEventListener('input', (e) => {
  document.getElementById('strength-value').textContent = e.target.value;
});

// --- Start the demo ---
function startDemo() {
  if (voters.length === 0) {
    alert('Voter data not loaded. Make sure voters.csv exists.');
    return;
  }
  currentRound = 0;
  phase = 'idle';
  updateStepsBar();
  showRoundIntro();
  showButtons('btn-honest');
  // Set default strength for this round
  const defaultStr = ROUNDS[currentRound].defaultStrength;
  document.getElementById('strength-slider').value = defaultStr;
  document.getElementById('strength-value').textContent = defaultStr;
}

function showRoundIntro() {
  const round = ROUNDS[currentRound];
  const panel = document.getElementById('narrative-panel');
  panel.innerHTML = `
    <div class="fade-enter">
      <div class="round-title">${round.title}</div>
      <div class="round-rule">${round.rule}</div>
      <div id="election-results"></div>
    </div>
  `;
}

// --- Run honest election ---
function runHonest() {
  const round = ROUNDS[currentRound];
  const result = round.systemFn(ballots);
  const container = document.getElementById('election-results');

  let chartHtml;
  if (round.id === 'plurality') {
    chartHtml = renderBarChart(result.tally, result.winner, 'votes');
  } else if (round.id === 'borda') {
    chartHtml = renderBarChart(result.scores, result.winner, 'points');
  } else if (round.id === 'irv') {
    chartHtml = renderIRVResult(result);
  } else if (round.id === 'pairwise') {
    chartHtml = renderPairwiseResult(result);
  }

  container.innerHTML = `
    <div class="election-block election-block--honest fade-enter">
      <div class="election-block__header">
        <span class="tag tag--honest">Honest</span>
        Honest Election
      </div>
      ${chartHtml}
      ${renderWinnerBanner(result.winner, result.winner === BEST)}
    </div>
  `;

  phase = 'honest-done';
  showButtons('btn-rig');
}

// --- Run rigged election ---
function runRigged() {
  const round = ROUNDS[currentRound];
  const strength = getStrength();
  const rigResult = round.rigFn(ballots, strength);
  const riggedBallots = rigResult.riggedBallots;

  let result;
  if (round.id === 'pairwise') {
    // For pairwise, the rigger also controls the agenda
    const winningAgenda = VotingSystems.findWinningAgenda(riggedBallots, CANDIDATE_IDS, WORST);
    if (winningAgenda) {
      result = VotingSystems.pairwiseAgenda(riggedBallots, CANDIDATE_IDS, winningAgenda);
    } else {
      // If no winning agenda, just use default
      result = VotingSystems.pairwiseAgenda(riggedBallots, CANDIDATE_IDS, ['sushi', 'tacos', 'pad_thai', 'butter_chicken', 'pizza']);
    }
  } else {
    result = round.systemFn(riggedBallots);
  }

  let chartHtml;
  if (round.id === 'plurality') {
    chartHtml = renderBarChart(result.tally, result.winner, 'votes');
  } else if (round.id === 'borda') {
    chartHtml = renderBarChart(result.scores, result.winner, 'points');
  } else if (round.id === 'irv') {
    chartHtml = renderIRVResult(result);
  } else if (round.id === 'pairwise') {
    chartHtml = renderPairwiseResult(result);
  }

  const container = document.getElementById('election-results');
  const rigBlock = document.createElement('div');
  rigBlock.innerHTML = `
    <div class="rigger-narrative fade-enter">
      <strong>🕵️ The Rigger Strikes!</strong> (Strength: ${strength} voters manipulated)<br>
      ${rigResult.description}
      <div class="flaw-tag">⚡ Flaw: ${rigResult.flawName}</div>
    </div>
    <div class="election-block election-block--rigged fade-enter" style="animation-delay: 0.2s">
      <div class="election-block__header">
        <span class="tag tag--rigged">Rigged</span>
        Rigged Election
      </div>
      ${chartHtml}
      ${renderWinnerBanner(result.winner, result.winner === BEST)}
    </div>
  `;
  container.appendChild(rigBlock);

  phase = 'rigged-done';
  
  if (currentRound < ROUNDS.length - 1) {
    showButtons('btn-next');
  } else {
    // Last round — show Arrow button
    showButtons('btn-next');
    document.getElementById('btn-next').textContent = '🏛️ Arrow\'s Theorem';
  }
}

// --- Next round ---
function nextRound() {
  if (currentRound >= ROUNDS.length - 1) {
    // Show Arrow's theorem
    showArrowFinale();
    return;
  }

  // Show protest first
  const round = ROUNDS[currentRound];
  if (phase === 'rigged-done' && round.protest) {
    const container = document.getElementById('election-results');
    const protestEl = document.createElement('div');
    protestEl.innerHTML = `
      <div class="protest-banner">
        <span class="protest-emoji">😤🪧</span>
        <div class="protest-text">"${round.protest}"</div>
        <div class="protest-suggestion">The voters demand: <strong>${round.nextSuggestion}</strong></div>
      </div>
    `;
    container.appendChild(protestEl);

    // After a brief pause, advance
    setTimeout(() => {
      currentRound++;
      updateStepsBar();
      showRoundIntro();
      phase = 'idle';
      showButtons('btn-honest');
      // Set default strength
      const defaultStr = ROUNDS[currentRound].defaultStrength;
      document.getElementById('strength-slider').value = defaultStr;
      document.getElementById('strength-value').textContent = defaultStr;
    }, 1800);
    showButtons(); // hide all buttons during transition
    return;
  }

  currentRound++;
  updateStepsBar();
  showRoundIntro();
  phase = 'idle';
  showButtons('btn-honest');
  const defaultStr = ROUNDS[currentRound].defaultStrength;
  document.getElementById('strength-slider').value = defaultStr;
  document.getElementById('strength-value').textContent = defaultStr;
}

// --- Arrow's Theorem Finale ---
function showArrowFinale() {
  currentRound = ROUNDS.length; // step 5 (index 4)
  updateStepsBar();

  const panel = document.getElementById('narrative-panel');
  panel.innerHTML = `
    <div class="arrow-finale fade-enter">
      <div class="arrow-title">🏛️ Arrow's Impossibility Theorem</div>
      <p style="color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.7; font-size: 0.95rem;">
        The voters kept switching systems and the rigger kept winning.<br>
        In <strong style="color: var(--text-primary);">1951</strong>, mathematician 
        <strong style="color: var(--text-primary);">Kenneth Arrow</strong> proved this is <em>no accident</em>.<br>
        With 3 or more candidates, <strong style="color: var(--accent-warn);">no ranked voting system</strong> can satisfy ALL of these fair rules at once:
      </p>

      <div class="arrow-rules">
        <div class="arrow-rule">
          <div class="rule-number">1</div>
          <div class="rule-name">Free Choice</div>
          <div class="rule-desc">Voters may rank the candidates in any order they want.</div>
        </div>
        <div class="arrow-rule">
          <div class="rule-number">2</div>
          <div class="rule-name">Unanimity</div>
          <div class="rule-desc">If EVERYONE prefers Pizza to Sushi, then Sushi cannot win.</div>
        </div>
        <div class="arrow-rule">
          <div class="rule-number">3</div>
          <div class="rule-name">Independence (IIA)</div>
          <div class="rule-desc">The Pizza vs. Sushi result should depend ONLY on how voters rank Pizza vs. Sushi — not on how they rank Tacos.</div>
        </div>
        <div class="arrow-rule">
          <div class="rule-number">4</div>
          <div class="rule-name">No Dictator</div>
          <div class="rule-desc">No single voter's ranking should always determine the outcome.</div>
        </div>
      </div>

      <div class="election-block election-block--arrow" style="text-align:left;">
        <div class="election-block__header">
          <span class="tag tag--arrow">Recap</span>
          What broke in our demo
        </div>
        <div class="arrow-breakdown">
          <div class="arrow-breakdown__item">
            <span class="arrow-breakdown__system">🗳️ Plurality</span>
            <span class="arrow-breakdown__flaw">Rule 3 broken — adding Pad Thai as a spoiler flipped Pizza vs. Sushi, even though nobody's Pizza-vs-Sushi preference changed.</span>
          </div>
          <div class="arrow-breakdown__item">
            <span class="arrow-breakdown__system">🔢 Borda Count</span>
            <span class="arrow-breakdown__flaw">Rule 3 broken — moving Pizza to last place dishonestly changed the winner, even though those voters' Sushi-vs-Pizza opinion didn't change.</span>
          </div>
          <div class="arrow-breakdown__item">
            <span class="arrow-breakdown__system">🔄 IRV</span>
            <span class="arrow-breakdown__flaw">Rule 3 broken + non-monotonicity — more support for Pizza paradoxically made it lose by changing the elimination order.</span>
          </div>
          <div class="arrow-breakdown__item">
            <span class="arrow-breakdown__system">⚔️ Pairwise</span>
            <span class="arrow-breakdown__flaw">Condorcet cycles make every candidate beatable — whoever controls the duel order picks the winner.</span>
          </div>
        </div>
      </div>

      <div class="arrow-conclusion">
        <strong>Every voting system has a weak spot.</strong><br>
        Arrow's theorem doesn't say democracy is hopeless — it says we must be <em>aware</em> of tradeoffs 
        and guard against manipulation. The only system that satisfies rules 1–3 is a <strong>dictatorship</strong> — 
        which obviously fails rule 4.<br><br>
        <span style="font-size: 1.2rem;">🎓</span> <em>Know your system's weakness, and protect it.</em>
      </div>
    </div>
  `;

  showButtons('btn-restart');
}

// --- Restart ---
function restartDemo() {
  currentRound = -1;
  phase = 'idle';
  updateStepsBar();
  showButtons('btn-start');
  const panel = document.getElementById('narrative-panel');
  panel.innerHTML = `
    <div class="intro-screen fade-enter">
      <div class="intro-emoji">🗳️</div>
      <div class="intro-title">Welcome to the Election!</div>
      <div class="intro-desc">
        100 voters are choosing their favorite dish. <strong>Margherita Pizza</strong> is the crowd favorite 🍕 —
        but a sneaky rigger wants <strong>Sushi Roll</strong> 🍣 to win.<br><br>
        Can they exploit the voting system? Let's find out!
      </div>
    </div>
  `;
  // Reset steps
  for (let i = 0; i < STEP_LABELS.length; i++) {
    const dot = document.getElementById(`step-${i}`);
    dot.classList.remove('active', 'done');
    dot.textContent = i + 1;
  }
}
