
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animationState, setAnimationState] = useState<'entering' | 'entered' | 'exiting' | 'exited'>('exited');

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      document.body.style.overflow = 'hidden';
      // Trigger enter animation after mount
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationState('entering');
          setTimeout(() => setAnimationState('entered'), 50);
        });
      });
    } else {
      setAnimationState('exiting');
      const timer = setTimeout(() => {
        setShouldRender(false);
        setAnimationState('exited');
        document.body.style.overflow = 'unset';
      }, 400); // Wait for exit animation
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const isVisible = animationState === 'entering' || animationState === 'entered';

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 z-[9999] transition-all duration-400`}
      style={{
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-slate-900/50"
        style={{
          backdropFilter: isVisible ? 'blur(12px)' : 'blur(0px)',
          WebkitBackdropFilter: isVisible ? 'blur(12px)' : 'blur(0px)',
          transition: 'backdrop-filter 400ms cubic-bezier(0.16, 1, 0.3, 1), -webkit-backdrop-filter 400ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={onClose}
      />

      {/* Modal Container with spring animation */}
      <div
        className={`relative bg-white rounded-[2.5rem] shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden`}
        style={{
          transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(30px)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: isVisible
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)'
            : '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Header Modal */}
        <div className="flex-shrink-0 px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-b from-white to-slate-50/50 z-10">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-2xl transition-all duration-300 hover:scale-110 hover:rotate-90"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div
          className="flex-grow p-8 overflow-y-auto custom-scrollbar"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 500ms cubic-bezier(0.16, 1, 0.3, 1) 100ms, transform 500ms cubic-bezier(0.16, 1, 0.3, 1) 100ms'
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
