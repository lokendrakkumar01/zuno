import React, { useState, useEffect, useRef } from 'react';
import './CricketGame.css';

const OUTCOMES = [
    { type: 'OUT', runs: 0, color: '#ef4444', message: 'WICKET! Clean bowled! 🏏💥' },
    { type: '0', runs: 0, color: '#6b7280', message: 'Dot ball. Good bowling. 🧐' },
    { type: '1', runs: 1, color: '#3b82f6', message: 'Pushed for a quick single. 🏃‍♂️' },
    { type: '2', runs: 2, color: '#8b5cf6', message: 'Placed in the gap for two! 🏃‍♂️🏃‍♂️' },
    { type: '4', runs: 4, color: '#f59e0b', message: 'FOUR! Smashed to the boundary! 🔥' },
    { type: '6', runs: 6, color: '#10b981', message: 'SIX! Into the stands! Massive hit! 🚀' }
];

const CricketGame = () => {
    const [gameState, setGameState] = useState('start'); // start, playing, over
    const [score, setScore] = useState(0);
    const [wickets, setWickets] = useState(0);
    const [ballsLeft, setBallsLeft] = useState(6);
    const [ballPos, setBallPos] = useState(-20); // -20 to 120
    const [isBowling, setIsBowling] = useState(false);
    const [actionMessage, setActionMessage] = useState('Get Ready!');
    const [actionColor, setActionColor] = useState('#fff');
    const [batSwing, setBatSwing] = useState(false);
    
    const animationRef = useRef(null);
    const speedRef = useRef(1);

    const startGame = () => {
        setGameState('playing');
        setScore(0);
        setWickets(0);
        setBallsLeft(6);
        setActionMessage('Ready to bat... 🏏');
        setActionColor('#e0e7ff');
        setBallPos(-20);
        setIsBowling(false);
    };

    const bowlBall = () => {
        if (isBowling || ballsLeft <= 0 || wickets >= 2) return;
        
        setIsBowling(true);
        setBallPos(-20);
        setActionMessage('Bowler running in... 💨');
        setActionColor('#fbbf24');
        
        // Randomize speed slightly
        speedRef.current = 2 + Math.random() * 2; 

        const animateBall = () => {
            setBallPos(prev => {
                if (prev > 120) {
                    // Ball passed without hit -> Dot ball
                    handleResult(0, 'Missed it! Dot ball.');
                    return -20;
                }
                return prev + speedRef.current;
            });
            animationRef.current = requestAnimationFrame(animateBall);
        };
        animationRef.current = requestAnimationFrame(animateBall);
    };

    const handleHit = () => {
        if (!isBowling) return;
        
        setBatSwing(true);
        setTimeout(() => setBatSwing(false), 200);

        cancelAnimationFrame(animationRef.current);
        
        // Calculate timing
        // Ideal hit zone is between 75 and 90
        let outcome;
        if (ballPos >= 75 && ballPos <= 90) {
            // Perfect timing (4 or 6)
            outcome = Math.random() > 0.5 ? OUTCOMES[5] : OUTCOMES[4];
        } else if ((ballPos >= 60 && ballPos < 75) || (ballPos > 90 && ballPos <= 100)) {
            // Good timing (1, 2)
            outcome = Math.random() > 0.5 ? OUTCOMES[2] : OUTCOMES[3];
        } else {
            // Bad timing (Out or 0)
            outcome = (Math.random() > 0.3) ? OUTCOMES[0] : OUTCOMES[1]; 
        }

        handleResult(outcome.runs, outcome.message, outcome.type, outcome.color);
        
        // Move ball away quickly
        setBallPos(150); 
    };

    const handleResult = (runs, message, type = '0', color = '#fff') => {
        setIsBowling(false);
        setActionMessage(message);
        setActionColor(color);
        
        if (type === 'OUT') {
            setWickets(w => w + 1);
        } else {
            setScore(s => s + runs);
        }
        
        setBallsLeft(b => b - 1);
    };

    useEffect(() => {
        if (ballsLeft <= 0 || wickets >= 2) {
            setTimeout(() => {
                setGameState('over');
            }, 1000);
        }
    }, [ballsLeft, wickets]);

    useEffect(() => {
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    return (
        <div className="cricket-game-container">
            <div className="cricket-scoreboard">
                <div className="cricket-stat">
                    <span>Score</span>
                    <strong style={{ color: '#fbbf24' }}>{score}/{wickets}</strong>
                </div>
                <div className="cricket-stat">
                    <span>Balls Left</span>
                    <strong>{ballsLeft}</strong>
                </div>
            </div>

            <div className="cricket-scene">
                {/* Pitch */}
                <div className="cricket-pitch">
                    <div className="cricket-stumps top-stumps">
                        <div className="stump"></div><div className="stump"></div><div className="stump"></div>
                    </div>
                    
                    {/* The Ball */}
                    <div 
                        className="cricket-ball" 
                        style={{ 
                            top: `${ballPos}%`, 
                            transform: `translate(-50%, -50%) scale(${1 + (ballPos/100)})`,
                            opacity: ballPos < 0 || ballPos > 100 ? 0 : 1
                        }}
                    ></div>

                    <div className="cricket-stumps bottom-stumps">
                        <div className="stump"></div><div className="stump"></div><div className="stump"></div>
                    </div>

                    {/* The Bat */}
                    <div className={`cricket-bat ${batSwing ? 'swing' : ''}`}></div>
                </div>
            </div>

            <div className="cricket-commentary" style={{ color: actionColor }}>
                {actionMessage}
            </div>

            <div className="cricket-controls">
                {gameState === 'start' && (
                    <button className="cricket-btn primary" onClick={startGame}>🏏 Play Cricket</button>
                )}
                
                {gameState === 'playing' && !isBowling && (
                    <button className="cricket-btn bowl-btn" onClick={bowlBall}>💨 Bowl</button>
                )}
                
                {gameState === 'playing' && isBowling && (
                    <button className="cricket-btn hit-btn" onClick={handleHit}>💥 HIT!</button>
                )}
                
                {gameState === 'over' && (
                    <div className="cricket-game-over">
                        <h3>Innings Over!</h3>
                        <p>You scored <strong>{score}</strong> runs in {6 - ballsLeft} balls.</p>
                        <button className="cricket-btn primary mt-sm" onClick={startGame}>🔄 Play Again</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CricketGame;
