import React, { useState } from 'react';
import { Shield, PhoneCall, Heart, Sun, Moon, Type } from 'lucide-react';

const Navbar = () => {
  const [darkTheme, setDarkTheme] = useState(false);
  const [largeFont, setLargeFont] = useState(false);

  const toggleTheme = () => {
    setDarkTheme(!darkTheme);
    document.documentElement.setAttribute('data-theme', !darkTheme ? 'dark' : 'light');
  };

  const toggleFontSize = () => {
    setLargeFont(!largeFont);
    document.documentElement.setAttribute('data-font-size', !largeFont ? 'large' : 'normal');
  };

  return (
    <nav className="navbar-senior">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          backgroundColor: 'var(--color-brand-primary)',
          color: '#ffffff',
          width: '46px',
          height: '46px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '1.5rem'
        }}>
          <Heart fill="#ffffff" size={26} />
        </div>
        <div>
          <span style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--color-brand-primary)' }}>CareNest</span>
          <span style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text-muted)', fontWeight: '600' }}>Senior Care Ecosystem</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button 
          onClick={toggleFontSize} 
          title="Toggle Large Text for Accessibility"
          style={{
            background: 'var(--bg-card-hover)',
            border: '2px solid var(--text-muted)',
            borderRadius: '12px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-primary)'
          }}
        >
          <Type size={20} />
          {largeFont ? 'Normal Text' : 'Large Text'}
        </button>

        <button 
          onClick={toggleTheme} 
          title="Toggle High Contrast Mode"
          style={{
            background: 'var(--bg-card-hover)',
            border: '2px solid var(--text-muted)',
            borderRadius: '12px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-primary)'
          }}
        >
          {darkTheme ? <Sun size={20} color="#eab308" /> : <Moon size={20} />}
          {darkTheme ? 'Light Mode' : 'Dark Mode'}
        </button>

        <a 
          href="#sos" 
          className="btn-sos" 
          style={{ padding: '0.6rem 1.4rem', fontSize: '1.1rem' }}
        >
          <PhoneCall size={22} />
          SOS EMERGENCY
        </a>
      </div>
    </nav>
  );
};

export default Navbar;
