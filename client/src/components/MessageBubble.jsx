import { resolveMediaUrl } from '../services/api';
import { useEffect, useMemo, useRef, useState } from 'react';
import ContextMenu from './ContextMenu';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const MessageBubble = ({ message, imageGroup = null, isSent, showTail, currentUserId, onReply, onEdit, onDelete, onReact, onForward, isGroup }) => {
  const [contextMenu, setContextMenu] = useState(null);
  const [showReactions, setShowReactions] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const voiceAudioRef = useRef(null);

  // Generate a consistent color for a user name
  const getSenderColor = (name) => {
    const colors = ['#ff6b6b', '#ffa06b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6', '#e84393', '#00b894', '#fdcb6e', '#6c5ce7'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatSec = (val) => {
    const total = Number.isFinite(val) ? Math.floor(val) : 0;
    const mm = String(Math.floor(total / 60)).padStart(1, '0');
    const ss = String(total % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (message.deletedForEveryone) return;
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text).catch(() => {});
  };

  const isImageMessage = useMemo(() => (
    Boolean(message?.fileUrl && (message?.type === 'image' || message?.mimeType?.startsWith('image/')))
  ), [message]);

  const resolvedImageGroup = useMemo(() => (
    imageGroup?.length ? imageGroup : (isImageMessage ? [message] : [])
  ), [imageGroup, isImageMessage, message]);

  useEffect(() => {
    const audio = voiceAudioRef.current;
    if (!audio) return;
    const onTime = () => {
      setVoiceProgress(audio.currentTime || 0);
      setVoiceDuration(audio.duration || 0);
    };
    const onEnded = () => setIsPlayingVoice(false);
    const onLoaded = () => setVoiceDuration(audio.duration || 0);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoaded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [message._id, message.fileUrl]);

  // Build context menu options
  const contextMenuOptions = [];

  if (!message.deletedForEveryone) {
    contextMenuOptions.push({
      label: 'Reply',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
        </svg>
      ),
      onClick: () => onReply && onReply(message),
    });

    contextMenuOptions.push({
      label: 'React',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
        </svg>
      ),
      onClick: () => setShowReactions(true),
    });

    contextMenuOptions.push({
      label: 'Copy',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      ),
      onClick: handleCopy,
    });

    contextMenuOptions.push({
      label: 'Forward',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/>
        </svg>
      ),
      onClick: () => onForward && onForward(message),
    });

    if (isSent) {
      contextMenuOptions.push({
        label: 'Edit',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        ),
        onClick: () => onEdit && onEdit(message),
      });
    }

    contextMenuOptions.push({ divider: true });
  }

  // Delete options always available
  contextMenuOptions.push({
    label: 'Delete for me',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
      </svg>
    ),
    onClick: () => onDelete && onDelete(message._id, 'me'),
    danger: true,
  });

  if (isSent && !message.deletedForEveryone) {
    contextMenuOptions.push({
      label: 'Delete for everyone',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      ),
      onClick: () => onDelete && onDelete(message._id, 'everyone'),
      danger: true,
    });
  }

  const renderTicks = () => {
    if (!isSent) return null;
    const isRead = message.status === 'read';
    const isDelivered = message.status === 'delivered' || isRead;

    return (
      <span className={`message-ticks ${isRead ? 'read' : ''}`}>
        {isDelivered || isRead ? (
          <svg viewBox="0 0 16 15" fill="currentColor">
            <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.033l-.36.412a.365.365 0 0 0 .063.51l1.08.98c.15.136.384.118.514-.042l6.1-7.672a.365.365 0 0 0-.063-.51zm-2.962 0l-.478-.372a.365.365 0 0 0-.51.063L5.696 9.879a.32.32 0 0 1-.484.033L2.674 7.67a.365.365 0 0 0-.51.063l-.36.412a.365.365 0 0 0 .063.51l3.255 2.962c.15.136.384.118.514-.042l6.35-7.768a.365.365 0 0 0-.063-.51z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 16 15" fill="currentColor">
            <path d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.89a.366.366 0 0 0-.51.063l-.36.412a.365.365 0 0 0 .063.51l2.977 2.706c.15.136.383.118.514-.042l5.96-7.733a.365.365 0 0 0-.063-.51z"/>
          </svg>
        )}
      </span>
    );
  };

  // Render reactions
  const renderReactions = () => {
    const reactions = message.reactions;
    if (!reactions) return null;

    // Convert Map to Object if needed
    const reactionsObj = reactions instanceof Map ? Object.fromEntries(reactions) : reactions;
    const entries = Object.entries(reactionsObj || {});
    if (entries.length === 0) return null;

    return (
      <div className="message-reactions">
        {entries.map(([emoji, users]) => (
          <button
            key={emoji}
            className={`reaction-chip ${users.includes(currentUserId) ? 'reacted' : ''}`}
            onClick={() => onReact && onReact(message._id, emoji)}
            title={`${users.length} reaction${users.length > 1 ? 's' : ''}`}
          >
            {emoji} {users.length > 1 && <span className="reaction-count">{users.length}</span>}
          </button>
        ))}
      </div>
    );
  };

  // Render reply preview
  const renderReplyPreview = () => {
    if (!message.replyTo) return null;
    const reply = message.replyTo;
    return (
      <div className="reply-preview" onClick={() => {
        const el = document.getElementById(`msg-${reply._id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-message');
          setTimeout(() => el.classList.remove('highlight-message'), 2000);
        }
      }}>
        <div className="reply-preview-bar" />
        <div className="reply-preview-content">
          <span className="reply-preview-name">
            {reply.deletedForEveryone ? '' : (reply.sender?.name || 'Unknown')}
          </span>
          <span className="reply-preview-text">
            {reply.deletedForEveryone ? '🚫 This message was deleted' : reply.text}
          </span>
        </div>
      </div>
    );
  };

  // Deleted for everyone display
  if (message.deletedForEveryone) {
    return (
      <div className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
        <div
          className={`message-bubble bubble-text-layout ${isSent ? 'sent' : 'received'} deleted-message ${showTail ? 'tail' : ''}`}
          onContextMenu={handleContextMenu}
        >
          <div className="bubble-main">
            <span className="message-text deleted-text">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5, verticalAlign: 'middle', marginRight: 4 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              {isSent ? 'You deleted this message' : 'This message was deleted'}
            </span>
          </div>
          <div className="message-meta-row">
            <span className="message-time">{formatTime(message.createdAt)}</span>
          </div>
        </div>
        {contextMenu && (
          <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} options={contextMenuOptions} />
        )}
      </div>
    );
  }

  const isVoiceBubble = message.type === 'voice' && message.fileUrl;
  const isImageBubble = resolvedImageGroup.length > 0;
  /** Text / document: footer row in flow (fixes edited + time alignment). */
  const useTextFooterLayout = !isImageBubble && !isVoiceBubble;

  const renderMessageContent = () => {
    if (message.type === 'voice' && message.fileUrl) {
      return (
        <div className="voice-note">
          <audio ref={voiceAudioRef} src={resolveMediaUrl(message.fileUrl)} preload="metadata" />
          <button
            className="voice-play-btn"
            onClick={() => {
              const audio = voiceAudioRef.current;
              if (!audio) return;
              if (audio.paused) {
                audio.play().then(() => setIsPlayingVoice(true)).catch(() => {});
              } else {
                audio.pause();
                setIsPlayingVoice(false);
              }
            }}
            title={isPlayingVoice ? 'Pause' : 'Play'}
          >
            {isPlayingVoice ? '||' : '▶'}
          </button>
          <input
            className="voice-progress"
            type="range"
            min="0"
            max={Math.max(voiceDuration, 1)}
            step="0.01"
            value={Math.min(voiceProgress, Math.max(voiceDuration, 1))}
            onChange={(e) => {
              const audio = voiceAudioRef.current;
              if (!audio) return;
              audio.currentTime = Number(e.target.value);
              setVoiceProgress(Number(e.target.value));
            }}
          />
          <span className="voice-time">{formatSec(voiceProgress)} / {formatSec(voiceDuration)}</span>
        </div>
      );
    }
    if (resolvedImageGroup.length > 0) {
      return (
        <div className={`message-image-grid count-${Math.min(resolvedImageGroup.length, 4)}`}>
          {resolvedImageGroup.slice(0, 4).map((imgMsg, idx) => (
            <a
              key={imgMsg._id}
              href={resolveMediaUrl(imgMsg.fileUrl)}
              target="_blank"
              rel="noreferrer"
              className="image-cell-link"
              title={imgMsg.fileName || 'Image'}
            >
              <img src={resolveMediaUrl(imgMsg.fileUrl)} alt={imgMsg.fileName || `Image ${idx + 1}`} className="message-image-cell" />
              {idx === 3 && resolvedImageGroup.length > 4 && (
                <span className="image-more-overlay">+{resolvedImageGroup.length - 4}</span>
              )}
            </a>
          ))}
        </div>
      );
    }
    if (message.type === 'document' && message.fileUrl) {
      return (
        <a
          href={resolveMediaUrl(message.fileUrl)}
          target="_blank"
          rel="noreferrer"
          className="document-link"
        >
          <span>{message.fileName || 'Document'}</span>
        </a>
      );
    }
    return <span className="message-text">{message.text}</span>;
  };

  return (
    <div className={`message-wrapper ${isSent ? 'sent' : 'received'}`} id={`msg-${message._id}`}>
      <div className="message-bubble-container">
        <div
          className={`message-bubble ${isSent ? 'sent' : 'received'} ${showTail ? 'tail' : ''} ${useTextFooterLayout ? 'bubble-text-layout' : ''} ${resolvedImageGroup.length > 0 ? 'media-bubble image-only-bubble' : ''} ${message.type === 'voice' ? 'voice-bubble' : ''}`}
          onContextMenu={handleContextMenu}
        >
          {useTextFooterLayout ? (
            <>
              <div className="bubble-main">
                {renderReplyPreview()}
                {message.forwarded && (
                  <div className="forwarded-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
                      <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/>
                    </svg>
                    <span>Forwarded</span>
                  </div>
                )}
                {isGroup && !isSent && showTail && (
                  <div className="group-sender-name" style={{ color: getSenderColor(message.sender?.name) }}>
                    {message.sender?.name || 'Unknown'}
                  </div>
                )}
                {renderMessageContent()}
              </div>
              <div className="message-meta-row">
                {message.edited && <span className="edited-label">edited</span>}
                <span className="message-time">{formatTime(message.createdAt)}</span>
                {renderTicks()}
              </div>
            </>
          ) : (
            <>
              {renderReplyPreview()}
              {message.forwarded && (
                <div className="forwarded-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
                    <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/>
                  </svg>
                  <span>Forwarded</span>
                </div>
              )}
              {isGroup && !isSent && showTail && (
                <div className="group-sender-name" style={{ color: getSenderColor(message.sender?.name) }}>
                  {message.sender?.name || 'Unknown'}
                </div>
              )}
              {renderMessageContent()}
              {resolvedImageGroup.length > 0 ? (
                <div className="image-meta-inline">
                  <span className="message-time">{formatTime(message.createdAt)}</span>
                  {renderTicks()}
                </div>
              ) : (
                <div className="voice-meta-inline">
                  <span className="message-time">{formatTime(message.createdAt)}</span>
                  {renderTicks()}
                </div>
              )}
            </>
          )}
        </div>
        {renderReactions()}
      </div>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} options={contextMenuOptions} />
      )}

      {showReactions && (
        <div className="reaction-picker-overlay" onClick={() => setShowReactions(false)}>
          <div className="reaction-picker" onClick={(e) => e.stopPropagation()}>
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className="reaction-picker-btn"
                onClick={() => {
                  onReact && onReact(message._id, emoji);
                  setShowReactions(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
