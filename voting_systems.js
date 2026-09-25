/**
 * Voting Systems Module
 * Contains pure functions for different voting algorithms.
 * Each function returns a structured result without manipulating the DOM.
 */

/**
 * Plurality Voting
 * Counts only first-place votes. Most votes wins.
 * 
 * @param {Array} ballots - Array of ballot objects { voterId, ranking: [] }
 * @param {Array} candidateIds - Array of candidate string IDs
 * @returns {Object} Result containing winner, tally, and totalVoters
 */
function plurality(ballots, candidateIds) {
    const tally = {};
    for (const c of candidateIds) tally[c] = 0;
    
    for (const b of ballots) {
        if (b.ranking && b.ranking.length > 0) {
            tally[b.ranking[0]]++;
        }
    }
    
    let winner = null;
    let max = -1;
    for (const c of candidateIds) {
        if (tally[c] > max) {
            max = tally[c];
            winner = c;
        } else if (tally[c] === max && winner !== null) {
            if (c < winner) {
                winner = c; // Break ties alphabetically
            }
        }
    }
    
    return {
        winner,
        tally,
        totalVoters: ballots.length
    };
}

/**
 * Borda Count
 * Assigns points based on ranking position (N-1 for 1st, 0 for last).
 * 
 * @param {Array} ballots - Array of ballot objects
 * @param {Array} candidateIds - Array of candidate string IDs
 * @returns {Object} Result containing winner, scores, pointsPerRank, and totalVoters
 */
function bordaCount(ballots, candidateIds) {
    const scores = {};
    for (const c of candidateIds) scores[c] = 0;
    const n = candidateIds.length;
    
    for (const b of ballots) {
        for (let i = 0; i < b.ranking.length; i++) {
            const candidate = b.ranking[i];
            if (scores[candidate] !== undefined) {
                scores[candidate] += (n - 1 - i);
            }
        }
    }
    
    let winner = null;
    let max = -1;
    for (const c of candidateIds) {
        if (scores[c] > max) {
            max = scores[c];
            winner = c;
        } else if (scores[c] === max && winner !== null) {
            if (c < winner) winner = c;
        }
    }
    
    const pointsPerRank = [];
    for (let i = 0; i < n; i++) {
        pointsPerRank.push(n - 1 - i);
    }
    
    return {
        winner,
        scores,
        pointsPerRank,
        totalVoters: ballots.length
    };
}

/**
 * Instant Runoff Voting (IRV)
 * Eliminates the candidate with the fewest first-place votes in rounds.
 * 
 * @param {Array} ballots - Array of ballot objects
 * @param {Array} candidateIds - Array of candidate string IDs
 * @returns {Object} Result containing winner, rounds, and totalVoters
 */
function instantRunoff(ballots, candidateIds) {
    let remaining = [...candidateIds];
    const rounds = [];
    let winner = null;
    
    while (remaining.length > 0) {
        const tally = {};
        for (const c of remaining) tally[c] = 0;
        
        for (const b of ballots) {
            for (const c of b.ranking) {
                if (remaining.includes(c)) {
                    tally[c]++;
                    break;
                }
            }
        }
        
        let min = Infinity;
        let eliminated = null;
        for (const c of remaining) {
            if (tally[c] < min) {
                min = tally[c];
                eliminated = c;
            } else if (tally[c] === min && eliminated !== null) {
                // Break ties by eliminating the one that is alphabetically last
                if (c > eliminated) eliminated = c;
            }
        }
        
        if (remaining.length === 2) {
            let max = -1;
            for (const c of remaining) {
                if (tally[c] > max) {
                    max = tally[c];
                    winner = c;
                } else if (tally[c] === max && winner !== null) {
                    if (c < winner) winner = c;
                }
            }
            rounds.push({
                tally: { ...tally },
                eliminated: null,
                remaining: [...remaining]
            });
            break;
        } else if (remaining.length === 1) {
            winner = remaining[0];
            rounds.push({
                tally: { ...tally },
                eliminated: null,
                remaining: [...remaining]
            });
            break;
        }
        
        rounds.push({
            tally: { ...tally },
            eliminated,
            remaining: [...remaining]
        });
        
        remaining = remaining.filter(c => c !== eliminated);
    }
    
    return {
        winner,
        rounds,
        totalVoters: ballots.length
    };
}

/**
 * Head-to-Head Helper
 * Returns the winner between two candidates.
 */
function headToHead(ballots, a, b) {
    let aVotes = 0;
    let bVotes = 0;
    for (const ballot of ballots) {
        const aIndex = ballot.ranking.indexOf(a);
        const bIndex = ballot.ranking.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) {
            if (aIndex < bIndex) aVotes++;
            else if (bIndex < aIndex) bVotes++;
        } else if (aIndex !== -1) {
            aVotes++;
        } else if (bIndex !== -1) {
            bVotes++;
        }
    }
    let winner = null;
    if (aVotes > bVotes) winner = a;
    else if (bVotes > aVotes) winner = b;
    else winner = a < b ? a : b; // Tie-breaker alphabetically
    return { winner, aVotes, bVotes };
}

/**
 * Pairwise Agenda
 * Runs duels in a specific order. Winner of a duel faces the next candidate.
 * 
 * @param {Array} ballots - Array of ballot objects
 * @param {Array} candidateIds - Array of candidate string IDs
 * @param {Array} agenda - The order of candidates to run duels for
 * @returns {Object} Result containing winner, duels, agenda, and totalVoters
 */
function pairwiseAgenda(ballots, candidateIds, agenda) {
    if (!agenda || agenda.length === 0) return null;
    let currentWinner = agenda[0];
    const duels = [];
    
    for (let i = 1; i < agenda.length; i++) {
        const challenger = agenda[i];
        const result = headToHead(ballots, currentWinner, challenger);
        duels.push({
            a: currentWinner,
            b: challenger,
            winner: result.winner,
            aVotes: result.aVotes,
            bVotes: result.bVotes
        });
        currentWinner = result.winner;
    }
    
    return {
        winner: currentWinner,
        duels,
        agenda,
        totalVoters: ballots.length
    };
}

// Helper to generate all permutations for findWinningAgenda
function _getPermutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        const current = arr[i];
        const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
        const remainingPerms = _getPermutations(remaining);
        for (let j = 0; j < remainingPerms.length; j++) {
            result.push([current].concat(remainingPerms[j]));
        }
    }
    return result;
}

/**
 * Find Winning Agenda
 * Tries all permutations of candidateIds as agendas to find one where targetWinner wins.
 * 
 * @param {Array} ballots - Array of ballot objects
 * @param {Array} candidateIds - Array of candidate string IDs
 * @param {String} targetWinner - The desired winner
 * @returns {Array|null} The winning agenda array, or null if none exists
 */
function findWinningAgenda(ballots, candidateIds, targetWinner) {
    const permutations = _getPermutations(candidateIds);
    for (const agenda of permutations) {
        const result = pairwiseAgenda(ballots, candidateIds, agenda);
        if (result.winner === targetWinner) {
            return agenda;
        }
    }
    return null;
}

// Export to window
window.VotingSystems = {
    plurality,
    bordaCount,
    instantRunoff,
    headToHead,
    pairwiseAgenda,
    findWinningAgenda
};
