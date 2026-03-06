import React from 'react';
import { useCallContext } from '../context/CallContext';

const CallOverlay = () => {
      const {
            stream, myVideo, userVideo,
            receivingCall, caller, callAccepted, callEnded, callType,
            isCalling, showCallModal, answerCall, leaveCall
      } = useCallContext();

      const otherUser = caller;

      // Active Call UI Overlay
      return (
            <>
                  {/* Active Call View */}
                  {(isCalling || callAccepted) && !callEnded && (
                        <div className="chat-call-overlay" style={{
                              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                              background: 'var(--bg-card)', zIndex: 9999, display: 'flex', flexDirection: 'column'
                        }}>
                              <div className="chat-call-header" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', color: 'white' }}>
                                    <div className="font-bold">{isCalling && !callAccepted ? 'Calling...' : `${callType === 'video' ? 'Video' : 'Voice'} Call`}</div>
                                    <div className="font-semibold">{otherUser?.displayName || otherUser?.username || 'User'}</div>
                              </div>
                              <div className="chat-call-video-container" style={{ flex: 1, position: 'relative', background: '#000' }}>
                                    {/* Main Video (Remote User) */}
                                    {callAccepted && (
                                          <video
                                                playsInline
                                                ref={userVideo}
                                                autoPlay
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                          />
                                    )}
                                    {/* PIP Video (Local User) */}
                                    {stream && (
                                          <video
                                                playsInline
                                                muted
                                                ref={myVideo}
                                                autoPlay
                                                style={{
                                                      position: 'absolute', bottom: '20px', right: '20px',
                                                      width: '120px', height: '160px', objectFit: 'cover',
                                                      borderRadius: '12px', border: '2px solid white',
                                                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                                      display: callType === 'video' ? 'block' : 'none'
                                                }}
                                          />
                                    )}

                                    {/* Avatar placeholder if voice call or video not connected */}
                                    {(!callAccepted || callType === 'voice') && (
                                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                                <div className="msg-avatar" style={{ width: '100px', height: '100px', fontSize: '3rem', marginBottom: '16px' }}>
                                                      {otherUser?.avatar ? <img src={otherUser.avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (otherUser?.displayName?.charAt(0) || otherUser?.username?.charAt(0) || 'U')}
                                                </div>
                                                {isCalling && !callAccepted && <div style={{ color: 'white', animation: 'pulse 1.5s infinite' }}>Ringing...</div>}
                                          </div>
                                    )}
                              </div>
                              <div className="chat-call-controls" style={{ padding: '24px', display: 'flex', justifyContent: 'center', gap: '24px', background: 'var(--bg-card)' }}>
                                    <button onClick={() => leaveCall(true)} className="chat-call-end-btn" style={{
                                          width: '56px', height: '56px', borderRadius: '50%', background: '#ef4444',
                                          color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                                          </svg>
                                    </button>
                              </div>
                        </div>
                  )}

                  {/* Incoming Call Modal */}
                  {showCallModal === 'incoming' && !callAccepted && (
                        <div className="chat-call-modal-overlay" style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                              <div className="chat-call-modal" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', textAlign: 'center', minWidth: '300px' }}>
                                    <div className="chat-call-modal-icon" style={{ fontSize: '3rem', marginBottom: '16px' }}>
                                          {callType === 'video' ? '📹' : '📞'}
                                    </div>
                                    <h3 className="text-lg font-bold mb-sm">
                                          Incoming {callType === 'video' ? 'Video' : 'Voice'} Call
                                    </h3>
                                    {/* Make sure we safely access caller and fallback appropriately */}
                                    <p className="text-muted text-sm mb-lg">
                                          {otherUser?.displayName || otherUser?.username || 'Someone'} is calling you.
                                    </p>
                                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                                          <button onClick={() => leaveCall(true)} className="btn" style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none' }}>
                                                Decline
                                          </button>
                                          <button onClick={answerCall} className="btn" style={{ flex: 1, background: '#10b981', color: 'white', border: 'none' }}>
                                                Answer
                                          </button>
                                    </div>
                              </div>
                        </div>
                  )}
            </>
      );
};

export default CallOverlay;
