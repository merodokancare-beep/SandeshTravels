'use client';

import { useState, useEffect } from 'react';

/**
 * Single Toast Item Component
 */
export function ToastItem({ toast, onClose }) {
  const { id, type = 'info', title, message, duration = 6000, action } = toast;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration <= 0) return;
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onClose(id);
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [id, duration, onClose]);

  // Style variations based on toast type
  const typeConfig = {
    error: {
      bg: 'rgba(28, 15, 19, 0.92)',
      border: '1px solid rgba(239, 68, 68, 0.45)',
      color: '#FCA5A5',
      iconColor: '#EF4444',
      progressBarBg: 'linear-gradient(90deg, #EF4444, #F87171)',
      iconClass: 'fa-solid fa-circle-exclamation',
      glow: '0 8px 32px rgba(239, 68, 68, 0.25)',
    },
    warning: {
      bg: 'rgba(28, 22, 14, 0.92)',
      border: '1px solid rgba(245, 158, 11, 0.45)',
      color: '#FCD34D',
      iconColor: '#F59E0B',
      progressBarBg: 'linear-gradient(90deg, #F59E0B, #FBBF24)',
      iconClass: 'fa-solid fa-triangle-exclamation',
      glow: '0 8px 32px rgba(245, 158, 11, 0.25)',
    },
    success: {
      bg: 'rgba(12, 26, 21, 0.92)',
      border: '1px solid rgba(16, 185, 129, 0.45)',
      color: '#6EE7B7',
      iconColor: '#10B981',
      progressBarBg: 'linear-gradient(90deg, #10B981, #34D399)',
      iconClass: 'fa-solid fa-circle-check',
      glow: '0 8px 32px rgba(16, 185, 129, 0.25)',
    },
    info: {
      bg: 'rgba(12, 23, 35, 0.92)',
      border: '1px solid rgba(56, 189, 248, 0.45)',
      color: '#7DD3FC',
      iconColor: '#38BDF8',
      progressBarBg: 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
      iconClass: 'fa-solid fa-circle-info',
      glow: '0 8px 32px rgba(56, 189, 248, 0.25)',
    },
  };

  const config = typeConfig[type] || typeConfig.info;

  return (
    <div
      className="toast-item"
      style={{
        background: config.bg,
        border: config.border,
        color: config.color,
        boxShadow: config.glow,
      }}
    >
      <i
        className={`${config.iconClass} fa-lg`}
        style={{ color: config.iconColor, marginTop: '2px', flexShrink: 0 }}
      ></i>

      <div style={{ flexGrow: 1, minWidth: 0, paddingRight: '0.5rem' }}>
        {title && (
          <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.2rem', color: '#FFF' }}>
            {title}
          </div>
        )}
        <div style={{ fontSize: '0.85rem', lineHeight: '1.45', wordBreak: 'break-word' }}>
          {message}
        </div>
        {action && (
          <div style={{ marginTop: '0.5rem' }}>
            {action}
          </div>
        )}
      </div>

      <button
        onClick={() => onClose(id)}
        style={{
          background: 'transparent',
          border: 'none',
          color: config.color,
          opacity: 0.7,
          cursor: 'pointer',
          padding: '2px 4px',
          fontSize: '0.9rem',
          flexShrink: 0,
          transition: 'opacity 0.2s ease',
        }}
        onMouseEnter={(e) => (e.target.style.opacity = '1')}
        onMouseLeave={(e) => (e.target.style.opacity = '0.7')}
        title="Dismiss toast"
      >
        <i className="fa-solid fa-xmark"></i>
      </button>

      {duration > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '3px',
            width: `${progress}%`,
            background: config.progressBarBg,
            transition: 'width 50ms linear',
          }}
        />
      )}
    </div>
  );
}

/**
 * Fixed Bottom-Right Toast Container Component
 */
export function ToastContainer({ toasts = [], onClose }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}
