'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef();

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <header
      className="fixed top-0 left-0 w-full z-50 bg-white/90"
      style={{ height: '3rem' }}
    >
      <div className="relative h-full flex items-center justify-center max-w-4xl mx-auto">
        {/* Centered logo */}
        <Link
          href="/"
          aria-label="Go to homepage"
          tabIndex={0}
          className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center focus:outline-none"
        >
          <img
            src="/swing-swing-logo.svg"
            alt="Swing Swing Logo"
            className="h-10 w-auto"
            style={{
              background: 'white',
              borderRadius: '50%',
              padding: '15px',
              boxSizing: 'content-box',
            }}
            draggable="false"
            loading="eager"
          />
        </Link>
        {/* Hamburger menu (always visible, right aligned) and dropdown wrapper */}
        <div ref={menuWrapRef}>
          <button
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center h-10 w-10 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <span className="sr-only">Menu</span>
            {menuOpen ? (
              <svg width="24" height="24" fill="none" stroke="#222" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 6L18 18M6 18L18 6" />
              </svg>
            ) : (
              <svg width="24" height="24" fill="none" stroke="#222" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M4 8h16M4 16h16" />
              </svg>
            )}
          </button>
          {/* Dropdown menu */}
          {menuOpen && (
            <nav
              className="absolute top-full right-4 mt-2 bg-white rounded shadow-lg py-2 px-4 flex flex-col gap-2 z-50"
              style={{ minWidth: '150px' }}
              role="menu"
              aria-label="Main menu"
            >
              <Link
                href="/"
                className="text-xs font-normal leading-tight text-blue-700 hover:text-blue-500 focus:text-blue-600 focus:outline-none select-none px-2 py-1"
                role="menuitem"
                tabIndex={0}
                onClick={() => setMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/compare"
                className="text-xs font-normal leading-tight text-blue-700 hover:text-blue-500 focus:text-blue-600 focus:outline-none select-none px-2 py-1"
                role="menuitem"
                tabIndex={0}
                onClick={() => setMenuOpen(false)}
              >
                Compare Swings
              </Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}