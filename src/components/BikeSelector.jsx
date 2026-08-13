import React from 'react';
import { Bike, Plus } from 'lucide-react';

export default function BikeSelector({ bikes = [], activeBikeId, onSelectBike, onOpenBikeModal, lang = 'bn' }) {
  return (
    <div className="w-full px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar flex-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap mr-1 flex items-center gap-1">
          <Bike className="w-3.5 h-3.5 text-emerald-400" />
          <span>{lang === 'bn' ? 'বাইক নির্বাচন:' : 'Select Bike:'}</span>
        </span>

        {bikes.map((bike) => {
          const isActive = bike.id === activeBikeId;
          return (
            <button
              key={bike.id}
              type="button"
              onClick={() => onSelectBike(bike.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 shadow-sm active:scale-95 ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-emerald-950/20'
                  : 'bg-slate-800/70 text-slate-300 border border-slate-700/50 hover:bg-slate-700/80 hover:text-white'
              }`}
            >
              <Bike className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="max-w-[120px] truncate">{bike.name}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onOpenBikeModal}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/90 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-bold transition-all shrink-0 active:scale-95"
        title={lang === 'bn' ? 'নতুন বাইক যোগ করুন' : 'Add Bike'}
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{lang === 'bn' ? 'নতুন বাইক' : 'Add Bike'}</span>
      </button>
    </div>
  );
}

