import React, { useState } from 'react';
import { Pill, Calendar, FileText, Mic, AlertTriangle, Users, BookOpen, ShieldCheck } from 'lucide-react';

const Home = () => {
  const [sosActive, setSosActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');

  const handleSOSClick = () => {
    setSosActive(true);
    alert('🚨 Emergency Alert Sent! Caregivers & Emergency Contacts Have Been Notified via WebSockets.');
  };

  const handleVoiceListen = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech Recognition is not supported in this browser. Please try Chrome/Edge.');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setListening(true);
      setVoiceText('Listening for your voice command...');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceText(`You said: "${transcript}"`);
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
      setVoiceText('Could not hear clearly. Please try clicking the button again.');
    };

    recognition.start();
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Hero Header with SOS & Voice Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
        color: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        padding: '2.5rem 2rem',
        marginBottom: '2.5rem',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div style={{ maxWidth: '600px' }}>
          <span style={{
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '0.4rem 1rem',
            borderRadius: '999px',
            fontSize: '0.95rem',
            fontWeight: 'bold',
            letterSpacing: '0.5px'
          }}>
            WELCOME TO CARENEST
          </span>
          <h1 style={{ color: '#ffffff', fontSize: 'var(--font-hero)', marginTop: '0.75rem', marginBottom: '0.5rem' }}>
            Hello, Welcome Home 👋
          </h1>
          <p style={{ fontSize: '1.25rem', opacity: 0.95 }}>
            Your personal AI health companion and emergency safety network. Everything you need is right here.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <button className="btn-sos" onClick={handleSOSClick}>
            <AlertTriangle size={32} />
            PRESS FOR SOS EMERGENCY
          </button>
          {sosActive && (
            <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.4rem 1rem', borderRadius: '8px', fontWeight: 'bold' }}>
              🚨 SOS Signal Broadcasting Active!
            </span>
          )}
        </div>
      </div>

      {/* Voice Companion Banner */}
      <div className="senior-card" style={{ marginBottom: '2.5rem', borderLeft: '6px solid var(--color-brand-primary)', backgroundColor: 'var(--color-brand-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ backgroundColor: 'var(--color-brand-primary)', color: '#ffffff', padding: '1rem', borderRadius: '50%' }}>
              <Mic size={32} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem' }}>CareNest Voice AI Assistant</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Click the button and speak. Ask about your medicine, doctors, or talk freely.</p>
              {voiceText && <p style={{ fontWeight: 'bold', marginTop: '0.5rem', color: 'var(--color-brand-primary)' }}>{voiceText}</p>}
            </div>
          </div>
          <button className="btn-senior-primary" onClick={handleVoiceListen}>
            <Mic size={24} />
            {listening ? 'Listening...' : 'Tap to Speak'}
          </button>
        </div>
      </div>

      {/* Main Senior Dashboard Grid */}
      <h2 style={{ fontSize: 'var(--font-heading)', marginBottom: '1.5rem' }}>Core Care Ecosystem</h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.75rem'
      }}>
        {/* Card 1: Medicine Reminder */}
        <div className="senior-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '0.8rem', borderRadius: '14px' }}>
              <Pill size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem' }}>Medicines & Tracker</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Next: BP Pill at 8:00 PM</p>
            </div>
          </div>
          <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
            Never miss a dose. Automated reminder alerts and daily dosage schedule.
          </p>
          <button className="btn-senior-primary" style={{ width: '100%' }}>View Medicine Schedule</button>
        </div>

        {/* Card 2: Doctor Appointments */}
        <div className="senior-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.8rem', borderRadius: '14px' }}>
              <Calendar size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem' }}>Doctor Appointments</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Dr. Sharma - Tomorrow 10 AM</p>
            </div>
          </div>
          <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
            Book appointments, set tele-consultations, and review prescriptions.
          </p>
          <button className="btn-senior-primary" style={{ width: '100%' }}>Book / View Appointments</button>
        </div>

        {/* Card 3: Digital Health Vault & AI Explainer */}
        <div className="senior-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ backgroundColor: '#f3e8ff', color: '#7e22ce', padding: '0.8rem', borderRadius: '14px' }}>
              <FileText size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem' }}>Health Records & AI</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>AI Simplifier Enabled</p>
            </div>
          </div>
          <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
            Store lab reports securely and let AI explain complex medical reports in simple words.
          </p>
          <button className="btn-senior-primary" style={{ width: '100%' }}>Open Health Vault</button>
        </div>

        {/* Card 4: Community & Memory Care */}
        <div className="senior-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ backgroundColor: '#ffedd5', color: '#c2410c', padding: '0.8rem', borderRadius: '14px' }}>
              <Users size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem' }}>Community & Memory</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Senior Clubs & Quizzes</p>
            </div>
          </div>
          <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
            Join social groups, family feeds, and enjoy daily memory-boosting brain exercises.
          </p>
          <button className="btn-senior-primary" style={{ width: '100%' }}>Explore Community</button>
        </div>

        {/* Card 5: AI Scam & Fraud Shield */}
        <div className="senior-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.8rem', borderRadius: '14px' }}>
              <ShieldCheck size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem' }}>AI Scam & Fraud Shield</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Safety Check Tool</p>
            </div>
          </div>
          <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
            Received a suspicious message or call? Paste it here to verify if it is a scam.
          </p>
          <button className="btn-senior-primary" style={{ width: '100%' }}>Check Suspicious Message</button>
        </div>

        {/* Card 6: Government Schemes */}
        <div className="senior-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '0.8rem', borderRadius: '14px' }}>
              <BookOpen size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem' }}>Govt Schemes Guide</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Pensions & Healthcare</p>
            </div>
          </div>
          <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
            Guidance on senior citizen welfare programs, pension assistance, and benefits.
          </p>
          <button className="btn-senior-primary" style={{ width: '100%' }}>View Welfare Schemes</button>
        </div>
      </div>
    </div>
  );
};

export default Home;
