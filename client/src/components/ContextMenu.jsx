import { useEffect, useRef } from 'react';

const ContextMenu = ({ x, y, onClose, options }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu inside viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ top: y, left: x }}
    >
      {options.map((option, index) => (
        option.divider ? (
          <div key={index} className="context-menu-divider" />
        ) : (
          <div
            key={index}
            className={`context-menu-item ${option.danger ? 'danger' : ''}`}
            onClick={() => {
              option.onClick();
              onClose();
            }}
          >
            {option.icon && <span className="context-menu-icon">{option.icon}</span>}
            <span>{option.label}</span>
          </div>
        )
      ))}
    </div>
  );
};

export default ContextMenu;
