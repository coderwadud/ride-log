import React, { useState, useRef, useEffect } from 'react';
import { Bike, ChevronDown, Plus, Check } from 'lucide-react';

export default function BikeSelector({ bikes = [], activeBikeId, onSelectBike, onOpenBikeModal, lang = 'bn', align = 'right' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const activeBike = bikes.find(b => b.id === activeBikeId) || bikes[0] || { name: 'My Bike' };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bike-dropdown-trigger"
      >
        <Bike size={16} />
        <span style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeBike.name || 'My Bike'}
        </span>
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
      </button>

      {isOpen && (
        <div 
          className="bike-dropdown-menu"
          style={{ [align === 'left' ? 'left' : 'right']: 0 }}
        >
          <div style={{ padding: '6px 10px 4px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
            <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', fontWeight: 700, margin: 0 }}>
              {lang === 'bn' ? 'আপনার বাইকসমূহ' : 'YOUR BIKES'}
            </p>
          </div>

          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {bikes.map((bike) => {
              const isActive = bike.id === activeBikeId;
              return (
                <button
                  key={bike.id}
                  type="button"
                  onClick={() => {
                    onSelectBike(bike.id);
                    setIsOpen(false);
                  }}
                  className={`bike-dropdown-item ${isActive ? 'active' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <Bike size={15} style={{ color: isActive ? 'var(--accent-fuel)' : 'var(--text-muted)' }} />
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <p style={{ margin: 0, fontWeight: isActive ? 700 : 600 }}>{bike.name}</p>
                      {bike.regNumber && (
                        <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-dim)' }}>{bike.regNumber}</p>
                      )}
                    </div>
                  </div>
                  {isActive && <Check size={14} style={{ color: 'var(--accent-fuel)', flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '4px', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenBikeModal();
              }}
              className="bike-dropdown-item"
              style={{ color: 'var(--accent-fuel)', justifyContent: 'center', gap: '6px', fontWeight: 700 }}
            >
              <Plus size={15} />
              <span>{lang === 'bn' ? 'নতুন বাইক যোগ করুন' : 'Add New Bike'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


