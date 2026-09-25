/**
 * Rigger Module
 * Contains strategies for manipulating different voting algorithms.
 * Each strategy takes ballots, strength (number of voters to manipulate), 
 * and returns new rigged ballots, description, and flaw name.
 */

const WORST_CANDIDATE = 'sushi';
const BEST_CANDIDATE = 'pizza';

/**
 * Rig Plurality (Vote Splitting / Spoiler Effect)
 * Siphons Pizza voters to vote for Sushi Roll, splitting the crowd favorite.
 * 
 * @param {Array} ballots 
 * @param {Number} strength 
 * @param {Array} candidateIds 
 * @returns {Object} { riggedBallots, description, flawName }
 */
function rigPlurality(ballots, strength, candidateIds) {
    const riggedBallots = ballots.map(b => ({ ...b, ranking: [...b.ranking] }));
    
    let modified = 0;
    for (const b of riggedBallots) {
        if (modified >= strength) break;
        if (b.ranking[0] === BEST_CANDIDATE) {
            // Move sushi to first place
            b.ranking = [WORST_CANDIDATE, ...b.ranking.filter(c => c !== WORST_CANDIDATE)];
            modified++;
        }
    }
    
    return {
        riggedBallots,
        description: `The rigger convinces ${modified} Pizza voters to vote for Sushi Roll! Pizza's support is SPLIT, and Sushi Roll steals plurality!`,
        flawName: "Vote Splitting (Spoiler Effect / Strategic Defection)"
    };
}

/**
 * Rig Borda Count (Burying & Dishonest Ranking)
 * Convinces voters to dishonestly rank Sushi #1 and Pizza LAST to tank Pizza's score.
 * 
 * @param {Array} ballots 
 * @param {Number} strength 
 * @param {Array} candidateIds 
 * @returns {Object} { riggedBallots, description, flawName }
 */
function rigBorda(ballots, strength, candidateIds) {
    const riggedBallots = ballots.map(b => ({ ...b, ranking: [...b.ranking] }));
    
    let modified = 0;
    for (const b of riggedBallots) {
        if (modified >= strength) break;
        // Put Sushi #1 and Pizza LAST (5th)
        b.ranking = [WORST_CANDIDATE, ...b.ranking.filter(c => c !== WORST_CANDIDATE && c !== BEST_CANDIDATE), BEST_CANDIDATE];
        modified++;
    }
    
    return {
        riggedBallots,
        description: `The rigger tells ${modified} voters: 'Rank Sushi FIRST and Pizza LAST!' Their dishonest rankings propel Sushi to victory while burying Pizza.`,
        flawName: "Burying (Dishonest Ranking)"
    };
}

/**
 * Rig Instant Runoff (Strategic Voting & Non-Monotonicity)
 * Manipulates early round elimination cascades so Sushi survives and wins the final round.
 * 
 * @param {Array} ballots 
 * @param {Number} strength 
 * @param {Array} candidateIds 
 * @returns {Object} { riggedBallots, description, flawName }
 */
function rigIRV(ballots, strength, candidateIds) {
    const riggedBallots = ballots.map(b => ({ ...b, ranking: [...b.ranking] }));
    
    let modified = 0;
    for (const b of riggedBallots) {
        if (modified >= strength) break;
        if (b.ranking[0] === BEST_CANDIDATE) {
            b.ranking = [WORST_CANDIDATE, ...b.ranking.filter(c => c !== WORST_CANDIDATE)];
            modified++;
        }
    }
    
    return {
        riggedBallots,
        description: `The rigger siphons ${modified} voters' 1st-place preferences to Sushi, engineering the elimination cascade so Pizza loses in the final runoff!`,
        flawName: "Non-Monotonicity & Strategic Voting"
    };
}

/**
 * Rig Pairwise Agenda (Condorcet Cycles + Agenda Control)
 * Forces a cycle where every candidate loses to someone, then controls the duel agenda.
 * 
 * @param {Array} ballots 
 * @param {Number} strength 
 * @param {Array} candidateIds 
 * @returns {Object} { riggedBallots, description, flawName }
 */
function rigPairwise(ballots, strength, candidateIds) {
    const riggedBallots = ballots.map(b => ({ ...b, ranking: [...b.ranking] }));
    
    let modified = 0;
    for (const b of riggedBallots) {
        if (modified >= strength) break;
        // Set ranking order to favor Sushi over Pizza in head-to-head
        b.ranking = [WORST_CANDIDATE, 'tacos', 'pad_thai', 'butter_chicken', BEST_CANDIDATE];
        modified++;
    }
    
    return {
        riggedBallots,
        description: `The rigger shifts ${modified} voters' preferences to create a CYCLE: every candidate loses to someone! Then the rigger controls the duel order to crown Sushi.`,
        flawName: "Condorcet Cycles + Agenda Control"
    };
}

// Export to window
window.Rigger = {
    rigPlurality,
    rigBorda,
    rigIRV,
    rigPairwise
};
