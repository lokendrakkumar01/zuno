import { useEffect, useState } from 'react';
import zunoLogo from '../assets/zuno-logo.png';
import '../styles/splash.css';

const SplashScreen = ({ onComplete }) => {
      const [exit, setExit] = useState(false);

      useEffect(() => {
            // Faster exit animation
            const timer = setTimeout(() => {
                  setExit(true);
                  setTimeout(onComplete, 280);
            }, 650);

            return () => clearTimeout(timer);
      }, [onComplete]);

      const handleSkip = () => {
            setExit(true);
            setTimeout(onComplete, 160);
      };

      return (
            <div className={`splash-screen ${exit ? 'exit' : ''}`} onClick={handleSkip}>
                  <div className="splash-content">
                        <div className="splash-logo-container">
                              <img
                                    src={zunoLogo}
                                    alt="ZUNO"
                                    className="splash-logo"
                              />
                              <div className="splash-glow"></div>
                        </div>
                        <h1 className="splash-title">ZUNO</h1>
                        <div className="splash-tagline">Your Creative Universe</div>

                        <div className="splash-progress">
                              <div className="splash-progress-bar"></div>
                        </div>
                  </div>
            </div>
      );
};

export default SplashScreen;
