"use client";

import { Download, Youtube, Film, Facebook, Moon, Sun, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useThemeLanguage } from '@/lib/hooks/useThemeLanguage';

import '@/style/header.css';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isDarkMode, toggleDarkMode } = useThemeLanguage();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo-container">
          <div className="logo-icon">
            <Download size={22} color="white" />
          </div>
          <h1 className="logo-text">FastYt</h1>
        </div>

        <div className="header-right">
          <div className="platform-buttons">
            <button className="platform-btn youtube">
              <Youtube size={20} />
              <span>YouTube</span>
            </button>

            <button className="platform-btn tiktok">
              <Film size={20} />
              <span>TikTok</span>
            </button>

            <button className="platform-btn facebook">
              <Facebook size={20} />
              <span>Facebook</span>
            </button>
          </div>

          <button onClick={toggleDarkMode} className="theme-button" aria-label="Toggle theme">
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <button onClick={toggleMenu} className="menu-button" aria-label="Toggle menu">
          <Menu size={24} />
        </button>
      </div>

      {/* ====== mobile menu ====== */}
      {/* ====== mobile menu ====== */}
      {/* ====== mobile menu ====== */}

      <div className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <div className="logo-container">
            <div className="logo-icon">
              <Download size={22} color="white" />
            </div>
            <h1 className="logo-text">FastYt</h1>
          </div>
          <button onClick={closeMenu} className="close-button" aria-label="Close menu">
            <X size={24} />
          </button>
        </div>

        <div className="mobile-menu-content">
          <button className="platform-btn youtube" onClick={closeMenu}>
            <Youtube size={20} />
            <span>YouTube</span>
          </button>

          <button className="platform-btn tiktok" onClick={closeMenu}>
            <Film size={20} />
            <span>TikTok</span>
          </button>

          <button className="platform-btn facebook" onClick={closeMenu}>
            <Facebook size={20} />
            <span>Facebook</span>
          </button>

          <button onClick={toggleDarkMode} className="theme-button" aria-label="Toggle theme">
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>

      {/* Оверлей */}
      {isMenuOpen && <div className="overlay" onClick={closeMenu}></div>}
    </header>
  );
}