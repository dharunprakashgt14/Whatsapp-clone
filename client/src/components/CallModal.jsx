const CallModal = ({
  open,
  mode,
  status,
  contactName,
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef,
  isIncoming,
  onAccept,
  onDecline,
  onEnd,
}) => {
  if (!open) return null;

  return (
    <div className="call-overlay">
      <div className="call-modal">
        <div className="call-header">
          <h3>{mode === 'video' ? 'Video call' : 'Voice call'}</h3>
          <p>{contactName}</p>
          <span>{status}</span>
        </div>

        <div className="call-body">
          <audio ref={remoteAudioRef} autoPlay playsInline />
          {mode === 'video' ? (
            <>
              <video className="call-video remote" ref={remoteVideoRef} autoPlay playsInline />
              <video className="call-video local" ref={localVideoRef} autoPlay playsInline muted />
            </>
          ) : (
            <div className="call-audio-visual" />
          )}
        </div>

        <div className="call-actions">
          {isIncoming ? (
            <>
              <button className="call-btn accept" onClick={onAccept}>Accept</button>
              <button className="call-btn reject" onClick={onDecline}>Decline</button>
            </>
          ) : (
            <button className="call-btn reject" onClick={onEnd}>End call</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;
