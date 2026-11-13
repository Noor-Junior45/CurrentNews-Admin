import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  UserCheck, 
  ChevronRight,
  BookOpen,
  ArrowUp
} from 'lucide-react';
import ProfilePageNavbar from '../components/ProfilePageNavbar';
import { updateDocumentSEO } from '../utils/seo';

export default function PrivacyView() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    updateDocumentSEO({
      title: 'Privacy Policy | Current News',
      description: 'Enterprise global privacy policy, data protection rules, GDPR, CCPA/CPRA, PIPEDA, LGPD, and Google Play Store safety standards for Current News Live.',
      canonicalPath: '/privacy'
    });
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const sectionsIndex = [
    { id: 'section-1', num: '§ 01', title: 'Corporate Entity & Territorial Jurisdiction' },
    { id: 'section-2', num: '§ 02', title: 'Categories of Information Collected & Processed' },
    { id: 'section-3', num: '§ 03', title: 'Lawful Grounds for Processing (GDPR Article 6)' },
    { id: 'section-4', num: '§ 04', title: 'Advertising, Cookies & Google AdSense Policies' },
    { id: 'section-5', num: '§ 05', title: 'Regional Statutory Protections (GDPR, CCPA, PIPEDA, LGPD)' },
    { id: 'section-6', num: '§ 06', title: 'Google Play Safety & Permanent Account Deletion' },
    { id: 'section-7', num: '§ 07', title: 'Children’s Privacy Mandate (COPPA & International Standards)' },
    { id: 'section-8', num: '§ 08', title: 'Data Security, Retention Schedules & Cryptographic Shielding' },
    { id: 'section-9', num: '§ 09', title: 'Cross-Border Transfers & International Safeguards' },
    { id: 'section-10', num: '§ 10', title: 'Government Subpoenas, Law Enforcement & Sovereign Inquiries' },
    { id: 'section-11', num: '§ 11', title: 'Statutory Data Subject Rights & Regulatory Recourse' },
    { id: 'section-12', num: '§ 12', title: 'Designated Legal Directorate & Regulatory Contact' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F0] dark:bg-[#161513] text-[#2C2621] dark:text-[#E2DDD3] transition-colors" id="privacy-policy-view">
      <ProfilePageNavbar 
        title="Privacy Policy" 
        align="left" 
        fallbackUrl="/admin" 
        onBack={() => navigate('/admin')} 
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        
        {/* Document Header - Formal Legal Codex Book Style */}
        <header className="border-b-2 border-[#E5DEC9] dark:border-[#38332A] pb-8 mb-12">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest uppercase text-[#7A5832] dark:text-[#D4AF37] font-semibold mb-3">
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>Official Legal Codex &bull; Document Reference CNL-PRIV-2026-V5</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-black text-[#1C1814] dark:text-[#FAF7F2] tracking-tight leading-tight mb-4">
            Privacy Policy
          </h1>

          <p className="text-base sm:text-lg text-[#554C42] dark:text-[#B8AEA0] font-sans leading-relaxed mb-6">
            Published and enforced by <strong>Current News Live</strong> (&ldquo;Current News,&rdquo; &ldquo;the Organization,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). This binding statutory codex governs the gathering, transmission, processing, retention, and legal protection of personal data across all global jurisdictions.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#EAE3D2] dark:border-[#2C2720] text-sm text-[#63594D] dark:text-[#A69C8E]">
            <div>
              <span className="block font-mono text-xs uppercase tracking-wider text-[#8A755D] dark:text-[#C2A675]">Effective Date</span>
              <strong className="text-[#2C241E] dark:text-[#EAE5DC]">October 10, 2026</strong>
            </div>
            <div>
              <span className="block font-mono text-xs uppercase tracking-wider text-[#8A755D] dark:text-[#C2A675]">Territorial Scope</span>
              <strong className="text-[#2C241E] dark:text-[#EAE5DC]">Global &bull; 190+ Sovereign States</strong>
            </div>
            <div>
              <span className="block font-mono text-xs uppercase tracking-wider text-[#8A755D] dark:text-[#C2A675]">Statutory Standard</span>
              <strong className="text-[#2C241E] dark:text-[#EAE5DC]">GDPR, CCPA, PIPEDA, LGPD</strong>
            </div>
          </div>
        </header>

        {/* Book Type Table of Contents / Codex Directory Box */}
        <section className="mb-12 border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-8 shadow-xs" id="codex-directory">
          <div className="border-b border-[#EBE4D8] dark:border-[#2D2822] pb-4 mb-6">
            <h2 className="text-lg sm:text-xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2] flex items-center gap-2">
              <span className="font-mono text-sm text-[#7A5832] dark:text-[#D4AF37]">Index &bull;</span>
              <span>Table of Contents & Section Navigator</span>
            </h2>
            <p className="text-sm text-[#665D52] dark:text-[#A89F93] mt-1">
              Select any section to navigate directly to its binding statutory provisions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sectionsIndex.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSection(sec.id)}
                className="w-full text-left p-3 rounded-xl border border-[#EDE7DC] dark:border-[#2C2720] bg-[#FAF8F2] dark:bg-[#23201C] hover:bg-[#F2ECE0] dark:hover:bg-[#2C2722] transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <span className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] shrink-0">
                    {sec.num}
                  </span>
                  <span className="text-sm sm:text-[15px] font-medium text-[#2C2621] dark:text-[#DDD7CE] truncate group-hover:text-[#141210] dark:group-hover:text-white">
                    {sec.title}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#9C8F7E] dark:text-[#786F63] shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </section>

        {/* Section 1: Corporate Entity & Territorial Jurisdiction */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-1">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 1.0 &bull; JURISDICTION & SCOPE
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Corporate Entity & Territorial Scope
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              <strong>1.1 Operational Entity:</strong> This Worldwide Privacy Policy governs all digital publications, services, mobile application distributions, and technical platforms operated by <strong>Current News Live</strong> (collectively referred to as &ldquo;the Organization,&rdquo; &ldquo;Current News,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;).
            </p>
            <p>
              <strong>1.2 Scope of Applicability:</strong> The provisions set forth in this Codex apply to all readers, subscribers, contributors, and platform visitors accessing our services through:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base text-[#3A332B] dark:text-[#D5CEC2]">
              <li>The primary registered web domain <strong>currentnews.blog</strong> and its canonical subdomain <strong>www.currentnews.blog</strong>.</li>
              <li>The official Android Application distribution package <strong>blog.currentnews.app</strong> distributed through the Google Play Store and official deployment repositories.</li>
              <li>Progressive Web Applications (PWA), real-time notification endpoints, RSS XML publication feeds, and automated news delivery infrastructure.</li>
            </ul>
            <p>
              <strong>1.3 Affirmative Agreement:</strong> By accessing, browsing, reading, subscribing to, or installing any application or publication provided by Current News Live, you acknowledge that you have read, understood, and consented to the data protection protocols detailed herein. If you do not agree with these principles, your sole remedy is to cease interacting with our services immediately.
            </p>
          </div>
        </article>

        {/* Section 2: Categories of Information Collected */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-2">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 2.0 &bull; DATA MINIMIZATION
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Categories of Information Collected & Processed
            </h2>
          </div>

          <div className="space-y-5 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              Current News Live operates under the statutory principle of <strong>Data Minimization</strong> (Article 5(1)(c) of the General Data Protection Regulation). We systematically refuse to collect intrusive behavioral data, biometric records, or extraneous device telemetry. We restrict processing strictly to the following three delineated categories:
            </p>

            {/* Subsection 2.1 Box */}
            <div className="border border-[#EAE3D4] dark:border-[#302B23] bg-[#FAF8F3] dark:bg-[#221F1B] rounded-xl p-5 sm:p-6">
              <h3 className="text-lg font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2] mb-2 flex items-center gap-2">
                <span className="font-mono text-sm text-[#7A5832] dark:text-[#D4AF37]">2.1</span>
                <span>Information Voluntarily Provided by the User</span>
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-base text-[#3A332B] dark:text-[#D5CEC2]">
                <li><strong>Newsletter Dispatch Registry:</strong> When you voluntarily subscribe to our news service, your email address is encrypted and stored in Google Firebase Cloud Firestore exclusively to deliver breaking dispatches and editorial analysis.</li>
                <li><strong>Editorial & Public Inquiries:</strong> When submitting dispatches or inquiries via our Contact Desk, we receive your name, email address, topic classification, and message content for correspondence.</li>
                <li><strong>Editorial Staff Credentials:</strong> Authorized writers and editors access the newsroom suite via Google Firebase Authentication with cryptographic password hashing (bcrypt/scrypt standards).</li>
              </ul>
            </div>

            {/* Subsection 2.2 Box */}
            <div className="border border-[#EAE3D4] dark:border-[#302B23] bg-[#FAF8F3] dark:bg-[#221F1B] rounded-xl p-5 sm:p-6">
              <h3 className="text-lg font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2] mb-2 flex items-center gap-2">
                <span className="font-mono text-sm text-[#7A5832] dark:text-[#D4AF37]">2.2</span>
                <span>Client-Side Local Storage (Zero Centralized Surveillance)</span>
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-base text-[#3A332B] dark:text-[#D5CEC2]">
                <li><strong>Reader Reactions & Preferences:</strong> Your article &ldquo;Like&rdquo; and &ldquo;Dislike&rdquo; reactions, reading bookmarks, and category filters are maintained 100% locally within your device cache (HTML5 LocalStorage). <em>This data is never transmitted to our remote servers, never monetized, and never correlated with your personal identity.</em></li>
                <li><strong>Cookie Consent Configurations:</strong> Your affirmative cookie preferences (Personalized versus Non-Personalized advertising) are preserved directly on your client machine.</li>
              </ul>
            </div>

            {/* Subsection 2.3 Box */}
            <div className="border border-[#EAE3D4] dark:border-[#302B23] bg-[#FAF8F3] dark:bg-[#221F1B] rounded-xl p-5 sm:p-6">
              <h3 className="text-lg font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2] mb-2 flex items-center gap-2">
                <span className="font-mono text-sm text-[#7A5832] dark:text-[#D4AF37]">2.3</span>
                <span>Technical & Diagnostic Telemetry (Automatically Logged)</span>
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-base text-[#3A332B] dark:text-[#D5CEC2]">
                <li><strong>Server Infrastructure Logs:</strong> Standard HTTP request logs (including IP addresses truncated for privacy where required, browser engine identifiers, referrer headers, and timestamp metadata) used strictly for DDoS mitigation, automated bot defense, and uptime reliability.</li>
                <li><strong>Android App Metrics:</strong> Crash reports and software execution logs collected through Google Play Core and Firebase Crashlytics in full conformity with Google Play Developer Policies.</li>
              </ul>
            </div>
          </div>
        </article>

        {/* Section 3: Lawful Grounds for Processing */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-3">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 3.0 &bull; STATUTORY AUTHORIZATION
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Lawful Grounds for Processing (GDPR Article 6)
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              In strict adherence to international statutory norms, Current News Live processes user data only when an explicit, legally validated ground under Article 6 of the General Data Protection Regulation is established:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4">
              <div className="p-4 border border-[#E8E1D2] dark:border-[#332E26] rounded-xl bg-[#FAF8F3] dark:bg-[#221F1B]">
                <strong className="block text-sm font-serif font-bold text-[#1C1814] dark:text-white mb-1">3.1 Consent (Art. 6(1)(a))</strong>
                <p className="text-sm text-[#5C5348] dark:text-[#ABA092] leading-relaxed">
                  Affirmative authorization provided by the reader for receiving email dispatches, push alerts, or opting into tailored advertising.
                </p>
              </div>
              <div className="p-4 border border-[#E8E1D2] dark:border-[#332E26] rounded-xl bg-[#FAF8F3] dark:bg-[#221F1B]">
                <strong className="block text-sm font-serif font-bold text-[#1C1814] dark:text-white mb-1">3.2 Legitimate Interests (Art. 6(1)(f))</strong>
                <p className="text-sm text-[#5C5348] dark:text-[#ABA092] leading-relaxed">
                  Safeguarding server networks, countering cyber attacks, debugging software defects, and preserving journalistic independence.
                </p>
              </div>
              <div className="p-4 border border-[#E8E1D2] dark:border-[#332E26] rounded-xl bg-[#FAF8F3] dark:bg-[#221F1B]">
                <strong className="block text-sm font-serif font-bold text-[#1C1814] dark:text-white mb-1">3.3 Legal Mandate (Art. 6(1)(c))</strong>
                <p className="text-sm text-[#5C5348] dark:text-[#ABA092] leading-relaxed">
                  Fulfilling statutory record-keeping requirements, tax compliance, or legally binding sovereign judicial mandates.
                </p>
              </div>
            </div>
          </div>
        </article>

        {/* Section 4: Advertising, Cookies & Google AdSense Disclosures */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-4">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 4.0 &bull; COMMERCIAL DISCLOSURES
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Advertising, Cookies & Google AdSense Policies
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              To sustain free, unrestricted global access to independent, verified investigative journalism without erecting exclusionary paywalls, Current News Live collaborates with trusted advertising networks, including <strong>Google AdSense</strong>. We enforce comprehensive compliance with the <strong>Google Publisher Policies</strong> and the <strong>EU User Consent Policy</strong>.
            </p>

            {/* Formal Framed Callout Box */}
            <div className="border-l-4 border-[#7A5832] bg-[#F4EFE6] dark:bg-[#25221C] p-5 sm:p-7 rounded-r-xl my-4 space-y-3">
              <h3 className="text-base font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
                Mandatory Google AdSense & Third-Party Vendor Notice
              </h3>
              <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-[#3E372F] dark:text-[#D5CFC3]">
                <li>
                  <strong>Cookie Usage:</strong> Third-party vendors, including Google, employ cookies (such as the Google advertising cookie and DoubleClick cookie) to serve advertisements based on a user&rsquo;s previous visits to our website or other sites across the Internet.
                </li>
                <li>
                  <strong>Personalized Advertising:</strong> Google&rsquo;s use of advertising cookies enables it and its partners to serve ads to our readers based on their visit to our site and/or other sites on the Internet.
                </li>
                <li>
                  <strong>Universal Opt-Out Channels:</strong> Readers may opt out of personalized advertising at any moment by navigating to <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="font-bold underline text-[#7A5832] dark:text-[#D4AF37]">Google Ads Settings (adssettings.google.com)</a>. Alternatively, users may opt out of a third-party vendor&rsquo;s use of cookies for personalized advertising by visiting the <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="font-bold underline text-[#7A5832] dark:text-[#D4AF37]">Digital Advertising Alliance (aboutads.info/choices)</a> or the Network Advertising Initiative at <a href="https://optout.networkadvertising.org" target="_blank" rel="noopener noreferrer" className="font-bold underline text-[#7A5832] dark:text-[#D4AF37]">networkadvertising.org</a>.
                </li>
                <li>
                  <strong>Consent Architecture:</strong> Our web platforms and Android applications incorporate an active consent management interface permitting users to toggle between personalized and non-personalized advertising modes at will.
                </li>
              </ul>
            </div>
          </div>
        </article>

        {/* Section 5: Regional Statutory Protections */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-5">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 5.0 &bull; GLOBAL STATUTORY FRAMEWORKS
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Regional Statutory Protections & Worldwide Rights
            </h2>
          </div>

          <div className="space-y-6 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              Our governance architecture guarantees compliance across sovereign jurisdictions worldwide:
            </p>

            <div className="border border-[#EAE3D4] dark:border-[#302B23] bg-[#FAF8F3] dark:bg-[#221F1B] rounded-xl p-5 sm:p-6">
              <h3 className="text-lg font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2] mb-2">
                5.1 European Union & United Kingdom (GDPR / UK Data Protection Act 2018)
              </h3>
              <p className="text-base text-[#3A332B] dark:text-[#D5CEC2]">
                Data subjects located in the European Economic Area (EEA) and the United Kingdom possess statutory rights: Right of Access (Art. 15), Right to Rectification (Art. 16), Right to Erasure (&ldquo;Right to be Forgotten&rdquo;, Art. 17), Right to Restriction of Processing (Art. 18), Right to Data Portability (Art. 20), and Right to Object (Art. 21). You retain the right to lodge a formal complaint with your national Supervisory Authority (e.g., the UK Information Commissioner&rsquo;s Office or EU National DPA).
              </p>
            </div>

            <div className="border border-[#EAE3D4] dark:border-[#302B23] bg-[#FAF8F3] dark:bg-[#221F1B] rounded-xl p-5 sm:p-6">
              <h3 className="text-lg font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2] mb-2">
                5.2 United States Consumer Privacy Protections (CCPA / CPRA & State Statutes)
              </h3>
              <p className="text-base text-[#3A332B] dark:text-[#D5CEC2] mb-3">
                Residents of California, Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), and Utah (UCPA) enjoy specific statutory guarantees under the California Consumer Privacy Act as amended by the California Privacy Rights Act:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-base text-[#3A332B] dark:text-[#D5CEC2]">
                <li><strong>Absolute Non-Sale Commitment:</strong> We DO NOT sell, rent, monetize, or share consumer personal records with data brokers or marketing syndicates.</li>
                <li><strong>Right to Know & Delete:</strong> You possess the enforceable right to demand complete disclosure of categories of data processed and request complete permanent erasure.</li>
                <li><strong>Non-Discrimination Covenant:</strong> Exercising your statutory privacy rights will never result in degraded performance, higher fees, or denied news coverage.</li>
              </ul>
            </div>

            <div className="border border-[#EAE3D4] dark:border-[#302B23] bg-[#FAF8F3] dark:bg-[#221F1B] rounded-xl p-5 sm:p-6">
              <h3 className="text-lg font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2] mb-2">
                5.3 Canada (PIPEDA), Latin America (LGPD) & Asia-Pacific (DPDP Act)
              </h3>
              <p className="text-base text-[#3A332B] dark:text-[#D5CEC2]">
                Canadian citizens are protected under the Personal Information Protection and Electronic Documents Act (PIPEDA). Brazilian residents enjoy protections under the Lei Geral de Prote&ccedil;&atilde;o de Dados (LGPD, Law No. 13.709/2018). Indian users are covered under the Digital Personal Data Protection Act (DPDP Act 2023), and Australian readers under the Privacy Act 1988 (APPs). We honor all statutory mandates for cross-border data transfer, notice, and immediate revocation of consent.
              </p>
            </div>
          </div>
        </article>

        {/* Section 6: Google Play Store Safety & Account Deletion */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-6">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 6.0 &bull; APPLICATION COMPLIANCE
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Google Play Safety & Permanent Account Deletion
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              In accordance with the <strong>Google Play Store Developer Program Policy (User Data & Account Deletion Requirements)</strong>, Current News Live maintains a fully functional, publicly accessible web portal permitting users to delete their account credentials and all associated records permanently.
            </p>

            <div className="border border-[#DECDB8] dark:border-[#3D3428] bg-[#FAF5EC] dark:bg-[#231F19] rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
                6.1 Self-Service Account & Data Deletion Guarantee
              </h3>
              <p className="text-base text-[#3E362C] dark:text-[#DDD5C8]">
                Users may trigger complete, irreversible deletion of their registered email address, newsletter subscription records, credentials, and associated telemetry without requiring administrative intervention:
              </p>
              <div>
                <Link
                  to="/delete-account"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#7A5832] hover:bg-[#634626] text-white font-sans font-semibold text-sm transition-colors shadow-xs"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Access Permanent Account Deletion Portal</span>
                </Link>
              </div>
              <p className="text-xs sm:text-sm text-[#6E6354] dark:text-[#A89E90] pt-1">
                Data deletion requests are executed synchronously in Google Firebase Cloud Firestore and completed within twenty-four (24) hours across secondary backups.
              </p>
            </div>
          </div>
        </article>

        {/* Section 7: Children's Privacy Protections */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-7">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 7.0 &bull; MINORS & STATUTORY THRESHOLDS
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Children&rsquo;s Privacy Mandate (COPPA & Worldwide Standards)
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              <strong>7.1 Age Threshold:</strong> Current News Live is formulated exclusively for general public audiences and young adults seeking verified global reporting and analysis. We do not knowingly solicit, collect, or store personal information from individuals under the age of thirteen (13) in the United States (pursuant to the Children&rsquo;s Online Privacy Protection Act — COPPA), or under sixteen (16) within the European Union.
            </p>
            <p>
              <strong>7.2 Prompt Expungement:</strong> In the event that our legal team becomes aware that personal data belonging to an underage individual has been submitted without verifiable parental authorization, we will expunge such data from our operational repositories immediately upon notification.
            </p>
          </div>
        </article>

        {/* Section 8: Data Security & Retention */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-8">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 8.0 &bull; INFORMATION SECURITY
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Data Security, Retention Schedules & Cryptographic Shielding
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              We maintain rigorous multi-layered technical and organizational security controls:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base text-[#3A332B] dark:text-[#D5CEC2]">
              <li><strong>Transport Layer Encryption:</strong> All client-to-server and API communications are strictly mandated over TLS 1.3 / HTTPS encryption with strict HTTP Strict Transport Security (HSTS) headers.</li>
              <li><strong>Database Protection:</strong> Subscriber email records and administrative tables are stored within Google Firebase Cloud Firestore, fortified with server-enforced security rules preventing unauthorized reads, writes, or automated enumeration attacks.</li>
              <li><strong>Retention Schedules:</strong> Active subscriber emails are retained solely during the term of active subscription. Following unsubscribing or deletion request, records are permanently purged within thirty (30) calendar days. Diagnostic server logs are overwritten every ninety (90) days.</li>
            </ul>
          </div>
        </article>

        {/* Section 9: Cross-Border Transfers */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-9">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 9.0 &bull; INTERNATIONAL TRANSFERS
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Cross-Border Transfers & International Safeguards
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              Current News Live operates upon global cloud architecture provided by Google Cloud Platform. Data may be routed through and processed in secure data centers located in the United States and global distribution hubs. When transferring personal data from the European Economic Area, Switzerland, or the United Kingdom to recipient jurisdictions lacking an European Commission Adequacy Decision, we execute Standard Contractual Clauses (SCCs) to guarantee statutory equivalence.
            </p>
          </div>
        </article>

        {/* Section 10: Government Subpoenas & Law Enforcement Policy */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-10">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 10.0 &bull; SOVEREIGN INQUIRIES
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Government Subpoenas, Law Enforcement & Sovereign Inquiries
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              <strong>10.1 Independence of the Press:</strong> As an independent press entity, Current News Live maintains strict institutional autonomy. We do not provide bulk, automated, or backdoor surveillance access to any domestic or foreign law enforcement body, intelligence agency, or governmental apparatus.
            </p>
            <p>
              <strong>10.2 Strict Adherence to Lawful Process:</strong> Information will be disclosed solely when compelled by a valid, legally enforceable subpoena, court warrant, or binding statutory order issued by a court of competent jurisdiction following extensive review by our legal counsel. We challenge overbroad, unlawful, or warrantless government demands to the full extent of applicable law.
            </p>
          </div>
        </article>

        {/* Section 11: Statutory Data Subject Rights */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-11">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 11.0 &bull; EXERCISE OF RIGHTS
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Statutory Data Subject Rights & Regulatory Recourse
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              Every user retains the fundamental statutory entitlement to submit requests regarding their personal records:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base text-[#3A332B] dark:text-[#D5CEC2]">
              <li><strong>Verification of Identity:</strong> Prior to fulfilling any disclosure or erasure request, our Legal Directorate will verify the identity of the requesting party to prevent unauthorized account tampering.</li>
              <li><strong>Response Timeline:</strong> Valid requests are resolved within thirty (30) calendar days as mandated by GDPR, or forty-five (45) days where extended under CCPA requirements.</li>
              <li><strong>Zero Cost:</strong> The exercise of statutory privacy rights is entirely cost-free to all readers.</li>
            </ul>
          </div>
        </article>

        {/* Section 12: Designated Legal Directorate & Regulatory Contact */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-12" id="section-12">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 12.0 &bull; OFFICIAL CORRESPONDENCE
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Designated Legal Directorate & Regulatory Contact
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              For formal statutory inquiries, Data Protection Officer (DPO) communications, or regulatory filings, contact our designated Directorate:
            </p>

            <div className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FAF8F2] dark:bg-[#23201C] rounded-xl p-6 font-mono text-sm space-y-2 text-[#3A332B] dark:text-[#DDD7CE]">
              <div className="font-serif font-bold text-base text-[#1C1814] dark:text-white mb-2">
                Current News Live &bull; Directorate of Legal & Regulatory Affairs
              </div>
              <p>Support &amp; Legal Email: <a href="mailto:help@currentnews.blog" className="text-[#7A5832] dark:text-[#D4AF37] font-bold underline">help@currentnews.blog</a></p>
              <p>Corporate Affairs: <a href="mailto:team@currentnews.blog" className="text-[#7A5832] dark:text-[#D4AF37] font-bold underline">team@currentnews.blog</a></p>
              <p>Newsroom Corrections: <span className="font-bold">corrections@currentnews.blog</span></p>
              <p>Canonical Web Registry: <span className="font-bold">https://www.currentnews.blog/</span></p>
              <p>Android Package Identifier: <span className="font-bold">blog.currentnews.app</span></p>
              <p>Physical Dispatch Jurisdiction: Singapore & International Digital Commerce Framework</p>
            </div>
          </div>
        </article>

        {/* Bottom Back-to-Top Button */}
        <div className="text-center pt-4">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] hover:bg-[#F2ECE0] dark:hover:bg-[#26231E] text-sm font-medium text-[#5C5245] dark:text-[#B5AAA0] transition-colors cursor-pointer shadow-xs"
          >
            <ArrowUp className="w-4 h-4" />
            <span>Return to Top of Document</span>
          </button>
        </div>

      </main>
    </div>
  );
}
