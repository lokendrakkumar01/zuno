import React from 'react';
import { useCallContext } from '../context/CallContext';

const CallOverlay = () => {
      const {
            stream, myVideo, userVideo,
            receivingCall, caller, callAccepted, callEnded, callType,
            isCalling, showCallModal, answerCall, leaveCall,
            isMuted, isVideoOff, toggleMute, toggleVideo
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

                                    {/* Avatar placeholder if voice call or video not connected or video paused */}
                                    {(!callAccepted || callType === 'voice' || (callAccepted && isVideoOff)) && (
                                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: '#111' }}>
                                                <div className="msg-avatar" style={{ width: '100px', height: '100px', fontSize: '3rem', marginBottom: '16px' }}>
                                                      {otherUser?.avatar ? <img src={otherUser.avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (otherUser?.displayName?.charAt(0) || otherUser?.username?.charAt(0) || 'U')}
                                                </div>
                                                {isCalling && !callAccepted && <div style={{ color: 'white', animation: 'pulse 1.5s infinite' }}>Ringing...</div>}
                                                {callAccepted && isVideoOff && <div style={{ color: 'white', opacity: 0.8 }}>Camera Paused</div>}
                                          </div>
                                    )}
                              </div>
                              <div className="chat-call-controls" style={{ padding: '24px', display: 'flex', justifyContent: 'center', gap: '24px', background: 'var(--bg-card)' }}>
                                    {/* Mute/Unmute Button */}
                                    <button onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"} style={{
                                          width: '56px', height: '56px', borderRadius: '50%', background: isMuted ? '#6b7280' : 'var(--bg-secondary)',
                                          color: isMuted ? 'white' : 'var(--text-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s'
                                    }}>
                                          {isMuted ? (
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02 3.28l-1.63-1.63c.09-.54.15-1.09.15-1.65V5c0-1.66-1.34-3-3-3S7.5 3.34 7.5 5v3.13l-1.63-1.63V5c0-2.76 2.24-5 5-5s5 2.24 5 5v6c0 .59-.1 1.15-.27 1.68l-1.35-1.35c.03-.33.05-.66.05-1.01h-1.7V11c0 .61-.1 1.2-.27 1.76l-1.35-1.35c-.01-.37-.03-.74-.03-1.12zm-3.8 2.37l-1.63-1.63v1.36h1.7c-.02-.12-.04-.24-.07-.36zM3.41 2.86L2 4.27l5.95 5.95c-.29.43-.53.9-.71 1.4L5.61 9.98c.5-.83 1.14-1.55 1.88-2.11L11.5 11.89v1.6l1.63 1.63C12.59 13.9 12 13.62 12 13.5v-1.6l3.35 3.35c-.86.53-1.85.87-2.92.98v2.77H10.43v-2.77c-2.82-.28-5.18-2.43-5.63-5.23L4.85 11.23c.31 1.96 1.67 3.59 3.5 4.31l1.73 1.73c-1.36-.18-2.61-.79-3.62-1.71l-1.61 1.61z" />
                                                </svg>
                                          ) : (
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                                </svg>
                                          )}
                                    </button>

                                    {/* Video Toggle Button (Only show if it's a video call) */}
                                    {callType === 'video' && (
                                          <button onClick={toggleVideo} title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"} style={{
                                                width: '56px', height: '56px', borderRadius: '50%', background: isVideoOff ? '#6b7280' : 'var(--bg-secondary)',
                                                color: isVideoOff ? 'white' : 'var(--text-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s'
                                          }}>
                                                {isVideoOff ? (
                                                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
                                                      </svg>
                                                ) : (
                                                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                                                      </svg>
                                                )}
                                          </button>
                                    )}

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
