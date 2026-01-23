import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Option {
    value: string;
    label: string;
}

interface AnimatedSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    className?: string;
    placeholder?: string;
}

const AnimatedSelect: React.FC<AnimatedSelectProps> = ({
    value,
    onChange,
    options,
    className = '',
    placeholder = 'Pilih opsi...'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [animationState, setAnimationState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        if (isOpen) {
            setAnimationState('opening');
            setTimeout(() => setAnimationState('open'), 50);

            // Calculate position
            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setDropdownPosition({
                    top: rect.bottom + 8,
                    left: rect.left,
                    width: rect.width
                });
            }
        } else {
            if (animationState !== 'closed') {
                setAnimationState('closing');
                setTimeout(() => setAnimationState('closed'), 300);
            }
        }
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Close on escape
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    const isVisible = animationState === 'opening' || animationState === 'open';

    return (
        <>
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-slate-900 text-sm text-left flex items-center justify-between ${className}`}
            >
                <span className={selectedOption ? 'text-slate-900' : 'text-slate-400'}>
                    {selectedOption?.label || placeholder}
                </span>
                <svg
                    className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown Portal */}
            {animationState !== 'closed' && createPortal(
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[10000]"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Menu */}
                    <div
                        ref={dropdownRef}
                        className="fixed z-[10001] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
                        style={{
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                            width: dropdownPosition.width,
                            minWidth: '200px',
                            opacity: isVisible ? 1 : 0,
                            transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)',
                            transformOrigin: 'top center',
                            transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1), transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                            boxShadow: isVisible
                                ? '0 20px 40px -10px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)'
                                : '0 5px 20px -5px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        <div className="py-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {options.map((option, index) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={`w-full px-4 py-3 text-left text-sm font-bold transition-all duration-200 flex items-center gap-3 ${option.value === value
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                    style={{
                                        opacity: isVisible ? 1 : 0,
                                        transform: isVisible ? 'translateX(0)' : 'translateX(-10px)',
                                        transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) ${50 + index * 30}ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) ${50 + index * 30}ms`
                                    }}
                                >
                                    {/* Check Icon */}
                                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${option.value === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-transparent'
                                        }`}>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span>{option.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    );
};

export default AnimatedSelect;
