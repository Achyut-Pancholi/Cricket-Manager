import { store } from './store.js';
import { db, rtdb } from './firebase-config.js';

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.log('SW registration failed:', err);
        });
    });
}

// Utility: Generate short match ID
const generateMatchId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// Modal Handlers
const setupModals = () => {
    const closeBtns = document.querySelectorAll('.close-btn');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });
};

import { ref, onValue, get, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================
// HOME PAGE LOGIC
// ==========================================
const initHome = () => {
    const joinBtn = document.getElementById('joinMatchBtn');
    if (joinBtn) {
        joinBtn.addEventListener('click', () => {
            document.getElementById('qrModal').classList.remove('hidden');
        });
        document.getElementById('submitJoinMatch')?.addEventListener('click', () => {
            const id = document.getElementById('matchIdInput').value.trim();
            if (id) loadMatch(id);
        });
    }

    const recentList = document.getElementById('recentMatchesList');
    if (recentList) {
        if (rtdb) {
            const matchesRef = ref(rtdb, 'matches');
            onValue(matchesRef, (snapshot) => {
                recentList.innerHTML = '';
                if (snapshot.exists()) {
                    const matches = snapshot.val();
                    Object.keys(matches).forEach(key => {
                        const m = matches[key];
                        if (!m.matchDetails) return;
                        recentList.innerHTML += `
                            <div class="secondary-card mb-4" style="text-align: left; display: block; position: relative;">
                                <div class="d-flex justify-between align-center" style="cursor: pointer; padding-right: 40px;" onclick="loadMatch('${key}')">
                                    <div>
                                        <h4 style="margin:0">${m.matchDetails.name}</h4>
                                        <small style="color: var(--text-muted)">${m.matchDetails.overs} Overs</small>
                                    </div>
                                    <span class="text-primary font-weight-bold">${m.score.runs}/${m.score.wickets}</span>
                                </div>
                                <button onclick="deleteMatch(event, '${key}')" class="icon-btn text-danger" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); z-index: 10; padding: 5px;">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        `;
                    });
                } else {
                    recentList.innerHTML = '<p class="text-center text-muted">No matches found. Create one!</p>';
                }
            }, (error) => {
                recentList.innerHTML = '<p class="text-center text-danger">Error loading matches.</p>';
            });
        } else {
            recentList.innerHTML = '<p class="text-center text-muted">Offline Mode. No recent matches available.</p>';
        }
    }
};

window.loadMatch = (matchId) => {
    get(ref(rtdb, 'matches/' + matchId)).then((snapshot) => {
        if(snapshot.exists()) {
            store.state = snapshot.val();
            store.save();
            window.location.href = 'live-score.html';
        }
    });
};

window.deleteMatch = (e, matchId) => {
    e.stopPropagation(); // Prevent loadMatch from firing
    if (confirm("Are you sure you want to completely delete this match?")) {
        remove(ref(rtdb, 'matches/' + matchId)).then(() => {
            if(store.state.matchId === matchId) {
                store.clear();
            }
        }).catch(err => {
            alert('Error deleting match');
            console.error(err);
        });
    }
};

// ==========================================
// MATCH CREATION LOGIC
// ==========================================
const initMatchCreation = () => {
    const form = document.getElementById('matchSetupForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('matchName').value;
            const overs = document.getElementById('overs').value;
            const venue = document.getElementById('venue').value;
            
            store.update('matchId', generateMatchId());
            store.update('matchDetails', { name, overs, venue, date: new Date().toISOString() });
            
            window.location.href = 'player-registration.html';
        });
    }
};

// ==========================================
// PLAYER REGISTRATION LOGIC
// ==========================================
const initPlayerRegistration = () => {
    const list = document.getElementById('globalAvailableList');
    const selectedCount = document.getElementById('selectedCount');
    let availableGlobalPlayers = [];
    let selectedIds = new Set();
    
    // Clear old match players
    store.state.players = [];
    store.save();

    onValue(ref(rtdb, 'players'), (snapshot) => {
        list.innerHTML = '';
        availableGlobalPlayers = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                const p = data[key];
                if (p.available !== false) {
                    p.id = key;
                    availableGlobalPlayers.push(p);
                }
            });
            
            if(availableGlobalPlayers.length === 0) {
                list.innerHTML = '<p class="text-center text-muted">No available players found. Please add players in Manage Players.</p>';
            } else {
                availableGlobalPlayers.forEach(p => {
                    const isSel = selectedIds.has(p.id) ? 'checked' : '';
                    list.innerHTML += `
                        <label class="list-group-item d-flex align-center" style="gap: 15px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 15px 10px;">
                            <input type="checkbox" class="player-checkbox" value="${p.id}" ${isSel} style="width: 20px; height: 20px;">
                            <div style="width: 35px; height: 35px; border-radius: 50%; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--text-muted);">
                                ${p.name.charAt(0).toUpperCase()}
                            </div>
                            <span style="font-size: 1.1rem;">${p.name}</span>
                        </label>
                    `;
                });
                
                document.querySelectorAll('.player-checkbox').forEach(cb => {
                    cb.addEventListener('change', (e) => {
                        if(e.target.checked) selectedIds.add(e.target.value);
                        else selectedIds.delete(e.target.value);
                        selectedCount.textContent = selectedIds.size;
                    });
                });
            }
        } else {
            list.innerHTML = '<p class="text-center text-muted">No global players exist. Please add them in the Manage Players screen.</p>';
        }
    });
    
    document.getElementById('confirmMatchPlayersBtn')?.addEventListener('click', () => {
        if(selectedIds.size < 2) {
            alert('Please select at least 2 players to start a match.');
            return;
        }
        store.state.players = availableGlobalPlayers.filter(p => selectedIds.has(p.id));
        store.save();
        window.location.href = 'team-shuffle.html';
    });
};

// ==========================================
// TEAM SHUFFLE LOGIC
// ==========================================
const initTeamShuffle = () => {
    const shuffleBtn = document.getElementById('shuffleBtn');
    const listA = document.getElementById('teamAList');
    const listB = document.getElementById('teamBList');

    const renderTeams = () => {
        if (!listA || !listB) return;
        listA.innerHTML = ''; listB.innerHTML = '';
        
        store.state.teamA.forEach(p => {
            listA.innerHTML += `<div class="player-card mb-4" style="padding: 8px 12px;"><div class="player-info"><div class="player-avatar" style="width: 30px; height: 30px; font-size:0.8rem;">${p.name.charAt(0)}</div><span>${p.name}</span></div></div>`;
        });
        store.state.teamB.forEach(p => {
            listB.innerHTML += `<div class="player-card mb-4" style="padding: 8px 12px;"><div class="player-info"><div class="player-avatar" style="width: 30px; height: 30px; font-size:0.8rem;">${p.name.charAt(0)}</div><span>${p.name}</span></div></div>`;
        });
    };

    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            shuffleBtn.classList.add('pulse-effect');
            setTimeout(() => shuffleBtn.classList.remove('pulse-effect'), 500);
            store.shuffleTeams();
            renderTeams();
        });
        
        if (store.state.teamA.length === 0 && store.state.players.length > 0) {
            store.shuffleTeams();
        }
        renderTeams();
    }
};

// ==========================================
// TOSS LOGIC
// ==========================================
const initToss = () => {
    const coin = document.getElementById('coin');
    const controls = document.getElementById('tossControls');
    const result = document.getElementById('tossResult');
    const winnerText = document.getElementById('winnerText');
    const proceed = document.getElementById('proceedToMatchContainer');

    const tossCoin = (callerCall) => {
        if(!coin) return;
        coin.classList.add('flipping');
        
        setTimeout(() => {
            coin.classList.remove('flipping');
            const isHeads = Math.random() > 0.5;
            coin.textContent = isHeads ? 'H' : 'T';
            const tossWinner = (isHeads && callerCall === 'Heads') || (!isHeads && callerCall === 'Tails') ? 'Team A' : 'Team B';
            
            store.update('tossWinner', tossWinner);
            controls.classList.add('hidden');
            result.classList.remove('hidden');
            winnerText.textContent = `${tossWinner} won the toss!`;
        }, 3000);
    };

    if (document.getElementById('callHeads')) {
        document.getElementById('callHeads').addEventListener('click', () => tossCoin('Heads'));
        document.getElementById('callTails').addEventListener('click', () => tossCoin('Tails'));
        
        document.getElementById('chooseBat').addEventListener('click', () => {
            store.update('tossDecision', 'Bat');
            proceed.classList.remove('hidden');
        });
        document.getElementById('chooseBowl').addEventListener('click', () => {
            store.update('tossDecision', 'Bowl');
            proceed.classList.remove('hidden');
        });
    }
};

// ==========================================
// LIVE SCORE LOGIC
// ==========================================
const initLiveScore = () => {
    const shareBtn = document.getElementById('shareBtn') || document.getElementById('shareMatchBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const modal = document.getElementById('shareMatchModal');
            if(modal) {
                document.getElementById('shareMatchName').textContent = store.state.matchDetails?.name || 'Match';
                document.getElementById('shareMatchIdText').textContent = store.state.matchId;
                
                const joinUrl = window.location.origin + window.location.pathname.replace('live-score.html', '') + '?join=' + store.state.matchId;
                const urlInput = document.getElementById('shareUrlInput');
                if(urlInput) urlInput.value = joinUrl;
                
                const qrContainer = document.getElementById('shareQrCode');
                if(qrContainer) {
                    qrContainer.innerHTML = '';
                    
                    if(typeof QRCode !== 'undefined') {
                        new QRCode(qrContainer, {
                            text: joinUrl, width: 200, height: 200,
                            colorDark : "#000000", colorLight : "#ffffff",
                            correctLevel : QRCode.CorrectLevel.H
                        });
                    } else {
                        qrContainer.innerHTML = `<p class="text-danger">QR Library not loaded.</p>`;
                    }
                }
                modal.classList.remove('hidden');
            }
        });
    }

    const populateSelects = () => {
        const teamBatting = store.state.tossDecision === 'Bat' ? 
            (store.state.tossWinner === 'Team A' ? store.state.teamA : store.state.teamB) :
            (store.state.tossWinner === 'Team A' ? store.state.teamB : store.state.teamA);
        
        const teamBowling = store.state.tossDecision === 'Bowl' ? 
            (store.state.tossWinner === 'Team A' ? store.state.teamA : store.state.teamB) :
            (store.state.tossWinner === 'Team A' ? store.state.teamB : store.state.teamA);
            
        const batters = teamBatting && teamBatting.length ? teamBatting : store.state.players;
        const bowlers = teamBowling && teamBowling.length ? teamBowling : store.state.players;

        let bOpts = '<option value="">Select Striker...</option>';
        batters.forEach(p => bOpts += `<option value="${p.id}">${p.name}</option>`);
        const selStriker = document.getElementById('selectStriker');
        if(selStriker) selStriker.innerHTML = bOpts;
        
        let nbOpts = '<option value="">None (Single Batsman)</option>';
        batters.forEach(p => nbOpts += `<option value="${p.id}">${p.name}</option>`);
        const selNonStriker = document.getElementById('selectNonStriker');
        if(selNonStriker) selNonStriker.innerHTML = nbOpts;
        
        let bowlOpts = '<option value="">Select Bowler...</option>';
        bowlers.forEach(p => bowlOpts += `<option value="${p.id}">${p.name}</option>`);
        const selBowler = document.getElementById('selectBowler');
        if(selBowler) selBowler.innerHTML = bowlOpts;
    };

    if (!store.state.striker || !store.state.bowler) {
        const modal = document.getElementById('playerSelectModal');
        if (modal) {
            modal.classList.remove('hidden');
            populateSelects();
        }
    }

    document.getElementById('confirmPlayersBtn')?.addEventListener('click', () => {
        const strId = document.getElementById('selectStriker').value;
        const nsId = document.getElementById('selectNonStriker').value;
        const bwId = document.getElementById('selectBowler').value;
        
        if (!strId || !bwId) return alert('Select at least a Striker and Bowler');
        
        if (strId === bwId) return alert('Striker and Bowler cannot be the same person.');
        if (nsId && strId === nsId) return alert('Striker and Non-Striker cannot be the same person.');
        if (nsId && nsId === bwId) return alert('Non-Striker and Bowler cannot be the same person.');
        
        const getP = id => store.state.players.find(p => p.id === id) || { name: 'Player' };
        
        store.state.striker = getP(strId);
        store.state.nonStriker = nsId ? getP(nsId) : null;
        store.state.bowler = getP(bwId);
        
        store.save();
        document.getElementById('playerSelectModal').classList.add('hidden');
        renderScore();
    });

    const renderScore = () => {
        const elRuns = document.getElementById('runs');
        if(!elRuns) return;
        
        elRuns.textContent = store.state.score.runs;
        document.getElementById('wickets').textContent = store.state.score.wickets;
        document.getElementById('overs').textContent = store.state.score.overs;
        if (store.state.matchDetails) {
            document.getElementById('totalOvers').textContent = store.state.matchDetails.overs;
        }

        if (store.state.striker) {
            const strikerEl = document.getElementById('strikerName');
            if (strikerEl) strikerEl.textContent = store.state.striker.name;
        }
        if (store.state.nonStriker) {
            const nsEl = document.getElementById('nonStrikerName');
            if (nsEl) nsEl.textContent = store.state.nonStriker.name;
        } else {
            const nsEl = document.getElementById('nonStrikerName');
            if (nsEl) nsEl.textContent = 'None';
        }
        if (store.state.bowler) {
            const bwEl = document.getElementById('bowlerName');
            if (bwEl) bwEl.textContent = store.state.bowler.name;
        }

        // Render over tracker
        const tracker = document.getElementById('overTracker');
        tracker.innerHTML = '';
        
        // Get current over balls
        const totalValidBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
        const currentOverBalls = totalValidBalls % 6;
        const ballsToShow = store.state.history.slice(- (currentOverBalls + 2)); // Show a few recent
        
        ballsToShow.forEach(b => {
            let cls = ''; let txt = b.runs;
            if(b.isWicket) { cls = 'w'; txt = 'W'; }
            else if(b.runs === 4) { cls = 'b4'; }
            else if(b.runs === 6) { cls = 'b6'; }
            else if(b.isExtra) { txt = b.extraType; }
            tracker.innerHTML += `<div class="ball-circle fade-in ${cls}">${txt}</div>`;
        });
        tracker.scrollLeft = tracker.scrollWidth;
    };

    // Listen for live updates from other devices (Spectator mode)
    if(rtdb && store.state.matchId) {
        onValue(ref(rtdb, 'matches/' + store.state.matchId), (snapshot) => {
            if(snapshot.exists()) {
                const newData = snapshot.val();
                if (JSON.stringify(store.state.score) !== JSON.stringify(newData.score)) {
                    store.state = newData;
                    localStorage.setItem('gullyscore_state', JSON.stringify(newData));
                    renderScore();
                }
            }
        });
    }

    const checkOverComplete = (prevBalls) => {
        const newBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
        if (newBalls > prevBalls && newBalls % 6 === 0) {
            // Swap batsmen if both exist
            if (store.state.striker && store.state.nonStriker) {
                const temp = store.state.striker;
                store.state.striker = store.state.nonStriker;
                store.state.nonStriker = temp;
                store.save();
            }
            
            const totalOvers = parseFloat(store.state.matchDetails.overs);
            if (store.state.score.overs < totalOvers) {
                const teamBowling = store.state.tossDecision === 'Bat' ? 
                    (store.state.tossWinner === 'Team A' ? store.state.teamB : store.state.teamA) :
                    (store.state.tossWinner === 'Team A' ? store.state.teamA : store.state.teamB);
                const bowlers = teamBowling?.length ? teamBowling : store.state.players;
                
                const selectNew = document.getElementById('selectNewBowler');
                if (selectNew) {
                    selectNew.innerHTML = '';
                    bowlers.forEach(p => {
                        if (p.id !== store.state.bowler?.id) {
                            selectNew.innerHTML += `<option value="${p.id}">${p.name}</option>`;
                        }
                    });
                    document.getElementById('newBowlerModal').classList.remove('hidden');
                }
            } else {
                alert("Innings Complete!");
                window.location.href = 'match-summary.html';
            }
        }
    };
    
    document.getElementById('confirmNewBowler')?.addEventListener('click', () => {
        const nbId = document.getElementById('selectNewBowler').value;
        if(nbId) {
            store.state.bowler = store.state.players.find(p => p.id === nbId);
            store.save();
        }
        document.getElementById('newBowlerModal').classList.add('hidden');
        renderScore();
    });

    // Bind Score Buttons
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const runs = parseInt(e.target.dataset.runs);
            const prevBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
            store.recordBall(runs);
            
            // Strike rotation on 1s, 3s, 5s
            if ((runs % 2 !== 0) && store.state.striker && store.state.nonStriker) {
                const temp = store.state.striker;
                store.state.striker = store.state.nonStriker;
                store.state.nonStriker = temp;
                store.save();
            }
            
            checkOverComplete(prevBalls);
            renderScore();
        });
    });

    if (document.getElementById('undoBtn')) {
        document.getElementById('undoBtn').addEventListener('click', () => {
            store.undoLastBall();
            renderScore();
        });

        document.getElementById('btnWide').addEventListener('click', () => { 
            const prevBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
            store.recordBall(0, true, 'WD'); checkOverComplete(prevBalls); renderScore(); 
        });
        document.getElementById('btnNoBall').addEventListener('click', () => { 
            const prevBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
            store.recordBall(0, true, 'NB'); checkOverComplete(prevBalls); renderScore(); 
        });
        document.getElementById('btnLegBye').addEventListener('click', () => { 
            const prevBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
            store.recordBall(1, true, 'LB'); // LB runs typically count for strike rotation. Let's do 1 run for simplicity in this button.
            if (store.state.striker && store.state.nonStriker) {
                const temp = store.state.striker;
                store.state.striker = store.state.nonStriker;
                store.state.nonStriker = temp;
                store.save();
            }
            checkOverComplete(prevBalls); renderScore(); 
        });
        
        document.getElementById('btnWicket').addEventListener('click', () => { 
            const teamBatting = store.state.tossDecision === 'Bat' ? 
                (store.state.tossWinner === 'Team A' ? store.state.teamA : store.state.teamB) :
                (store.state.tossWinner === 'Team A' ? store.state.teamB : store.state.teamA);
            const batters = teamBatting?.length ? teamBatting : store.state.players;
            
            const outIds = store.state.history.filter(b => b.isWicket).map(b => b.strikerId);
            const currentBatters = [store.state.striker?.id, store.state.nonStriker?.id];
            
            const selectNew = document.getElementById('newBatsman');
            selectNew.innerHTML = '<option value="">None (All Out / End Innings)</option>';
            batters.forEach(p => {
                if (!outIds.includes(p.id) && !currentBatters.includes(p.id)) {
                    selectNew.innerHTML += `<option value="${p.id}">${p.name}</option>`;
                }
            });
            document.getElementById('wicketModal').classList.remove('hidden');
        });
        
        document.getElementById('confirmWicket').addEventListener('click', () => {
            const wType = document.getElementById('wicketType').value;
            const newBatId = document.getElementById('newBatsman').value;
            
            const prevBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
            store.recordBall(0, false, '', true, wType);
            
            if (newBatId) {
                store.state.striker = store.state.players.find(p => p.id === newBatId);
                store.save();
            } else {
                alert("Innings Complete!");
                window.location.href = 'match-summary.html';
                return;
            }
            
            document.getElementById('wicketModal').classList.add('hidden');
            checkOverComplete(prevBalls);
            renderScore();
        });
        
        renderScore();
    }
};

// ==========================================
// MATCH SUMMARY LOGIC
// ==========================================
const initMatchSummary = () => {
    if (!store.state.matchId) {
        document.getElementById('battingStatsBody').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No data</td></tr>';
        document.getElementById('bowlingStatsBody').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No data</td></tr>';
        return;
    }

    const { score, matchDetails, history, players } = store.state;
    document.getElementById('matchResultText').textContent = `${matchDetails?.name || 'Match'} - Summary`;
    
    document.getElementById('teamAScore').textContent = score.runs;
    document.getElementById('teamAWickets').textContent = score.wickets;
    document.getElementById('teamAOvers').textContent = score.overs;

    document.getElementById('teamBScore').textContent = '-';
    document.getElementById('teamBWickets').textContent = '-';
    document.getElementById('teamBOvers').textContent = '-';
    
    document.getElementById('motmName').textContent = store.state.striker?.name || 'N/A';
    document.getElementById('bestBowlerName').textContent = store.state.bowler?.name || 'N/A';
    
    // Calculate player stats
    const batters = {};
    const bowlers = {};
    
    const getPName = id => players.find(p => p.id === id)?.name || 'Unknown Player';

    history.forEach(b => {
        if (!b.strikerId || !b.bowlerId) return; // Legacy fallback
        
        if (!batters[b.strikerId]) batters[b.strikerId] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
        if (!bowlers[b.bowlerId]) bowlers[b.bowlerId] = { runs: 0, balls: 0, wickets: 0 };
        
        // Batter stats
        if (!b.isExtra || b.extraType === 'NB') {
            batters[b.strikerId].balls += 1;
            batters[b.strikerId].runs += b.runs;
            if (b.runs === 4) batters[b.strikerId].fours += 1;
            if (b.runs === 6) batters[b.strikerId].sixes += 1;
        }
        if (b.isWicket) batters[b.strikerId].out = true;
        
        // Bowler stats
        if (b.isExtra && (b.extraType === 'WD' || b.extraType === 'NB')) {
            bowlers[b.bowlerId].runs += 1;
        } else if (!b.isExtra || b.extraType === 'LB') {
            bowlers[b.bowlerId].balls += 1;
        }
        if (!b.isExtra || b.extraType === 'NB') {
            bowlers[b.bowlerId].runs += b.runs;
        }
        if (b.isWicket && b.wicketType !== 'runout') {
            bowlers[b.bowlerId].wickets += 1;
        }
    });

    // Render Batting
    const batTbody = document.getElementById('battingStatsBody');
    batTbody.innerHTML = '';
    Object.keys(batters).forEach(id => {
        const st = batters[id];
        const sr = st.balls > 0 ? ((st.runs / st.balls) * 100).toFixed(1) : '0.0';
        batTbody.innerHTML += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 10px;">
                    <div style="font-weight: 600;">${getPName(id)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${st.out ? 'Out' : 'Not Out'}</div>
                </td>
                <td style="padding: 10px; text-align:center; font-weight: bold;">${st.runs}</td>
                <td style="padding: 10px; text-align:center;">${st.balls}</td>
                <td style="padding: 10px; text-align:center;">${st.fours}</td>
                <td style="padding: 10px; text-align:center;">${st.sixes}</td>
                <td style="padding: 10px; text-align:center;">${sr}</td>
            </tr>
        `;
    });

    // Render Bowling
    const bowlTbody = document.getElementById('bowlingStatsBody');
    bowlTbody.innerHTML = '';
    Object.keys(bowlers).forEach(id => {
        const st = bowlers[id];
        const overs = Math.floor(st.balls / 6) + (st.balls % 6) / 10;
        const eco = overs > 0 ? (st.runs / (st.balls / 6)).toFixed(1) : '0.0';
        bowlTbody.innerHTML += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 10px; font-weight: 600;">${getPName(id)}</td>
                <td style="padding: 10px; text-align:center;">${overs}</td>
                <td style="padding: 10px; text-align:center;">0</td>
                <td style="padding: 10px; text-align:center;">${st.runs}</td>
                <td style="padding: 10px; text-align:center; font-weight: bold; color: var(--text-primary);">${st.wickets}</td>
                <td style="padding: 10px; text-align:center;">${eco}</td>
            </tr>
        `;
    });

    // Render Teams
    const teamAList = document.getElementById('teamAList');
    const teamBList = document.getElementById('teamBList');
    if (teamAList && teamBList) {
        teamAList.innerHTML = store.state.teamA?.length > 0 ? 
            store.state.teamA.map(p => `<li style="padding: 5px 0; font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.05);">${p.name}</li>`).join('') :
            '<li class="text-muted" style="font-size: 0.9rem;">Not assigned</li>';
            
        teamBList.innerHTML = store.state.teamB?.length > 0 ? 
            store.state.teamB.map(p => `<li style="padding: 5px 0; font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.05);">${p.name}</li>`).join('') :
            '<li class="text-muted" style="font-size: 0.9rem;">Not assigned</li>';
    }
};

// ==========================================
// MANAGE PLAYERS LOGIC (Admin)
// ==========================================
import { push, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const initManagePlayers = () => {
    const adminOverlay = document.getElementById('adminLoginOverlay');
    const adminContent = document.getElementById('adminContent');
    const loginBtn = document.getElementById('loginAdminBtn');
    
    // Simple password check
    loginBtn.addEventListener('click', () => {
        const pw = document.getElementById('adminPassword').value;
        if (pw === 'admin123') { // Simple client-side admin password
            adminOverlay.style.display = 'none';
            adminContent.style.display = 'block';
            loadGlobalPlayers();
        } else {
            alert('Incorrect Password');
        }
    });
    
    const loadGlobalPlayers = () => {
        const list = document.getElementById('globalPlayersList');
        onValue(ref(rtdb, 'players'), (snapshot) => {
            list.innerHTML = '';
            if (snapshot.exists()) {
                const data = snapshot.val();
                let count = 0;
                Object.keys(data).forEach(key => {
                    count++;
                    const p = data[key];
                    const isAvail = p.available !== false;
                    
                    list.innerHTML += `
                        <div class="list-group-item d-flex justify-between align-center" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 15px 10px;">
                            <div class="d-flex align-center" style="gap: 15px;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${isAvail ? 'var(--primary-color)' : 'var(--bg-secondary)'}; display: flex; align-items: center; justify-content: center; font-weight: bold; color: ${isAvail ? '#000' : 'var(--text-muted)'};">
                                    ${p.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h4 style="margin: 0; color: ${isAvail ? 'var(--text-primary)' : 'var(--text-muted)'}">${p.name}</h4>
                                    <small style="color: ${isAvail ? '#10B981' : '#EF4444'}">${isAvail ? 'Available' : 'Unavailable'}</small>
                                </div>
                            </div>
                            <div class="d-flex" style="gap: 10px;">
                                <button onclick="togglePlayerStatus('${key}', ${!isAvail})" class="btn ${isAvail ? 'btn-secondary' : 'btn-primary'}" style="padding: 5px 15px; font-size: 0.8rem;">
                                    ${isAvail ? 'Set Away' : 'Set Available'}
                                </button>
                                <button onclick="deleteGlobalPlayer('${key}')" class="icon-btn text-danger" style="padding: 5px;"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    `;
                });
                document.getElementById('totalPlayersCount').textContent = `${count} Players`;
            } else {
                list.innerHTML = '<p class="text-center text-muted mt-4">No global players found.</p>';
                document.getElementById('totalPlayersCount').textContent = `0 Players`;
            }
        });
    };
    
    document.getElementById('addGlobalPlayerBtn').addEventListener('click', () => {
        const input = document.getElementById('newPlayerName');
        const name = input.value.trim();
        if (name) {
            push(ref(rtdb, 'players'), {
                name: name,
                available: true,
                createdAt: Date.now()
            }).then(() => {
                input.value = '';
            });
        }
    });
    
    window.togglePlayerStatus = (key, makeAvail) => {
        update(ref(rtdb, 'players/' + key), { available: makeAvail });
    };
    
    window.deleteGlobalPlayer = (key) => {
        if(confirm("Are you sure you want to completely delete this player?")) {
            remove(ref(rtdb, 'players/' + key));
        }
    };
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    setupModals();
    
    // Check for Join URL Parameter
    const urlParams = new URLSearchParams(window.location.search);
    const joinId = urlParams.get('join');
    if (joinId) {
        loadMatch(joinId);
        return; // wait for redirect
    }

    const path = window.location.pathname;
    if (path.includes('match-creation')) initMatchCreation();
    else if (path.includes('player-registration')) initPlayerRegistration();
    else if (path.includes('team-shuffle')) initTeamShuffle();
    else if (path.includes('toss')) initToss();
    else if (path.includes('live-score')) initLiveScore();
    else if (path.includes('match-summary')) initMatchSummary();
    else if (path.includes('manage-players')) initManagePlayers();
    else initHome(); // Default to home for GitHub Pages subdirectories
});
