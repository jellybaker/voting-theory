
const fs = require('fs');
const ballots = JSON.parse(process.argv[2]);
global.window = {};
eval(fs.readFileSync('voting_systems.js', 'utf8'));
eval(fs.readFileSync('rigger.js', 'utf8'));

const CANDIDATES = ['butter_chicken', 'pad_thai', 'pizza', 'sushi', 'tacos'];
const VS = window.VotingSystems;
const Rig = window.Rigger;

const hPlur = VS.plurality(ballots, CANDIDATES).winner;
const hBorda = VS.bordaCount(ballots, CANDIDATES).winner;
const hIRV = VS.instantRunoff(ballots, CANDIDATES).winner;
const hPair = VS.pairwiseAgenda(ballots, CANDIDATES, ['sushi', 'tacos', 'pad_thai', 'butter_chicken', 'pizza']).winner;

const rPlur = VS.plurality(Rig.rigPlurality(ballots, 20, CANDIDATES).riggedBallots, CANDIDATES).winner;
const rBorda = VS.bordaCount(Rig.rigBorda(ballots, 25, CANDIDATES).riggedBallots, CANDIDATES).winner;
const rIRV = VS.instantRunoff(Rig.rigIRV(ballots, 15, CANDIDATES).riggedBallots, CANDIDATES).winner;

const rPairBallots = Rig.rigPairwise(ballots, 25, CANDIDATES).riggedBallots;
const winningAgenda = VS.findWinningAgenda(rPairBallots, CANDIDATES, 'sushi');
const rPair = winningAgenda ? VS.pairwiseAgenda(rPairBallots, CANDIDATES, winningAgenda).winner : 'none';

console.log(JSON.stringify({ honest: [hPlur, hBorda, hIRV, hPair], rigged: [rPlur, rBorda, rIRV, rPair] }));
