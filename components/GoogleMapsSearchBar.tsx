'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Mic,
  Camera,
  MapPin,
  Sparkles,
  Layers,
  ChevronRight,
  X,
  Droplets,
  Trees,
  Wheat,
  Sliders,
} from 'lucide-react';
import type { RegionId } from '@/types/sar';
import type { SearchPlace, UserProfile } from '@/types/google-maps';
import { SEARCH_PLACES } from '@/lib/placesData';

interface GoogleMapsSearchBarProps {
  currentRegion: RegionId;
  onSelectRegion: (id: RegionId) => void;
  onSelectPlace: (place: SearchPlace) => void;
  onOpenAuth: () => void;
  onOpenAiReport: () => void;
  onToggleCompareMode: () => void;
  compareMode: 'before' | 'animate' | 'after';
  profile: UserProfile;
  activeFilterClass: number | null;
  onToggleFilterClass: (classId: number) => void;
}

export function GoogleMapsSearchBar({
  currentRegion,
  onSelectRegion,
  onSelectPlace,
  onOpenAuth,
  onOpenAiReport,
  onToggleCompareMode,
  compareMode,
  profile,
  activeFilterClass,
  onToggleFilterClass,
}: GoogleMapsSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter places based on search query or show current region places
  const filteredPlaces = query.trim()
    ? SEARCH_PLACES.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase()) ||
          p.type.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_PLACES.filter((p) => p.regionId === currentRegion);

  const handleChoosePlace = (place: SearchPlace) => {
    if (place.regionId !== currentRegion) {
      onSelectRegion(place.regionId);
    }
    onSelectPlace(place);
    setQuery(place.name);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="flex flex-col space-y-2 pointer-events-auto font-sans w-full max-w-md">
      {/* 1. GOOGLE MAPS FLOATING SEARCH PILL */}
      <div className="relative flex items-center bg-[#1E1F22]/95 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.8)] h-12 px-3 text-white transition-all focus-within:ring-2 focus-within:ring-cyan-400/50">
        {/* Left: Google Map Pin with DELTAWATCH Cyan Glow */}
        <div className="flex items-center justify-center w-8 h-8 rounded-full text-red-400 shrink-0">
          <svg className="w-5 h-5 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
        </div>

        {/* Center: Search Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search places, towns, wetlands..."
          className="flex-1 bg-transparent border-none text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none px-2 font-medium"
        />

        {query && (
          <button
            onClick={handleClear}
            className="p-1 rounded-full text-white/50 hover:text-white transition cursor-pointer mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Right Action Icons: Mic, Lens, User Profile Avatar */}
        <div className="flex items-center gap-1.5 pl-1 border-l border-white/10">
          <button
            type="button"
            onClick={() => {
              setQuery('Nagapattinam Port');
              setIsOpen(true);
            }}
            className="p-1.5 text-white/60 hover:text-cyan-300 transition cursor-pointer"
            title="Voice Search"
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onToggleCompareMode()}
            className="p-1.5 text-white/60 hover:text-cyan-300 transition cursor-pointer hidden sm:block"
            title="Scan / Lens (Compare Mode)"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* User Profile Avatar Circle (Google Maps style) */}
          <button
            type="button"
            onClick={onOpenAuth}
            className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 via-sky-400 to-blue-600 text-black font-bold text-xs shadow-md ml-1 hover:ring-2 hover:ring-cyan-300 transition cursor-pointer"
            title={profile.isSignedIn ? `${profile.name} (Account Settings)` : 'Sign in / Profile'}
          >
            {profile.isSignedIn ? (
              <span>{profile.name.charAt(0).toUpperCase()}</span>
            ) : (
              <span className="text-[11px] font-black">G</span>
            )}
            {profile.isSignedIn && (
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-black" />
            )}
          </button>
        </div>
      </div>

      {/* 2. AUTOCOMPLETE PLACES DROPDOWN */}
      {isOpen && (
        <div className="bg-[#1E1F22]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-white/5 animate-in fade-in duration-150">
          <div className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-cyan-300/80 bg-black/30 flex items-center justify-between">
            <span>{query ? 'Matching Places & Towns' : `Key Locations in ${currentRegion === 'nagapattinam' ? 'Cauvery Delta' : 'Majuli Island'}`}</span>
            <span className="text-white/40">{filteredPlaces.length} places</span>
          </div>

          {filteredPlaces.length > 0 ? (
            filteredPlaces.map((place) => (
              <button
                key={place.id}
                onClick={() => handleChoosePlace(place)}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/5 transition text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 group-hover:text-cyan-400 group-hover:bg-cyan-950/60 transition">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition">
                      {place.name}
                    </div>
                    <div className="text-[11px] text-white/50 line-clamp-1">
                      {place.description}
                    </div>
                  </div>
                </div>
                {place.floodStatus && (
                  <div className="text-right shrink-0 pl-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                      {place.floodStatus}
                    </span>
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-xs text-white/40">
              No matching town found. Try &quot;Nagapattinam&quot;, &quot;Muthupet&quot;, or &quot;Majuli&quot;.
            </div>
          )}
        </div>
      )}

      {/* 3. GOOGLE MAPS HORIZONTAL QUICK-ACTION CATEGORY PILLS */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 select-none">
        {/* Pill 1: Ask Maps / AI Science Report */}
        <button
          onClick={onOpenAiReport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E1F22]/90 hover:bg-cyan-950/70 border border-white/10 hover:border-cyan-400/50 text-white text-xs font-semibold shrink-0 shadow-md transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Ask Maps (AI)</span>
        </button>

        {/* Pill 3: Open Flood Filter */}
        <button
          onClick={() => onToggleFilterClass(1)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 shadow-md transition cursor-pointer ${
            activeFilterClass === 1
              ? 'bg-[#00F0FF]/30 border border-[#00F0FF] text-[#00F0FF]'
              : 'bg-[#1E1F22]/90 hover:bg-white/10 border border-white/10 text-white/80'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[#00F0FF]" />
          <span>Open Flood</span>
        </button>

        {/* Pill 4: Flooded Canopy Filter */}
        <button
          onClick={() => onToggleFilterClass(2)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 shadow-md transition cursor-pointer ${
            activeFilterClass === 2
              ? 'bg-[#FF2E93]/30 border border-[#FF2E93] text-[#FF2E93]'
              : 'bg-[#1E1F22]/90 hover:bg-white/10 border border-white/10 text-white/80'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[#FF2E93]" />
          <span>Mangroves</span>
        </button>

        {/* Pill 5: Animate / Before / After */}
        <button
          onClick={onToggleCompareMode}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1E1F22]/90 hover:bg-white/10 border border-white/10 text-xs font-medium text-cyan-300 shrink-0 shadow-md transition cursor-pointer"
        >
          <Sliders className="w-3 h-3 text-cyan-400" />
          <span>View: {compareMode === 'animate' ? 'ANIMATE' : compareMode.toUpperCase()}</span>
        </button>
      </div>
    </div>
  );
}
