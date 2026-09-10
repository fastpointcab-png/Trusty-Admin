import React, { useState } from 'react';
import { FileCode2, Copy, Check, ShieldCheck, Terminal, MapPin, KeyRound, Smartphone } from 'lucide-react';
import { PRODUCTION_FIRESTORE_RULES } from '../firebase/rules';

export const RulesManager: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(PRODUCTION_FIRESTORE_RULES);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Geo-Fencing & Operational Security Architecture */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Geo-Fencing & Operational Fleet Security
            </h3>
            <p className="text-xs text-slate-500">
              Radial dispatch filtering, device token binding & customer OTP ride authentication
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
          <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-indigo-950 mb-1">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <span>Radius Geofencing Policy</span>
              </div>
              <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                Dispatches are dynamically filtered to drivers reporting GPS coordinates within radial bounds (5km, 10km, 25km, 50km) of pickup location.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-indigo-100/80 flex items-center justify-between text-[10px] text-indigo-700 font-bold uppercase">
              <span>Standard: 10 KM Radius</span>
              <span className="bg-indigo-200/70 text-indigo-900 px-1.5 py-0.5 rounded">Active</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-950 mb-1">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <span>Customer OTP Trip Lock</span>
              </div>
              <p className="text-[11px] text-emerald-900/80 leading-relaxed">
                Drivers must input the 4-digit rider OTP to initiate trip meter and transition ride from ACCEPTED to IN_PROGRESS, eliminating ghost rides.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-emerald-100/80 flex items-center justify-between text-[10px] text-emerald-700 font-bold uppercase">
              <span>Enforcement: Mandatory</span>
              <span className="bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded">Enforced</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-purple-950 mb-1">
                <Smartphone className="w-4 h-4 text-purple-600" />
                <span>Single Hardware Device Lock</span>
              </div>
              <p className="text-[11px] text-purple-900/80 leading-relaxed">
                Driver accounts are bound to a verified hardware device token. Resetting hardware credentials requires dispatcher authorization in Driver Management.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-purple-100/80 flex items-center justify-between text-[10px] text-purple-700 font-bold uppercase">
              <span>Anti-Sharing: Enabled</span>
              <span className="bg-purple-200/70 text-purple-900 px-1.5 py-0.5 rounded">Protected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Production Firestore Security Rules (Driver App + Web Admin)
              </h3>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed max-w-3xl">
              These rules guarantee <strong>100% backward compatibility</strong> with your existing Android taxi driver application while unlocking full real-time control, trip dispatching, driver management, emergency cutoff, and rate matrices from this Web Admin Console PWA.
            </p>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Rules for Firebase Console'}</span>
          </button>
        </div>

        {/* Key Architectural Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
            <h5 className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> 1. Android App Safe
            </h5>
            <p className="text-[11px] text-emerald-800 mt-1 leading-normal">
              Keeps open read/write access on <code>/drivers</code> and <code>/trips</code> so your Kotlin drivers can update location, FCM tokens, and accept trips without modifying Kotlin client code.
            </p>
          </div>

          <div className="bg-sky-50/70 p-3 rounded-xl border border-sky-200">
            <h5 className="font-bold text-xs text-sky-900 flex items-center gap-1.5">
              <FileCode2 className="w-4 h-4 text-sky-600" /> 2. Full Admin Authorization
            </h5>
            <p className="text-[11px] text-sky-800 mt-1 leading-normal">
              Enables Web Console to create open trips, assign drivers, verify ride OTPs, delete records, and reset driver hardware device bindings.
            </p>
          </div>

          <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
            <h5 className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-amber-600" /> 3. System Killswitch
            </h5>
            <p className="text-[11px] text-amber-800 mt-1 leading-normal">
              Secures <code>/system_settings/dispatch_control</code> to govern fleet-wide cutoff switch and broadcast banners live.
            </p>
          </div>
        </div>
      </div>

      {/* Rules Code Viewer */}
      <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-md">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-xs font-mono text-slate-400 ml-2">firestore.rules</span>
          </div>
          <button
            onClick={handleCopy}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono transition"
          >
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[500px]">
          {PRODUCTION_FIRESTORE_RULES}
        </pre>
      </div>

      {/* Deployment Guide */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-xs space-y-3">
        <h4 className="font-extrabold text-sm text-slate-900">How to Apply These Rules to Your Firebase Project</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <strong className="text-slate-900 font-bold block mb-1">Method 1: Firebase Console (Quickest)</strong>
            <ol className="list-decimal list-inside space-y-1 text-slate-600">
              <li>Open <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-amber-600 underline font-medium">Firebase Console</a>.</li>
              <li>Go to <strong>Build &rarr; Firestore Database &rarr; Rules</strong> tab.</li>
              <li>Click <strong>&quot;Copy Rules for Firebase Console&quot;</strong> button above.</li>
              <li>Paste the code into the editor and click <strong>Publish</strong>.</li>
            </ol>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <strong className="text-slate-900 font-bold block mb-1">Method 2: Firebase CLI</strong>
            <p className="text-slate-600 mb-2">If you have the Firebase CLI installed locally, run:</p>
            <div className="bg-slate-900 text-slate-200 font-mono p-2.5 rounded-lg text-[11px]">
              firebase deploy --only firestore:rules
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
