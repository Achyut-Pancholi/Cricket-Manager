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
                        const isLive = m.matchEnded === false;
                        recentList.innerHTML += `
                            <div class="secondary-card mb-4" style="text-align: left; display: block; position: relative;">
                                <div style="cursor: pointer; padding-right: 40px;" onclick="loadMatch('${key}')">
                                    <div class="d-flex align-center" style="gap: 12px; margin-bottom: 4px;">
                                        <h4 style="margin:0">${m.matchDetails.name}</h4>
                                        ${isLive ? '<span class="badge badge-live">LIVE</span>' : ''}
                                    </div>
                                    <small style="color: var(--text-muted)">${m.matchDetails.overs} Overs</small>
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
            const m = snapshot.val();
            store.state = m;
            store.save();
            if (m.matchEnded) {
                window.location.href = 'match-summary.html';
            } else {
                window.location.href = 'live-score.html';
            }
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
            const name  = document.getElementById('matchName').value;
            const overs = document.getElementById('overs').value;
            const venue = document.getElementById('venue').value;
            const teamAName = document.getElementById('teamAName')?.value.trim() || 'Team A';
            const teamBName = document.getElementById('teamBName')?.value.trim() || 'Team B';

            store.update('matchId', generateMatchId());
            store.update('matchDetails', { name, overs, venue, teamAName, teamBName, date: new Date().toISOString() });
            store.update('matchEnded', false);

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
    const renderNoActiveMatch = () => {
        const content = document.querySelector('.content');
        if (content) {
            content.innerHTML = `
                <div class="text-center fade-in" style="padding: 60px 20px;">
                    <div style="font-size: 4rem; margin-bottom: 20px;">🏏</div>
                    <h2 class="mb-2">No Active Live Match</h2>
                    <p class="text-muted mb-6">There are no matches currently in progress.</p>
                    <a href="match-summary.html" class="btn btn-primary btn-block mb-4">View Past Scorecards</a>
                    <a href="index.html" class="btn btn-secondary btn-block">Back to Home</a>
                </div>
            `;
        }
    };

    if (!store.state.matchId || store.state.matchEnded) {
        get(ref(rtdb, 'matches')).then((snapshot) => {
            if (snapshot.exists()) {
                const matches = snapshot.val();
                const activeId = Object.keys(matches).find(id => !matches[id].matchEnded);
                if (activeId) {
                    loadMatch(activeId);
                } else {
                    renderNoActiveMatch();
                }
            } else {
                renderNoActiveMatch();
            }
        });
        return;
    }
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
        // Innings 1: toss winner bats/bowls as decided
        // Innings 2: roles are REVERSED
        const isInnings2 = store.state.currentInnings === 2;

        // Batting team for innings 1
        let teamBatting1 = store.state.tossDecision === 'Bat'
            ? (store.state.tossWinner === 'Team A' ? store.state.teamA : store.state.teamB)
            : (store.state.tossWinner === 'Team A' ? store.state.teamB : store.state.teamA);

        let teamBowling1 = store.state.tossDecision === 'Bat'
            ? (store.state.tossWinner === 'Team A' ? store.state.teamB : store.state.teamA)
            : (store.state.tossWinner === 'Team A' ? store.state.teamA : store.state.teamB);

        // For innings 2, swap the roles
        const batters = isInnings2
            ? (teamBowling1?.length ? teamBowling1 : store.state.players)
            : (teamBatting1?.length ? teamBatting1 : store.state.players);

        const bowlers = isInnings2
            ? (teamBatting1?.length ? teamBatting1 : store.state.players)
            : (teamBowling1?.length ? teamBowling1 : store.state.players);

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

        // Calculate live player stats from history
        let batsmen = {};
        let bowlers = {};
        store.state.history.forEach(b => {
            if (!batsmen[b.strikerId]) batsmen[b.strikerId] = { runs: 0, balls: 0 };
            if (!b.isExtra && !b.isWicket) batsmen[b.strikerId].runs += b.runs;
            if (!b.isExtra) batsmen[b.strikerId].balls += 1;
            
            if (!bowlers[b.bowlerId]) bowlers[b.bowlerId] = { runs: 0, wickets: 0, balls: 0 };
            if (b.isExtra && (b.extraType === 'WD' || b.extraType === 'NB')) {
                bowlers[b.bowlerId].runs += b.runs + 1;
            } else if (!b.isExtra) {
                bowlers[b.bowlerId].runs += b.runs;
                bowlers[b.bowlerId].balls += 1;
            }
            if (b.isWicket && b.wicketType !== 'Run Out') bowlers[b.bowlerId].wickets += 1;
        });

        // Striker display
        if (store.state.striker) {
            const stStats = batsmen[store.state.striker.id] || { runs: 0, balls: 0 };
            const stEl = document.getElementById('strikerName'); if (stEl) stEl.textContent = store.state.striker.name;
            const srEl = document.getElementById('strikerRuns'); if (srEl) srEl.textContent = stStats.runs;
            const sbEl = document.getElementById('strikerBalls'); if (sbEl) sbEl.textContent = stStats.balls;
        }
        
        // Non-Striker display
        if (store.state.nonStriker) {
            const nsStats = batsmen[store.state.nonStriker.id] || { runs: 0, balls: 0 };
            const nsEl = document.getElementById('nonStrikerName'); if (nsEl) nsEl.textContent = store.state.nonStriker.name;
            const nrEl = document.getElementById('nonStrikerRuns'); if (nrEl) nrEl.textContent = nsStats.runs;
            const nbEl = document.getElementById('nonStrikerBalls'); if (nbEl) nbEl.textContent = nsStats.balls;
        } else {
            const nsEl = document.getElementById('nonStrikerName'); if (nsEl) nsEl.textContent = '—';
            const nrEl = document.getElementById('nonStrikerRuns'); if (nrEl) nrEl.textContent = '';
            const nbEl = document.getElementById('nonStrikerBalls'); if (nbEl) nbEl.textContent = '';
        }
        
        // Bowler display
        if (store.state.bowler) {
            const bwStats = bowlers[store.state.bowler.id] || { runs: 0, balls: 0, wickets: 0 };
            const overs = Math.floor(bwStats.balls / 6) + '.' + (bwStats.balls % 6);
            const bwEl = document.getElementById('bowlerName'); if (bwEl) bwEl.textContent = store.state.bowler.name;
            const brEl = document.getElementById('bowlerRuns'); if (brEl) brEl.textContent = bwStats.runs;
            const bwoEl = document.getElementById('bowlerOvers'); if (bwoEl) bwoEl.textContent = overs;
            const bwkEl = document.getElementById('bowlerWickets'); if (bwkEl) bwkEl.textContent = bwStats.wickets;
        }

        // Target / CRR / REQ display
        const target = store.state.score.target;
        const totalValidBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
        const totalOvers = parseFloat(store.state.matchDetails?.overs || 0);
        const ballsUsed = totalValidBalls;
        const oversDecimal = ballsUsed > 0 ? (Math.floor(ballsUsed / 6) + (ballsUsed % 6) / 6) : 0;
        const crr = oversDecimal > 0 ? (store.state.score.runs / oversDecimal).toFixed(2) : '0.00';
        
        const crrEl = document.getElementById('crrValue'); if (crrEl) crrEl.textContent = crr;
        const targetEl = document.getElementById('targetValue');
        const reqEl = document.getElementById('reqrValue');
        const inningsBannerEl = document.getElementById('inningsBanner');
        
        if (store.state.currentInnings === 2 && target) {
            if (targetEl) { targetEl.textContent = target; targetEl.style.color = '#F59E0B'; }
            const runsNeeded = target - store.state.score.runs;
            const ballsLeft = (totalOvers * 6) - ballsUsed;
            const rr = ballsLeft > 0 ? ((runsNeeded / ballsLeft) * 6).toFixed(2) : '0.00';
            if (reqEl) reqEl.textContent = rr;
            if (inningsBannerEl) {
                if (runsNeeded <= 0) {
                    inningsBannerEl.textContent = '🏆 Match Won!';
                    inningsBannerEl.style.background = 'rgba(16,185,129,0.3)';
                    inningsBannerEl.style.display = 'block';
                } else if (ballsLeft <= 0 || store.state.score.wickets >= (store.state.players.length / 2)) {
                    inningsBannerEl.textContent = '❌ Match Lost';
                    inningsBannerEl.style.background = 'rgba(239,68,68,0.3)';
                    inningsBannerEl.style.display = 'block';
                } else {
                    inningsBannerEl.textContent = `Need ${runsNeeded} from ${ballsLeft} balls`;
                    inningsBannerEl.style.display = 'block';
                    inningsBannerEl.style.background = 'rgba(245,158,11,0.15)';
                }
            }
        } else {
            if (targetEl) { targetEl.textContent = store.state.innings1 ? store.state.innings1.score.runs : '—'; }
            if (reqEl) reqEl.textContent = '—';
            if (inningsBannerEl) {
                inningsBannerEl.textContent = `Innings ${store.state.currentInnings}`;
                inningsBannerEl.style.display = 'block';
                inningsBannerEl.style.background = 'rgba(99,102,241,0.2)';
            }
        }

        // Render over tracker - only current over's balls
        const tracker = document.getElementById('overTracker');
        if (tracker) {
            tracker.innerHTML = '';
            const hist = store.state.history;
            let currentOverBallsArr = [];
            // Walk backwards to find where the current over started
            let validCount = 0;
            for (let i = hist.length - 1; i >= 0; i--) {
                currentOverBallsArr.unshift(hist[i]);
                if (!hist[i].isExtra || hist[i].extraType === 'LB') {
                    validCount++;
                    // Check if we just crossed the over boundary
                    const ballsBeforeThis = totalValidBalls - validCount;
                    if (ballsBeforeThis % 6 === 0 && ballsBeforeThis > 0) break;
                }
            }
            
            currentOverBallsArr.forEach(b => {
                let cls = ''; let txt = b.runs;
                if (b.isWicket) { cls = 'w'; txt = 'W'; }
                else if (b.runs === 4) { cls = 'b4'; }
                else if (b.runs === 6) { cls = 'b6'; }
                else if (b.isExtra) { txt = b.extraType; cls = 'extra'; }
                tracker.innerHTML += `<div class="ball-circle fade-in ${cls}">${txt}</div>`;
            });
            tracker.scrollLeft = tracker.scrollWidth;
        }
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

    // ── Commentary generator ──
    const getCommentary = (ball) => {
        const name = store.state.striker?.name || 'Batsman';
        const bowler = store.state.bowler?.name || 'Bowler';
        if (ball.isWicket && ball.wicketType === 'Retired') return { icon: '🏥', text: `${name} retires hurt.` };
        if (ball.isWicket) {
            const msgs = { Bowled: `BOWLED! ${name} is clean bowled by ${bowler}!`, Caught: `CAUGHT! ${name} holes out. ${bowler} takes the wicket!`, 'Run Out': `RUN OUT! What a mix-up in the middle!`, LBW: `LBW! Plumb in front. ${name} has to walk.` };
            return { icon: '💥', text: msgs[ball.wicketType] || `OUT! ${name} is dismissed.` };
        }
        if (ball.isExtra) {
            if (ball.extraType === 'WD') return { icon: '➡️', text: `Wide ball from ${bowler}. Extra run added.` };
            if (ball.extraType === 'NB') return { icon: '🚫', text: `No ball! Free hit coming up.` };
            if (ball.extraType === 'LB') return { icon: '🦵', text: `Leg bye! Ball clips the pad.` };
        }
        if (ball.runs === 6) return { icon: '🚀', text: `SIX! ${name} sends it into the stands!` };
        if (ball.runs === 4) return { icon: '🏏', text: `FOUR! ${name} finds the boundary!` };
        if (ball.runs === 3) return { icon: '🏃', text: `Three runs! Great running between the wickets.` };
        if (ball.runs === 2) return { icon: '✌️', text: `Two runs to ${name}.` };
        if (ball.runs === 1) return { icon: '•', text: `Single taken. Strike rotated.` };
        return { icon: '🔵', text: `Dot ball from ${bowler}. Good delivery!` };
    };

    const showCommentary = (ball) => {
        const ticker = document.getElementById('commentaryTicker');
        const commText = document.getElementById('commText');
        if (!ticker || !commText) return;
        const { icon, text } = getCommentary(ball);
        ticker.querySelector('.comm-icon').textContent = icon;
        commText.textContent = text;
        ticker.style.borderColor = ball.isWicket ? 'rgba(239,68,68,0.5)' : ball.runs === 6 ? 'rgba(0,242,254,0.4)' : ball.runs === 4 ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.07)';
    };

    // ── Match complete overlay ──
    const showMatchComplete = () => {
        const overlay = document.getElementById('matchCompleteOverlay');
        if (!overlay) return;
        const s = store.state;
        const inn1Score = s.innings1?.score;
        const inn2Score = s.score;
        const players = s.players || [];
        const teamA = s.teamA || [], teamB = s.teamB || [];
        const md = s.matchDetails || {};

        // Team labels
        const inn1Bat = s.tossDecision === 'Bat' ? (s.tossWinner === 'Team A' ? teamA : teamB) : (s.tossWinner === 'Team A' ? teamB : teamA);
        const inn1BatName = inn1Bat === teamA ? (md.teamAName || 'Team A') : (md.teamBName || 'Team B');
        const inn2BatName = inn1BatName === (md.teamAName || 'Team A') ? (md.teamBName || 'Team B') : (md.teamAName || 'Team A');

        document.getElementById('mcInn1Label').textContent = inn1BatName;
        document.getElementById('mcInn1Score').textContent = inn1Score ? `${inn1Score.runs}/${inn1Score.wickets}` : '—';
        document.getElementById('mcInn2Label').textContent = inn2BatName;
        document.getElementById('mcInn2Score').textContent = inn2Score ? `${inn2Score.runs}/${inn2Score.wickets}` : '—';

        // Result text
        let result = '', sub = '';
        if (inn1Score && inn2Score) {
            const target = inn1Score.runs + 1;
            if (inn2Score.runs >= target) {
                const wl = (s.innings1 ? teamA.length : teamB.length) - inn2Score.wickets;
                result = `🏆 ${inn2BatName} Won!`;
                sub = `by ${wl} wicket${wl !== 1 ? 's' : ''}`;
            } else {
                const margin = inn1Score.runs - inn2Score.runs;
                result = `🏆 ${inn1BatName} Won!`;
                sub = `by ${margin} run${margin !== 1 ? 's' : ''}`;
            }
        }
        document.getElementById('mcResult').textContent = result;
        document.getElementById('mcSub').textContent = sub;

        // Quick awards from history
        const allH = [...(s.innings1?.history || []), ...(s.history || [])];
        const batRuns = {};
        allH.forEach(b => { if (!b.strikerId || b.isExtra || b.isWicket) return; if (!batRuns[b.strikerId]) batRuns[b.strikerId] = 0; batRuns[b.strikerId] += b.runs; });
        const topBatId = Object.keys(batRuns).sort((a,b) => batRuns[b]-batRuns[a])[0];
        const topBat = players.find(p => p.id === topBatId);

        const bowlStats = {};
        allH.forEach(b => { if (!b.bowlerId) return; if (!bowlStats[b.bowlerId]) bowlStats[b.bowlerId] = {w:0}; if (b.isWicket && b.wicketType !== 'Run Out') bowlStats[b.bowlerId].w++; });
        const topBowlId = Object.keys(bowlStats).sort((a,b) => bowlStats[b].w - bowlStats[a].w)[0];
        const topBowl = players.find(p => p.id === topBowlId);

        document.getElementById('mcTopBat').textContent  = topBat  ? `${topBat.name} (${batRuns[topBatId]})`  : '—';
        document.getElementById('mcTopBowl').textContent = topBowl ? `${topBowl.name} (${bowlStats[topBowlId].w}W)` : '—';
        document.getElementById('mcMotm').textContent    = topBat?.name || topBowl?.name || '—';

        overlay.style.display = 'flex';
    };

    // ── Innings-end handler ──
    const endInnings = () => {
        if (store.state.currentInnings === 1) {
            store.startInnings2();
            populateSelects();
            const modal = document.getElementById('playerSelectModal');
            const title = modal?.querySelector('h2');
            if (title) title.textContent = 'Innings 2 — Select Opening Players';
            if (modal) modal.classList.remove('hidden');
            renderScore();
        } else {
            // Match over — show complete overlay
            store.state.matchEnded = true;
            store.save();
            showMatchComplete();
        }
    };

    const checkInningsEnd = () => {
        const totalOvers = parseFloat(store.state.matchDetails?.overs || 0);
        // Valid balls only (no WD, no NB) — only LB counts toward overs
        const validBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
        const overs = Math.floor(validBalls / 6);
        
        // Overs exhausted?
        if (overs >= totalOvers && validBalls % 6 === 0 && validBalls > 0) {
            return true;
        }
        
        // Innings 2: target chased?
        if (store.state.currentInnings === 2 && store.state.score.target &&
            store.state.score.runs >= store.state.score.target) {
            return true;
        }
        
        return false;
    };

    const checkOverComplete = (prevBalls) => {
        // Only count valid balls (no WD/NB) toward over completion
        const newBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
        if (newBalls > prevBalls && newBalls % 6 === 0 && newBalls > 0) {
            // End-of-innings takes priority
            if (checkInningsEnd()) { endInnings(); return; }

            // Swap strike at end of over if both batsmen exist
            if (store.state.striker && store.state.nonStriker) {
                const temp = store.state.striker;
                store.state.striker = store.state.nonStriker;
                store.state.nonStriker = temp;
                store.save();
            }
            
            // Show new bowler selection
            const teamBowling = store.state.currentInnings === 1
                ? (store.state.tossDecision === 'Bat'
                    ? (store.state.tossWinner === 'Team A' ? store.state.teamB : store.state.teamA)
                    : (store.state.tossWinner === 'Team A' ? store.state.teamA : store.state.teamB))
                : (store.state.tossDecision === 'Bat'
                    ? (store.state.tossWinner === 'Team A' ? store.state.teamA : store.state.teamB)
                    : (store.state.tossWinner === 'Team A' ? store.state.teamB : store.state.teamA));
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
            showCommentary({ runs, isExtra: false, isWicket: false });
            store.recordBall(runs);
            
            // Strike rotation on 1s, 3s, 5s
            if ((runs % 2 !== 0) && store.state.striker && store.state.nonStriker) {
                const temp = store.state.striker;
                store.state.striker = store.state.nonStriker;
                store.state.nonStriker = temp;
                store.save();
            }
            
            // Check if innings 2 target chased
            if (checkInningsEnd()) { renderScore(); setTimeout(() => endInnings(), 600); return; }
            
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
            showCommentary({ runs: 0, isExtra: true, extraType: 'WD' });
            store.recordBall(0, true, 'WD'); 
            checkOverComplete(prevBalls); 
            renderScore(); 
        });
        document.getElementById('btnNoBall').addEventListener('click', () => { 
            const prevBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
            showCommentary({ runs: 0, isExtra: true, extraType: 'NB' });
            store.recordBall(0, true, 'NB'); 
            checkOverComplete(prevBalls); 
            renderScore(); 
        });
        document.getElementById('btnLegBye').addEventListener('click', () => { 
            const prevBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
            const r = 1;
            showCommentary({ runs: r, isExtra: true, extraType: 'LB' });
            store.recordBall(r, true, 'LB'); 
            if (r % 2 !== 0 && store.state.striker && store.state.nonStriker) {
                const temp = store.state.striker;
                store.state.striker = store.state.nonStriker;
                store.state.nonStriker = temp;
                store.save();
            }
            checkOverComplete(prevBalls); 
            renderScore(); 
        });
        
        document.getElementById('btnWicket').addEventListener('click', () => { 
            // Determine current batting team (flips for innings 2)
            let teamBatting;
            if (store.state.currentInnings === 1) {
                teamBatting = store.state.tossDecision === 'Bat'
                    ? (store.state.tossWinner === 'Team A' ? store.state.teamA : store.state.teamB)
                    : (store.state.tossWinner === 'Team A' ? store.state.teamB : store.state.teamA);
            } else {
                teamBatting = store.state.tossDecision === 'Bat'
                    ? (store.state.tossWinner === 'Team A' ? store.state.teamB : store.state.teamA)
                    : (store.state.tossWinner === 'Team A' ? store.state.teamA : store.state.teamB);
            }
            const batters = teamBatting?.length ? teamBatting : store.state.players;
            
            const outIds = store.state.history.filter(b => b.isWicket).map(b => b.strikerId);
            const currentBatters = [store.state.striker?.id, store.state.nonStriker?.id];
            const remaining = batters.filter(p => !outIds.includes(p.id) && !currentBatters.includes(p.id));
            
            const selectNew = document.getElementById('newBatsman');
            selectNew.innerHTML = remaining.length > 0
                ? '<option value="">Select New Batsman...</option>'
                : '<option value="">All Out — End Innings</option>';
            remaining.forEach(p => {
                selectNew.innerHTML += `<option value="${p.id}">${p.name}</option>`;
            });
            document.getElementById('wicketModal').classList.remove('hidden');
        });
        
        document.getElementById('confirmWicket').addEventListener('click', () => {
            const wType = document.getElementById('wicketType').value;
            const newBatId = document.getElementById('newBatsman').value;

            const prevBalls = store.state.history.filter(b => !b.isExtra || b.extraType === 'LB').length;
            const isRetire = wType === 'Retired';

            // Retire doesn't count as wicket
            showCommentary({ isWicket: !isRetire, isExtra: false, runs: 0, wicketType: wType });
            store.recordBall(0, false, '', !isRetire, wType);

            if (newBatId) {
                store.state.striker = store.state.players.find(p => p.id === newBatId);
                store.save();
                document.getElementById('wicketModal').classList.add('hidden');
                checkOverComplete(prevBalls);
                renderScore();
            } else {
                // No batsman left — all out
                document.getElementById('wicketModal').classList.add('hidden');
                renderScore();
                setTimeout(() => endInnings(), 600);
            }
        });
        
        renderScore();
    }
};

// ==========================================
// MATCH SUMMARY / STATS LOGIC
// ==========================================
const initMatchSummary = () => {
    const matchSelectScreen = document.getElementById('matchSelectScreen');
    const statsScreen = document.getElementById('statsScreen');
    const matchPickList = document.getElementById('matchPickList');

    // ── Helper: calculate stats from a ball-by-ball history array ──
    const calcStats = (history) => {
        const batters = {};
        const bowlers = {};
        history.forEach(b => {
            if (!b.strikerId || !b.bowlerId) return;

            // --- Batter ---
            if (!batters[b.strikerId]) batters[b.strikerId] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
            if (!b.isExtra) {
                batters[b.strikerId].balls += 1;
                if (!b.isWicket) {
                    batters[b.strikerId].runs += b.runs;
                    if (b.runs === 4) batters[b.strikerId].fours += 1;
                    if (b.runs === 6) batters[b.strikerId].sixes += 1;
                }
            }
            if (b.isWicket) batters[b.strikerId].out = true;

            // --- Bowler ---
            if (!bowlers[b.bowlerId]) bowlers[b.bowlerId] = { runs: 0, balls: 0, wickets: 0 };
            if (!b.isExtra) {
                bowlers[b.bowlerId].balls += 1;
                bowlers[b.bowlerId].runs += b.runs;
            } else if (b.extraType === 'WD' || b.extraType === 'NB') {
                bowlers[b.bowlerId].runs += 1; // penalty + no ball to over
            } else if (b.extraType === 'LB') {
                bowlers[b.bowlerId].balls += 1; // LB counts as valid ball
                // LB runs don't go against bowler
            }
            if (b.isWicket && b.wicketType !== 'Run Out') bowlers[b.bowlerId].wickets += 1;
        });
        return { batters, bowlers };
    };

    // ── Helper: render a batting table body ──
    const renderBatting = (tbodyId, history, teamPlayers, allPlayers) => {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return null;
        const { batters } = calcStats(history);
        tbody.innerHTML = '';
        let topRuns = -1, topId = null;

        // Only show players who actually batted (from this innings' history)
        const battedIds = [...new Set(history.map(b => b.strikerId).filter(Boolean))];
        // Order: players who batted in order they first appeared
        battedIds.forEach(id => {
            const st = batters[id];
            if (!st) return;
            if (st.runs > topRuns) { topRuns = st.runs; topId = id; }
        });

        // Show all team players, mark DNB if they didn't bat
        const teamList = teamPlayers?.length ? teamPlayers : allPlayers;
        teamList.forEach(p => {
            const st = batters[p.id];
            const batted = battedIds.includes(p.id);
            if (!batted) {
                tbody.innerHTML += `<tr style="opacity:0.4;"><td>${p.name} <span style="font-size:0.7rem;color:var(--text-muted);">DNB</span></td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;
                return;
            }
            const sr = st.balls > 0 ? ((st.runs / st.balls) * 100).toFixed(1) : '0.0';
            const isTop = p.id === topId;
            tbody.innerHTML += `
                <tr class="${isTop ? 'top-scorer' : ''}">
                    <td><div style="font-weight:600;">${p.name}</div><div style="font-size:0.72rem;color:var(--text-muted);">${st.out ? 'Out' : 'Not Out'}</div></td>
                    <td style="font-weight:${isTop ? '800' : '400'};color:${isTop ? 'var(--primary)' : 'inherit'};">${st.runs}</td>
                    <td>${st.balls}</td>
                    <td>${st.fours}</td>
                    <td>${st.sixes}</td>
                    <td>${sr}</td>
                </tr>`;
        });
        return { topId, topRuns, topBatter: allPlayers.find(p => p.id === topId) };
    };

    // ── Helper: render a bowling table body ──
    const renderBowling = (tbodyId, history, teamPlayers, allPlayers) => {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return null;
        const { bowlers } = calcStats(history);
        tbody.innerHTML = '';
        let topWkts = -1, topEco = 999, topId = null;

        const teamList = teamPlayers?.length ? teamPlayers : allPlayers;
        teamList.forEach(p => {
            const st = bowlers[p.id];
            if (!st || st.balls === 0) return; // didn't bowl
            const oversInt = Math.floor(st.balls / 6);
            const ballsRem = st.balls % 6;
            const oversDisplay = `${oversInt}.${ballsRem}`;
            const oversDecimal = oversInt + ballsRem / 6;
            const eco = oversDecimal > 0 ? (st.runs / oversDecimal).toFixed(1) : '0.0';

            // Maiden overs: a maiden is an over where 0 runs were scored off the bat from that bowler
            // Simple approach: count full overs bowled by this bowler and check the balls
            let maidens = 0;
            const bowlerBalls = history.filter(b => b.bowlerId === p.id && (!b.isExtra || b.extraType === 'LB'));
            for (let i = 0; i < Math.floor(bowlerBalls.length / 6); i++) {
                const overBalls = bowlerBalls.slice(i * 6, i * 6 + 6);
                const overRuns = overBalls.reduce((s, b) => s + (b.isExtra ? 0 : b.runs), 0);
                if (overRuns === 0) maidens++;
            }

            const isBest = st.wickets > topWkts || (st.wickets === topWkts && parseFloat(eco) < topEco);
            if (isBest) { topWkts = st.wickets; topEco = parseFloat(eco); topId = p.id; }

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight:600;">${p.name}</td>
                    <td>${oversDisplay}</td>
                    <td>${maidens}</td>
                    <td>${st.runs}</td>
                    <td style="font-weight:700;color:${st.wickets > 0 ? 'var(--primary)' : 'inherit'};">${st.wickets}</td>
                    <td>${eco}</td>
                </tr>`;
        });
        return { topId, topBowler: allPlayers.find(p => p.id === topId) };
    };

    // ── Render full stats for a loaded match state ──
    const renderStats = (state) => {
        matchSelectScreen.style.display = 'none';
        statsScreen.style.display = 'block';

        const players = state.players || [];
        const teamA = state.teamA || [];
        const teamB = state.teamB || [];

        // Determine who batted in innings 1
        const inn1Batting = state.tossDecision === 'Bat'
            ? (state.tossWinner === 'Team A' ? teamA : teamB)
            : (state.tossWinner === 'Team A' ? teamB : teamA);
        const inn1Bowling = state.tossDecision === 'Bat'
            ? (state.tossWinner === 'Team A' ? teamB : teamA)
            : (state.tossWinner === 'Team A' ? teamA : teamB);
        const inn1BatLabel = inn1Batting === teamA ? 'Team A' : 'Team B';
        const inn1BowlLabel = inn1Bowling === teamA ? 'Team A' : 'Team B';

        // Innings 1 history and score
        const inn1History = state.innings1?.history || state.history || [];
        const inn1Score = state.innings1?.score || state.score;

        // Innings 2
        const inn2History = state.innings1 ? (state.history || []) : [];
        const inn2Score = state.innings1 ? state.score : null;
        const inn2BatLabel = inn1BowlLabel; // roles flip
        const inn2BowlLabel = inn1BatLabel;

        // Scores display
        document.getElementById('matchName').textContent = state.matchDetails?.name || 'Match';
        document.getElementById('inn1TeamLabel').textContent = inn1BatLabel;
        document.getElementById('inn1Score').textContent = `${inn1Score?.runs ?? '—'}/${inn1Score?.wickets ?? '—'}`;
        document.getElementById('inn1Overs').textContent = inn1Score ? `(${inn1Score.overs} ov)` : '';
        document.getElementById('inn2TeamLabel').textContent = inn2BatLabel;
        document.getElementById('inn2Score').textContent = inn2Score ? `${inn2Score.runs}/${inn2Score.wickets}` : 'Innings 2 pending';
        document.getElementById('inn2Overs').textContent = inn2Score ? `(${inn2Score.overs} ov)` : '';

        // Tab labels
        document.getElementById('tab1').textContent = `${inn1BatLabel} Batting`;
        document.getElementById('tab2').textContent = `${inn2BatLabel} Batting`;
        document.getElementById('inn1BatTeam').textContent = `${inn1BatLabel} — Batting`;
        document.getElementById('inn1BowlTeam').textContent = `${inn1BowlLabel} — Bowling`;
        document.getElementById('inn2BatTeam').textContent = `${inn2BatLabel} — Batting`;
        document.getElementById('inn2BowlTeam').textContent = `${inn2BowlLabel} — Bowling`;

        // Render innings 1 tables
        const batRes1 = renderBatting('inn1BatBody', inn1History, inn1Batting, players);
        const bowlRes1 = renderBowling('inn1BowlBody', inn1History, inn1Bowling, players);

        // Render innings 2 tables
        const batRes2 = inn2History.length > 0
            ? renderBatting('inn2BatBody', inn2History, inn1Bowling, players)
            : null;
        const bowlRes2 = inn2History.length > 0
            ? renderBowling('inn2BowlBody', inn2History, inn1Batting, players)
            : null;

        // Enable/disable innings 2 tab
        const tab2El = document.getElementById('tab2');
        if (inn2History.length > 0) {
            tab2El.style.opacity = '1';
            tab2El.style.pointerEvents = 'auto';
        } else {
            tab2El.style.opacity = '0.4';
            tab2El.style.pointerEvents = 'none';
        }

        // ── Result calculation ──
        let resultText = 'In Progress';
        let resultSub = '';
        if (state.matchEnded && inn2Score && inn1Score) {
            const target = inn1Score.runs + 1;
            if (inn2Score.runs >= target) {
                const wktsLeft = (inn1Bowling?.length || players.length / 2) - inn2Score.wickets;
                resultText = `${inn2BatLabel} Won by ${wktsLeft} wicket${wktsLeft !== 1 ? 's' : ''}`;
                resultSub = `Target: ${target} | Chased in ${inn2Score.overs} overs`;
            } else {
                const margin = inn1Score.runs - inn2Score.runs;
                resultText = `${inn1BatLabel} Won by ${margin} run${margin !== 1 ? 's' : ''}`;
                resultSub = `${inn2BatLabel} fell short of target ${target}`;
            }
        } else if (inn2Score && inn1Score) {
            const target = inn1Score.runs + 1;
            if (inn2Score.runs >= target) {
                const wktsLeft = (inn1Bowling?.length || players.length / 2) - inn2Score.wickets;
                resultText = `${inn2BatLabel} Won by ${wktsLeft} wicket${wktsLeft !== 1 ? 's' : ''}`;
                resultSub = `Target: ${target} | Chased in ${inn2Score.overs} overs`;
            } else if (parseFloat(inn2Score.overs) >= parseFloat(state.matchDetails?.overs || 99)) {
                const margin = inn1Score.runs - inn2Score.runs;
                resultText = `${inn1BatLabel} Won by ${margin} run${margin !== 1 ? 's' : ''}`;
                resultSub = `${inn2BatLabel} fell short of target ${target}`;
            } else {
                resultText = 'Match in Progress — Innings 2';
                resultSub = `${inn2BatLabel} need ${target - inn2Score.runs} more`;
            }
        } else if (inn1Score) {
            resultText = 'Innings 1 Complete';
            resultSub = `${inn1BatLabel}: ${inn1Score.runs}/${inn1Score.wickets} in ${inn1Score.overs} overs`;
        }
        document.getElementById('resultText').textContent = resultText;
        document.getElementById('resultSubtext').textContent = resultSub;

        // ── Awards (restricted to winning team where result is known) ──
        let winnerIds = null;
        if (inn2Score && inn1Score) {
            const target = inn1Score.runs + 1;
            if (inn2Score.runs >= target) {
                // Team B (chasing team) won
                winnerIds = inn1Bowling.map(p => p.id);
            } else if (state.matchEnded || parseFloat(inn2Score.overs) >= parseFloat(state.matchDetails?.overs || 99)) {
                // Team A (batting first) won
                winnerIds = inn1Batting.map(p => p.id);
            }
        }

        // Best Batsman: highest runs — from winning team if known, else all
        const allBatStats = {};
        [...inn1History, ...inn2History].forEach(b => {
            if (!b.strikerId || b.isExtra || b.isWicket) return;
            if (winnerIds && !winnerIds.includes(b.strikerId)) return;
            if (!allBatStats[b.strikerId]) allBatStats[b.strikerId] = 0;
            allBatStats[b.strikerId] += b.runs;
        });
        const bestBatId = Object.keys(allBatStats).sort((a, b) => allBatStats[b] - allBatStats[a])[0];
        const bestBat = players.find(p => p.id === bestBatId);
        document.getElementById('bestBatName').textContent = bestBat?.name || '—';
        document.getElementById('bestBatStat').textContent = bestBatId ? `${allBatStats[bestBatId]} runs` : '';

        // Best Bowler: most wickets from winning team if known, else all
        const winnerBowlIds = winnerIds
            ? (inn2Score && inn2Score.runs >= inn1Score.runs + 1 ? inn1Batting.map(p => p.id) : inn1Bowling.map(p => p.id))
            : null;
        const allBowlStats = {};
        [...inn1History, ...inn2History].forEach(b => {
            if (!b.bowlerId) return;
            if (winnerBowlIds && !winnerBowlIds.includes(b.bowlerId)) return;
            if (!allBowlStats[b.bowlerId]) allBowlStats[b.bowlerId] = { wickets: 0, runs: 0, balls: 0 };
            if (b.isWicket && b.wicketType !== 'Run Out') allBowlStats[b.bowlerId].wickets += 1;
            if (!b.isExtra) { allBowlStats[b.bowlerId].balls += 1; allBowlStats[b.bowlerId].runs += b.runs; }
            else if (b.extraType === 'WD' || b.extraType === 'NB') allBowlStats[b.bowlerId].runs += 1;
        });
        const bestBowlId = Object.keys(allBowlStats).sort((a, b) => {
            if (allBowlStats[b].wickets !== allBowlStats[a].wickets) return allBowlStats[b].wickets - allBowlStats[a].wickets;
            const ecoA = allBowlStats[a].balls > 0 ? allBowlStats[a].runs / allBowlStats[a].balls : 999;
            const ecoB = allBowlStats[b].balls > 0 ? allBowlStats[b].runs / allBowlStats[b].balls : 999;
            return ecoA - ecoB;
        })[0];
        const bestBowl = players.find(p => p.id === bestBowlId);
        document.getElementById('bestBowlName').textContent = bestBowl?.name || '—';
        document.getElementById('bestBowlStat').textContent = bestBowlId
            ? `${allBowlStats[bestBowlId].wickets}W / ${allBowlStats[bestBowlId].runs}R` : '';

        // MOTM: best player from winning team — prefer highest runs, fallback to most wickets
        const motmPlayer = bestBat || bestBowl;
        document.getElementById('motmName').textContent = motmPlayer?.name || '—';
        document.getElementById('motmStat').textContent = bestBatId
            ? `${allBatStats[bestBatId]} runs` : (bestBowlId ? `${allBowlStats[bestBowlId].wickets} wkts` : '');
    };

    // ── Load match list from Firebase ──
    onValue(ref(rtdb, 'matches'), (snapshot) => {
        matchPickList.innerHTML = '';
        if (!snapshot.exists()) {
            matchPickList.innerHTML = '<p class="text-center text-muted">No matches found.</p>';
            return;
        }
        const matches = snapshot.val();
        Object.keys(matches).reverse().forEach(key => {
            const m = matches[key];
            const name = m.matchDetails?.name || key;
            const score = m.score ? `${m.score.runs}/${m.score.wickets} (${m.score.overs} ov)` : '—';
            const inn2 = m.innings1 ? `vs ${m.innings1.score.runs}/${m.innings1.score.wickets}` : '';
            const item = document.createElement('div');
            item.className = 'match-pick-item';
            item.innerHTML = `
                <div>
                    <div style="font-weight:700;">${name}</div>
                    <div style="font-size:0.8rem;color:var(--text-muted);">${m.currentInnings === 2 ? 'Innings 2' : 'Innings 1'} · ${score} ${inn2}</div>
                </div>
                <i class="fa-solid fa-chevron-right text-muted"></i>`;
            item.addEventListener('click', () => {
                // Listen live to this match
                onValue(ref(rtdb, 'matches/' + key), (snap) => {
                    if (snap.exists()) renderStats(snap.val());
                });
            });
            matchPickList.appendChild(item);
        });
    });

    // Back button
    document.getElementById('backToListBtn')?.addEventListener('click', () => {
        statsScreen.style.display = 'none';
        matchSelectScreen.style.display = 'block';
        switchTab(1); // reset to innings 1 tab
    });

    // If navigated here from live-score with a match already loaded, auto-open it
    if (store.state.matchId) {
        onValue(ref(rtdb, 'matches/' + store.state.matchId), (snap) => {
            if (snap.exists()) renderStats(snap.val());
        }, { onlyOnce: true });
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
