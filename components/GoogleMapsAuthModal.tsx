'use client';

import React, { useState } from 'react';
import {
  X,
  User,
  Shield,
  Key,
  LogIn,
  UserPlus,
  LogOut,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import type { UserProfile } from '@/types/google-maps';

interface GoogleMapsAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateProfile: (newProfile: UserProfile) => void;
}

export function GoogleMapsAuthModal({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
}: GoogleMapsAuthModalProps) {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'profile'>(
    profile.isSignedIn ? 'profile' : 'signin'
  );
  const [emailInput, setEmailInput] = useState(profile.email || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState(profile.name || '');
  const [earthdataUsername, setEarthdataUsername] = useState('mehul_raikwar');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      name: nameInput || 'NASA Earthdata Specialist',
      email: emailInput || 'researcher@nasa.gov',
      role: 'SAR Payload Hydrologist',
      organization: 'NASA Space Apps 2026',
      isSignedIn: true,
      isGuest: false,
    };
    onUpdateProfile(updated);
    setStatusMsg('Successfully authenticated with NASA Earthdata.');
    setTimeout(() => {
      setStatusMsg(null);
      onClose();
    }, 800);
  };

  const handleGoogleSignIn = () => {
    const updated: UserProfile = {
      name: 'Google Space Explorer',
      email: 'user@gmail.com',
      role: 'Science Contributor',
      organization: 'Google Earth & Maps Partner',
      isSignedIn: true,
      isGuest: false,
    };
    onUpdateProfile(updated);
    setStatusMsg('Signed in with Google Account.');
    setTimeout(() => {
      setStatusMsg(null);
      onClose();
    }, 800);
  };

  const handleSkipAsGuest = () => {
    const updated: UserProfile = {
      name: 'Guest Observer',
      email: 'guest@deltawatch.public',
      role: 'Public Viewer',
      organization: 'Civil Defense & Open Science',
      isSignedIn: false,
      isGuest: true,
    };
    onUpdateProfile(updated);
    onClose();
  };

  const handleSignOut = () => {
    const updated: UserProfile = {
      name: 'Guest Observer',
      email: '',
      role: 'Public Viewer',
      organization: 'Civil Defense',
      isSignedIn: false,
      isGuest: true,
    };
    onUpdateProfile(updated);
    setActiveTab('signin');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      {/* Modal Dialog Box */}
      <div className="relative w-full max-w-md bg-[#1E1F22] border border-white/10 rounded-3xl shadow-2xl overflow-hidden text-white font-sans">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            {/* Google-Style G Avatar / DELTAWATCH pin */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 via-sky-400 to-blue-600 flex items-center justify-center font-bold text-black text-sm shadow-md">
              {profile.isSignedIn ? profile.name.charAt(0).toUpperCase() : 'G'}
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-white">
                {profile.isSignedIn ? 'NASA & Google Account' : 'Sign in to DELTAWATCH'}
              </h2>
              <p className="text-[11px] text-white/50">
                {profile.isSignedIn ? profile.email : 'Google Maps NISAR Mission Control'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/10 bg-black/20 text-xs font-medium">
          <button
            onClick={() => setActiveTab('signin')}
            className={`flex-1 py-2.5 text-center transition ${
              activeTab === 'signin'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/5 font-semibold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setActiveTab('signup')}
            className={`flex-1 py-2.5 text-center transition ${
              activeTab === 'signup'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/5 font-semibold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Create Account
          </button>
          {profile.isSignedIn && (
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2.5 text-center transition ${
                activeTab === 'profile'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/5 font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Profile
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          {statusMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-400/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {activeTab === 'signin' && (
            <div className="space-y-4">
              {/* Google One-Tap / Sign In with Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-full bg-white text-gray-800 hover:bg-gray-100 font-semibold text-xs shadow-md transition cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 text-white/30 text-[11px]">
                <div className="flex-1 h-[1px] bg-white/10" />
                <span>or email & Earthdata</span>
                <div className="flex-1 h-[1px] bg-white/10" />
              </div>

              {/* Email & Password Form */}
              <form onSubmit={handleSignIn} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-white/70 mb-1">Email address</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@organization.gov"
                    required
                    className="w-full text-xs px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-white/70 mb-1">Password</label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full text-xs px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </form>

              {/* Skip / Continue as Guest Option */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-white/40">Testing without an account?</span>
                <button
                  type="button"
                  onClick={handleSkipAsGuest}
                  className="text-xs text-cyan-300 hover:text-cyan-200 font-medium underline underline-offset-4 cursor-pointer"
                >
                  Skip & Continue as Guest →
                </button>
              </div>
            </div>
          )}

          {activeTab === 'signup' && (
            <form onSubmit={handleSignIn} className="space-y-3">
              <div>
                <label className="block text-[11px] text-white/70 mb-1">Full Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Dr. Rajesh Patel"
                  required
                  className="w-full text-xs px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-[11px] text-white/70 mb-1">Organization / Agency</label>
                <input
                  type="text"
                  defaultValue="State Disaster Management Authority"
                  className="w-full text-xs px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-[11px] text-white/70 mb-1">Work Email</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="rajesh@sdma.gov.in"
                  required
                  className="w-full text-xs px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-[11px] text-white/70 mb-1">Create Password</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full text-xs px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-semibold text-xs shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Research Profile</span>
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleSkipAsGuest}
                  className="text-xs text-white/40 hover:text-white/70 transition"
                >
                  Skip registration
                </button>
              </div>
            </form>
          )}

          {activeTab === 'profile' && profile.isSignedIn && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-black font-bold text-lg">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{profile.name}</h3>
                  <p className="text-xs text-cyan-300 font-mono">{profile.email}</p>
                  <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                    {profile.role} • {profile.organization}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    NASA Earthdata Sync
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-400/30">
                    ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-white/50">
                  User ID: <code className="text-white font-mono">{earthdataUsername}</code> (NISAR L2 GCOV Provisioning)
                </p>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-2.5 rounded-full bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 text-red-300 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out from Device</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
