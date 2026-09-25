# 🗳️ Rig the Vote! — Voting Theory Interactive Demo

An interactive educational demonstration designed for elementary/high school students to explore the flaws in different voting systems and understand **Arrow's Impossibility Theorem** through a storytelling experience.

---

## 📖 Context & Story

The election features **5 food candidates** and **100 simulated voters**:

- 🍕 **Margherita Pizza** (Crowd Favorite — natural winner under honest voting)
- 🍣 **Sushi Roll** (Rigger's Pick — naturally unpopular choice)
- 🍛 **Butter Chicken**
- 🍜 **Pad Thai**
- 🌮 **Tacos**

A sneaky **Rigger** exploits structural flaws in each voting system to make **Sushi Roll** win:
1. **Plurality Voting**: Exploited via **Vote Splitting (Spoiler Effect)**.
2. **Borda Count**: Exploited via **Burying (Dishonest Ranking)**.
3. **Ranked Choice (Instant Runoff)**: Exploited via **Strategic Voting & Non-Monotonicity**.
4. **Head-to-Head Duels (Condorcet)**: Exploited via **Condorcet Cycles & Agenda Control**.

After each round, agitated voters stage a protest and demand a "fairer" voting system — which the rigger promptly manipulates again. The demo culminates in **Arrow's Impossibility Theorem (1951)**, proving mathematically that no ranked voting system can satisfy all basic fairness criteria simultaneously.

---

## 🚀 Quick Start

### 1. Generate Voter Data
```bash
python generate_voters.py
```
This generates `voters.csv` (100 voters) using a spatial ideal-point preference model where voter utilities are derived from multi-dimensional attribute distances (spiciness, creaminess, sweetness, crunchiness, richness).

### 2. Launch Local Web App
```bash
python -m http.server 8080
```
Open **`http://localhost:8080`** in any modern web browser to run the interactive demo.

---

## 🛠️ Project Structure

```
├── generate_voters.py # Generates 100 voters & outputs voters.csv
├── voters.csv         # Standardized voter dataset (100 rows)
├── voting_systems.js  # Pure JavaScript implementations of voting algorithms
├── rigger.js          # Pure JavaScript rigging strategies
├── app.js             # Narrative engine, state management, & UI rendering
├── index.html         # Web application layout & structure
└── styles.css         # Dark-mode glassmorphism design system
```

---

## 🏛️ Mathematical Overview: Arrow's Impossibility Theorem

Formulated by Nobel laureate **Kenneth Arrow** in 1951, the theorem proves that when voters have three or more options, **no ranked voting system** can simultaneously satisfy all four of these criteria:

1. **Unrestricted Domain (Free Choice)**: Voters can rank candidates in any order.
2. **Pareto Efficiency (Unanimity)**: If every voter prefers A over B, B cannot win.
3. **Independence of Irrelevant Alternatives (IIA)**: The relative ranking of A vs. B depends *only* on voter preferences between A and B, unaffected by candidate C.
4. **Non-Dictatorship**: No single voter's preferences dictate the societal outcome.

The only system satisfying criteria 1–3 is a **dictatorship** (which fails criterion 4).

---

## 👥 Educational Target Audience
Designed for interactive foundation day demos, workshops, and classroom presentations for students in elementary, middle, and high school.
