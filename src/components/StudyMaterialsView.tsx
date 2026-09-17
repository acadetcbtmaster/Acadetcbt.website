import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { UserProfile, StudyMaterial, University, Faculty, Department, Course } from '../types';
import { StorageService } from '../services/storage';
import { ACADEMIC_LEVELS, ACADEMIC_SEMESTERS, normalizeLevel, normalizeSemester } from '../utils/academicStructure';
import { AcademicHierarchySelector, AcademicHierarchyValues } from './common/AcademicHierarchySelector';
import {
  BookOpen,
  Download,
  Lock,
  Sparkles,
  Search,
  Crown,
  Eye,
  CheckCircle2,
  CreditCard,
  Building2,
  Phone,
  ShieldCheck,
  X,
  Loader2,
  FileCheck,
  ArrowLeft,
} from 'lucide-react';

interface StudyMaterialsViewProps {
  user: UserProfile;
  universities?: University[];
  faculties?: Faculty[];
  departments?: Department[];
  courses?: Course[];
  onOpenSubscribe: () => void;
  onPurchaseMaterial?: (materialId: string) => void;
  onNavigate?: (tab: string) => void;
}

interface MaterialItem {
  id: string;
  title: string;
  courseCode: string;
  courseTitle: string;
  universityId?: string;
  universityName?: string;
  facultyId?: string;
  departmentId?: string;
  level?: string;
  semester?: string;
  category: string;
  isFreeSample: boolean;
  fileSize: string;
  pages: number;
  uploadDate: string;
  description: string;
  downloadsCount: number;
  downloadPriceNGN: number;
}

export const StudyMaterialsView: React.FC<StudyMaterialsViewProps> = ({
  user,
  universities = StorageService.getUniversities(),
  faculties = StorageService.getFaculties(),
  departments = StorageService.getDepartments(),
  courses = StorageService.getCourses(),
  onOpenSubscribe,
  onPurchaseMaterial,
  onNavigate,
}) => {
  const isPremium = user?.subscription?.isPremium ?? false;
  const purchasedMaterialIds = user?.purchasedMaterialIds || [];

  // Academic Hierarchy Selection (University -> Faculty -> Department -> Level -> Semester -> Course)
  const [hierarchy, setHierarchy] = useState<AcademicHierarchyValues>({
    universityId: universities[0]?.id || '',
    facultyId: '',
    departmentId: '',
    level: '100 Level',
    semester: 'First Semester',
    courseId: '',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [activePreview, setActivePreview] = useState<MaterialItem | null>(null);
  
  // Modals
  const [showPremiumLockModal, setShowPremiumLockModal] = useState(false);
  const [lockedMaterialName, setLockedMaterialName] = useState('');
  
  // ₦500 Payment Checkout Modal
  const [checkoutMaterial, setCheckoutMaterial] = useState<MaterialItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer' | 'ussd'>('card');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);

  const [allMaterials, setAllMaterials] = useState<StudyMaterial[]>(() => StorageService.getMaterials());

  useEffect(() => {
    const handleStorageChange = () => {
      setAllMaterials(StorageService.getMaterials());
    };
    window.addEventListener('cbt_storage_change', handleStorageChange);
    return () => window.removeEventListener('cbt_storage_change', handleStorageChange);
  }, []);

  const selectedUniObj = universities.find((u) => u.id === hierarchy.universityId);

  const materials: MaterialItem[] = allMaterials.map((sm) => ({
    id: sm.id,
    title: sm.title,
    courseCode: sm.courseCode || 'GST101',
    courseTitle: sm.courseTitle || 'General Course',
    universityId: sm.universityId,
    universityName: sm.universityName,
    facultyId: (sm as any).facultyId,
    departmentId: (sm as any).departmentId,
    level: sm.level || '100 Level',
    semester: sm.semester || 'First Semester',
    category: sm.type || 'Lecture Notes',
    isFreeSample: sm.accessLevel === 'Free Trial',
    fileSize: sm.fileSize || '1.5 MB',
    pages: sm.pagesCount || 12,
    uploadDate: sm.uploadDate || new Date().toISOString().split('T')[0],
    description: sm.description || 'Comprehensive study resource for CBT exams.',
    downloadsCount: sm.totalDownloads || 0,
    downloadPriceNGN: 500,
  }));

  const filteredMaterials = materials.filter((m) => {
    // 1. Hierarchy Filter: University -> Faculty -> Department -> Level -> Semester -> Course
    if (hierarchy.universityId && hierarchy.universityId !== 'all' && m.universityId) {
      const uniMatches = m.universityId === hierarchy.universityId || 
        (selectedUniObj && m.universityName && m.universityName.toLowerCase().includes((selectedUniObj.abbreviation || selectedUniObj.name).toLowerCase()));
      if (!uniMatches) return false;
    }

    if (hierarchy.facultyId && m.facultyId && m.facultyId !== hierarchy.facultyId) {
      return false;
    }

    if (hierarchy.departmentId && m.departmentId && m.departmentId !== hierarchy.departmentId) {
      return false;
    }

    if (m.level && normalizeLevel(m.level) !== normalizeLevel(hierarchy.level)) {
      return false;
    }

    if (m.semester && normalizeSemester(m.semester) !== normalizeSemester(hierarchy.semester)) {
      return false;
    }

    if (hierarchy.courseId) {
      const targetCourse = courses.find((c) => c.id === hierarchy.courseId);
      if (targetCourse && m.courseCode !== targetCourse.code && m.courseTitle !== targetCourse.title) {
        return false;
      }
    }

    // Search Query
    const matchesSearch =
      !searchQuery ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Access filter
    const isUnlocked = purchasedMaterialIds.includes(m.id);
    const matchesFilter =
      selectedFilter === 'all' ||
      (selectedFilter === 'unlocked' && isUnlocked) ||
      (selectedFilter === 'locked' && !isUnlocked);

    return matchesFilter;
  });

  // Handle Online Reading Preview
  const handleAccessMaterial = (material: MaterialItem) => {
    setActivePreview(material);
  };

  // Handle Download Request
  const handleDownloadClick = (material: MaterialItem) => {
    // Directly trigger file download without payment checkout
    if (onPurchaseMaterial && !purchasedMaterialIds.includes(material.id)) {
      onPurchaseMaterial(material.id);
    }
    triggerFileDownload(material);
  };

  // Execute Actual Browser Download
  const triggerFileDownload = (material: MaterialItem) => {
    const originalMat = allMaterials.find((sm) => sm.id === material.id);
    if (originalMat?.fileUrl) {
      const element = document.createElement('a');
      element.href = originalMat.fileUrl;
      const fileExt =
        originalMat.type === 'PDF' ? '.pdf' :
        originalMat.type === 'Image' ? '.png' :
        originalMat.type === 'DOCX' ? '.docx' :
        originalMat.type === 'PPTX' ? '.pptx' : '.txt';
      element.download = `${material.courseCode}_${material.title.replace(/[^a-zA-Z0-9]/g, '_')}${fileExt}`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else {
      const element = document.createElement('a');
      const file = new Blob(
        [
          `==================================================\nCBT MASTER - OFFICIAL STUDY MATERIAL\nTitle: ${material.title}\nCourse: ${material.courseCode} - ${material.courseTitle}\nDownloaded By: ${user.name} (${user.email})\nDownload Date: ${new Date().toLocaleDateString()}\nStatus: Verified Student Download\n==================================================\n\nOVERVIEW:\n${material.description}\n\nSUMMARY & EXAM HIGHLIGHTS:\n- High-yield past questions compiled for university CBT examinations.\n- Key formulas, solutions, and memory mnemonics.\n\n[Official Study Material Document]`
        ],
        { type: 'text/plain;charset=utf-8' }
      );
      element.href = URL.createObjectURL(file);
      element.download = `${material.courseCode}_${material.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  // Complete ₦500 Material Payment
  const handleCompleteMaterialPayment = () => {
    if (!checkoutMaterial) return;

    setIsProcessingPayment(true);
    setTimeout(() => {
      setIsProcessingPayment(false);
      setPaymentSuccessMsg(`Payment of ₦500 successful for "${checkoutMaterial.title}"!`);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      if (onPurchaseMaterial) {
        onPurchaseMaterial(checkoutMaterial.id);
      }

      // Automatically download file
      triggerFileDownload(checkoutMaterial);

      setTimeout(() => {
        setCheckoutMaterial(null);
        setPaymentSuccessMsg(null);
      }, 1500);
    }, 1200);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5" id="study-materials-view">
      
      {/* Top Header Controls: Back Arrow (Top Left) & Cancel X Button (Top Right) */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => onNavigate && onNavigate('dashboard')}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs"
          id="materials-top-back-btn"
        >
          <ArrowLeft className="w-4 h-4 text-[#1e3a8a] dark:text-blue-400" />
          <span>Back to Dashboard</span>
        </button>

        <button
          onClick={() => onNavigate && onNavigate('dashboard')}
          className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs"
          id="materials-top-cancel-btn"
          title="Cancel / Close Materials Interface"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 text-[#1e3a8a] dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#1e3a8a] dark:text-blue-400" />
                Study Materials & PDF Library
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                Study Packs Available
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Course Materials, Notes & PDF Solved Papers</h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Read lecture summaries online or download complete course study materials and past question PDF packages for offline study.
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
        
        {/* Academic Hierarchy Dropdowns */}
        <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
          <AcademicHierarchySelector
            values={hierarchy}
            onChange={setHierarchy}
            universities={universities}
            faculties={faculties}
            departments={departments}
            courses={courses}
            mode="filter"
            layout="grid-3"
            courseLabel="6. Course (All / Specific)"
          />
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search materials by course code (e.g. GST101, MTH101)..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#1e3a8a] dark:focus:border-blue-500"
              id="materials-search-input"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-[#1e3a8a] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              All Materials
            </button>
            <button
              onClick={() => setSelectedFilter('unlocked')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedFilter === 'unlocked'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              Unlocked (Paid)
            </button>
            <button
              onClick={() => setSelectedFilter('locked')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedFilter === 'locked'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              Available for Purchase
            </button>
          </div>

        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="materials-grid">
        {filteredMaterials.map((mat) => {
          const isPurchased = purchasedMaterialIds.includes(mat.id);
          const originalMat = allMaterials.find((sm) => sm.id === mat.id);
          const uniName = originalMat?.universityName || 'Federal University';
          const levelName = originalMat?.level || '100 Level';
          const totalPages = originalMat?.pagesCount || mat.pages || 16;
          const uploadDate = originalMat?.uploadDate || '2026-02-15';

          return (
            <div
              key={mat.id}
              className={`bg-white dark:bg-slate-900 border rounded-xl p-5 flex flex-col justify-between transition-all hover:border-[#1e3a8a]/40 dark:hover:border-blue-500/40 shadow-xs ${
                isPurchased
                  ? 'border-blue-300 dark:border-blue-500/40'
                  : isPremium
                  ? 'border-slate-200 dark:border-slate-800'
                  : 'border-slate-200 dark:border-slate-800 opacity-95'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 text-[#1e3a8a] dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                    {mat.courseCode}
                  </span>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-[#1e3a8a] dark:text-blue-300 border border-blue-200 dark:border-blue-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-[#1e3a8a] dark:text-blue-400" />
                    PDF Download
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                  {mat.title}
                </h3>
                
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {mat.description}
                </p>

                {/* Metadata List */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500 font-medium">Course:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">{mat.courseCode} ({mat.courseTitle})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500 font-medium">University:</span>
                    <span className="font-semibold text-[#1e3a8a] dark:text-blue-400 truncate max-w-[170px]">{mat.universityName || uniName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500 font-medium">Level & Semester:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{mat.level || levelName} • {mat.semester || 'First Semester'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500 font-medium">Pages & Size:</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">{totalPages} Pages • {mat.fileSize}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => handleAccessMaterial(mat)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
                  id={`read-sample-${mat.id}`}
                >
                  <Eye className="w-3.5 h-3.5 text-[#1e3a8a] dark:text-blue-400" />
                  <span>Preview</span>
                </button>

                <button
                  onClick={() => handleDownloadClick(mat)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                    isPurchased
                      ? 'bg-[#1e3a8a] hover:bg-[#172554] text-white'
                      : isPremium
                      ? 'bg-[#1e3a8a] hover:bg-[#172554] text-white'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                  id={`download-btn-${mat.id}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isPurchased
                      ? 'Download PDF'
                      : isPremium
                      ? 'Pay ₦500 & Download'
                      : 'Download (₦500)'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Online Document Sample Preview Modal */}
      {activePreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 max-w-2xl w-full shadow-xl space-y-4 relative max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
              <button
                onClick={() => setActivePreview(null)}
                className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-xs"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4 text-[#1e3a8a] dark:text-blue-400" />
                <span>Back</span>
              </button>

              <div className="text-center">
                <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-200 dark:border-amber-500/30">
                  Total Pages: {allMaterials.find((sm) => sm.id === activePreview.id)?.pagesCount || activePreview.pages || 16} Pages
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate max-w-xs">{activePreview.title}</h3>
              </div>

              <button
                onClick={() => setActivePreview(null)}
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-xs"
                title="Cancel / Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const originalMat = allMaterials.find((sm) => sm.id === activePreview.id);
              const uniName = originalMat?.universityName || 'Federal University';
              const levelName = originalMat?.level || '100 Level';
              const pagesTotal = originalMat?.pagesCount || activePreview.pages || 16;
              const uploadDate = originalMat?.uploadDate || '2026-02-15';

              // Extract readable lines or build ~40 line structured preview
              const previewLines = originalMat?.extractedTextPreview
                ? originalMat.extractedTextPreview
                : `DOCUMENT PREVIEW — FIRST PAGE & HIGH-YIELD READABLE LINES EXCERPT
================================================================================
COURSE CODE: ${activePreview.courseCode} (${activePreview.courseTitle})
UNIVERSITY: ${uniName}
LEVEL: ${levelName} | TOTAL PAGES: ${pagesTotal} PAGES
UPLOAD DATE: ${uploadDate} | FILE SIZE: ${activePreview.fileSize}
================================================================================

1. OVERVIEW & SCOPE
  • This course material provides full coverage of examination syllabus requirements.
  • Standard CBT multiple choice questions are formulated directly from these definitions.
  • Master all italicized key terms, formulas, and historical context noted in each section.

2. CORE CONCEPTS & DEFINITIONS (SECTION 1)
  • Concept 1.1: Fundamental Definitions and System Postulates.
  • Concept 1.2: Core Methodologies, Principles, and Theoretical Foundations.
  • Concept 1.3: Empirical Rules and Analytical Frameworks.
  • Note: Pay close attention to exceptions and special edge cases during revision.

3. KEY FORMULAS / GRAMMAR RULES / CONCORD PROTOCOLS
  • Rule A: Primary Rule of Proximity and Agreement in Compound Constructions.
  • Rule B: Quantitative Equations and Derivations for Mid-Semester Examinations.
  • Rule C: Systemic Operational Workflow and Sequential Stages.
  • Rule D: Critical Terminology for Multiple-Choice Distractors.

4. SAMPLE EXAM QUESTION REFERENCES & WORKED SOLVED EXAMPLES
  • Q1: Identification of principal variables in standardized university testing.
  • Q2: Verification of correct options under timed CBT conditions.
  • Q3: Step-by-step resolution of high-frequency past question items.
  • Q4: Common pitfalls and error analysis during answer sheet selections.

5. SUMMARY & NEXT CHAPTER OUTLINE
  • Chapter 1 Recap: Synthesize core principles before proceeding to practice quizzes.
  • Chapter 2 Preview: Advanced Applications, Multi-Step Problem Solving, and Case Studies.
  • [End of First Page / 40-Line Extracted Preview] — Download full ${pagesTotal} Pages document below.`;

              return (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl space-y-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                  <div className="text-amber-700 dark:text-amber-400 font-bold text-center border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-center gap-2">
                    <FileCheck className="w-4 h-4 text-amber-500" />
                    <span>AUTOMATICALLY EXTRACTED DOCUMENT PREVIEW ({pagesTotal} PAGES)</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    <p><strong>Course:</strong> {activePreview.courseCode} - {activePreview.courseTitle}</p>
                    <p><strong>University:</strong> {uniName}</p>
                    <p><strong>Level & Date:</strong> {levelName} • {uploadDate}</p>
                    <p><strong>Total Pages:</strong> <span className="text-amber-600 dark:text-amber-300 font-bold">{pagesTotal} Pages</span> ({activePreview.fileSize})</p>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400"><strong>Description:</strong> {activePreview.description}</p>

                  {/* Render Image Diagram Preview */}
                  {originalMat?.type === 'Image' && originalMat.fileUrl && (
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
                      <p className="font-bold text-[#1e3a8a] dark:text-blue-400">Uploaded Diagram / Image File:</p>
                      <img
                        src={originalMat.fileUrl}
                        alt={activePreview.title}
                        className="max-h-80 mx-auto rounded-xl border border-slate-200 dark:border-slate-800 object-contain shadow-xs"
                      />
                    </div>
                  )}

                  {/* Render Video Link Stream Preview */}
                  {(originalMat?.type === 'Video Link' || originalMat?.videoUrl) && (
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <p className="font-bold text-[#1e3a8a] dark:text-blue-400 flex items-center gap-2">
                        <span>Video Stream Tutorial Link</span>
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] font-mono break-all bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">
                        {originalMat?.videoUrl || 'https://www.youtube.com/watch?v=demo'}
                      </p>
                      <a
                        href={originalMat?.videoUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#1e3a8a] hover:bg-[#172554] text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Watch Lecture Video Stream</span>
                      </a>
                    </div>
                  )}

                  {/* Document Text Preview (~40 lines) */}
                  {originalMat?.type !== 'Image' && originalMat?.type !== 'Video Link' && (
                    <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-slate-700 dark:text-slate-300 max-h-72 overflow-y-auto">
                      <p className="font-bold text-[#1e3a8a] dark:text-blue-400 text-[11px]">Extracted Text & First Page Preview:</p>
                      <pre className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-mono text-[10px] bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        {previewLines}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Download Button Positioned Directly Below Preview */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <button
                onClick={() => {
                  const target = activePreview;
                  setActivePreview(null);
                  handleDownloadClick(target);
                }}
                className="w-full py-2.5 bg-[#1e3a8a] hover:bg-[#172554] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>
                  {purchasedMaterialIds.includes(activePreview.id)
                    ? 'Download PDF Document Now'
                    : isPremium
                    ? 'Pay ₦500 & Download Full Document'
                    : 'Download Full Material (₦500)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NON-PREMIUM SUBSCRIPTION REQUIREMENT MODAL */}
      {showPremiumLockModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 max-w-md w-full shadow-xl text-center space-y-4 relative">
            
            {/* Top Header Navigation Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowPremiumLockModal(false)}
                className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-xs"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4 text-[#1e3a8a] dark:text-blue-400" />
                <span>Back</span>
              </button>

              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Premium Access
              </span>

              <button
                onClick={() => setShowPremiumLockModal(false)}
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-xs"
                title="Cancel / Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/40 rounded-xl flex items-center justify-center mx-auto shadow-xs">
              <Lock className="w-6 h-6" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-3 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30">
                Premium Subscription Required
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2">Subscribe to Premium First</h3>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed text-left space-y-1.5">
              <p className="font-semibold text-slate-900 dark:text-white">
                You cannot download study materials until you have subscribed to Premium.
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Once you have an active Premium Subscription, you will gain access to purchase and download any course study material package for <strong className="text-slate-900 dark:text-white">₦500 per material</strong> for offline study.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowPremiumLockModal(false);
                  onOpenSubscribe();
                }}
                className="w-full py-2.5 bg-[#1e3a8a] hover:bg-[#172554] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                id="materials-lock-upgrade-btn"
              >
                <Crown className="w-4 h-4 text-amber-300" />
                <span>Subscribe to Premium Now</span>
              </button>
              <button
                onClick={() => setShowPremiumLockModal(false)}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-medium cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ₦500 MATERIAL DOWNLOAD PAYMENT CHECKOUT MODAL */}
      {checkoutMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 max-w-md w-full shadow-xl space-y-4 relative">
            
            {/* Top Header Navigation Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  if (!isProcessingPayment) setCheckoutMaterial(null);
                }}
                className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-xs"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4 text-[#1e3a8a] dark:text-blue-400" />
                <span>Back</span>
              </button>

              <span className="text-[11px] font-bold text-[#1e3a8a] dark:text-blue-400 uppercase tracking-wider">
                Material Purchase
              </span>

              <button
                onClick={() => {
                  if (!isProcessingPayment) setCheckoutMaterial(null);
                }}
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-xs"
                title="Cancel / Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Header */}
            <div className="text-center space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a] dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-0.5 rounded-full border border-blue-200 dark:border-blue-500/20">
                Study Material Download Checkout
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">Pay ₦500 to Unlock & Download</h3>
            </div>

            {/* Item Card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-[#1e3a8a] dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-500/20">
                {checkoutMaterial.courseCode}
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{checkoutMaterial.title}</p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">{checkoutMaterial.pages} Pages • PDF Format</span>
                <span className="text-[#1e3a8a] dark:text-blue-400 font-bold text-sm">₦500 NGN</span>
              </div>
            </div>

            {/* Payment Options */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Select Payment Method
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    paymentMethod === 'card'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-[#1e3a8a] dark:border-blue-500 text-[#1e3a8a] dark:text-white font-bold'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-[#1e3a8a] dark:text-blue-400" />
                  <span className="text-[10px]">Debit Card</span>
                </button>

                <button
                  onClick={() => setPaymentMethod('transfer')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    paymentMethod === 'transfer'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-[#1e3a8a] dark:border-blue-500 text-[#1e3a8a] dark:text-white font-bold'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-[10px]">Transfer</span>
                </button>

                <button
                  onClick={() => setPaymentMethod('ussd')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    paymentMethod === 'ussd'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-[#1e3a8a] dark:border-blue-500 text-[#1e3a8a] dark:text-white font-bold'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Phone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-[10px]">USSD</span>
                </button>
              </div>
            </div>

            {/* Payment Details Box */}
            {paymentMethod === 'card' && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span>Merchant:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">Flutterwave / CBT Materials</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span>Download Fee:</span>
                  <span className="font-bold text-[#1e3a8a] dark:text-blue-400">₦500.00</span>
                </div>
              </div>
            )}

            {paymentMethod === 'transfer' && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                <p className="text-slate-500 dark:text-slate-400">Transfer exactly <strong>₦500</strong> to:</p>
                <div className="font-mono bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold flex justify-between items-center">
                  <span>8920192019 (Wema Bank)</span>
                  <span className="text-[10px] bg-blue-50 dark:bg-blue-500/20 text-[#1e3a8a] dark:text-blue-300 px-1.5 py-0.5 rounded">CBT Simulator</span>
                </div>
              </div>
            )}

            {paymentMethod === 'ussd' && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 text-center">
                <p className="text-slate-500 dark:text-slate-400">Dial on your mobile device:</p>
                <div className="font-mono bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-300 font-bold text-sm mt-1">
                  *737*500#
                </div>
              </div>
            )}

            {/* Success Banner */}
            {paymentSuccessMsg && (
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/50 rounded-xl text-xs text-[#1e3a8a] dark:text-blue-200 font-bold flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{paymentSuccessMsg}</span>
              </div>
            )}

            {/* Submit Action Button */}
            <button
              disabled={isProcessingPayment}
              onClick={handleCompleteMaterialPayment}
              className="w-full py-2.5 bg-[#1e3a8a] hover:bg-[#172554] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              id="confirm-500-payment-btn"
            >
              {isProcessingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Verifying ₦500 Payment...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>Pay ₦500 Now & Download File</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
