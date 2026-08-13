import React, { useState, useRef, useEffect } from 'react';
import { Bike, ChevronDown, Plus, Settings } from 'lucide-react';

export default function BikeSelector({ bikes = [], activeBikeId, onSelectBike, onOpenBikeModal, lang = 'bn' }) {
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
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-100 text-xs font-semibold shadow-sm transition-all active:scale-95"
      >
        <div className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
          <Bike className="w-3.5 h-3.5" />
        </div>
        <span className="max-w-[110px] truncate">{activeBike.name || 'My Bike'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl z-50 overflow-hidden py-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-slate-800">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              {lang === 'bn' ? 'আপনার বাইকসমূহ' : 'YOUR BIKES'}
            </p>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/50">
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
                  className={`w-full text-left px-3 py-2.5 flex items-center justify-between text-xs transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 font-bold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Bike className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <div className="truncate">
                      <p className="truncate font-semibold">{bike.name}</p>
                      {bike.regNumber && (
                        <p className="text-[10px] text-slate-400 truncate">{bike.regNumber}</p>
                      )}
                    </div>
                  </div>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-800 p-1 bg-slate-950/40">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenBikeModal();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'নতুন বাইক যোগ করুন / ম্যানেজ' : 'Add New Bike / Manage'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
