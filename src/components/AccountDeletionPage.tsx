import React from 'react';
import { Trash2, Mail, Globe, MapPin, AlertTriangle, Clock, ShieldCheck } from 'lucide-react';

export const AccountDeletionPage: React.FC = () => {
  const mailtoUrl = `mailto:trustyyellowcabs@gmail.com?subject=Account%20Deletion%20Request%20-%20TRUSTY%20YELLOW%20CAB%20DRIVER&body=Hello%20Trusty%20Yellow%20Cab%20Team%2C%0A%0AI%20would%20like%20to%20request%20the%20deletion%20of%20my%20driver%20account%20and%20associated%20personal%20information.%0A%0ADriver%20ID%3A%20%0ADriver%20Name%3A%20%0ARegistered%20Mobile%20Number%3A%20%0AReason%20(optional)%3A%20%0A%0AThank%20you.`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-12 shadow-sm">
        
        {/* Title */}
        <div className="border-b border-slate-100 pb-6 mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Account Deletion Request
          </h1>
        </div>

        {/* Intro */}
        <div className="space-y-4 text-slate-700 text-sm sm:text-base leading-relaxed mb-8">
          <p>
            <strong>TRUSTY YELLOW CAB DRIVER</strong> allows drivers to request deletion of their account and associated personal information.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8 text-slate-700 text-sm sm:text-base leading-relaxed">

          {/* How to Request */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-600 shrink-0" />
              <span>How to Request Account Deletion</span>
            </h2>
            <p className="mb-3 text-slate-700">
              To request deletion of your driver account, please contact us using one of the methods below:
            </p>
            <div className="mb-4">
              <p className="font-semibold text-slate-900">
                Email:{' '}
                <a
                  href={mailtoUrl}
                  className="text-amber-700 hover:text-amber-800 underline font-mono font-bold"
                >
                  trustyyellowcabs@gmail.com
                </a>
              </p>
            </div>
            <p className="mb-2 font-medium text-slate-900">Please include:</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700 mb-5">
              <li>Driver ID</li>
              <li>Driver Name</li>
              <li>Registered Mobile Number</li>
              <li>Request for Account Deletion</li>
            </ul>

            <a
              href={mailtoUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-xs cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>Compose Deletion Request Email</span>
            </a>
          </div>

          {/* What Will Be Deleted */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600 shrink-0" />
              <span>What Will Be Deleted</span>
            </h2>
            <p className="mb-3 text-slate-600">
              Upon successful verification and approval of your request, we may delete:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
              <li>Driver Profile Information</li>
              <li>Driver Login Access</li>
              <li>Driver Photograph</li>
              <li>Vehicle Information</li>
              <li>Account-related Personal Information</li>
            </ul>
          </div>

          {/* What May Be Retained */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0" />
              <span>What May Be Retained</span>
            </h2>
            <p className="mb-3 text-slate-700">
              Certain information may be retained where required by law, regulatory requirements, fraud prevention, dispute resolution, audit purposes, tax compliance, or legitimate business obligations.
            </p>
            <p className="mb-2 text-slate-600 font-medium">Examples may include:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
              <li>Trip Records</li>
              <li>Billing Records</li>
              <li>Financial Transaction Records</li>
              <li>Compliance Logs</li>
              <li>Legal Records</li>
            </ul>
          </div>

          {/* Processing Time */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Processing Time</span>
            </h2>
            <p className="text-slate-700">
              Account deletion requests are generally processed within <strong>7 to 30 business days</strong> after successful verification.
            </p>
          </div>

          {/* Effect of Deletion */}
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/60 border border-rose-200/80">
            <h2 className="text-base sm:text-lg font-bold text-rose-950 mb-2.5 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Effect of Deletion</span>
            </h2>
            <p className="mb-2 text-rose-900 font-medium">Once the account is deleted:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-rose-900/90 text-sm">
              <li>Login access will be disabled.</li>
              <li>Driver services will no longer be available.</li>
              <li>Deleted information may not be recoverable.</li>
            </ul>
          </div>

          {/* Contact Information */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3">
              Contact Information
            </h2>
            <p className="font-semibold text-slate-900 mb-3">TRUSTY YELLOW CAB</p>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Email:{' '}
                  <a
                    href="mailto:trustyyellowcabs@gmail.com"
                    className="text-amber-700 hover:text-amber-800 underline font-medium"
                  >
                    trustyyellowcabs@gmail.com
                  </a>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Website:{' '}
                  <a
                    href="https://www.trustyyellowcabs.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-700 hover:text-amber-800 underline font-medium"
                  >
                    https://www.trustyyellowcabs.in
                  </a>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Location: Coimbatore, Tamil Nadu, India</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
