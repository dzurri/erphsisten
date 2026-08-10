
import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { UserProfile, ERPHData, ERPHStatus, WeeklyBundle, Resource, DskpLink, AppNotification, ScheduleSlot } from '../types';
import { 
  Calendar, FileText, CheckCircle2, Clock, Plus, Pencil, Copy, Eye, FileDown, AlertCircle, SendHorizontal, Layers, ChevronRight, UserCheck, Filter, ChevronDown, 
  BookOpen, LayoutGrid, BarChart3, MessageCircle, Info, ExternalLink, X, Link as LinkIcon, Share2, Search, ArrowRight, Bell, Trash2, RefreshCw
} from 'lucide-react';
import { WEEKS, formatDate } from '../constants';

import ResourceCenter from './ResourceCenter';

interface TeacherDashboardProps {
  user: UserProfile;
  adminUser?: UserProfile | null;
  erphs: ERPHData[];
  bundles: WeeklyBundle[];
  teachers: UserProfile[];
  masterSchedule?: ScheduleSlot[];
  masterData?: { resources: Resource[], dskpLinks?: DskpLink[] };
  onAddNew: () => void;
  onEdit: (erph: ERPHData) => void;
  onCopy: (erph: ERPHData) => void;
  onView: (erph: ERPHData) => void;
  onShare: (erph: ERPHData, recipientId: string) => void;
  onDelete?: (id: string) => void;
  onSelectScheduleSlot?: (slot: Partial<ERPHData>) => void;
  onViewWeek?: (week: number) => void;
  onBulkSubmit?: (week: number, pdfBase64?: string) => void;
  onNavigate?: (view: string) => void;
  onSync?: () => void;
  onAddResource?: (resource: Omit<Resource, 'id' | 'uploadedAt'>) => void;
  onDeleteResource?: (id: string) => void;
  notifications?: AppNotification[];
  syncStatus?: 'IDLE' | 'SYNCING' | 'OFFLINE';
}

const UTILITY_MENUS = [
  { id: 'TAKWIM', label: 'Takwim', icon: Calendar, color: 'bg-blue-600' },
  { id: 'RPT', label: 'RPT', icon: BookOpen, color: 'bg-indigo-600' },
  { id: 'DSKP_COLL', label: 'DSKP', icon: Layers, color: 'bg-violet-600' },
  { id: 'ANALYSIS', label: 'Analisis', icon: BarChart3, color: 'bg-purple-600' },
  { id: 'SCHEDULE', label: 'Jadual', icon: LayoutGrid, color: 'bg-fuchsia-600' },
  { id: 'CHAT', label: 'Notifikasi', icon: MessageCircle, color: 'bg-pink-600' },
  { id: 'REKOD_PENCERAPAN', label: 'Pencerapan', icon: UserCheck, color: 'bg-emerald-600' },
];

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ 
  user, adminUser, erphs, bundles, teachers, masterSchedule = [], masterData, 
  onAddNew, onEdit, onCopy, onView, onShare, onDelete, onSelectScheduleSlot, onViewWeek, onBulkSubmit, onNavigate, onSync, 
  onAddResource, onDeleteResource,
  notifications = [],
  syncStatus = 'IDLE'
}) => {
  const isAdmin = user.role === 'ADMIN' || !!adminUser;
  const [weekFilter, setWeekFilter] = useState<number | 'all'>('all'); 
  const [rangeFilter, setRangeFilter] = useState<number>(0); 
  const [activeResView, setActiveResView] = useState<string | null>(null);
  const [sharingErph, setSharingErph] = useState<ERPHData | null>(null);
  const [deletingErph, setDeletingErph] = useState<string | null>(null);
  const [shareSearch, setShareSearch] = useState('');
  const [rphSearch, setRphSearch] = useState('');
  const [currentWeekInfo, setCurrentWeekInfo] = useState<{minggu: string, julat: string, penyemak: string, isSubmissionDay: boolean} | null>(null);

  useEffect(() => {
    const fetchWeekInfo = async () => {
      try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/1rx8gxm2Xj64IDexhHRzwfg5dQEeHlGS_JL7J9XNm6Ag/export?format=csv&gid=0');
        const csvText = await response.text();
        
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data as any[];
            const now = new Date();
            
            const parseMalayDate = (dateStr: string) => {
              if (!dateStr) return null;
              const months: Record<string, number> = {
                'JAN': 0, 'FEB': 1, 'MAC': 2, 'APRIL': 3, 'MEI': 4, 'JUN': 5,
                'JULAI': 6, 'OGOS': 7, 'SEPT': 8, 'OKT': 9, 'NOV': 10, 'DIS': 11
              };
              const parts = dateStr.trim().split(' ');
              if (parts.length >= 3) {
                const day = parseInt(parts[0], 10);
                const monthStr = parts[1].toUpperCase();
                const year = parseInt(parts[2], 10);
                const month = months[monthStr];
                if (month !== undefined && !isNaN(day) && !isNaN(year)) {
                  return new Date(year, month, day, 23, 59, 59);
                }
              }
              return null;
            };

            let foundWeek = null;
            let isSubmissionDay = false;
            for (const row of data) {
              const tarikh = row['Tarikh Penghantaran (Jumaat)'];
              if (tarikh) {
                const endDate = parseMalayDate(tarikh);
                if (endDate && now <= endDate) {
                  foundWeek = row;
                  if (now.getFullYear() === endDate.getFullYear() && now.getMonth() === endDate.getMonth() && now.getDate() === endDate.getDate()) {
                    isSubmissionDay = true;
                  }
                  break;
                }
              }
            }
            
            if (!foundWeek && data.length > 0) {
              foundWeek = data[data.length - 1]; 
              const tarikh = foundWeek['Tarikh Penghantaran (Jumaat)'];
              if (tarikh) {
                const endDate = parseMalayDate(tarikh);
                if (endDate && now.getFullYear() === endDate.getFullYear() && now.getMonth() === endDate.getMonth() && now.getDate() === endDate.getDate()) {
                  isSubmissionDay = true;
                }
              }
            }

            if (foundWeek) {
              setCurrentWeekInfo({
                minggu: foundWeek['Minggu'] || '',
                julat: foundWeek['Julat mingguan'] || '',
                penyemak: foundWeek['Pegawai Penyemak'] || '',
                isSubmissionDay
              });
            }
          }
        });
      } catch (error) {
        console.error("Error fetching week info:", error);
      }
    };

    fetchWeekInfo();
  }, []);

  const otherTeachers = useMemo(() => {
    return teachers.filter(t => t.id !== user.id && t.name.toLowerCase().includes(shareSearch.toLowerCase()));
  }, [teachers, user.id, shareSearch]);

  const ranges = [
    { label: 'M1-10', start: 1, end: 10 },
    { label: 'M11-20', start: 11, end: 20 },
    { label: 'M21-30', start: 21, end: 30 },
    { label: 'M31-40', start: 31, end: 40 },
    { label: 'M41-55', start: 41, end: 55 },
  ];

  const activeWeeks = useMemo(() => {
    const set = new Set();
    erphs.forEach(e => set.add(e.week));
    return set;
  }, [erphs]);

  const filteredErphs = useMemo(() => {
    let result = weekFilter === 'all' ? erphs : erphs.filter(e => e.week === weekFilter);
    
    if (rphSearch.trim() !== '') {
      const search = rphSearch.toLowerCase();
      result = result.filter(e => 
        e.subject.toLowerCase().includes(search) || 
        e.className.toLowerCase().includes(search) || 
        e.classTitle.toLowerCase().includes(search) ||
        (e.title && e.title.toLowerCase().includes(search))
      );
    }
    
    return result;
  }, [erphs, weekFilter, rphSearch]);

  const groupedByWeek = useMemo(() => {
    return filteredErphs.reduce((acc, erph) => {
      if (!acc[erph.week]) acc[erph.week] = [];
      acc[erph.week].push(erph);
      return acc;
    }, {} as Record<number, ERPHData[]>);
  }, [filteredErphs]);

  const sortedWeeks = useMemo(() => {
    return Object.keys(groupedByWeek)
      .map(Number)
      .sort((a, b) => b - a);
  }, [groupedByWeek]);

  const dskpLinks = masterData?.dskpLinks || [];

  const teacherSchedule = useMemo(() => {
    return masterSchedule.filter(s => s.teacherId === user.id);
  }, [masterSchedule, user.id]);

  const generatedSchedule = useMemo(() => {
    const myErphs = erphs.filter(e => e.teacherId === user.id);
    const slotsMap = new Map<string, ScheduleSlot>();
    
    myErphs.forEach(e => {
      if (!e.day || !e.startTime || !e.subject) return;
      const key = `${e.day.toUpperCase()}-${e.startTime}-${e.endTime || ''}-${e.subject}-${e.className}-${e.classTitle}`;
      if (!slotsMap.has(key)) {
        slotsMap.set(key, {
          id: key,
          teacherId: user.id,
          day: e.day.toUpperCase(),
          startTime: e.startTime,
          endTime: e.endTime || '',
          subject: e.subject,
          className: e.className,
          classTitle: e.classTitle
        });
      }
    });
    
    return Array.from(slotsMap.values());
  }, [erphs, user.id]);

  const stats = useMemo(() => {
    return {
      draft: erphs.filter(e => e.status === ERPHStatus.DRAFT).length,
      hantaranMingguan: bundles.length,
      belumDisahkan: bundles.filter(b => b.status_proses !== 'DISEMAK' && (!b.linkPdfSelesai || b.linkPdfSelesai.trim() === "")).length,
    };
  }, [erphs, bundles]);

  const getResourcesFor = (viewId: string) => {
    return masterData?.resources?.filter(r => r.targetView === viewId) || [];
  };

  const scheduleByDay = useMemo(() => {
    const days = ['ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT'];
    const grouped: Record<string, ScheduleSlot[]> = {};
    days.forEach(d => grouped[d] = []);
    
    teacherSchedule.forEach(slot => {
      const dayUpper = slot.day.toUpperCase();
      if (grouped[dayUpper]) {
        grouped[dayUpper].push(slot);
      }
    });
    
    days.forEach(d => {
      grouped[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    
    return grouped;
  }, [teacherSchedule]);

  return (
    <div className="space-y-8 md:space-y-16 animate-fadeIn text-left pb-24 md:pb-20">
      {/* LED Signboard */}
      {currentWeekInfo && (
        <div className="overflow-hidden w-full relative flex items-center mb-2 px-1 text-[#dc5f26]">
          <div className="animate-marquee text-sm md:text-base font-bold tracking-wide uppercase whitespace-nowrap">
            Peringatan mesra: Minggu ini adalah {currentWeekInfo.minggu}, {currentWeekInfo.julat}. RPH anda akan disemak oleh {currentWeekInfo.penyemak}. Sila pastikan anda menyediakan RPH hari pertama pada minggu seterusnya.
          </div>
        </div>
      )}
      
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight flex items-center gap-3">
            Hi, <span className="text-blue-600">{user.name.split(' ').slice(0, 2).join(' ')}</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => onSync?.()}
                disabled={syncStatus === 'SYNCING'}
                className="p-2 text-slate-400 hover:text-blue-600 transition-all active:scale-90 disabled:opacity-50"
                title="Kemaskini Data"
              >
                <RefreshCw size={20} className={syncStatus === 'SYNCING' ? 'animate-spin' : ''} />
              </button>
              <button 
                onClick={() => onNavigate?.('CHAT')}
                className="relative p-2 text-slate-400 hover:text-blue-600 transition-all active:scale-90"
                title="Notifikasi"
              >
                <Bell size={24} className="md:w-7 md:h-7" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white"></span>
                  </span>
                )}
              </button>
            </div>
          </h1>
          <p className="text-slate-400 font-bold mt-1 text-[9px] md:text-[10px] uppercase tracking-widest">Sekolah Seni Malaysia Johor • SMART Portal</p>
        </div>
        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button 
              onClick={onSync} 
              disabled={syncStatus === 'SYNCING'}
              className={`flex items-center justify-center gap-3 bg-white border-2 border-slate-100 text-slate-600 px-6 md:px-8 py-4 md:py-6 rounded-2xl md:rounded-3xl font-black hover:bg-slate-50 transition-all active:scale-95 w-full md:w-auto ${syncStatus === 'SYNCING' ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <Clock size={20} className={`md:w-6 md:h-6 text-blue-600 ${syncStatus === 'SYNCING' ? 'animate-spin' : ''}`} />
              <span className="uppercase text-[11px] md:text-xs tracking-widest">
                {syncStatus === 'SYNCING' ? 'Sedang Kemaskini...' : 'Kemaskini'}
              </span>
            </button>
            <button onClick={onAddNew} className="flex items-center justify-center gap-3 bg-[#0b41c7] text-white px-6 md:px-10 py-4 md:py-6 rounded-2xl md:rounded-3xl font-black hover:bg-blue-600 shadow-xl transition-all active:scale-95 w-full md:w-auto">
              <Plus size={20} className="md:w-6 md:h-6" />
              <span className="uppercase text-[11px] md:text-xs tracking-widest">Bina RPH Baharu</span>
            </button>
          </div>
          {currentWeekInfo?.isSubmissionDay ? (
            <div className="text-red-500 font-black text-[10px] md:text-xs animate-pulse w-full text-center md:text-right tracking-widest uppercase mt-1">
              SILA HANTAR RPH MINGGUAN ANDA PADA HARI INI
            </div>
          ) : (
            <div className="text-slate-400 font-bold text-[10px] md:text-xs w-full text-center md:text-right tracking-widest uppercase mt-1">
              HARI INI: {new Date().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>

      {/* Stats Section - Horizontal Scroll on Mobile */}
      <div className="flex overflow-x-auto pb-4 hide-scrollbar md:grid md:grid-cols-3 gap-4 md:gap-8 snap-x snap-mandatory">
        <div className="flex-none w-[90vw] sm:w-[45vw] md:w-auto bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] premium-shadow border border-slate-100 flex items-center gap-5 md:gap-8 group snap-center">
          <div className="p-4 md:p-6 bg-slate-50 text-slate-400 rounded-2xl md:rounded-[1.8rem] shadow-inner"><Clock size={24} className="md:w-8 md:h-8" /></div>
          <div>
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">JUMLAH RPH HARIAN</p>
            <p className="text-2xl md:text-5xl font-black text-slate-900">{stats.draft}</p>
          </div>
        </div>
        <div className="flex-none w-[90vw] sm:w-[45vw] md:w-auto bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] premium-shadow border border-slate-100 flex items-center gap-5 md:gap-8 group snap-center">
          <div className="p-4 md:p-6 bg-blue-50 text-blue-600 rounded-2xl md:rounded-[1.8rem] shadow-inner"><FileText size={24} className="md:w-8 md:h-8" /></div>
          <div>
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">RPH MINGGUAN DIHANTAR</p>
            <p className="text-2xl md:text-5xl font-black text-slate-900">{stats.hantaranMingguan}</p>
          </div>
        </div>
        <div className="flex-none w-[90vw] sm:w-[45vw] md:w-auto bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] premium-shadow border border-slate-100 flex items-center gap-5 md:gap-8 group snap-center">
          <div className={`p-4 md:p-6 rounded-2xl md:rounded-[1.8rem] shadow-inner ${stats.belumDisahkan > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {stats.belumDisahkan > 0 ? <AlertCircle size={24} className="md:w-8 md:h-8" /> : <CheckCircle2 size={24} className="md:w-8 md:h-8" />}
          </div>
          <div>
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">BELUM DISEMAK</p>
            <p className={`text-2xl md:text-5xl font-black ${stats.belumDisahkan > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{stats.belumDisahkan}</p>
          </div>
        </div>
      </div>

      {/* Jadual Individu Quick Access */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3">
            <div className="w-2 h-6 md:h-10 bg-blue-600 rounded-full"></div>
            <div>
              <h2 className="font-black text-slate-900 text-lg md:text-xl tracking-tight uppercase">Jadual Individu</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Jadual Waktu Mengajar Mingguan</p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate?.('TIMETABLE')}
            className="px-4 py-2 rounded-xl text-[9px] font-black text-blue-600 bg-blue-50 uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center gap-1 flex-none"
          >
            Urus Jadual <ChevronRight size={12} />
          </button>
        </div>

        <div className="space-y-5">
          {teacherSchedule.length === 0 && generatedSchedule.length === 0 ? (
            <div className="bg-white p-10 rounded-[2rem] border border-slate-100 text-center">
              <Calendar size={32} className="text-slate-200 mx-auto mb-2" />
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiada jadual direkodkan</p>
            </div>
          ) : (
            <>
              {/* Ringkasan Jadual Mengajar from Sheet */}
              {(user.raw?.['RINGKASAN JADUAL MENGAJAR'] || user.raw?.['Ringkasan Jadual Mengajar'] || user.raw?.ringkasan_jadual) && (
                <div className="mb-6 p-5 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <LayoutGrid size={14} className="text-indigo-600" />
                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Ringkasan Jadual Mengajar</p>
                  </div>
                  <p className="text-xs font-bold text-slate-700 leading-relaxed">
                    {user.raw?.['RINGKASAN JADUAL MENGAJAR'] || user.raw?.['Ringkasan Jadual Mengajar'] || user.raw?.ringkasan_jadual}
                  </p>
                </div>
              )}

              {/* Auto-generated Summary Widget (If manual schedule is empty) */}
              {teacherSchedule.length === 0 && generatedSchedule.length > 0 && (
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 mb-6">
                   <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <BookOpen size={16} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 uppercase tracking-tight text-xs">Ringkasan Jadual Mengajar (Auto)</h3>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Dijana berdasarkan rekod RPH anda</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {['ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT'].map(day => {
                      const daySlots = generatedSchedule.filter(s => s.day.toUpperCase() === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
                      if (daySlots.length === 0) return null;
                      return (
                        <div key={day} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2 pb-1 border-b border-slate-200/60">{day}</h4>
                          <div className="space-y-2">
                            {daySlots.map((slot, idx) => (
                              <button 
                                key={idx} 
                                className="w-full flex flex-col gap-0.5 text-left hover:bg-blue-100/50 p-1 rounded-lg transition-all group"
                                onClick={() => onSelectScheduleSlot?.(slot)}
                              >
                                <span className="text-[9px] font-black text-slate-800 uppercase leading-tight truncate group-hover:text-blue-600">{slot.subject}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase truncate">{slot.className} {slot.classTitle}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {['ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT'].map(day => {
              const slots = scheduleByDay[day];
              if (slots.length === 0) return null;
              
              return (
                <div key={day} className="space-y-2">
                  <div className="flex items-center gap-3 px-1">
                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em]">{day}</span>
                    <div className="flex-1 h-[1px] bg-slate-100"></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <button 
                        key={slot.id} 
                        className="flex items-center gap-3 p-2.5 bg-white border border-slate-100 rounded-2xl hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left group premium-shadow-sm" 
                        onClick={() => onSelectScheduleSlot?.(slot)}
                      >
                        <div className="flex-none w-10 py-1 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-bold tabular-nums text-center group-hover:bg-blue-600 group-hover:text-white transition-colors flex items-center justify-center">
                          {slot.startTime === 'Sepanjang masa hari persekolahan' ? <span className="text-[7px] leading-tight">ALL<br/>DAY</span> : slot.startTime}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[10px] font-black text-slate-800 uppercase truncate leading-tight">{slot.subject}</h4>
                          <p className="text-[8px] font-bold text-slate-400 uppercase truncate mt-0.5">{slot.className} {slot.classTitle}</p>
                        </div>
                        <ChevronRight size={12} className="text-slate-200 group-hover:text-blue-600 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
          )}
        </div>
      </div>

      {/* Utility Menus Grid */}
      <div className="space-y-6">
         <div className="flex items-center gap-3 px-1">
            <div className="w-2 h-6 md:h-10 bg-slate-900 rounded-full"></div>
            <h2 className="font-black text-slate-900 text-lg md:text-xl tracking-tight uppercase">Sumber & Utiliti</h2>
         </div>
         <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-6">
            {UTILITY_MENUS.map(menu => (
              <button 
                key={menu.id} 
                onClick={() => {
                  if (menu.id === 'ANALYSIS') {
                    onNavigate?.('ANALYSIS');
                  } else if (menu.id === 'CHAT') {
                    onNavigate?.('CHAT');
                  } else if (menu.id === 'SCHEDULE') {
                    onNavigate?.('TIMETABLE');
                  } else if (menu.id === 'REKOD_PENCERAPAN') {
                    onNavigate?.('REKOD_PENCERAPAN');
                  } else {
                    setActiveResView(activeResView === menu.id ? null : menu.id);
                  }
                }}
                className={`relative overflow-hidden p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[1.5rem] md:rounded-[2.5rem] flex flex-col items-center text-center gap-2 sm:gap-3 md:gap-4 transition-all hover:scale-105 active:scale-95 ${activeResView === menu.id ? 'bg-slate-900 text-white shadow-2xl' : 'bg-white premium-shadow border border-slate-100 text-slate-600'}`}
              >
                {menu.id === 'CHAT' && notifications.length > 0 && (
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-8 md:right-8 flex items-center justify-center">
                    <span className="absolute inline-flex h-3 w-3 rounded-full bg-pink-400 opacity-75 animate-ping"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-600"></span>
                  </div>
                )}
                <div className={`p-2.5 sm:p-3 md:p-5 rounded-xl md:rounded-2xl ${activeResView === menu.id ? 'bg-white/10' : menu.color + ' text-white shadow-lg shadow-blue-100'}`}>
                  <menu.icon size={18} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </div>
                <span className="text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-tight leading-tight">{menu.label}</span>
              </button>
            ))}
         </div>

         {activeResView && (
           <ResourceCenter 
             viewId={activeResView}
             label={UTILITY_MENUS.find(m => m.id === activeResView)?.label || ''}
             resources={masterData?.resources || []}
             user={user}
             teachers={teachers}
             isAdmin={isAdmin}
             onAdd={(res) => onAddResource?.(res)}
             onDelete={(id) => {
               if (isAdmin) {
                 onDeleteResource?.(id);
               } else {
                 alert('Hanya pentadbir boleh memadam bahan ini.');
               }
             }}
             onClose={() => setActiveResView(null)}
           />
         )}
      </div>

      {/* Status Pengesahan Mingguan - Horizontal Scroll for Mobile */}
      <div className="bg-white rounded-[2.5rem] md:rounded-[3.5rem] premium-shadow border border-slate-100 overflow-hidden">
        <div className="p-6 md:p-12 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/30 text-left">
           <div className="flex items-center gap-4">
            <div className="w-2 h-8 md:h-12 bg-blue-600 rounded-full shadow-lg"></div>
            <div>
              <h2 className="font-black text-slate-900 text-lg md:text-2xl tracking-tight uppercase">Status Pengesahan</h2>
              <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Semakan Rasmi Mingguan</p>
            </div>
          </div>
        </div>
        <div className="flex overflow-x-auto p-4 md:p-8 gap-4 text-left hide-scrollbar snap-x snap-mandatory scroll-smooth">
           {bundles.length === 0 ? (
             <div className="col-span-full py-12 flex flex-col items-center text-slate-300 w-full">
                <FileDown size={48} className="opacity-20 mb-2" />
                <p className="text-[9px] font-black uppercase tracking-widest">Tiada hantaran</p>
             </div>
           ) : (
             bundles.map((bundle, idx) => {
               const isReviewed = bundle.status_proses === 'DISEMAK' || (bundle.linkPdfSelesai && bundle.linkPdfSelesai.trim() !== "");
               const finalLink = (bundle.linkPdfSelesai && bundle.linkPdfSelesai.trim() !== "") 
                                ? bundle.linkPdfSelesai 
                                : (bundle.jana_url || bundle.pdfBase64);

               return (
                 <div key={bundle.id_minggu || idx} className={`flex-none w-[280px] md:w-[320px] p-5 md:p-6 bg-white rounded-[2rem] border transition-all flex flex-col justify-between min-h-[240px] md:min-h-[260px] snap-center ${isReviewed ? 'border-emerald-200 shadow-emerald-50' : 'border-slate-100 premium-shadow group hover:border-blue-300'}`}>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                         <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border ${isReviewed ? 'bg-emerald-600 text-white border-emerald-400 shadow-md' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                            {isReviewed ? 'DISEMAK' : 'MENUNGGU'}
                         </span>
                         <span className="text-[7px] font-black text-slate-300 uppercase">{bundle.timestamp.split(' ')[0]}</span>
                      </div>
                      <h3 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight line-clamp-1">{bundle.week}</h3>
                    </div>
                    <div className="pt-2 md:pt-3 space-y-2">
                      {isReviewed ? (
                        <div className="space-y-2">
                           <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-[1rem]">
                             <p className="text-[7px] font-black text-emerald-600 uppercase mb-0.5 flex items-center gap-1"><UserCheck size={10}/> Ulasan:</p>
                             <p className="text-[8px] italic text-emerald-800 line-clamp-2 leading-tight">"{bundle.comment || "Rekod telah disemak."}"</p>
                           </div>
                           <button 
                             onClick={() => finalLink && window.open(finalLink, '_blank')}
                             className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 text-white py-2.5 rounded-lg md:rounded-xl font-black text-[8px] md:text-[9px] uppercase shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
                           >
                             <FileDown size={14} /> Lihat Template Rasmi
                           </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-[1rem]">
                            <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Status:</p>
                            <p className="text-[8px] font-bold text-slate-500 leading-tight uppercase">Sedang Diproses</p>
                          </div>
                          <button 
                            onClick={() => {
                              const weekNum = parseInt(bundle.week.replace(/[^0-9]/g, ''));
                              onViewWeek?.(weekNum);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 bg-white text-slate-500 py-2.5 rounded-lg md:rounded-xl font-black text-[8px] md:text-[9px] uppercase border border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-all active:scale-95"
                          >
                            <Eye size={14} /> Lihat Draf Template
                          </button>
                        </div>
                      )}
                    </div>
                 </div>
               );
             })
           )}
        </div>
      </div>

      {/* Filter and Log Section */}
      <div className="space-y-6">
        <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] premium-shadow border border-slate-100">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                <Filter size={16} className="md:w-5 md:h-5" />
              </div>
              <div>
                <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight leading-none">Log Rekod PdP</h3>
                <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Arkib Digital Harian</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:flex-1">
              <div className="relative group w-full sm:w-64">
                 <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                 <input 
                   type="text"
                   placeholder="Cari subjek, kelas..."
                   className="w-full h-12 md:h-14 pl-11 pr-5 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                   value={rphSearch}
                   onChange={(e) => setRphSearch(e.target.value)}
                 />
              </div>

              <div className="relative group w-full sm:w-48">
                 <select 
                   className="w-full h-12 md:h-14 pl-5 pr-10 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all appearance-none"
                   value={weekFilter === 'all' ? 'all' : rangeFilter}
                   onChange={(e) => {
                     const val = e.target.value;
                     if (val === 'all') {
                       setWeekFilter('all');
                     } else {
                       const idx = parseInt(val);
                       setRangeFilter(idx);
                       setWeekFilter(ranges[idx].start);
                     }
                   }}
                 >
                   <option value="all">Semua Rekod</option>
                   {ranges.map((range, idx) => (
                     <option key={idx} value={idx}>{range.label}</option>
                   ))}
                 </select>
                 <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-blue-600 transition-colors" />
              </div>

              {weekFilter !== 'all' && (
                <div className="flex overflow-x-auto pb-1 hide-scrollbar w-full">
                  <div className="flex items-center gap-2">
                    {WEEKS.slice(ranges[rangeFilter].start - 1, ranges[rangeFilter].end).map(w => {
                       const isSelected = weekFilter === w;
                       const hasData = activeWeeks.has(w);
                       return (
                        <button 
                          key={w} 
                          onClick={() => setWeekFilter(w)}
                          className={`relative h-10 w-10 md:h-12 md:w-12 flex-none rounded-xl text-[9px] md:text-[10px] font-black transition-all border flex items-center justify-center ${isSelected ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-white hover:border-blue-400 text-slate-900 border-slate-100'}`}
                        >
                          M{w}
                          {hasData && <div className={`absolute top-1 right-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-600 animate-pulse'}`}></div>}
                        </button>
                       );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {weekFilter !== 'all' && filteredErphs.length > 0 && (
           <div className="bg-gradient-to-br from-slate-900 to-blue-950 p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl animate-slideUp relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12"><SendHorizontal size={100} /></div>
              <div className="flex items-center gap-4 md:gap-6 relative z-10">
                 <div className="p-4 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                   <Layers size={24} className="md:w-8 md:h-8" />
                 </div>
                 <div>
                    <h3 className="text-lg md:text-xl font-black uppercase tracking-tight">Hantar RPH minggu {weekFilter}</h3>
                    <p className="text-blue-200 text-[8px] md:text-[9px] font-bold uppercase tracking-widest mt-0.5">{filteredErphs.length} Rekod Sedia Dihantar</p>
                 </div>
              </div>
              <button 
                onClick={() => onViewWeek?.(weekFilter as number)}
                className="w-full md:w-auto bg-blue-600 text-white px-8 md:px-10 py-4 md:py-5 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-lg active:scale-95 relative z-10"
              >
                <SendHorizontal size={18} />
                Preview& Hantar RPH
              </button>
           </div>
        )}

        {/* Daily Log - Compact Cards and Scrolling for Mobile */}
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] premium-shadow border border-slate-100 overflow-hidden flex flex-col">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aliran Kerja Harian</span>
          </div>
          
          <div className="max-h-[450px] md:max-h-[600px] overflow-y-auto custom-scrollbar">
            {filteredErphs.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                 <FileText size={40} className="mb-2 opacity-10" />
                 <p className="text-[9px] font-black uppercase tracking-widest">
                   {rphSearch ? 'Tiada hasil carian' : 'Tiada rekod harian'}
                 </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {sortedWeeks.length === 0 ? (
                  <div className="py-20 text-center text-slate-400">
                    <p className="font-black text-[9px] uppercase tracking-widest">Tiada rekod untuk Minggu {weekFilter}</p>
                  </div>
                ) : sortedWeeks.map(week => (
                  <div key={week} className="border-b last:border-0 border-slate-100">
                    <div className="bg-slate-50/20 px-6 md:px-8 py-3 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-slate-50">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Minggu {week}</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase bg-white px-2 py-0.5 rounded-md border border-slate-100">{groupedByWeek[week].length}</span>
                    </div>
                    
                    {/* Desktop View: Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left min-w-[600px]">
                        <tbody className="divide-y divide-slate-50">
                          {groupedByWeek[week].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(erph => (
                            <tr key={erph.id} className="group hover:bg-blue-50/20 transition-colors">
                              <td className="px-8 py-4 w-[25%]">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-extrabold text-slate-900 tracking-tight">{formatDate(erph.date)}</span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">{['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'][new Date(erph.date + 'T12:00:00').getDay()]}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 w-[40%]">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-slate-800 uppercase line-clamp-1">{erph.subject}</span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">{erph.className} • {erph.classTitle}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 w-[15%]">
                                <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-tighter border ${
                                  erph.status === ERPHStatus.REVIEWED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                  erph.status === ERPHStatus.SELESAI ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                  'bg-slate-50 text-slate-400 border-slate-100'
                                }`}>
                                  {erph.status === ERPHStatus.REVIEWED ? 'DISEMAK' : erph.status === ERPHStatus.SELESAI ? 'DIHANTAR' : 'DRAF'}
                                </span>
                              </td>
                              <td className="px-8 py-4 text-right">
                                <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => onView(erph)} className="p-2 bg-white text-slate-400 hover:text-blue-600 border border-slate-100 rounded-lg transition-all"><Eye size={14} /></button>
                                   <button onClick={() => onEdit(erph)} className="p-2 bg-white text-slate-400 hover:text-amber-500 border border-slate-100 rounded-lg transition-all"><Pencil size={14} /></button>
                                   <button onClick={() => onCopy(erph)} className="p-2 bg-white text-slate-400 hover:text-indigo-600 border border-slate-100 rounded-lg transition-all"><Copy size={14} /></button>
                                   <button onClick={() => setSharingErph(erph)} className="p-2 bg-white text-slate-400 hover:text-emerald-600 border border-slate-100 rounded-lg transition-all"><Share2 size={14} /></button>
                                   {onDelete && (
                                     <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDeletingErph(erph.id); }} className="p-2 bg-white text-slate-400 hover:text-red-600 border border-slate-100 rounded-lg transition-all"><Trash2 size={14} /></button>
                                   )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View: Compact Cards */}
                    <div className="md:hidden flex flex-col divide-y divide-slate-50">
                      {groupedByWeek[week].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(erph => (
                        <div key={erph.id} className="p-4 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/50">
                           <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-900">{formatDate(erph.date)}</span>
                                <span className={`px-1.5 py-0.5 rounded-[4px] text-[6px] font-black uppercase border ${
                                  erph.status === ERPHStatus.REVIEWED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                  erph.status === ERPHStatus.SELESAI ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                  'bg-slate-50 text-slate-400 border-slate-100'
                                }`}>
                                  {erph.status === ERPHStatus.REVIEWED ? 'SEM' : erph.status === ERPHStatus.SELESAI ? 'HAN' : 'DRA'}
                                </span>
                              </div>
                              <p className="text-[8px] font-black text-slate-500 uppercase truncate max-w-[180px]">{erph.subject}</p>
                              <p className="text-[7px] font-bold text-slate-300 uppercase">{['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'][new Date(erph.date + 'T12:00:00').getDay()]} • {erph.className} {erph.classTitle}</p>
                           </div>
                           <div className="flex items-center gap-1">
                              <button onClick={() => onView(erph)} className="p-2 bg-slate-50 text-slate-400 rounded-lg active:bg-blue-100 active:text-blue-600 transition-colors"><Eye size={14} /></button>
                              <button onClick={() => onEdit(erph)} className="p-2 bg-slate-50 text-slate-400 rounded-lg active:bg-amber-100 active:text-amber-600 transition-colors"><Pencil size={14} /></button>
                              <button onClick={() => onCopy(erph)} className="p-2 bg-slate-50 text-slate-400 rounded-lg active:bg-indigo-100 active:text-indigo-600 transition-colors"><Copy size={14} /></button>
                              <button onClick={() => setSharingErph(erph)} className="p-2 bg-slate-50 text-slate-400 rounded-lg active:bg-emerald-100 active:text-emerald-600 transition-colors"><Share2 size={14} /></button>
                              {onDelete && (
                                <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDeletingErph(erph.id); }} className="p-2 bg-slate-50 text-slate-400 rounded-lg active:bg-red-100 active:text-red-600 transition-colors"><Trash2 size={14} /></button>
                              )}
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-center">
             <button onClick={onSync} className="flex items-center gap-2 text-[8px] font-black text-blue-600 uppercase hover:underline">
               <SendHorizontal size={10} className="rotate-90"/> Kemaskini Rekod Terkini
             </button>
          </div>
        </div>
      </div>
      {/* Share Modal */}
      {sharingErph && (
        <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Share2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight leading-none">Kongsi RPH</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pilih rakan untuk dikongsi</p>
                </div>
              </div>
              <button onClick={() => { setSharingErph(null); setShareSearch(''); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari nama rakan..."
                  value={shareSearch}
                  onChange={(e) => setShareSearch(e.target.value)}
                  className="w-full h-12 pl-12 pr-6 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
                {otherTeachers.length === 0 ? (
                  <div className="py-12 text-center text-slate-300">
                    <p className="text-[10px] font-black uppercase tracking-widest">Tiada rakan dijumpai</p>
                  </div>
                ) : (
                  otherTeachers.map(teacher => (
                    <button 
                      key={teacher.id}
                      onClick={() => {
                        onShare(sharingErph, teacher.id);
                        setSharingErph(null);
                        setShareSearch('');
                        alert(`RPH telah dikongsi kepada ${teacher.name}`);
                      }}
                      className="w-full p-4 flex items-center gap-4 rounded-2xl border border-slate-50 hover:bg-emerald-50 hover:border-emerald-100 transition-all text-left group"
                    >
                      {teacher.photoUrl && teacher.photoUrl.trim() !== "" ? (
                        <img 
                          src={teacher.photoUrl} 
                          className="w-10 h-10 rounded-lg object-cover border-2 border-white shadow-sm" 
                          alt="" 
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name || 'U')}&background=random`; }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-black text-xs">
                          {(teacher.name || 'U').charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-[11px] font-black text-slate-900 uppercase group-hover:text-emerald-700 transition-colors">{teacher.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{teacher.designation}</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-200 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingErph && (
        <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-slideUp text-center p-8">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-2">Padam RPH?</h3>
            <p className="text-xs font-bold text-slate-500 mb-8">Tindakan ini tidak boleh diundur. Adakah anda pasti mahu memadam RPH ini secara kekal?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeletingErph(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  if (onDelete) onDelete(deletingErph);
                  setDeletingErph(null);
                }}
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95"
              >
                Padam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;