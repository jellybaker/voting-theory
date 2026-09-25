#!/usr/bin/env python3
"""
Generate 100 voters with spatial attribute preferences for the voting theory demo.

Each voter has an ideal attribute vector (spiciness, creaminess, sweetness, crunchiness, richness).
Utility for candidate c = 1.0 - EuclideanDistance(voter_ideal, candidate_attributes).
Rankings are derived from utilities (highest utility first).

Usage:
    python generate_voters.py              # seed=42, output=voters.csv
    python generate_voters.py --seed 99    # different seed
    python generate_voters.py --output custom.csv
"""
import argparse
import csv
import numpy as np
from collections import Counter

ATTRIBUTES = ['spiciness', 'creaminess', 'sweetness', 'crunchiness', 'richness']

CANDIDATES = {
    'butter_chicken': {'name': 'Butter Chicken', 'spiciness': 0.4, 'creaminess': 0.9, 'sweetness': 0.2, 'crunchiness': 0.1, 'richness': 0.9},
    'pad_thai':       {'name': 'Pad Thai',       'spiciness': 0.6, 'creaminess': 0.2, 'sweetness': 0.5, 'crunchiness': 0.7, 'richness': 0.5},
    'pizza':          {'name': 'Margherita Pizza','spiciness': 0.1, 'creaminess': 0.6, 'sweetness': 0.3, 'crunchiness': 0.5, 'richness': 0.7},
    'sushi':          {'name': 'Sushi Roll',      'spiciness': 0.2, 'creaminess': 0.1, 'sweetness': 0.3, 'crunchiness': 0.4, 'richness': 0.3},
    'tacos':          {'name': 'Tacos',           'spiciness': 0.8, 'creaminess': 0.3, 'sweetness': 0.1, 'crunchiness': 0.8, 'richness': 0.6},
}

CANDIDATE_IDS = sorted(CANDIDATES.keys())
BEST = 'pizza'
WORST = 'sushi'


def compute_utilities(ideal):
    """Compute utility of each candidate based on spatial distance to voter's ideal point."""
    res = {}
    for cid, cattrs in CANDIDATES.items():
        dist = np.sqrt(sum((ideal[attr] - cattrs[attr]) ** 2 for attr in ATTRIBUTES))
        res[cid] = round(float(1.0 - dist), 3)
    return res


def rank_from_utilities(utils):
    """Sort candidates by utility, highest first."""
    return sorted(utils.keys(), key=lambda c: utils[c], reverse=True)


def main():
    parser = argparse.ArgumentParser(description='Generate voter preference CSV.')
    parser.add_argument('--seed', type=int, default=42, help='Random seed for reproducibility')
    parser.add_argument('--output', type=str, default='voters.csv', help='Output CSV file path')
    args = parser.parse_args()

    rng = np.random.RandomState(args.seed)

    # Spatial Voter Groups centered near candidates
    # 45 Pizza, 18 Sushi, 13 Butter Chicken, 12 Pad Thai, 12 Tacos
    groups = [
        {'center': CANDIDATES['pizza'],          'count': 45, 'noise': 0.05},
        {'center': CANDIDATES['sushi'],          'count': 18, 'noise': 0.05},
        {'center': CANDIDATES['butter_chicken'], 'count': 13, 'noise': 0.05},
        {'center': CANDIDATES['pad_thai'],       'count': 12, 'noise': 0.05},
        {'center': CANDIDATES['tacos'],          'count': 12, 'noise': 0.05},
    ]

    voters = []
    first_places = []

    for group in groups:
        center = group['center']
        noise = group['noise']
        for _ in range(group['count']):
            ideal = {}
            for attr in ATTRIBUTES:
                val = center[attr] + rng.normal(0, noise)
                ideal[attr] = round(float(np.clip(val, 0.0, 1.0)), 3)
            
            utils = compute_utilities(ideal)
            ranking = rank_from_utilities(utils)
            first_places.append(ranking[0])
            voters.append({
                'voter_id': len(voters) + 1,
                'weights': ideal,  # w_* represents ideal attribute levels
                'utils': utils,
                'ranking': ranking,
            })

    # --- Summary ---
    counts = Counter(first_places)
    print("=" * 50)
    print("First-place vote distribution:")
    print("=" * 50)
    for cid in CANDIDATE_IDS:
        marker = ''
        if cid == BEST:
            marker = ' ← BEST (should be highest)'
        elif cid == WORST:
            marker = ' ← WORST (should be low)'
        print(f"  {CANDIDATES[cid]['name']:20s}: {counts.get(cid, 0):3d}{marker}")
    print(f"\n  Total voters: {len(voters)}")
    print(f"  Pizza is plurality winner: {counts.get(BEST, 0) == max(counts.values())}")
    print(f"  Sushi first-place votes:   {counts.get(WORST, 0)}")

    # --- Write CSV ---
    with open(args.output, 'w', newline='') as f:
        writer = csv.writer(f)
        header = (
            ['voter_id']
            + [f'w_{a}' for a in ATTRIBUTES]
            + [f'u_{c}' for c in CANDIDATE_IDS]
            + [f'rank_{i}' for i in range(1, 6)]
        )
        writer.writerow(header)

        for v in voters:
            row = [v['voter_id']]
            row.extend(v['weights'][a] for a in ATTRIBUTES)
            row.extend(v['utils'][c] for c in CANDIDATE_IDS)
            row.extend(v['ranking'])
            writer.writerow(row)

    print(f"\n✓ Wrote {len(voters)} voters to {args.output}")


if __name__ == '__main__':
    main()
