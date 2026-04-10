import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import zunoLogo from '../assets/zuno-logo.png';

const featureCards = [
      {
            title: 'Fast feed loading',
            body: 'A calmer social home with cached data, faster refresh, and smoother first open.'
      },
      {
            title: 'Stable chat and calling',
            body: 'Direct messages, voice calls, video calls, and profile-first inbox access that feels more direct.'
      },
      {
            title: 'Live rooms that reconnect',
            body: 'Streaming is tuned for quicker joins and more resilient reconnect behavior when the network flickers.'
      }
];

const statCards = [
      { label: 'Realtime', value: 'Chat + Calls' },
      { label: 'Creator flow', value: 'Upload + Live' },
      { label: 'Experience', value: 'Low-noise UI' }
];

const panelStyle = {
      background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(18px)',
      border: '1px solid rgba(15, 23, 42, 0.08)',
      boxShadow: '0 30px 70px rgba(15, 23, 42, 0.12)'
};

const Landing = () => {
      return (
            <div className="landing-page">
                  <div className="landing-bg" />

                  <div className="landing-shell">
                        <nav className="landing-nav">
                              <Link to="/welcome" className="landing-brand">
                                    <img src={zunoLogo} alt="ZUNO" className="landing-brand-logo" />
                                    <div className="landing-brand-copy">
                                          <div className="landing-brand-title">ZUNO</div>
                                          <div className="landing-brand-subtitle">Creators, chat, live and focus</div>
                                    </div>
                              </Link>

                              <div className="landing-nav-actions">
                                    <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
                                    <Link to="/register" className="btn btn-primary btn-sm">Create Account</Link>
                              </div>
                        </nav>

                        <section className="landing-hero">
                              <motion.div
                                    className="landing-copy"
                                    initial={{ opacity: 0, y: 24 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.55 }}
                              >
                                    <div className="landing-kicker">Dynamic social platform</div>

                                    <h1 className="landing-title">
                                          Open ZUNO into a faster,
                                          <span> cleaner, more alive experience.</span>
                                    </h1>

                                    <p className="landing-description">
                                          Login, create your account, jump into your feed, and switch between profile inbox, live streams, and calls without the interface feeling heavy.
                                    </p>

                                    <div className="landing-cta-row">
                                          <Link to="/register" className="btn btn-primary landing-cta">
                                                Create Your Space
                                          </Link>
                                          <Link to="/login" className="btn btn-secondary landing-cta">
                                                Open My Account
                                          </Link>
                                    </div>

                                    <div className="landing-stat-grid">
                                          {statCards.map((card) => (
                                                <div key={card.label} className="landing-stat-card" style={panelStyle}>
                                                      <div className="landing-stat-label">{card.label}</div>
                                                      <div className="landing-stat-value">{card.value}</div>
                                                </div>
                                          ))}
                                    </div>
                              </motion.div>

                              <motion.div
                                    className="landing-panel"
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.6, delay: 0.08 }}
                              >
                                    <div className="landing-panel-frame" style={panelStyle}>
                                          <div className="landing-panel-grid">
                                                <div className="landing-highlight-card">
                                                      <div className="landing-highlight-orb" />
                                                      <div className="landing-highlight-content">
                                                            <div className="landing-highlight-head">
                                                                  <span className="landing-highlight-chip">Live + Chat</span>
                                                                  <span className="landing-highlight-status">Connected</span>
                                                            </div>
                                                            <h2>Your platform should feel quick the moment it opens.</h2>
                                                            <p>Faster inbox access, better reconnect behavior, and a more polished launch screen for login and account creation.</p>
                                                      </div>
                                                </div>

                                                <div className="landing-feature-grid">
                                                      {featureCards.map((card, index) => (
                                                            <motion.div
                                                                  key={card.title}
                                                                  className="landing-feature-card"
                                                                  initial={{ opacity: 0, x: 18 }}
                                                                  animate={{ opacity: 1, x: 0 }}
                                                                  transition={{ duration: 0.45, delay: 0.15 + index * 0.1 }}
                                                                  style={panelStyle}
                                                            >
                                                                  <div className="landing-feature-title">{card.title}</div>
                                                                  <div className="landing-feature-body">{card.body}</div>
                                                            </motion.div>
                                                      ))}
                                                </div>
                                          </div>
                                    </div>
                              </motion.div>
                        </section>

                        <section className="landing-summary">
                              <div className="landing-summary-card" style={panelStyle}>
                                    <div>
                                          <div className="landing-summary-label">Why it feels better</div>
                                          <div className="landing-summary-title">Less clutter. More momentum.</div>
                                    </div>
                                    <div className="landing-summary-copy">
                                          Profile-first messaging keeps inbox actions close to the user profile, which makes chat and calling easier to discover.
                                    </div>
                                    <div className="landing-summary-copy">
                                          Streaming and realtime features are tuned to handle reconnects more gracefully instead of collapsing the session too quickly.
                                    </div>
                              </div>
                        </section>

                        <footer className="landing-footer">
                              <p>&copy; 2026 ZUNO Platform. All rights reserved. Created by Lokendra Kumar</p>
                        </footer>
                  </div>
            </div>
      );
};

export default Landing;
