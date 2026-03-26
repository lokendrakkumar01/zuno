import React, { useState, useEffect, useRef } from 'react';
import './CricketGame.css';

const OUTCOMES = [
    { type: 'OUT', runs: 0, color: '#ef4444', message: 'WICKET! Clean bowled! 🏏💥', sound: 'out' },
    { type: '0', runs: 0, color: '#6b7280', message: 'Dot ball. Good bowling. 🧐', sound: 'miss' },
    { type: '1', runs: 1, color: '#3b82f6', message: 'Pushed for a quick single. 🏃‍♂️', sound: 'hit' },
    { type: '2', runs: 2, color: '#8b5cf6', message: 'Placed in the gap for two! 🏃‍♂️🏃‍♂️', sound: 'hit' },
    { type: '4', runs: 4, color: '#f59e0b', message: 'FOUR! Smashed to the boundary! 🔥', sound: 'boundary' },
    { type: '6', runs: 6, color: '#10b981', message: 'SIX! Into the stands! Massive hit! 🚀', sound: 'boundary' }
];

const DEFAULT_PLAYERS = ['Virat (C)', 'Rohit', 'Gill', 'Surya', 'Hardik', 'Pant (WK)'];

const CricketGame = () => {
    const [gameState, setGameState] = useState('menu'); // menu, team-builder, playing, over
    const [teamName, setTeamName] = useState('Zuno Strikers');
    const [players, setPlayers] = useState([...DEFAULT_PLAYERS]);
    const [newPlayer, setNewPlayer] = useState('');
    
    // Game Stats
    const [score, setScore] = useState(0);
    const [wickets, setWickets] = useState(0);
    const [ballsLeft, setBallsLeft] = useState(12); // 2 overs
    
    // Animation & UI state
    const [isBowling, setIsBowling] = useState(false);
    const [actionMessage, setActionMessage] = useState('Welcome to Zuno Cricket!');
    const [actionColor, setActionColor] = useState('#fff');
    const [batSwing, setBatSwing] = useState(false);
    const [cameraShake, setCameraShake] = useState(false);
    
    const animationRef = useRef(null);
    const speedRef = useRef(1);
    const ballRef = useRef(null);
    const ballPosRef = useRef(-20);
    
    // Direct DOM manipulation for butter-smooth 60fps
    const updateBallDOM = (pos) => {
        if (ballRef.current) {
            ballRef.current.style.top = `${pos}%`;
            ballRef.current.style.transform = `translate(-50%, -50%) scale(${1 + (pos/100)})`;
            ballRef.current.style.opacity = pos < 0 || pos > 100 ? 0 : 1;
        }
    };
    
    // Audio Refs
    const bgmRef = useRef(null);
    const hitSoundRef = useRef(null);
    const crowdSoundRef = useRef(null);
    const outSoundRef = useRef(null);
    const bowlSoundRef = useRef(null);

    const initAudio = () => {
        if (bgmRef.current) return; // Already initialized

        // Initialize sounds using free mixkit/freesound assets
        bgmRef.current = new Audio('https://assets.mixkit.co/music/preview/mixkit-game-level-music-689.mp3');
        bgmRef.current.loop = true;
        bgmRef.current.volume = 0.2;
        
        hitSoundRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-hard-pop-click-2364.mp3');
        crowdSoundRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-crowd-cheer-and-applause-574.mp3');
        
        outSoundRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-losing-bleeps-2026.mp3');
        bowlSoundRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-fast-whoosh-118.mp3');
        
        // Unlock audio context for mobile browsers
        bgmRef.current.play().then(() => {
            bgmRef.current.pause();
        }).catch(e => console.log('Audio unlock failed', e));
    };

    useEffect(() => {
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            bgmRef.current?.pause();
        };
    }, []);

    const playFallbackTone = (type) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            if (type === 'hit') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.1);
            } else if (type === 'boundary') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1000, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.5);
            } else if (type === 'out') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);
                gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.5);
            }
        } catch (e) {
            console.log('Web Audio fallback failed', e);
        }
    };

    const playSoundEffect = (type) => {
        try {
            let sound = null;
            if (type === 'hit') sound = hitSoundRef.current;
            if (type === 'boundary') sound = hitSoundRef.current;
            if (type === 'out') sound = outSoundRef.current;
            if (type === 'bowl') sound = bowlSoundRef.current;

            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(e => {
                    playFallbackTone(type);
                });
                if (type === 'boundary' && crowdSoundRef.current) {
                    crowdSoundRef.current.currentTime = 0; 
                    crowdSoundRef.current.play().catch(() => {});
                }
            } else {
                playFallbackTone(type);
            }
        } catch(e) {}
    };

    const handleAddPlayer = (e) => {
        e.preventDefault();
        if (newPlayer.trim() && players.length < 11) {
            setPlayers([...players, newPlayer.trim()]);
            setNewPlayer('');
        }
    };

    const handleRemovePlayer = (idx) => {
        setPlayers(players.filter((_, i) => i !== idx));
    };

    const startGame = () => {
        setGameState('playing');
        setScore(0);
        setWickets(0);
        setBallsLeft(12); // 2 overs
        setActionMessage(`Let's go ${teamName}!`);
        setActionColor('#e0e7ff');
        ballPosRef.current = -20;
        updateBallDOM(-20);
        setIsBowling(false);
        try { bgmRef.current?.play(); } catch(e) {}
    };

    const stopGame = () => {
        setGameState('menu');
        try { bgmRef.current?.pause(); bgmRef.current.currentTime = 0; } catch(e) {}
    };

    const bowlBall = () => {
        // Can't bowl if out of bounds or game over conditions met
        if (isBowling || ballsLeft <= 0 || wickets >= players.length - 1) return;
        
        setIsBowling(true);
        ballPosRef.current = -20;
        updateBallDOM(-20);
        setActionMessage('Bowler running in... 💨');
        setActionColor('#fbbf24');
        playSoundEffect('bowl');
        
        // Randomize speed slightly. Make it playable (around 1.2 to 2.5 units per frame)
        speedRef.current = 1.2 + Math.random() * 1.5; 

        const animateBall = () => {
             ballPosRef.current += speedRef.current;
             
             if (ballPosRef.current > 120) {
                  // Ball passed without hit -> Dot ball
                  updateBallDOM(-20);
                  ballPosRef.current = -20;
                  handleResult(0, 'Missed it! Dot ball. 😅', '0', '#6b7280', 'miss');
             } else {
                  updateBallDOM(ballPosRef.current);
                  animationRef.current = requestAnimationFrame(animateBall);
             }
        };
        animationRef.current = requestAnimationFrame(animateBall);
    };

    const handleHit = () => {
        if (!isBowling) return;
        
        setBatSwing(true);
        setTimeout(() => setBatSwing(false), 300);

        cancelAnimationFrame(animationRef.current);
        const currentPos = ballPosRef.current;
        
        // Calculate timing
        let outcome;
        // Perfect timing (4 or 6) - 70 to 90
        if (currentPos >= 70 && currentPos <= 90) {
            outcome = Math.random() > 0.4 ? OUTCOMES[5] : OUTCOMES[4];
            triggerCameraShake();
        } 
        // Good timing (1, 2) - 50 to 70 or 90 to 110
        else if ((currentPos >= 50 && currentPos < 70) || (currentPos > 90 && currentPos <= 110)) {
            outcome = Math.random() > 0.5 ? OUTCOMES[2] : OUTCOMES[3];
        } 
        // Bad timing (Out or 0)
        else {
            outcome = (Math.random() > 0.4) ? OUTCOMES[0] : OUTCOMES[1]; 
            if (outcome.type === 'OUT') triggerCameraShake();
        }

        handleResult(outcome.runs, outcome.message, outcome.type, outcome.color, outcome.sound);
        
        // Move ball away quickly
        ballPosRef.current = 150;
        updateBallDOM(150);
    };

    const handleResult = (runs, message, type = '0', color = '#fff', sound = null) => {
        setIsBowling(false);
        setActionMessage(message);
        setActionColor(color);
        
        if (sound) playSoundEffect(sound);
        
        if (type === 'OUT') {
            setWickets(w => w + 1);
        } else {
            setScore(s => s + runs);
        }
        
        setBallsLeft(b => b - 1);
    };
    
    const triggerCameraShake = () => {
        setCameraShake(true);
        setTimeout(() => setCameraShake(false), 500);
    };

    useEffect(() => {
        if (gameState === 'playing' && (ballsLeft <= 0 || wickets >= players.length - 1)) {
            setTimeout(() => {
                setGameState('over');
                try { bgmRef.current?.pause(); } catch(e) {}
            }, 1500);
        }
    }, [ballsLeft, wickets, players.length, gameState]);

    // RENDER MENU
    if (gameState === 'menu') {
        return (
            <div className="cricket-game-container cricket-menu">
                <div className="cricket-hero">
                    <span className="cricket-emoji-hero">🏏</span>
                    <h2>Zuno Premium Cricket</h2>
                    <p>Build your dream team and smash some boundaries!</p>
                </div>
                <div className="cricket-game-actions">
                    <button className="cricket-btn primary btn-pulse" onClick={() => { initAudio(); setGameState('team-builder'); }}>
                        Manage Team
                    </button>
                    <button className="cricket-btn secondary" onClick={() => { initAudio(); startGame(); }}>
                        Quick Play
                    </button>
                </div>
            </div>
        );
    }

    // RENDER TEAM BUILDER
    if (gameState === 'team-builder') {
        return (
            <div className="cricket-game-container">
                <div className="cricket-header-flex">
                    <button className="cricket-icon-btn" onClick={() => setGameState('menu')}>🔙 Menu</button>
                    <h3>Team Builder</h3>
                </div>
                
                <div className="cricket-form-group">
                    <label>Team Name</label>
                    <input 
                        type="text" 
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="cricket-input"
                        placeholder="Enter team name"
                        maxLength={20}
                    />
                </div>
                
                <div className="cricket-roster">
                    <div className="cricket-roster-header">
                        <h4>Players ({players.length}/11)</h4>
                        {players.length < 11 && <span className="text-xs text-muted">Add more players!</span>}
                    </div>
                    
                    <ul className="cricket-player-list">
                        {players.map((p, idx) => (
                            <li key={idx} className="cricket-player-item animate-pop">
                                <span>{idx + 1}. {p}</span>
                                {players.length > 2 && (
                                    <button className="cricket-remove-btn" onClick={() => handleRemovePlayer(idx)}>✕</button>
                                )}
                            </li>
                        ))}
                    </ul>
                    
                    {players.length < 11 && (
                        <form onSubmit={handleAddPlayer} className="cricket-add-player-form">
                            <input 
                                type="text" 
                                value={newPlayer}
                                onChange={(e) => setNewPlayer(e.target.value)}
                                className="cricket-input"
                                placeholder="Player name..."
                                maxLength={15}
                            />
                            <button type="submit" className="cricket-add-btn">+</button>
                        </form>
                    )}
                </div>
                
                <button className="cricket-btn primary w-full mt-lg" onClick={startGame}>
                    Start Match
                </button>
            </div>
        );
    }

    // RENDER PLAYING / OVER
    const currentBatsman = wickets < players.length ? players[wickets] : players[players.length - 1];

    return (
        <div className={`cricket-game-container ${cameraShake ? 'camera-shake' : ''}`}>
            
            <div className="cricket-match-header">
                <div>
                    <h3 className="team-name-title">{teamName}</h3>
                    <div className="batsman-name">Batting: <strong>{currentBatsman}</strong></div>
                </div>
                {gameState !== 'over' && (
                    <button className="cricket-icon-btn quit" onClick={stopGame}>Quit</button>
                )}
            </div>

            <div className="cricket-scoreboard">
                <div className="cricket-stat">
                    <span>Score</span>
                    <strong style={{ color: '#fbbf24' }}>{score}/{wickets}</strong>
                </div>
                <div className="cricket-stat">
                    <span>Overs</span>
                    <strong>{Math.floor((12 - ballsLeft)/6)}.{ (12 - ballsLeft) % 6 } / 2.0</strong>
                </div>
            </div>

            <div className="cricket-scene">
                {/* The stadium background */}
                <div className="stadium-bg"></div>
                
                {/* Pitch */}
                <div className="cricket-pitch">
                    <div className="pitch-crease top-crease"></div>
                    
                    <div className="cricket-stumps top-stumps">
                        <div className="stump"></div><div className="stump"></div><div className="stump"></div>
                    </div>
                    
                    {/* The Ball */}
                    <div 
                        className="cricket-ball" 
                        ref={ballRef}
                        style={{ 
                            top: `-20%`, 
                            transform: `translate(-50%, -50%) scale(0.8)`,
                            opacity: 0
                        }}
                    ></div>

                    <div className="pitch-crease bottom-crease"></div>
                    <div className="cricket-stumps bottom-stumps">
                        <div className="stump"></div><div className="stump"></div><div className="stump"></div>
                    </div>

                    {/* The Bat */}
                    <div className={`cricket-bat ${batSwing ? 'swing' : ''}`}></div>
                </div>
            </div>

            <div className="cricket-commentary highlight" style={{ color: actionColor }}>
                {actionMessage}
            </div>

            <div className="cricket-controls">
                {gameState === 'playing' && !isBowling && (
                    <button className="cricket-btn bowl-btn w-full" onPointerDown={bowlBall}>
                        💨 BOWL NEXT BALL
                    </button>
                )}
                
                {gameState === 'playing' && isBowling && (
                    <button className="cricket-btn hit-btn w-full" onPointerDown={handleHit}>
                        💥 SMASH IT!
                    </button>
                )}
                
                {gameState === 'over' && (
                    <div className="cricket-game-over animate-pop">
                        <h3>Innings Over!</h3>
                        <div className="cricket-final-score">
                            <span>Final Score</span>
                            <strong>{score}/{wickets}</strong>
                        </div>
                        <p className="mt-sm">You scored <strong>{score}</strong> runs in {12 - ballsLeft} balls.</p>
                        
                        <div className="cricket-performance-rating" style={{ margin: '16px 0', fontSize: '1.2rem', fontWeight: 800 }}>
                            {score >= 36 ? '🏆 MASTER BLASTER!' : score >= 20 ? '🔥 GREAT KNOCK!' : '😅 NEEDS PRACTICE'}
                        </div>
                        
                        <div className="cricket-game-actions mt-lg">
                            <button className="cricket-btn secondary" onClick={() => setGameState('menu')}>Menu</button>
                            <button className="cricket-btn primary" onClick={startGame}>🔄 Play Again</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CricketGame;
