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
            <div
                  className="landing-page"
                  style={{
                        minHeight: '100vh',
                        color: 'var(--color-text-primary)',
                        background: 'linear-gradient(180deg, #fffdf7 0%, #eef6ff 45%, #f7fbff 100%)',
                        overflow: 'hidden',
                        position: 'relative'
                  }}
            >
                  <div
                        style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'radial-gradient(circle at top left, rgba(249, 115, 22, 0.16), transparent 28%), radial-gradient(circle at 85% 20%, rgba(14, 165, 233, 0.18), transparent 24%), radial-gradient(circle at 50% 80%, rgba(16, 185, 129, 0.14), transparent 22%)',
                              pointerEvents: 'none'
                        }}
                  />

                  <div style={{ position: 'relative', zIndex: 1 }}>
                        <nav
                              style={{
                                    padding: '1.5rem 2rem',
                                    maxWidth: '1240px',
                                    margin: '0 auto',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '1rem',
                                    flexWrap: 'wrap'
                              }}
                        >
                              <Link to="/welcome" style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', textDecoration: 'none', color: 'inherit' }}>
                                    <img src={zunoLogo} alt="ZUNO" style={{ width: '52px', height: '52px', borderRadius: '16px', boxShadow: '0 18px 30px rgba(249, 115, 22, 0.22)' }} />
                                    <div>
                                          <div style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '0.02em', fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}>ZUNO</div>
                                          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>Creators, chat, live and focus</div>
                                    </div>
                              </Link>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                                    <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
                                    <Link to="/register" className="btn btn-primary btn-sm">Create Account</Link>
                              </div>
                        </nav>

                        <section
                              style={{
                                    maxWidth: '1240px',
                                    margin: '0 auto',
                                    padding: '2rem',
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)',
                                    gap: '2rem',
                                    alignItems: 'center'
                              }}
                        >
                              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.9rem', borderRadius: '999px', background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(15, 23, 42, 0.08)', color: '#0f766e', fontWeight: 700, marginBottom: '1.2rem' }}>
                                          Dynamic social platform
                                    </div>

                                    <h1
                                          style={{
                                                fontSize: 'clamp(2.8rem, 6vw, 5.4rem)',
                                                lineHeight: 1,
                                                marginBottom: '1.2rem',
                                                letterSpacing: '-0.04em',
                                                fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif'
                                          }}
                                    >
                                          Open ZUNO into a faster,
                                          <span style={{ display: 'block', color: '#ea580c' }}> cleaner, more alive experience.</span>
                                    </h1>

                                    <p style={{ fontSize: '1.08rem', maxWidth: '640px', color: 'var(--color-text-secondary)', marginBottom: '1.75rem' }}>
                                          Login, create your account, jump into your feed, and switch between profile inbox, live streams, and calls without the interface feeling heavy.
                                    </p>

                                    <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', marginBottom: '1.8rem' }}>
                                          <Link to="/register" className="btn btn-primary" style={{ minWidth: '180px', justifyContent: 'center' }}>Create Your Space</Link>
                                          <Link to="/login" className="btn btn-secondary" style={{ minWidth: '180px', justifyContent: 'center' }}>Open My Account</Link>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
                                          {statCards.map((card) => (
                                                <div key={card.label} style={{ ...panelStyle, borderRadius: '22px', padding: '1rem 1.1rem' }}>
                                                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>{card.label}</div>
                                                      <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{card.value}</div>
                                                </div>
                                          ))}
                                    </div>
                              </motion.div>

                              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.08 }}>
                                    <div style={{ ...panelStyle, borderRadius: '30px', padding: '1.35rem' }}>
                                          <div style={{ display: 'grid', gap: '1rem' }}>
                                                <div style={{ borderRadius: '24px', padding: '1.1rem', background: 'linear-gradient(135deg, #101828 0%, #1e293b 100%)', color: '#f8fafc', minHeight: '180px', position: 'relative', overflow: 'hidden' }}>
                                                      <div style={{ position: 'absolute', right: '-2rem', top: '-2rem', width: '150px', height: '150px', borderRadius: '999px', background: 'rgba(249,115,22,0.24)' }} />
                                                      <div style={{ position: 'relative' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                                  <span style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', background: 'rgba(255,255,255,0.1)', fontSize: '0.78rem', fontWeight: 700 }}>Live + Chat</span>
                                                                  <span style={{ color: '#86efac', fontWeight: 700 }}>Connected</span>
                                                            </div>
                                                            <h2 style={{ fontSize: '1.7rem', lineHeight: 1.05, marginBottom: '0.7rem' }}>Your platform should feel quick the moment it opens.</h2>
                                                            <p style={{ color: 'rgba(248,250,252,0.76)', maxWidth: '320px' }}>Faster inbox access, better reconnect behavior, and a more polished launch screen for login and account creation.</p>
                                                      </div>
                                                </div>

                                                <div style={{ display: 'grid', gap: '0.9rem' }}>
                                                      {featureCards.map((card, index) => (
                                                            <motion.div
                                                                  key={card.title}
                                                                  initial={{ opacity: 0, x: 18 }}
                                                                  animate={{ opacity: 1, x: 0 }}
                                                                  transition={{ duration: 0.45, delay: 0.15 + index * 0.1 }}
                                                                  style={{ ...panelStyle, borderRadius: '22px', padding: '1rem 1.05rem' }}
                                                            >
                                                                  <div style={{ fontWeight: 800, marginBottom: '0.35rem' }}>{card.title}</div>
                                                                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>{card.body}</div>
                                                            </motion.div>
                                                      ))}
                                                </div>
                                          </div>
                                    </div>
                              </motion.div>
                        </section>

                        <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 2rem 4rem' }}>
                              <div
                                    style={{
                                          ...panelStyle,
                                          borderRadius: '30px',
                                          padding: '1.5rem',
                                          display: 'grid',
                                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                          gap: '1rem'
                                    }}
                              >
                                    <div>
                                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>Why it feels better</div>
                                          <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.1 }}>Less clutter. More momentum.</div>
                                    </div>
                                    <div style={{ color: 'var(--color-text-secondary)' }}>
                                          Profile-first messaging keeps inbox actions close to the user profile, which makes chat and calling easier to discover.
                                    </div>
                                    <div style={{ color: 'var(--color-text-secondary)' }}>
                                          Streaming and realtime features are tuned to handle reconnects more gracefully instead of collapsing the session too quickly.
                                    </div>
                              </div>
                        </section>

                        <footer style={{ padding: '0 2rem 3rem', textAlign: 'center' }}>
                              <p style={{ color: 'var(--color-text-muted)' }}>
                                    &copy; 2026 ZUNO Platform. All rights reserved. Created by Lokendra kumar
                              </p>
                        </footer>
                  </div>
            </div>
      );
};

export default Landing;
