import React from 'react';
import { ShieldCheck, Globe, Mail, MapPin } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-12 shadow-sm">
        
        {/* Title */}
        <div className="border-b border-slate-100 pb-6 mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Privacy Policy
          </h1>
        </div>

        {/* Intro */}
        <div className="space-y-4 text-slate-700 text-sm sm:text-base leading-relaxed mb-8">
          <p>
            <strong>TRUSTY YELLOW CAB DRIVER</strong> (&quot;we&quot;, &quot;our&quot;, or &quot;the Company&quot;) respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect information when you use the <strong>TRUSTY YELLOW CAB DRIVER</strong> mobile application.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8 text-slate-700 text-sm sm:text-base leading-relaxed">
          
          {/* Section 1 */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <span className="text-amber-600">1.</span> Information We Collect
            </h2>
            <p className="mb-3 text-slate-600">We may collect the following information:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
              <li>Driver Name</li>
              <li>Driver ID</li>
              <li>Mobile Number</li>
              <li>Vehicle Number</li>
              <li>Vehicle Category</li>
              <li>Driver Photograph</li>
              <li>Driving License and Vehicle Documents (if provided)</li>
              <li>Location Information (GPS)</li>
              <li>Trip Information and Trip History</li>
              <li>Device Information required for app functionality</li>
            </ul>
          </div>

          {/* Section 2 */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <span className="text-amber-600">2.</span> Location Information
            </h2>
            <p className="mb-3 text-slate-600">The application may collect location information while the app is in use for:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
              <li>Trip allocation and dispatch services</li>
              <li>Driver tracking during active trips</li>
              <li>Route monitoring and trip management</li>
              <li>Improving service quality and operational efficiency</li>
            </ul>
          </div>

          {/* Section 3 */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <span className="text-amber-600">3.</span> How We Use Information
            </h2>
            <p className="mb-3 text-slate-600">We use collected information to:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
              <li>Verify driver accounts</li>
              <li>Manage driver profiles</li>
              <li>Allocate and manage trips</li>
              <li>Provide dispatch services</li>
              <li>Generate trip records and reports</li>
              <li>Communicate important service updates</li>
              <li>Improve application performance and security</li>
            </ul>
          </div>

          {/* Section 4 */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <span className="text-amber-600">4.</span> Information Sharing
            </h2>
            <p className="mb-3 text-slate-600">We do not sell personal information.</p>
            <p className="mb-2 text-slate-600">Information may be shared only:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
              <li>When required by law or government authorities</li>
              <li>To protect the safety and security of users and the platform</li>
              <li>With authorized service providers supporting app operations</li>
            </ul>
          </div>

          {/* Section 5 */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <span className="text-amber-600">5.</span> Data Storage and Security
            </h2>
            <p className="mb-2 text-slate-700">
              We take reasonable measures to protect collected information from unauthorized access, misuse, alteration, or disclosure.
            </p>
            <p className="text-slate-600 italic">
              However, no electronic storage system can be guaranteed to be 100% secure.
            </p>
          </div>

          {/* Section 6 */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <span className="text-amber-600">6.</span> Driver Responsibilities
            </h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
              <li>Drivers are responsible for maintaining accurate information and protecting their account credentials.</li>
              <li>Drivers must not share login access with unauthorized persons.</li>
            </ul>
          </div>

          {/* Section 7 */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <span className="text-amber-600">7.</span> Retention of Information
            </h2>
            <p className="text-slate-700">
              Driver and trip-related information may be retained as required for operational, legal, compliance, audit, and business purposes.
            </p>
          </div>

          {/* Section 8 */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <span className="text-amber-600">8.</span> Third-Party Services
            </h2>
            <p className="mb-3 text-slate-600">The application may use third-party services such as:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700 mb-3">
              <li>Google Firebase</li>
              <li>Google Play Services</li>
              <li>Google Maps Services</li>
            </ul>
            <p className="text-slate-600">
              These services may collect information according to their own privacy policies.
            </p>
          </div>

          {/* Section 9 */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <span className="text-amber-600">9.</span> Your Rights
            </h2>
            <p className="text-slate-700">
              Drivers may request correction of inaccurate profile information by contacting the company.
            </p>
          </div>

          {/* Section 10 */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 flex items-center gap-2">
              <span className="text-amber-600">10.</span> Changes to this Privacy Policy
            </h2>
            <p className="text-slate-700">
              We may update this Privacy Policy from time to time. Continued use of the application after updates constitutes acceptance of the revised policy.
            </p>
          </div>

          {/* Section 11 */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="text-amber-600">11.</span> Contact Information
            </h2>
            <p className="font-semibold text-slate-900 mb-3">TRUSTY YELLOW CAB</p>
            <div className="space-y-2 text-sm text-slate-700">
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
                <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Location: Coimbatore, Tamil Nadu, India</span>
              </div>
            </div>
          </div>

          {/* Acknowledgement Footer */}
          <div className="pt-6 border-t border-slate-100 flex items-start gap-3 text-slate-600 text-xs sm:text-sm">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">
              By using the <strong>TRUSTY YELLOW CAB DRIVER</strong> application, you acknowledge that you have read and understood this Privacy Policy.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
