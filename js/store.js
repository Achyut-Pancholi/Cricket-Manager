import { rtdb } from './firebase-config.js';
import { ref, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// State Manager with localStorage fallback
export const store = {
    state: {
        matchId: null,
        matchDetails: null,
        players: [],
        teamA: [],
        teamB: [],
        tossWinner: null,
        tossDecision: null,
        currentInnings: 1,
        score: {
            runs: 0,
            wickets: 0,
            balls: 0,
            overs: 0,
            target: null
        },
        striker: null,
        nonStriker: null,
        bowler: null,
        history: [] // Ball by ball history
    },

    init() {
        const saved = localStorage.getItem('gullyscore_state');
        if (saved) {
            this.state = { ...this.state, ...JSON.parse(saved) };
        }
    },

    save() {
        localStorage.setItem('gullyscore_state', JSON.stringify(this.state));
        if (this.state.matchId && rtdb) {
            set(ref(rtdb, 'matches/' + this.state.matchId), this.state).catch(e => console.error("RTDB Sync error", e));
        }
    },

    update(key, value) {
        this.state[key] = value;
        this.save();
    },

    addPlayer(player) {
        this.state.players.push({
            id: Date.now().toString(),
            ...player
        });
        this.save();
    },

    // Generates teams randomly
    shuffleTeams() {
        const shuffled = [...this.state.players].sort(() => 0.5 - Math.random());
        const half = Math.ceil(shuffled.length / 2);
        this.state.teamA = shuffled.slice(0, half);
        this.state.teamB = shuffled.slice(half);
        this.save();
    },

    recordBall(runs, isExtra = false, extraType = '', isWicket = false) {
        this.state.history.push({
            runs, isExtra, extraType, isWicket, 
            over: this.state.score.overs,
            ballNum: this.state.score.balls
        });
        
        if (!isExtra) {
            this.state.score.balls += 1;
        } else if (extraType === 'NB' || extraType === 'WD') {
            this.state.score.runs += 1; // 1 run penalty
        }

        this.state.score.runs += runs;

        if (isWicket) {
            this.state.score.wickets += 1;
        }

        // Calculate overs (e.g. 1.5 -> 2.0 after a ball)
        const totalValidBalls = this.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
        this.state.score.overs = Math.floor(totalValidBalls / 6) + (totalValidBalls % 6) / 10;
        
        this.save();
    },

    undoLastBall() {
        const last = this.state.history.pop();
        if (!last) return;

        this.state.score.runs -= last.runs;
        if (last.extraType === 'NB' || last.extraType === 'WD') {
            this.state.score.runs -= 1;
        } else {
            this.state.score.balls -= 1;
        }

        if (last.isWicket) {
            this.state.score.wickets -= 1;
        }
        
        const totalValidBalls = this.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
        this.state.score.overs = Math.floor(totalValidBalls / 6) + (totalValidBalls % 6) / 10;

        this.save();
    },
    
    clear() {
        localStorage.removeItem('gullyscore_state');
        // Reset state
    }
};

store.init();
