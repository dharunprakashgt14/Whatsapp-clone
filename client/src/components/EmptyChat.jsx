const EmptyChat = () => {
  return (
    <div className="empty-chat">
      <div className="empty-chat-icon">
        <svg viewBox="0 0 303 172" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M229.565 160.229c32.647-16.884 55.532-50.88 55.532-90.228C285.097 31.33 253.766 0 215.097 0c-22.674 0-42.767 10.748-55.532 27.435C147.799 10.748 127.706 0 105.032 0 66.362 0 35.032 31.33 35.032 70.001c0 39.348 22.885 73.344 55.532 90.228" stroke="var(--text-secondary)" strokeWidth="3" strokeLinecap="round"/>
          <path d="M151.5 85L151.5 140" stroke="var(--text-secondary)" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="151.5" cy="152" r="5" fill="var(--text-secondary)"/>
          <path d="M75 172h153" stroke="var(--text-secondary)" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </div>
      <h2>WhatsApp Web</h2>
      <p>
        Send and receive messages without keeping your phone online.<br />
        Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
      </p>
      <div className="lock-text">
        <svg viewBox="0 0 10 12" fill="currentColor">
          <path d="M5.002 7.874C5.554 7.874 6.002 8.32 6.002 8.874c0 .554-.448 1-1 1-.554 0-1.002-.446-1.002-1 0-.554.448-1 1.002-1zM5.002.5c1.753 0 3.173 1.42 3.173 3.176V5.06h.323c.55 0 1.002.45 1.002 1.002v4.873c0 .553-.452 1.004-1.002 1.004H1.502c-.55 0-1.002-.45-1.002-1.004V6.062c0-.552.452-1.003 1.002-1.003h.323V3.676C1.825 1.92 3.247.5 5.002.5zm0 1.084c-1.155 0-2.09.934-2.093 2.092V5.06h4.182V3.676c0-1.155-.935-2.092-2.09-2.092z"/>
        </svg>
        Your personal messages are end-to-end encrypted
      </div>
    </div>
  );
};

export default EmptyChat;
