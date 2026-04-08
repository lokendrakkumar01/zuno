import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import zunoLogo from '../assets/zuno-logo.png';

const Landing = () => {
  return (
    <div className="landing-page" style={{ 
      minHeight: '100vh', 
      background: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
      overflowX: 'hidden'
    }}>
      {/* Navbar */}
      <nav style={{
        padding: '1.5rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src={zunoLogo} alt="ZUNO" style={{ height: '40px', borderRadius: '8px' }} />
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-accent-primary)' }}>ZUNO</span>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link to="/login" style={{ fontWeight: '500', color: 'var(--color-text-secondary)' }}>Login</Link>
          <Link to="/register" className="btn-primary" style={{ 
            padding: '0.6rem 1.5rem', 
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-accent-primary)',
            color: 'white',
            fontWeight: '600'
          }}>Join Now</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        padding: '4rem 2rem',
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4rem',
        alignItems: 'center',
        minHeight: '80vh'
      }}>
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 style={{ fontSize: '4rem', lineHeight: '1.1', marginBottom: '1.5rem', fontWeight: '800' }}>
            A <span style={{ color: 'var(--color-accent-primary)' }}>Calm</span> Space for <span style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Creators</span>
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)', marginBottom: '2.5rem', maxWidth: '500px' }}>
            ZUNO is a value-focused digital platform designed for meaningful learning, creativity, and connection. No noise, just pure value.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link to="/register" className="btn-primary" style={{ 
              padding: '1rem 2.5rem', 
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-accent-primary)',
              color: 'white',
              fontSize: '1.1rem',
              fontWeight: '600',
              boxShadow: '0 10px 20px rgba(0, 149, 246, 0.2)'
            }}>Get Started</Link>
            <Link to="/login" style={{ 
              padding: '1rem 2.5rem', 
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              fontSize: '1.1rem',
              fontWeight: '600'
            }}>Sign In</Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{ position: 'relative' }}
        >
          <div style={{
            width: '100%',
            height: '500px',
            background: 'var(--gradient-secondary)',
            borderRadius: '2rem',
            transform: 'rotate(-3deg)',
            opacity: 0.1,
            position: 'absolute',
            top: 0,
            left: 0
          }} />
          <div style={{
            width: '100%',
            height: '500px',
            background: 'var(--color-bg-card)',
            borderRadius: '2rem',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 1
          }}>
            <img src={zunoLogo} alt="Preview" style={{ width: '150px', opacity: 0.8 }} />
            <div style={{
              position: 'absolute',
              bottom: '2rem',
              left: '2rem',
              right: '2rem',
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              padding: '1.5rem',
              borderRadius: '1rem',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <div style={{ width: '40%', height: '8px', background: 'var(--color-accent-primary)', borderRadius: '4px', marginBottom: '0.5rem' }} />
              <div style={{ width: '80%', height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px' }} />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section style={{ padding: '6rem 2rem', background: 'var(--color-bg-secondary)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '4rem' }}>Why ZUNO?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {[
              { title: 'Focused Learning', desc: 'Curated content designed to help you grow without distractions.', icon: '🎓' },
              { title: 'Real-time Connection', desc: 'Instant messaging and high-quality calling for seamless collaboration.', icon: '💬' },
              { title: 'Privacy First', desc: 'Your data, your control. We prioritize security and privacy in everything.', icon: '🛡️' }
            ].map((f, i) => (
              <div key={i} style={{ 
                padding: '2rem', 
                background: 'var(--color-bg-card)', 
                borderRadius: '1.5rem',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{f.icon}</div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{f.title}</h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '4rem 2rem', textAlign: 'center', borderTop: '1px solid var(--color-border)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>&copy; 2026 ZUNO Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Landing;
