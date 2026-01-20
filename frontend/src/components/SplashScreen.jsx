import { useEffect } from 'react';
import zunoLogo from '../assets/zuno-logo.png';
import '../styles/splash.css';

const SplashScreen = ({ onComplete }) => {
      useEffect(() => {
            // Auto-navigate after 2.5 seconds
            const timer = setTimeout(() => {
                  onComplete();
            }, 2500);

            return () => clearTimeout(timer);
      }, [onComplete]);

      const handleSkip = () => {
            onComplete();
      };

      return (
            <div className="splash-screen" onClick={handleSkip}>
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

                        {/* Optional progress indicator */}
                        <div className="splash-progress">
                              <div className="splash-progress-bar"></div>
                        </div>
                  </div>
            </div>
      );
};

export default SplashScreen;
