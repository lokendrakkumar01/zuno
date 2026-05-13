import { useEffect, useRef } from 'react';

const Video = ({ stream, muted }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  return <video ref={ref} muted={muted} autoPlay playsInline className="h-40 w-full rounded bg-black object-cover" />;
};

const CallModal = ({ call }) => {
  if (!call?.incomingCall && !call?.activeCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
        {call.incomingCall ? (
          <>
            <h2 className="text-lg font-semibold">Incoming {call.incomingCall.callType} call</h2>
            <div className="mt-4 flex gap-2">
              <button onClick={call.acceptCall} className="flex-1 rounded bg-emerald-600 px-4 py-2 text-white">Accept</button>
              <button onClick={call.rejectCall} className="flex-1 rounded bg-rose-600 px-4 py-2 text-white">Reject</button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Video stream={call.localStream} muted />
              <Video stream={call.remoteStream} />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={call.toggleMute} className="flex-1 rounded bg-slate-200 px-3 py-2">{call.muted ? 'Unmute' : 'Mute'}</button>
              <button onClick={call.toggleCamera} className="flex-1 rounded bg-slate-200 px-3 py-2">{call.cameraOff ? 'Camera on' : 'Camera off'}</button>
              <button onClick={call.endCall} className="flex-1 rounded bg-rose-600 px-3 py-2 text-white">End</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CallModal;
