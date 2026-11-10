import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Scale, 
  ShieldCheck, 
  BookOpen, 
  ChevronRight, 
  AlertTriangle, 
  FileText, 
  Gavel, 
  Ban, 
  ArrowUp,
  Cpu,
  Mail
} from 'lucide-react';
import ProfilePageNavbar from '../components/ProfilePageNavbar';
import { updateDocumentSEO } from '../utils/seo';

export default function TermsView() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    updateDocumentSEO({
      title: 'Terms of Service | Current News',
      description: 'Universal terms of service, worldwide intellectual property notices, Berne Convention protections, DMCA takedown procedures, and commercial liability disclaimers for Current News Live.',
      canonicalPath: '/terms'
    });
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const sectionsIndex = [
    { id: 'section-1', num: '§ 01', title: 'Acceptance of Binding Terms & Legal Capacity' },
    { id: 'section-2', num: '§ 02', title: 'Worldwide Intellectual Property & Copyright Notice' },
    { id: 'section-3', num: '§ 03', title: 'Permitted Journalistic Fair Use vs. Prohibited Exploitation' },
    { id: 'section-4', num: '§ 04', title: 'Prohibition on Automated Data Mining & AI Ingestion' },
    { id: 'section-5', num: '§ 05', title: 'DMCA Copyright Agent & Statutory Safe Harbor Procedures' },
    { id: 'section-6', num: '§ 06', title: 'Editorial Independence, Corrections & Press Protections' },
    { id: 'section-7', num: '§ 07', title: 'User Conduct, Network Integrity & Security Guidelines' },
    { id: 'section-8', num: '§ 08', title: 'Comprehensive Warranty Disclaimers (As-Is / As-Available)' },
    { id: 'section-9', num: '§ 09', title: 'Maximum Limitation of Commercial Liability' },
    { id: 'section-10', num: '§ 10', title: 'Mutual Indemnification & Third-Party Hold Harmless' },
    { id: 'section-11', num: '§ 11', title: 'Governing Law, Dispute Escalation & Binding Arbitration' },
    { id: 'section-12', num: '§ 12', title: 'Severability, Integration & Periodic Codex Amendments' },
    { id: 'section-13', num: '§ 13', title: 'Designated Directorate of Legal & Corporate Affairs' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F0] dark:bg-[#161513] text-[#2C2621] dark:text-[#E2DDD3] transition-colors" id="terms-of-service-view">
      <ProfilePageNavbar 
        title="Terms of Service" 
        align="left" 
        fallbackUrl="/admin" 
        onBack={() => navigate('/admin')} 
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        
        {/* Document Header - Formal Legal Codex Book Style */}
        <header className="border-b-2 border-[#E5DEC9] dark:border-[#38332A] pb-8 mb-12">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest uppercase text-[#7A5832] dark:text-[#D4AF37] font-semibold mb-3">
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>Official Legal Codex &bull; Document Reference CNL-TERMS-2026-V5</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-black text-[#1C1814] dark:text-[#FAF7F2] tracking-tight leading-tight mb-4">
            Terms of Service
          </h1>

          <p className="text-base sm:text-lg text-[#554C42] dark:text-[#B8AEA0] font-sans leading-relaxed mb-6">
            Published by <strong>Current News Live</strong> (&ldquo;Current News,&rdquo; &ldquo;the Organization,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). This document constitutes an enforceable worldwide legal agreement between you (&ldquo;User,&rdquo; &ldquo;Reader,&rdquo; or &ldquo;You&rdquo;) and Current News Live governing all access to our web publications, mobile applications, APIs, dispatches, and syndication channels.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#EAE3D2] dark:border-[#2C2720] text-sm text-[#63594D] dark:text-[#A69C8E]">
            <div>
              <span className="block font-mono text-xs uppercase tracking-wider text-[#8A755D] dark:text-[#C2A675]">Effective Date</span>
              <strong className="text-[#2C241E] dark:text-[#EAE5DC]">October 10, 2026</strong>
            </div>
            <div>
              <span className="block font-mono text-xs uppercase tracking-wider text-[#8A755D] dark:text-[#C2A675]">Legal Status</span>
              <strong className="text-[#2C241E] dark:text-[#EAE5DC]">Enforceable Worldwide Contract</strong>
            </div>
            <div>
              <span className="block font-mono text-xs uppercase tracking-wider text-[#8A755D] dark:text-[#C2A675]">Copyright Treaty</span>
              <strong className="text-[#2C241E] dark:text-[#EAE5DC]">Berne, WIPO, Title 17 U.S.C.</strong>
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
              Select any section to review the specific legal covenants and operational rules.
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

        {/* Section 1: Acceptance of Binding Terms & Legal Capacity */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-1">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 1.0 &bull; MUTUAL ASSENT & CAPACITY
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Acceptance of Binding Terms & Legal Capacity
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              <strong>1.1 Mutual Assent:</strong> By visiting, browsing, viewing, caching, installing, downloading, linking to, or interacting with <strong>Current News Live</strong> via our web portals (including <strong>currentnews.blog</strong> and <strong>www.currentnews.blog</strong>), Android application package (<strong>blog.currentnews.app</strong>), or any associated application interfaces, you explicitly agree to be legally bound by these Terms of Service and our Global Privacy Policy.
            </p>
            <p>
              <strong>1.2 Legal Capacity & Threshold:</strong> You represent and warrant that you possess the full legal capacity, age, and authority to enter into this binding agreement under the laws of your jurisdiction. If you do not accept all terms without modification, you are strictly prohibited from using our services and must immediately cease access and uninstall our applications.
            </p>
          </div>
        </article>

        {/* Section 2: Worldwide Intellectual Property & Copyright Notice */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-2">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 2.0 &bull; STATUTORY INTELLECTUAL PROPERTY
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Worldwide Intellectual Property & Copyright Notice
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              <strong>2.1 Proprietary Ownership:</strong> All dispatches, investigative articles, written columns, headlines, photographs, illustrations, audio-visual works, user-interface designs, logos, typography, source code, data architectures, and compilations contained on Current News Live are the exclusive proprietary property of <strong>Current News Live</strong> or its licensed syndicated contributors, protected under:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-base text-[#3A332B] dark:text-[#D5CEC2]">
              <li><strong>International Copyright Treaties:</strong> The Berne Convention for the Protection of Literary and Artistic Works, the World Intellectual Property Organization (WIPO) Copyright Treaty, and the Universal Copyright Convention.</li>
              <li><strong>National Statutory Protections:</strong> Title 17 of the United States Code (U.S. Copyright Act), European Union Directive 2019/790 on Copyright in the Digital Single Market, the United Kingdom Copyright, Designs and Patents Act 1988, the Indian Copyright Act 1957, and applicable copyright statutes worldwide.</li>
              <li><strong>Trademark Reservations:</strong> &ldquo;Current News&rdquo;, &ldquo;Current News Live&rdquo;, our mastheads, insignia, and brand marks are protected common-law and registered trademarks. Unauthorized corporate or commercial use of our trademarks without prior written consent is strictly prohibited.</li>
            </ul>
          </div>
        </article>

        {/* Section 3: Permitted Journalistic Fair Use vs. Prohibited Exploitation */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-3">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 3.0 &bull; FAIR USE STANDARDS
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Permitted Journalistic Fair Use vs. Prohibited Exploitation
            </h2>
          </div>

          <div className="space-y-5 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              We champion healthy democratic discourse, commentary, and public transparency. Our publications may be referenced under strictly delineated boundaries:
            </p>

            <div className="border border-[#EAE3D4] dark:border-[#302B23] bg-[#FAF8F3] dark:bg-[#221F1B] rounded-xl p-5 sm:p-6">
              <h3 className="text-lg font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2] mb-2 flex items-center gap-2">
                <span className="font-mono text-sm text-[#7A5832] dark:text-[#D4AF37]">3.1</span>
                <span>Permitted Non-Commercial Quotation (Statutory Fair Use)</span>
              </h3>
              <p className="text-base text-[#3A332B] dark:text-[#D5CEC2]">
                Individual readers, educators, academic researchers, and news commentators may reproduce brief excerpts (not to exceed 150 continuous words) for criticism, review, scholarly analysis, or news reporting, provided that <strong>prominent, active, direct hyperlinked attribution</strong> is visibly given to the original article URL on <em>currentnews.blog</em>.
              </p>
            </div>

            <div className="border border-[#EAE3D4] dark:border-[#302B23] bg-[#FAF8F3] dark:bg-[#221F1B] rounded-xl p-5 sm:p-6">
              <h3 className="text-lg font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2] mb-2 flex items-center gap-2">
                <span className="font-mono text-sm text-[#7A5832] dark:text-[#D4AF37]">3.2</span>
                <span>Prohibited Commercial Republishing & Syndication</span>
              </h3>
              <p className="text-base text-[#3A332B] dark:text-[#D5CEC2]">
                Full-text republishing, automated content scraping, feed aggregation, white-label syndication, or mirrored hosting of our publications without an executed commercial syndication license constitutes copyright infringement actionable in statutory courts.
              </p>
            </div>
          </div>
        </article>

        {/* Section 4: Prohibition on Automated Data Mining & AI Model Ingestion */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-4">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 4.0 &bull; MACHINE INGESTION RESTRICTIONS
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Prohibition on Automated Data Mining & AI Model Ingestion
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              Current News Live explicitly reserves all intellectual property rights under Article 4(3) of European Union Directive 2019/790 and equivalent global statutes regarding text and data mining (TDM):
            </p>

            <ul className="list-disc pl-6 space-y-2 text-base text-[#3A332B] dark:text-[#D5CEC2]">
              <li><strong>Robots.txt Directives:</strong> All automated access by machine scrapers, web spiders, or automated crawlers must strictly comply with our published <code>robots.txt</code> directives.</li>
              <li><strong>Artificial Intelligence Training Prohibition:</strong> Unlicensed harvesting, tokenization, or ingestion of Current News journalistic output to train, fine-tune, or calibrate commercial artificial intelligence models, large language models (LLMs), or generative retrieval-augmented generation (RAG) engines is expressively forbidden without a negotiated, written data licensing contract.</li>
            </ul>
          </div>
        </article>

        {/* Section 5: DMCA Copyright Agent & Statutory Safe Harbor */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-5">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 5.0 &bull; DMCA TAKEDOWN PROCEDURE
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              DMCA Copyright Agent & Statutory Safe Harbor Procedures
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              Current News Live respects the intellectual property rights of all copyright holders and complies with Title II of the Digital Millennium Copyright Act (17 U.S.C. § 512) and the European Union eCommerce Directive (2000/31/EC).
            </p>

            {/* Formal Framed Callout Box */}
            <div className="border-l-4 border-[#7A5832] bg-[#F4EFE6] dark:bg-[#25221C] p-5 sm:p-7 rounded-r-xl my-4 space-y-3">
              <h3 className="text-base font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
                Statutory Copyright Infringement Takedown Notice Procedure
              </h3>
              <p className="text-sm sm:text-base text-[#3E372F] dark:text-[#D5CFC3]">
                If you believe in good faith that any content hosted on our platform infringes your valid copyright, please send a written notification to our Designated Copyright Agent including:
              </p>
              <ol className="list-decimal pl-5 space-y-1.5 text-sm sm:text-base text-[#3E372F] dark:text-[#D5CFC3]">
                <li>A physical or electronic signature of a person authorized to act on behalf of the owner of the infringed exclusive right.</li>
                <li>Identification of the copyrighted work claimed to have been infringed (or a representative list).</li>
                <li>Identification of the material claimed to be infringing with specific URLs sufficient to permit location.</li>
                <li>Your contact details, including full legal name, physical address, telephone number, and valid email address.</li>
                <li>A statement that you have a good-faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.</li>
                <li>A statement that the information is accurate, and under penalty of perjury, that you are authorized to act on behalf of the copyright holder.</li>
              </ol>
              <p className="pt-2 text-sm font-mono text-[#7A5832] dark:text-[#D4AF37] font-bold">
                Designated DMCA Agent: <a href="mailto:help@currentnews.blog" className="underline">help@currentnews.blog</a> (Subject: &ldquo;DMCA Copyright Takedown Notice&rdquo;)
              </p>
            </div>
          </div>
        </article>

        {/* Section 6: Editorial Independence & Corrections */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-6">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 6.0 &bull; EDITORIAL INTEGRITY
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Editorial Independence, Corrections & Press Protections
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              <strong>6.1 Journalistic Ethics:</strong> We operate under established journalistic codes, including the Society of Professional Journalists (SPJ) Code of Ethics and the International Federation of Journalists (IFJ) Declaration.
            </p>
            <p>
              <strong>6.2 Transparent Corrections:</strong> Factual discrepancies reported to <code>corrections@currentnews.blog</code> will be investigated and corrected with prominent editorial notes in accordance with our transparent corrections policy.
            </p>
            <p>
              <strong>6.3 Press Protections:</strong> Our reporting is protected under constitutional guarantees of freedom of speech and the press, including the First Amendment to the United States Constitution, Article 10 of the European Convention on Human Rights (ECHR), and Article 19 of the Universal Declaration of Human Rights.
            </p>
          </div>
        </article>

        {/* Section 7: User Conduct & Platform Security */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-7">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 7.0 &bull; ACCEPTABLE CONDUCT
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              User Conduct, Network Integrity & Security Guidelines
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              You agree to access Current News Live solely for lawful informational and reading purposes. You agree NOT to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base text-[#3A332B] dark:text-[#D5CEC2]">
              <li>Probe, scan, or test the vulnerability of any system, API, or network authentication protocol without explicit written authorization.</li>
              <li>Transmit any viruses, worms, malware, trojans, or destructive computer code.</li>
              <li>Launch Denial-of-Service (DoS) attacks, automated rapid-fire requests, or overload our hosting or database infrastructure.</li>
              <li>Impersonate any person, entity, editorial staff member, or government official.</li>
              <li>Attempt to reverse-engineer, decompile, or disassemble our client-side software bundles or Android APK/AAB builds.</li>
            </ul>
          </div>
        </article>

        {/* Section 8: Disclaimer of Warranties */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-8">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 8.0 &bull; STATUTORY DISCLAIMERS
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Comprehensive Warranty Disclaimers (As-Is / As-Available)
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p className="font-mono text-xs uppercase tracking-wider text-[#8A755D] dark:text-[#C2A675] font-semibold">
              MANDATORY STATUTORY COMMERCIAL NOTICE:
            </p>
            <p>
              CURRENT NEWS LIVE, ITS AFFILIATES, OFFICERS, DIRECTORS, JOURNALISTS, EMPLOYEES, AND AGENTS PROVIDE ALL WEBSITES, APPLICATIONS, DISPATCHES, ARTICLES, DATA, AND SERVICES ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
            </p>
            <p>
              TO THE FULLEST EXTENT PERMISSIBLE UNDER APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT OUR PLATFORMS WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE, OR THAT ANY DEFECTS WILL BE PROMPTLY CORRECTED.
            </p>
          </div>
        </article>

        {/* Section 9: Maximum Limitation of Liability */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-9">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 9.0 &bull; LIABILITY CAP
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Maximum Limitation of Commercial Liability
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              UNDER NO LEGAL THEORY (WHETHER IN CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE) SHALL CURRENT NEWS LIVE, ITS FOUNDERS, EDITORS, REPORTERS, OR INFRASTRUCTURE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, PUNITIVE, OR EXEMPLARY DAMAGES (INCLUDING LOSS OF PROFITS, DATA, GOODWILL, WORK STOPPAGE, COMPUTER FAILURE, OR SYSTEM MALFUNCTION) ARISING FROM OR RELATING TO YOUR USE OR INABILITY TO USE OUR SERVICES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p>
              IN JURISDICTIONS WHERE THE EXCLUSION OR LIMITATION OF INCIDENTAL OR CONSEQUENTIAL DAMAGES IS NOT PERMITTED, OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS SHALL BE STRICTLY LIMITED TO THE GREATER OF FIFTY UNITED STATES DOLLARS ($50.00 USD) OR THE AMOUNT PAID BY YOU TO US, IF ANY, DURING THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </div>
        </article>

        {/* Section 10: Mutual Indemnification */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-10">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 10.0 &bull; HOLD HARMLESS COVENANT
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Mutual Indemnification & Third-Party Hold Harmless
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              You agree to defend, indemnify, and hold harmless Current News Live, its corporate officers, editors, reporters, licensors, and affiliates from and against any third-party claims, liabilities, losses, damages, judgements, awards, costs, and expenses (including reasonable attorney&rsquo;s fees) arising out of or resulting from your breach of these Terms, your violation of any third-party intellectual property or privacy right, or any unlawful conduct committed while utilizing our platform.
            </p>
          </div>
        </article>

        {/* Section 11: Governing Law & Dispute Resolution */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-11">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 11.0 &bull; DISPUTE RESOLUTION & ARBITRATION
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Governing Law, Dispute Escalation & Binding Arbitration
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              <strong>11.1 Governing Law:</strong> These Terms of Service and any dispute arising from or in connection with them shall be governed by and construed in accordance with standard commercial statutory laws and federal electronic commerce frameworks, without giving effect to any principles of conflicts of law.
            </p>
            <p>
              <strong>11.2 Escalation & Binding Arbitration:</strong> Any controversy or legal claim shall first be submitted to good-faith informal dispute negotiation for a period of sixty (60) calendar days. Should informal dispute resolution fail, all disputes shall be resolved through final and binding individual arbitration or before a court of competent commercial jurisdiction, waiving any rights to participate in a class-action lawsuit or representative proceeding.
            </p>
          </div>
        </article>

        {/* Section 12: Severability & Entire Agreement */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-8" id="section-12">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 12.0 &bull; INTEGRATION & AMENDMENTS
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Severability, Integration & Periodic Codex Amendments
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              <strong>12.1 Severability:</strong> If any provision of these Terms is deemed unlawful, void, or for any reason unenforceable by a court of competent jurisdiction, that provision shall be deemed severable and shall not affect the validity and enforceability of any remaining provisions.
            </p>
            <p>
              <strong>12.2 Entire Agreement:</strong> These Terms, together with our Global Privacy Policy, constitute the complete, entire, and exclusive legal agreement between you and Current News Live.
            </p>
            <p>
              <strong>12.3 Periodic Amendments:</strong> We reserve the right to revise these Terms periodically to reflect legislative updates, judicial rulings, or platform modifications. Continued interaction after revisions constitutes legal acceptance.
            </p>
          </div>
        </article>

        {/* Section 13: Directorate of Legal & Corporate Affairs */}
        <article className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FFFDF9] dark:bg-[#1E1C18] rounded-2xl p-6 sm:p-9 shadow-xs mb-12" id="section-13">
          <div className="border-b border-[#EDE7DC] dark:border-[#2E2922] pb-4 mb-6">
            <div className="font-mono text-xs font-bold text-[#7A5832] dark:text-[#D4AF37] uppercase tracking-wider mb-1">
              SECTION 13.0 &bull; LEGAL DESK
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1814] dark:text-[#FAF7F2]">
              Designated Directorate of Legal & Corporate Affairs
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-[17px] leading-[1.8] text-[#2C2621] dark:text-[#DDD7CE]">
            <p>
              For formal legal communications, copyright infringement claims, licensing agreements, or regulatory questions, please direct formal communications to our legal team:
            </p>

            <div className="border border-[#E2DBD0] dark:border-[#353028] bg-[#FAF8F2] dark:bg-[#23201C] rounded-xl p-6 font-mono text-sm space-y-2 text-[#3A332B] dark:text-[#DDD7CE]">
              <div className="font-serif font-bold text-base text-[#1C1814] dark:text-white mb-2">
                Current News Live &bull; Directorate of Legal & Corporate Affairs
              </div>
              <p>Legal &amp; Support Inquiries: <a href="mailto:help@currentnews.blog" className="text-[#7A5832] dark:text-[#D4AF37] font-bold underline">help@currentnews.blog</a></p>
              <p>Corporate Communications: <a href="mailto:team@currentnews.blog" className="text-[#7A5832] dark:text-[#D4AF37] font-bold underline">team@currentnews.blog</a></p>
              <p>Newsroom &amp; Corrections: <span className="font-bold">corrections@currentnews.blog</span></p>
              <p>Canonical Web Registry: <span className="font-bold">https://www.currentnews.blog/</span></p>
              <p>Android Package Identifier: <span className="font-bold">blog.currentnews.app</span></p>
              <p>Commercial Regulatory Frame: Electronic Commerce & Global Press Charter</p>
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
