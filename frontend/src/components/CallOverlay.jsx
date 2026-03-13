import React, { useEffect, useState } from 'react';
import { useCallContext } from '../context/CallContext';

/* ── Inject CSS once ── */
const CallStyles = () => {
  useEffect(() => {
    const id = 'zuno-call-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes callPulseRing {
        0%   { transform: scale(1);   opacity:.9; }
        50%  { transform: scale(1.18);opacity:.5; }
        100% { transform: scale(1);   opacity:.9; }
      }
      @keyframes callRingWave {
        0%   { transform:scale(1);   opacity:.7; }
        100% { transform:scale(2.2); opacity:0; }
      }
      @keyframes callFadeIn {
        from { opacity:0; transform:scale(.92); }
        to   { opacity:1; transform:scale(1); }
      }
      @keyframes callSlideUp {
        from { opacity:0; transform:translateY(40px); }
        to   { opacity:1; transform:translateY(0); }
      }
      @keyframes callDot {
        0%,80%,100% { transform:scale(0); opacity:0; }
        40%          { transform:scale(1); opacity:1; }
      }
      @keyframes callBtnPop {
        0%  { transform:scale(1); }
        40% { transform:scale(.88); }
        100%{ transform:scale(1); }
      }
      @keyframes callNeonGlow {
        0%,100% { box-shadow: 0 0 12px rgba(99,102,241,.5), 0 0 30px rgba(99,102,241,.2); }
        50%     { box-shadow: 0 0 20px rgba(99,102,241,.9), 0 0 50px rgba(99,102,241,.4); }
      }

      .call-overlay-modal {
        position:fixed; inset:0; z-index:999999;
        display:flex; align-items:center; justify-content:center;
        background:rgba(0,0,0,.8); backdrop-filter:blur(12px);
        animation: callFadeIn .3s ease;
      }
      .call-modal-card {
        background:linear-gradient(160deg,#1a1a2e,#16213e);
        border:1px solid rgba(99,102,241,.25); border-radius:28px;
        padding:44px 36px; text-align:center; min-width:300px; max-width:380px; width:90%;
        box-shadow:0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(99,102,241,.1);
        animation: callSlideUp .35s ease;
      }
      .call-avatar-wrap {
        position:relative; width:100px; height:100px;
        margin:0 auto 20px; border-radius:50%; display:flex; align-items:center; justify-content:center;
      }
      .call-avatar-wave {
        position:absolute; inset:0; border-radius:50%;
        border:2px solid rgba(99,102,241,.6);
        animation: callRingWave 2s ease-out infinite;
      }
      .call-avatar-wave:nth-child(2) { animation-delay:.5s; }
      .call-avatar-wave:nth-child(3) { animation-delay:1s; }
      .call-avatar-img {
        width:100px; height:100px; border-radius:50%; object-fit:cover;
        border:3px solid rgba(99,102,241,.5); position:relative; z-index:2;
        box-shadow:0 8px 32px rgba(0,0,0,.5);
        animation: callNeonGlow 2.5s ease-in-out infinite;
      }
      .call-avatar-initials {
        width:100px; height:100px; border-radius:50%;
        background:linear-gradient(135deg,#6366f1,#8b5cf6);
        display:flex; align-items:center; justify-content:center;
        font-size:2.4rem; font-weight:800; color:#fff; position:relative; z-index:2;
        box-shadow:0 8px 32px rgba(99,102,241,.4);
        animation: callNeonGlow 2.5s ease-in-out infinite;
      }
      .call-name { font-size:1.3rem; font-weight:800; color:#f1f5f9; margin:0 0 6px; }
      .call-status {
        font-size:.9rem; color:#94a3b8; margin-bottom:32px;
        display:flex; align-items:center; justify-content:center; gap:6px;
      }
      .call-status-dot {
        width:7px; height:7px; border-radius:50%; background:#6366f1;
        animation: callDot 1.4s ease-in-out infinite;
        display:inline-block;
      }
      .call-status-dot:nth-child(2) { animation-delay:.16s; }
      .call-status-dot:nth-child(3) { animation-delay:.32s; }
      .call-btn-row { display:flex; gap:16px; justify-content:center; }
      .call-btn {
        width:64px; height:64px; border-radius:50%; border:none;
        cursor:pointer; display:flex; align-items:center; justify-content:center;
        font-size:1.5rem; transition:all .18s ease; box-shadow:0 6px 20px rgba(0,0,0,.4);
      }
      .call-btn:active { animation: callBtnPop .2s ease; }
      .call-btn-end  { background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff; }
      .call-btn-end:hover  { transform:scale(1.08) translateY(-2px); box-shadow:0 10px 30px rgba(239,68,68,.5); }
      .call-btn-answer{ background:linear-gradient(135deg,#10b981,#059669); color:#fff; }
      .call-btn-answer:hover{ transform:scale(1.08) translateY(-2px); box-shadow:0 10px 30px rgba(16,185,129,.5); }
      .call-type-badge {
        display:inline-flex; align-items:center; gap:6px; background:rgba(99,102,241,.15);
        border:1px solid rgba(99,102,241,.25); border-radius:99px; padding:4px 14px;
        font-size:.8rem; font-weight:600; color:#818cf8; margin-bottom:24px;
      }

      /* Active Call Screen */
      .call-active-overlay {
        position:fixed; inset:0; z-index:999999;
        background:#0a0a14; display:flex; flex-direction:column;
        /* iPhone safe area */
        padding-top: env(safe-area-inset-top, 0px);
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }
      .call-active-header {
        padding:16px 20px; display:flex; align-items:center; justify-content:space-between;
        background:rgba(255,255,255,.04); border-bottom:1px solid rgba(255,255,255,.06);
        backdrop-filter:blur(10px);
      }
      .call-header-info { display:flex; align-items:center; gap:12px; }
      .call-header-name { font-weight:700; font-size:1rem; color:#f1f5f9; }
      .call-header-timer { font-size:.78rem; color:#6366f1; font-weight:600; }
      .call-header-badge {
        background:rgba(99,102,241,.15); border:1px solid rgba(99,102,241,.3); border-radius:99px;
        padding:4px 12px; font-size:.75rem; color:#818cf8; font-weight:600;
      }
      .call-video-area { flex:1; position:relative; overflow:hidden; background:#0a0a14; }
      .call-remote-video { width:100%; height:100%; object-fit:cover; }
      .call-local-pip {
        position:absolute; bottom:20px; right:16px;
        width:110px; height:150px; border-radius:14px; overflow:hidden;
        border:2.5px solid rgba(255,255,255,.25); box-shadow:0 8px 24px rgba(0,0,0,.6);
        z-index:10; transition:transform .2s;
        /* Draggable feel */
        cursor:grab;
      }
      .call-local-pip:active { cursor:grabbing; transform:scale(.97); }
      .call-local-pip video { width:100%; height:100%; object-fit:cover; }
      .call-avatar-center {
        position:absolute; inset:0; display:flex; align-items:center;
        justify-content:center; flex-direction:column; background:#0a0a14;
      }
      .call-avatar-center-img {
        width:120px; height:120px; border-radius:50%; object-fit:cover;
        border:3px solid #6366f1; box-shadow:0 0 40px rgba(99,102,241,.5);
        animation: callNeonGlow 3s ease-in-out infinite;
        margin-bottom:20px;
      }
      .call-avatar-center-init {
        width:120px; height:120px; border-radius:50%;
        background:linear-gradient(135deg,#6366f1,#8b5cf6);
        display:flex; align-items:center; justify-content:center;
        font-size:3rem; font-weight:800; color:#fff;
        box-shadow:0 0 40px rgba(99,102,241,.5);
        animation: callNeonGlow 3s ease-in-out infinite;
        margin-bottom:20px;
      }
      .call-center-name { font-size:1.2rem; font-weight:700; color:#f1f5f9; margin-bottom:6px; }
      .call-center-status { color:#94a3b8; font-size:.9rem; display:flex; align-items:center; gap:6px; }
      .call-controls {
        padding:24px 20px;
        padding-bottom: max(24px, env(safe-area-inset-bottom, 24px));
        display:flex; justify-content:center; gap:20px; align-items:center;
        background:rgba(255,255,255,.04); border-top:1px solid rgba(255,255,255,.06);
        backdrop-filter:blur(20px); flex-wrap:wrap;
      }
      .call-ctrl-btn {
        width:60px; height:60px; border-radius:50%; border:none;
        cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center;
        font-size:1.3rem; transition:all .18s ease; gap:4px;
      }
      .call-ctrl-btn:hover { transform:translateY(-3px) scale(1.05); }
      .call-ctrl-btn:active { animation: callBtnPop .2s ease; }
      .call-ctrl-mute   { background:rgba(255,255,255,.1); color:#e2e8f0; }
      .call-ctrl-muted  { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; }
      .call-ctrl-video  { background:rgba(255,255,255,.1); color:#e2e8f0; }
      .call-ctrl-vidoff { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; }
      .call-ctrl-end    { background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff; width:68px; height:68px; box-shadow:0 6px 20px rgba(239,68,68,.5); }
      .call-ctrl-end:hover { transform:translateY(-3px) scale(1.05); box-shadow:0 12px 35px rgba(239,68,68,.6); }
      .call-ctrl-label  { font-size:.58rem; color:rgba(255,255,255,.5); text-align:center; line-height:1; }

      @media(max-width:480px) {
        .call-modal-card { padding:32px 20px; border-radius:20px; }
        .call-ctrl-btn { width:52px; height:52px; font-size:1.1rem; }
        .call-ctrl-end { width:60px; height:60px; }
        .call-local-pip { width:90px; height:120px; bottom:10px; right:10px; }
        .call-controls { gap:14px; padding:18px 12px; }
      }
    `;
    document.head.appendChild(style);
  }, []);
  return null;
};

/* ── Call Timer ── */
const useCallTimer = (active) => {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) { setSecs(0); return; }
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
};

/* ── Avatar helper ── */
const CallAvatar = ({ user, size = 100, className = '', style = {} }) => {
  const initial = (user?.displayName?.[0] || user?.username?.[0] || 'U').toUpperCase();
  if (user?.avatar) {
    return <img src={user.avatar} alt={initial} className={className || 'call-avatar-img'} style={{ width: size, height: size, ...style }} />;
  }
  return (
    <div className={className || 'call-avatar-initials'} style={{ width: size, height: size, ...style }}>
      {initial}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
const CallOverlay = () => {
  const {
    stream, myVideo, userVideo,
    receivingCall, caller, callAccepted, callEnded, callType,
    isCalling, showCallModal, answerCall, leaveCall, rejectCall,
    isMuted, isVideoOff, toggleMute, toggleVideo
  } = useCallContext();

  const timer = useCallTimer(callAccepted && !callEnded);
  const otherUser = caller;

  return (
    <>
      <CallStyles />

      {/* ── Outgoing Call (Dialing) ── */}
      {showCallModal === 'calling' && !callAccepted && (
        <div className="call-overlay-modal">
          <div className="call-modal-card">
            <div className="call-avatar-wrap">
              <div className="call-avatar-wave" />
              <div className="call-avatar-wave" />
              <div className="call-avatar-wave" />
              {otherUser?.avatar
                ? <img src={otherUser.avatar} alt="" className="call-avatar-img" />
                : <div className="call-avatar-initials">{(otherUser?.displayName?.[0] || otherUser?.username?.[0] || 'U').toUpperCase()}</div>
              }
            </div>
            <h2 className="call-name">{otherUser?.displayName || otherUser?.username || 'User'}</h2>
            <div className="call-type-badge">
              {callType === 'video' ? '📹 Video Call' : '📞 Voice Call'}
            </div>
            <div className="call-status">
              Calling<span className="call-status-dot" /><span className="call-status-dot" /><span className="call-status-dot" />
            </div>
            <div className="call-btn-row">
              <button
                className="call-btn call-btn-end"
                onClick={() => leaveCall(true)}
                title="Cancel call"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Incoming Call ── */}
      {showCallModal === 'incoming' && !callAccepted && (
        <div className="call-overlay-modal">
          <div className="call-modal-card">
            <div className="call-avatar-wrap">
              <div className="call-avatar-wave" />
              <div className="call-avatar-wave" />
              <div className="call-avatar-wave" />
              {caller?.avatar
                ? <img src={caller.avatar} alt="" className="call-avatar-img" />
                : <div className="call-avatar-initials">{(caller?.displayName?.[0] || caller?.username?.[0] || 'U').toUpperCase()}</div>
              }
            </div>
            <h2 className="call-name">{otherUser?.displayName || otherUser?.username || 'Someone'}</h2>
            <div className="call-type-badge">
              {callType === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Voice Call'}
            </div>
            <div className="call-status">
              Incoming<span className="call-status-dot" /><span className="call-status-dot" /><span className="call-status-dot" />
            </div>
            <div className="call-btn-row">
              <button className="call-btn call-btn-end" onClick={rejectCall} title="Decline">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                </svg>
              </button>
              <button className="call-btn call-btn-answer" onClick={answerCall} title="Answer">
                📱
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Call Screen ── */}
      {(isCalling || callAccepted) && !callEnded && (
        <div className="call-active-overlay">
          {/* Header */}
          <div className="call-active-header">
            <div className="call-header-info">
              <CallAvatar user={otherUser} size={36} style={{ borderRadius:'50%', border:'2px solid #6366f1', flexShrink:0 }} />
              <div>
                <div className="call-header-name">{otherUser?.displayName || otherUser?.username || 'User'}</div>
                <div className="call-header-timer">{callAccepted ? timer : 'Connecting...'}</div>
              </div>
            </div>
            <span className="call-header-badge">
              {callType === 'video' ? '📹 Video' : '📞 Voice'}
            </span>
          </div>

          {/* Video / Avatar Area */}
          <div className="call-video-area">
            {/* Remote video */}
            <video
              playsInline ref={userVideo} autoPlay
              className="call-remote-video"
              style={{ display: callAccepted && callType === 'video' && !isVideoOff ? 'block' : 'none' }}
            />

            {/* Avatar shown when voice call or video off or not yet connected */}
            {(!callAccepted || callType === 'voice' || isVideoOff) && (
              <div className="call-avatar-center">
                <div style={{ position:'relative', width:120, height:120, margin:'0 auto 20px' }}>
                  <div style={{ position:'absolute', inset:0, border:'2px solid rgba(99,102,241,.5)', borderRadius:'50%', animation:'callRingWave 2s ease-out infinite' }} />
                  <div style={{ position:'absolute', inset:0, border:'2px solid rgba(99,102,241,.4)', borderRadius:'50%', animation:'callRingWave 2s ease-out infinite', animationDelay:'.7s' }} />
                  {otherUser?.avatar
                    ? <img src={otherUser.avatar} alt="" className="call-avatar-center-img" style={{ width:120, height:120 }} />
                    : <div className="call-avatar-center-init" style={{ width:120, height:120, fontSize:'3rem' }}>{(otherUser?.displayName?.[0] || otherUser?.username?.[0] || 'U').toUpperCase()}</div>
                  }
                </div>
                <div className="call-center-name">{otherUser?.displayName || otherUser?.username}</div>
                {isCalling && !callAccepted && (
                  <div className="call-center-status">
                    Ringing<span className="call-status-dot" style={{ background:'#6366f1' }} /><span className="call-status-dot" style={{ background:'#6366f1', animationDelay:'.16s' }} /><span className="call-status-dot" style={{ background:'#6366f1', animationDelay:'.32s' }} />
                  </div>
                )}
                {callAccepted && isVideoOff && (
                  <div className="call-center-status">📵 Camera Paused</div>
                )}
              </div>
            )}

            {/* Local PiP */}
            {stream && callType === 'video' && (
              <div className="call-local-pip">
                <video playsInline muted ref={myVideo} autoPlay style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div className="call-controls">
            {/* Mute */}
            <button
              onClick={toggleMute}
              className={`call-ctrl-btn ${isMuted ? 'call-ctrl-muted' : 'call-ctrl-mute'}`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02 3.28l-1.63-1.63c.09-.54.15-1.09.15-1.65V5c0-1.66-1.34-3-3-3S7.5 3.34 7.5 5v3.13l-1.63-1.63V5c0-2.76 2.24-5 5-5s5 2.24 5 5v6c0 .59-.1 1.15-.27 1.65zM3.41 2.86L2 4.27l5.95 5.95c-.29.43-.53.9-.7 1.4-.17.5-.25 1.03-.25 1.38H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.87-.13 1.69-.44 2.43-.86l1.9 1.9L18.73 17.6 3.41 2.86z"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              )}
              <span className="call-ctrl-label">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            {/* Video toggle — only for video calls */}
            {callType === 'video' && (
              <button
                onClick={toggleVideo}
                className={`call-ctrl-btn ${isVideoOff ? 'call-ctrl-vidoff' : 'call-ctrl-video'}`}
                title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
              >
                {isVideoOff ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                )}
                <span className="call-ctrl-label">{isVideoOff ? 'Cam On' : 'Cam Off'}</span>
              </button>
            )}

            {/* End call */}
            <button
              onClick={() => leaveCall(true)}
              className="call-ctrl-btn call-ctrl-end"
              title="End call"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
              </svg>
              <span className="call-ctrl-label">End</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default CallOverlay;
