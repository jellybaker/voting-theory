#!/usr/bin/env python3
"""
Rig the Vote! A classroom demo of voting-system flaws and Arrow's theorem.

Cast: Ava (G) = best for the voters, Rex (W) = the rigger's pick, Bo (O) = third candidate.
A ballot group is (number_of_voters, ranking) with ranking best->worst, e.g. (55, "GOW").

Usage:
  python rig_the_vote.py                       # full story, all rounds
  python rig_the_vote.py --round 3             # one round only
  python rig_the_vote.py --round 1 --strength 5            # weaker rigger -> trick fails
  python rig_the_vote.py --round 2 --voters 25,35,30       # change group sizes
  python rig_the_vote.py --no-pause            # don't wait for Enter between rounds
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from itertools import permutations
from typing import Callable

NAMES = {"G": "Ava", "W": "Rex", "O": "Bo"}
CANDS = ["G", "W", "O"]
Groups = list  # list of (n, ranking)


# ------------------------------------------------------------------ helpers
def tally_first(groups: Groups, alive: list[str]) -> dict[str, int]:
    t = {c: 0 for c in alive}
    for n, r in groups:
        t[next(c for c in r if c in alive)] += n
    return t


def argmax(t: dict[str, int]) -> str:
    return max(t, key=t.get)  # first one wins ties


def bars(t: dict[str, int], width: int = 30) -> list[str]:
    m = max(t.values()) or 1
    return [f"   {NAMES[c]:<4} {'#' * round(v / m * width):<{width}} {v}" for c, v in t.items()]


def rank_str(r: str) -> str:
    return " > ".join(NAMES[c] for c in r)


@dataclass
class Result:
    winner: str
    lines: list[str]


# ------------------------------------------------------------ voting systems
class VotingSystem:
    title = rule = ""

    def run(self, groups: Groups) -> Result:
        raise NotImplementedError


class Plurality(VotingSystem):
    title = "1. Plurality"
    rule = "Everyone votes for ONE candidate. Most votes wins."

    def run(self, groups):
        t = tally_first(groups, CANDS)
        return Result(argmax(t), bars(t))


class Borda(VotingSystem):
    title = "2. Borda Count"
    rule = "Rank everyone: 1st = 2 points, 2nd = 1, last = 0. Most points wins."

    def run(self, groups):
        t = {c: 0 for c in CANDS}
        for n, r in groups:
            for i, c in enumerate(r):
                t[c] += n * (len(r) - 1 - i)
        return Result(argmax(t), bars(t))


class InstantRunoff(VotingSystem):
    title = "3. Ranked Choice (Instant Runoff)"
    rule = ("Rank everyone. Fewest 1st-place votes is knocked out and those ballots move "
            "to their next choice. Repeat.")

    def run(self, groups):
        alive, lines, rnd = list(CANDS), [], 1
        while True:
            t = tally_first(groups, alive)
            lines += [f"  Round {rnd}:"] + bars(t)
            if len(alive) == 2:
                return Result(argmax(t), lines)
            lo = min(alive, key=t.get)
            lines.append(f"   -> {NAMES[lo]} is knocked out")
            alive.remove(lo)
            rnd += 1


class AgendaPairwise(VotingSystem):
    title = "4. Head-to-Head duels (Condorcet-style)"
    rule = "Candidates duel two at a time; the winner faces the next. The 'agenda' sets the order."

    def __init__(self, agenda: str = "OWG"):
        self.agenda = agenda

    @staticmethod
    def duel(groups, a, b):
        x = sum(n for n, r in groups if r.index(a) < r.index(b))
        y = sum(n for n, _ in groups) - x
        return (a, x, y) if x > y else (b, y, x)

    def run(self, groups):
        w, lines = self.agenda[0], []
        for c in self.agenda[1:]:
            win, p, q = self.duel(groups, w, c)
            lines.append(f"   {NAMES[w]} vs {NAMES[c]}: {NAMES[win]} wins {p}-{q}")
            w = win
        return Result(w, lines)


class Dictator(VotingSystem):
    """Only used in the Arrow finale: the top choice of voter group `i` always wins."""

    def __init__(self, i: int):
        self.i = i

    def run(self, groups):
        return Result(groups[self.i][1][0], [])


# ---------------------------------------------------------------- scenarios
def best_agenda(groups: Groups) -> AgendaPairwise:
    """The rigger tries every duel order and picks one that makes Rex win."""
    for p in permutations("GWO"):
        s = AgendaPairwise("".join(p))
        if s.run(groups).winner == "W":
            return s
    return AgendaPairwise()


@dataclass
class Scenario:
    system: type
    honest: Groups                          # honest voters
    k: int                                  # default rigger strength
    src: int                                # index of the group the rigger works on
    what_k_means: str
    rig: Callable[[Groups, int], Groups]    # rigger's move
    move: Callable[[int], str]              # story text
    flaw: str
    make: Callable[[Groups, bool], VotingSystem]


SCENARIOS = [
    Scenario(
        Plurality, [(55, "GOW"), (45, "WOG")], 15, 0, "Ava fans lured to Bo",
        lambda g, k: [(g[0][0] - k, "GOW"), (k, "OGW"), g[1]],
        lambda k: f"Rex's team launches Bo, an Ava lookalike. {k} Ava fans switch to Bo: Ava's votes are SPLIT.",
        "vote splitting (the spoiler effect)",
        lambda g, rigged: Plurality(),
    ),
    Scenario(
        Borda, [(25, "GWO"), (35, "WGO"), (30, "OGW")], 25, 1, "Rex fans 'bury' Ava",
        lambda g, k: [g[0], (g[1][0] - k, "WGO"), (k, "WOG"), g[2]],
        lambda k: f"{k} Rex fans pretend Bo is their 2nd choice and rank Ava LAST. Ava loses points; Bo gains them.",
        "burying (dishonest ranking)",
        lambda g, rigged: Borda(),
    ),
    Scenario(
        InstantRunoff, [(35, "GOW"), (33, "OWG"), (32, "WGO")], 4, 1, "Bo fans pushed to rank Ava 1st",
        lambda g, k: [g[0], (k, "GOW"), (g[1][0] - k, "OWG"), g[2]],
        lambda k: (f"The rigger tells {k} Bo fans: 'Ava needs you, rank her 1st!' Bo gets knocked out too early "
                   f"and Bo's ballots flow to Rex. MORE support made Ava LOSE! (Try --strength 20: it stops working.)"),
        "non-monotonicity (more votes can make you lose)",
        lambda g, rigged: InstantRunoff(),
    ),
    Scenario(
        AgendaPairwise, [(35, "WGO"), (33, "GOW"), (32, "OGW")], 20, 2, "Bo fans swap Ava and Rex",
        lambda g, k: [g[0], g[1], (g[2][0] - k, "OGW"), (k, "OWG")],
        lambda k: (f"{k} voters change their minds slightly. Now Ava beats Bo, Bo beats Rex, Rex beats Ava: a LOOP. "
                   f"Whoever sets the duel order picks the winner - and the rigger sets it."),
        "cycles + agenda control (the Condorcet paradox)",
        lambda g, rigged: best_agenda(g) if rigged else AgendaPairwise(),
    ),
]


# --------------------------------------------------------------------- demo
def play(s: Scenario, counts: list[int] | None = None, strength: int | None = None) -> None:
    counts = counts or [n for n, _ in s.honest]
    gs = [(n, r) for n, (_, r) in zip(counts, s.honest)]
    k = max(0, min(strength if strength is not None else s.k, gs[s.src][0]))
    rigged = s.rig(gs, k)

    print(f"\n{'=' * 64}\n{s.system.title}\n{s.system.rule}\n{'=' * 64}")
    print("\nThe voters:")
    for n, r in gs:
        print(f"   {n:>3} voters: {rank_str(r)}")

    honest = s.make(gs, False).run(gs)
    print("\n[1] HONEST ELECTION")
    print("\n".join(honest.lines))
    print(f"   >> Winner: {NAMES[honest.winner]}")

    print(f"\n[2] THE RIGGER STRIKES (strength {k}: {s.what_k_means})")
    print(f"   {s.move(k)}")
    result = s.make(rigged, True).run(rigged)
    print("\n".join(result.lines))
    print(f"   >> Winner: {NAMES[result.winner]}")

    if s.system is AgendaPairwise:
        print("\n   Same voters, six different duel orders:")
        for p in permutations("GWO"):
            w = AgendaPairwise("".join(p)).run(rigged).winner
            print(f"     {' -> '.join(NAMES[c] for c in p)}: {NAMES[w]} wins")

    if result.winner == "W":
        print(f"\n   !! Rex wins. The rigger exploited: {s.flaw}.")
    else:
        print("\n   The rigger failed this time. Change the numbers to see when the trick works!")


def finale() -> None:
    d = SCENARIOS[0].honest
    a, b = (NAMES[Dictator(i).run(d).winner] for i in (0, 1))
    print(f"""
{'=' * 64}
ARROW'S IMPOSSIBILITY THEOREM
{'=' * 64}
The voters kept switching systems and the rigger kept winning.
In 1951 Kenneth Arrow proved this is no accident. With 3+ candidates,
no ranked voting system can satisfy ALL of these fair rules:

  1. Free choice : voters may rank candidates however they like.
  2. Unanimity   : if everyone prefers Ava to Rex, Rex can't beat Ava.
  3. Independence: Ava vs Rex depends only on how voters rank Ava vs Rex, never on Bo.
  4. No dictator : no single voter always decides.

What broke in our demo:
  Plurality     - Rule 3: adding Bo flipped Ava vs Rex.
  Borda         - Rule 3: nobody changed their Ava-vs-Rex opinion, yet moving Bo flipped it.
  Ranked Choice - Rule 3, and more votes for Ava made her lose.
  Head-to-Head  - society's ranking became a loop; the duel order decided.
  Dictatorship  - passes rules 1-3, breaks rule 4. Same voters: an Ava-fan dictator -> {a},
                  a Rex-fan dictator -> {b}.

Every system has a weak spot. Know it, and guard against it.
""")


def main() -> None:
    ap = argparse.ArgumentParser(description="Rig the Vote! voting-flaws demo")
    ap.add_argument("--round", type=int, choices=range(1, 5), help="play a single round (1-4)")
    ap.add_argument("--strength", type=int, help="rigger strength (number of voters manipulated)")
    ap.add_argument("--voters", help="comma-separated group sizes, e.g. 35,33,32 (needs --round)")
    ap.add_argument("--no-pause", action="store_true", help="don't wait for Enter between rounds")
    args = ap.parse_args()

    if args.voters and not args.round:
        ap.error("--voters needs --round")
    counts = [int(x) for x in args.voters.split(",")] if args.voters else None
    if counts and len(counts) != len(SCENARIOS[args.round - 1].honest):
        ap.error(f"round {args.round} has {len(SCENARIOS[args.round - 1].honest)} voter groups")

    if args.round:
        play(SCENARIOS[args.round - 1], counts, args.strength)
        return

    print("Voters want Ava (best). The rigger wants Rex (worst).")
    for i, s in enumerate(SCENARIOS):
        play(s, strength=args.strength if args.strength is not None else None)
        nxt = SCENARIOS[i + 1].system.title if i + 1 < len(SCENARIOS) else "Arrow's Theorem"
        msg = f"\n>> The voters protest! 'Unfair! Let's use: {nxt}'"
        if args.no_pause:
            print(msg)
        else:
            input(msg + "  [Enter to continue] ")
    finale()


if __name__ == "__main__":
    main()