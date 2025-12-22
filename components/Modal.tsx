
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string; // Menambahkan opsi ukuran modal
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = 'unset';
      }, 300); // Wait for animation
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return createPortal(
    <div 
      className={`fixed inset-0 flex items-center justify-center p-4 z-[9999] transition-all duration-300 ease-out ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Container Modal */}
      <div 
        className={`relative bg-white rounded-[2.5rem] shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden transform transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${
          isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-10'
        }`}
      >
        {/* Header Modal */}
        <div className="flex-shrink-0 px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-white/80 backdrop-blur-sm z-10">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Isi Modal */}
        <div className="flex-grow p-8 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
