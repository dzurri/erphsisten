
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { UserProfile, UserRole, ERPHData, ERPHStatus, MasterData, Resource, WeeklyBundle, AppNotification, ScheduleSlot } from './types';
import { DEFAULT_MASTER_DATA, WEEKS, sortSubjects } from './constants';
import Layout from './components/Layout';
import Register from './components/Register';
import { Loader2 } from 'lucide-react';

const TeacherDashboard = React.lazy(() => import('./components/TeacherDashboard'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const ERPHForm = React.lazy(() => import('./components/ERPHForm'));
const ERPHPreview = React.lazy(() => import('./components/ERPHPreview'));
const Settings = React.lazy(() => import('./components/Settings'));
const Analysis = React.lazy(() => import('./components/Analysis'));
const Notifications = React.lazy(() => import('./components/Notifications'));
const Timetable = React.lazy(() => import('./components/Timetable'));
const Pencerapan = React.lazy(() => import('./components/Pencerapan'));
const RekodPencerapan = React.lazy(() => import('./components/RekodPencerapan'));
const MasterDataManager = React.lazy(() => import('./components/MasterDataManager'));

const GAS_WEB_APP_URL = import.meta.env.VITE_GAS_WEB_APP_URL || "https://script.google.com/macros/s/AKfycbzm6fcZIr8gnraM-oJbADlfq-IV-QL38YJj0cjRkH42yHQn9L6vnm3Om2Q7Mz8ZYtru/exec";
const SECONDARY_GAS_URL = "https://script.google.com/macros/s/AKfycbyqm3_5TxT98s_3ZfaokoqUkbFRVqKLDZLX4wqTz_sTzMiAU3bCwiKbeZA6EjZJ5ffm/exec";

const ADMIN_ORDER = [
  "TEE TIAM CHAI",
  "SITI JAUHARA BINTI JAMIAN",
  "KHAIRINA BT WAHLED @ WALID",
  "MUHAMAD SAFIDZAN BIN SALMAN",
  "MAH NYUK YING",
  "AHMAD NAZRI BIN NORDIN",
  "IZU HANA ZILZA BINTI IMRAN",
  "MOHD FAUZI BIN AHMAD SELO",
  "FAEZAH BINTI BAHARI",
  "SARAVANAN A/L PALANISAMY",
  "NUREMELIA BINTI MOHAMAD RAWAN",
  "MOHD FIRDAUS BIN MOHD JALIL"
].map(name => name.toUpperCase());

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [adminUser, setAdminUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'FORM' | 'ADMIN' | 'REGISTER' | 'PREVIEW' | 'CALENDAR' | 'RPT' | 'ANALYSIS' | 'TEXTBOOKS' | 'DSKP_COLL' | 'CHAT' | 'SETTINGS' | 'TIMETABLE' | 'PENCERAPAN' | 'REKOD_PENCERAPAN' | 'MASTER_DATA_MANAGER'>('REGISTER');
  const [groqApiKey, setGroqApiKey] = useState<string | null>(null);
  const [allErphs, setAllErphs] = useState<ERPHData[]>([]);
  const [bundles, setBundles] = useState<WeeklyBundle[]>([]);
  const [masterData, setMasterData] = useState<MasterData>(DEFAULT_MASTER_DATA);
  const [editingErph, setEditingErph] = useState<ERPHData | null>(null);
  const [previewErphs, setPreviewErphs] = useState<ERPHData[]>([]);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'OFFLINE'>('IDLE');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const readNotifIdsRef = useRef<string[]>([]);
  useEffect(() => { readNotifIdsRef.current = readNotifIds; }, [readNotifIds]);

  const [allRegisteredTeachers, setAllRegisteredTeachers] = useState<any[]>(() => {
    const saved = localStorage.getItem('ssemj_registered_teachers');
    return saved ? JSON.parse(saved) : [];
  });
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [locallyReviewedIds, setLocallyReviewedIds] = useState<Set<string>>(() => {
    const saved = sessionStorage.getItem('ssemj_locally_reviewed');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const locallyReviewedIdsRef = useRef<Set<string>>(locallyReviewedIds);
  useEffect(() => { locallyReviewedIdsRef.current = locallyReviewedIds; }, [locallyReviewedIds]);

  useEffect(() => {
    sessionStorage.setItem('ssemj_locally_reviewed', JSON.stringify(Array.from(locallyReviewedIds)));
  }, [locallyReviewedIds]);
  const [masterSchedule, setMasterSchedule] = useState<ScheduleSlot[]>(() => {
    const saved = localStorage.getItem('ssemj_master_schedule');
    return saved ? JSON.parse(saved) : [];
  });

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const handleSaveSchedule = async (schedule: ScheduleSlot[]) => {
    if (!user) return;
    setSyncStatus('SYNCING');
    try {
      await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          logType: "SCHEDULE_SYNC", 
          teacherId: user.id, 
          schedule: JSON.stringify(schedule) 
        })
      });
      setSyncStatus('IDLE');
    } catch (err) {
      setSyncStatus('OFFLINE');
    }
  };
  const [isProcessingBundle, setIsProcessingBundle] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const hiddenRenderRef = useRef<HTMLDivElement>(null);

  const getDirectImageUrl = (url: string) => {
    if (!url) return "";
    if (url.includes('drive.google.com')) {
      const idMatch = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/) || url.match(/\/file\/d\/([^/]+)/);
      if (idMatch && idMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
      }
    }
    return url;
  };

  const allTeachers = useMemo(() => {
    if (allRegisteredTeachers && allRegisteredTeachers.length > 0) {
      return allRegisteredTeachers
        .map((teacher) => {
          // Robust ID/Login detection
          const loginId = String(
            teacher.login || 
            teacher.loginid || 
            teacher.login_id || 
            teacher.id || 
            teacher["LOGIN ID"] || 
            teacher["Login ID"] || 
            teacher["ID"] ||
            teacher["LOGIN"] ||
            teacher["No IC"] ||
            teacher["NO IC"] ||
            teacher.ic ||
            ""
          ).trim();

          // Robust Name detection
          const teacherName = String(
            teacher.namaguru || 
            teacher.nama_guru || 
            teacher.name || 
            teacher["NAMA GURU"] || 
            teacher["Nama Guru"] || 
            teacher["NAMA"] || 
            teacher["Nama"] ||
            teacher["NAMA PENUH"] ||
            teacher["Nama Penuh"] ||
            ""
          ).trim();

          // Robust Department detection
          const department = String(
            teacher.bidang || 
            teacher.department || 
            teacher.unit || 
            teacher["BIDANG"] || 
            teacher["UNIT"] || 
            ""
          ).trim();

          return {
            id: loginId,
            name: teacherName,
            login: loginId,
            ic: teacher.ic || teacher.no_ic || teacher["NO IC"] || "",
            designation: teacher.designation || teacher.jawatan || "Guru",
            subjects: teacher.subjects || [],
            email: teacher.email || teacher.emel || "",
            phone: teacher.phone || teacher.no_tel || "",
            department: department,
            grade: teacher.grade || teacher.gred || "",
            photoUrl: getDirectImageUrl(
              teacher.gambar || 
              teacher.photo || 
              teacher["GAMBAR"] || 
              teacher["Gambar"] || 
              teacher["PHOTO"] || 
              teacher["Photo"] || 
              teacher["URL FOTO"] || 
              teacher["Url Foto"] || 
              ""
            ),
            raw: teacher
          };
        })
        .filter(teacher => teacher.id && teacher.id !== "" && teacher.name && teacher.name !== "")
        .sort((a, b) => {
          const deptA = (a.department || "").trim().toUpperCase();
          const deptB = (b.department || "").trim().toUpperCase();
          
          // "PENTADBIRAN" first
          if (deptA === "PENTADBIRAN" && deptB !== "PENTADBIRAN") return -1;
          if (deptA !== "PENTADBIRAN" && deptB === "PENTADBIRAN") return 1;
          
          if (deptA === "PENTADBIRAN" && deptB === "PENTADBIRAN") {
            const nameA = (a.name || "").trim().toUpperCase();
            const nameB = (b.name || "").trim().toUpperCase();
            
            const indexA = ADMIN_ORDER.indexOf(nameA);
            const indexB = ADMIN_ORDER.indexOf(nameB);
            
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            
            return nameA.localeCompare(nameB);
          }

          // Then sort by department
          if (deptA < deptB) return -1;
          if (deptA > deptB) return 1;
          
          // Then sort by name
          const nameA = (a.name || "").trim().toUpperCase();
          const nameB = (b.name || "").trim().toUpperCase();
          return nameA.localeCompare(nameB);
        });
    }
    
    // Fallback to bundles if no registered teachers
    const uniqueTeachers = new Map<string, any>();
    bundles.forEach(bundle => {
      const teacherId = String(bundle.teacherId || "").trim();
      const teacherName = String(bundle.teacherName || "").trim();
      
      if (teacherId && !uniqueTeachers.has(teacherId)) {
        uniqueTeachers.set(teacherId, {
          id: teacherId,
          name: teacherName || 'Guru SSEMJ',
          login: teacherId,
          ic: `IC-${teacherId.slice(0, 5).toUpperCase()}`,
          designation: 'Guru',
          subjects: ['Pendidikan Seni Visual'],
          photoUrl: "",
          department: 'Bidang Kesenian',
          raw: bundle
        });
      }
    });
    return Array.from(uniqueTeachers.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRegisteredTeachers, allRegisteredTeachers.length > 0 ? null : bundles]);

  const fetchRobust = async (url: string): Promise<any> => {
    const timestamp = Date.now();
    const urlWithCacheBust = `${url}${url.includes('?') ? '&' : '?'}t=${timestamp}`;
    try {
      const directRes = await fetch(urlWithCacheBust, { method: 'GET', redirect: 'follow' });
      if (directRes.ok) {
        const text = await directRes.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          console.warn("Direct fetch returned non-JSON:", text.substring(0, 100));
        }
      }
    } catch (e) { console.warn("Fallback proxy..."); }
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlWithCacheBust)}`;
      const res = await fetch(proxyUrl);
      const data = await res.json();
      const contents = data.contents;
      
      if (!contents) throw new Error("Tiada respon dari pelayan.");
      
      try {
        return typeof contents === 'string' ? JSON.parse(contents) : contents;
      } catch (e) {
        if (typeof contents === 'string' && (contents.includes('<!DOCTYPE') || contents.includes('<html') || contents.includes('Oops'))) {
          throw new Error("Pelayan memulangkan ralat HTML (Mungkin had kuota Google atau skrip tidak aktif).");
        }
        throw new Error("Format data tidak sah.");
      }
    } catch (e: any) { throw new Error(`Sync Cloud Gagal: ${e.message}`); }
  };

  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`ssemj_read_notifs_${user.id}`);
      if (saved) {
        setReadNotifIds(JSON.parse(saved));
      } else {
        // Fallback to old key for backward compatibility
        const oldSaved = localStorage.getItem('ssemj_read_notifs');
        if (oldSaved) {
          setReadNotifIds(JSON.parse(oldSaved));
        } else {
          setReadNotifIds([]);
        }
      }
    } else {
      setReadNotifIds([]);
    }
  }, [user]);

  const handleSyncCloud = useCallback(async () => {
    setSyncStatus('SYNCING');
    try {
      const data = await fetchRobust(GAS_WEB_APP_URL);
      const secondaryData = await fetchRobust(SECONDARY_GAS_URL).catch(() => null);

      if (data && data.status === "success") {
        if (data.masterData) {
          // Deduplicate resources to prevent key errors
          if (data.masterData.resources) {
            const uniqueMap = new Map();
            data.masterData.resources.forEach((r: any) => uniqueMap.set(r.id, r));
            data.masterData.resources = Array.from(uniqueMap.values());
          }

          // Backwards compatibility: ensure masterData always has a notifications array
          // to prevent crashes in child components that might still expect it.
          data.masterData.notifications = data.masterData.notifications || [];
          setMasterData({
            ...DEFAULT_MASTER_DATA,
            ...data.masterData,
            subjects: sortSubjects(data.masterData.subjects && data.masterData.subjects.length > 0 ? data.masterData.subjects : DEFAULT_MASTER_DATA.subjects),
            hierarchy: data.masterData.hierarchy && Object.keys(data.masterData.hierarchy).length > 0 ? data.masterData.hierarchy : DEFAULT_MASTER_DATA.hierarchy,
            classes: data.masterData.classes && Object.keys(data.masterData.classes).length > 0 ? data.masterData.classes : DEFAULT_MASTER_DATA.classes,
            resources: data.masterData.resources || DEFAULT_MASTER_DATA.resources,
            dskpLinks: data.masterData.dskpLinks || DEFAULT_MASTER_DATA.dskpLinks
          });
        }
        if (data.erphs) {
          // Filter out any ERPHs that were marked as DELETED
          const activeErphs = data.erphs.filter((e: ERPHData) => e.status !== 'DELETED' as any);
          setAllErphs(activeErphs);
        }
        
        // Ultra-aggressive registry detection: find the best matching array in the response
        let registry: any[] = [];
        let maxScore = -1;
        
        const scanForRegistry = (obj: any, depth = 0) => {
          if (!obj || typeof obj !== 'object' || depth > 3) return;
          
          for (const key in obj) {
            const val = obj[key];
            if (Array.isArray(val) && val.length > 0) {
              // Score this array based on how much it looks like a teacher registry
              let score = 0;
              const sample = val[0];
              if (typeof sample === 'object' && sample !== null) {
                const keys = Object.keys(sample).map(k => k.toLowerCase());
                if (keys.some(k => k.includes('nama') || k.includes('name'))) score += 10;
                if (keys.some(k => k.includes('login') || k.includes('id') || k.includes('ic'))) score += 5;
                if (keys.some(k => k.includes('bidang') || k.includes('dept') || k.includes('unit'))) score += 3;
                
                // Bonus for specific keys mentioned by user
                if (key.toLowerCase().includes('registry')) score += 20;
                if (key.toLowerCase().includes('teacher')) score += 15;
                if (key.toLowerCase().includes('guru')) score += 15;
                
                if (score > maxScore) {
                  maxScore = score;
                  registry = val;
                }
              }
            } else if (typeof val === 'object' && val !== null) {
              scanForRegistry(val, depth + 1);
            }
          }
        };
        
        scanForRegistry(data);

        if (registry && registry.length > 0) {
          setAllRegisteredTeachers(registry);
          localStorage.setItem('ssemj_registered_teachers', JSON.stringify(registry));
          
          // If a teacher is logged in, update their profile with fresh data from the registry
          if (user && user.role === UserRole.GURU) {
            const freshData = registry.find((t: any) => {
              const tid = String(t.id || t.login || t.loginid || t.login_id || t["LOGIN ID"] || t["Login ID"] || t["ID"] || t["LOGIN"] || t["No IC"] || t["NO IC"] || t.ic || "").trim().toLowerCase();
              return tid === String(user.id || "").trim().toLowerCase();
            });
            
            if (freshData) {
              const department = String(
                freshData.bidang || 
                freshData.department || 
                freshData.unit || 
                freshData["BIDANG"] || 
                freshData["UNIT"] || 
                user.department ||
                ""
              ).trim();

              const updatedUser: UserProfile = {
                ...user,
                name: String(freshData.namaguru || freshData.nama_guru || freshData.name || freshData["NAMA GURU"] || freshData["Nama Guru"] || freshData["NAMA"] || freshData["Nama"] || freshData["NAMA PENUH"] || freshData["Nama Penuh"] || user.name).trim(),
                email: freshData.email || freshData.emel || user.email || "",
                phone: freshData.phone || freshData.no_tel || user.phone || "",
                department: department,
                grade: freshData.grade || freshData.gred || user.grade || "",
                photoUrl: getDirectImageUrl(
                  freshData.gambar || 
                  freshData.photo || 
                  freshData["GAMBAR"] || 
                  freshData["Gambar"] || 
                  freshData["PHOTO"] || 
                  freshData["Photo"] || 
                  freshData["URL FOTO"] || 
                  freshData["Url Foto"] || 
                  user.photoUrl ||
                  ""
                )
              };
              
              // Only update if there's an actual change to avoid unnecessary re-renders
              if (JSON.stringify(updatedUser) !== JSON.stringify(user)) {
                setUser(updatedUser);
                localStorage.setItem('ssemj_user', JSON.stringify(updatedUser));
              }
            }
          }
        }
        
        if (data.schedules) {
          // If the cloud has schedules, merge or overwrite local ones
          // For "Individu", we might want to keep other teachers' schedules if they were already there
          // but prioritize cloud data for the current user
          const cloudSchedules: ScheduleSlot[] = data.schedules;
          setMasterSchedule(prev => {
            const otherTeachersSchedules = prev.filter(s => s.teacherId !== user?.id);
            const myCloudSchedules = cloudSchedules.filter(s => s.teacherId === user?.id);
            const next = [...otherTeachersSchedules, ...myCloudSchedules];
            localStorage.setItem('ssemj_master_schedule', JSON.stringify(next));
            return next;
          });
        }

        if (data.notifications) {
          // Sort notifications: latest first with robust date parsing
          const sortedNotifications = data.notifications
            .filter((n: AppNotification) => !n.recipientId || n.recipientId === user?.id)
            .map((n: AppNotification) => {
              const stableId = `${n.timestamp}_${n.senderId}`;
              return {
                ...n,
                read: n.read || readNotifIds.includes(n.id) || readNotifIds.includes(stableId)
              };
            })
            .sort((a: AppNotification, b: AppNotification) => {
              const timeA = new Date(a.timestamp).getTime();
              const timeB = new Date(b.timestamp).getTime();
              if (isNaN(timeA) && isNaN(timeB)) return 0;
              if (isNaN(timeA)) return 1;
              if (isNaN(timeB)) return -1;
              return timeB - timeA;
            });
          setNotifications(sortedNotifications);
        }
        
        if (data.bundles || (secondaryData && secondaryData.bundles)) {
          const bundleMap = new Map<string, WeeklyBundle>();
          const allBundles = [...(data.bundles || []), ...(secondaryData?.bundles || [])];
          
          for (const rawBundle of allBundles) {
            // Helper to find the first truthy value for a set of possible keys (case-insensitive) in order of preference
            const getTruthyValue = (keys: string[]) => {
              const rawKeys = Object.keys(rawBundle);
              for (const searchKey of keys) {
                const foundKey = rawKeys.find(k => k.trim().toUpperCase() === searchKey);
                if (foundKey && rawBundle[foundKey]) {
                  return rawBundle[foundKey];
                }
              }
              return "";
            };

            const finalLink = getTruthyValue(['LINKPDFSELESAI', 'URL_PDF', 'URL PDF', 'URL_PDF_SELESAI']);
            const comment = getTruthyValue(['ULASAN PENYEMAK', 'ULASAN', 'COMMENT']);
            const signature = getTruthyValue(['TANDATANGAN PENYEMAK', 'SIGNATURE']);
            const reviewedBy = getTruthyValue(['DISEMAK OLEH', 'REVIEWER', 'REVIEWEDBY']);
            const status_proses = getTruthyValue(['REKOD SEMAKAN', 'REKOD_SEMAKAN', 'STATUS_PROSES', 'STATUS PROSES', 'STATUS']);
            const id_minggu = getTruthyValue(['ID_MINGGU', 'ID MINGGU', 'ID_REKOD', 'ID REKOD']);

            const bundle = {
              ...rawBundle,
              id_minggu: id_minggu || rawBundle.id_minggu,
              linkPdfSelesai: finalLink || rawBundle.linkPdfSelesai,
              comment: comment || rawBundle.comment,
              signature: signature || rawBundle.signature,
              reviewedBy: reviewedBy || rawBundle.reviewedBy,
              status_proses: status_proses || rawBundle.status_proses
            };
            
            // Check if this bundle is in our local "just reviewed" cache
            const isLocallyReviewed = locallyReviewedIds.has(bundle.id_minggu);
            const effectiveStatus = isLocallyReviewed ? 'DISEMAK' : bundle.status_proses;
            
            // If the server finally caught up, we can remove it from local cache
            if (isLocallyReviewed && bundle.status_proses === 'DISEMAK') {
              setLocallyReviewedIds(prev => {
                const next = new Set(prev);
                next.delete(bundle.id_minggu);
                return next;
              });
            }

            const existing = bundleMap.get(bundle.id_minggu);
            if (!existing) {
              bundleMap.set(bundle.id_minggu, { ...bundle, status_proses: effectiveStatus });
            } else {
              // Priority: linkPdfSelesai > DISEMAK > newer timestamp
              const hasLink = bundle.linkPdfSelesai && bundle.linkPdfSelesai.trim() !== "";
              const existingHasLink = existing.linkPdfSelesai && existing.linkPdfSelesai.trim() !== "";

              if (hasLink && !existingHasLink) {
                bundleMap.set(bundle.id_minggu, { ...bundle, status_proses: effectiveStatus });
              } else if (effectiveStatus === 'DISEMAK' && existing.status_proses !== 'DISEMAK') {
                bundleMap.set(bundle.id_minggu, { ...bundle, status_proses: effectiveStatus });
              } else if (effectiveStatus === existing.status_proses) {
                if (new Date(bundle.timestamp) > new Date(existing.timestamp)) {
                  bundleMap.set(bundle.id_minggu, { ...bundle, status_proses: effectiveStatus });
                }
              }
            }
          }

          const processedBundles = Array.from(bundleMap.values()).map((b: WeeklyBundle) => ({
            ...b,
            activePdfUrl: b.linkPdfSelesai && b.linkPdfSelesai.trim() !== "" 
              ? b.linkPdfSelesai 
              : (b.jana_url || b.pdfBase64)
          }));
          setBundles(processedBundles);
        }
        setSyncStatus('IDLE');
      } else {
        console.error("Sync returned non-success status:", data);
        setSyncStatus('OFFLINE');
      }
    } catch (error: any) { 
      console.error("Sync Error:", error);
      setSyncStatus('OFFLINE'); 
    }
  }, [user, readNotifIds, locallyReviewedIds]);

  useEffect(() => {
    const savedUser = localStorage.getItem('ssemj_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setView(parsedUser.role === UserRole.ADMIN ? 'ADMIN' : 'DASHBOARD');
    }
    
    const savedApiKey = localStorage.getItem('groq_api_key');
    if (savedApiKey) {
      setGroqApiKey(savedApiKey);
    }
  }, []);

  useEffect(() => {
    handleSyncCloud();
  }, [user, handleSyncCloud]);

  useEffect(() => {
    const hasUnappliedRead = notifications.some(n => {
      const stableId = `${n.timestamp}_${n.senderId}`;
      return !n.read && (readNotifIds.includes(n.id) || readNotifIds.includes(stableId));
    });
    if (hasUnappliedRead) {
      setNotifications(prev => prev.map(n => {
        const stableId = `${n.timestamp}_${n.senderId}`;
        return {
          ...n,
          read: n.read || readNotifIds.includes(n.id) || readNotifIds.includes(stableId)
        };
      }));
    }
  }, [notifications, readNotifIds]);

  const handleSaveERPH = async (data: ERPHData) => {
    const updated = [...allErphs];
    const idx = updated.findIndex(e => e.id === data.id);
    if (idx > -1) updated[idx] = data; else updated.push(data);
    setAllErphs(updated);
    setSyncStatus('SYNCING');
    try {
      // Strip reviewSignature from payload to prevent GAS from saving it as a separate file
      const { reviewSignature, ...payloadData } = data;
      await fetch(GAS_WEB_APP_URL, {
        method: 'POST', 
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payloadData, logType: "RPH_RECORD" })
      });
      setSyncStatus('IDLE');
      setTimeout(handleSyncCloud, 1500);
    } catch (err) { setSyncStatus('OFFLINE'); }
  };

  const handleDeleteERPH = async (id: string) => {
    const erphToDelete = allErphs.find(e => e.id === id);
    if (!erphToDelete) return;

    const updated = allErphs.filter(e => e.id !== id);
    setAllErphs(updated);
    setSyncStatus('SYNCING');
    try {
      // Since we don't know if the backend supports DELETE_RPH action,
      // we overwrite the record with a DELETED status so it gets filtered out.
      await fetch(GAS_WEB_APP_URL, {
        method: 'POST', 
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...erphToDelete, status: 'DELETED', logType: "RPH_RECORD" })
      });
      setSyncStatus('IDLE');
      setTimeout(handleSyncCloud, 1500);
    } catch (err) { setSyncStatus('OFFLINE'); }
  };

  const handleSaveGroqApiKey = (apiKey: string) => {
    setGroqApiKey(apiKey);
    localStorage.setItem('groq_api_key', apiKey);
  };

  const handleBulkSubmitWeek = async (week: number, existingPdfBase64?: string) => {
    if (!user) return;
    const weekRPHs = allErphs.filter(e => e.teacherId === user.id && e.week === week);
    if (weekRPHs.length === 0) return;

    setIsProcessingBundle(true);
    try {
      const id_minggu = `M${week}_${user.id}_${Date.now()}`;
      const payload = {
        logType: "WEEKLY_SUBMISSION",
        action: "submit",
        teacherName: user.name,
        teacherId: user.id,
        week: `Minggu ${week}`,
        id_minggu: id_minggu,
        rphIds: JSON.stringify(weekRPHs.map(r => r.id)),
        pdfBase64: existingPdfBase64,
        
        // Explicit column mappings (Kolum A-G)
        "Timestamp": new Date().toLocaleString('ms-MY'),
        "Guru": user.name,
        "Minggu": `Minggu ${week}`,
        "ID_minggu": id_minggu,
        "Status Column": "DIHANTAR",
        "Jana_URL": "", // Script will fill this with Drive URL
        "ID_Guru": user.id,
        
        // Sheet name hints for the script
        "sheetName": "Hantaran_Mingguan",
        "targetSheet": "Hantaran_Mingguan"
      };
      
      console.log(`[SUBMIT] Menghantar draf PDF Minggu ${week} ke kedua-dua GAS...`);
      
      // Send to SECONDARY first (Ultimate Fix script)
      const secondaryPromise = fetch(SECONDARY_GAS_URL, {
        method: 'POST', 
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(e => console.error("Secondary GAS failed:", e));

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send to PRIMARY
      const primaryPromise = fetch(GAS_WEB_APP_URL, {
        method: 'POST', 
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(e => console.error("Primary GAS failed:", e));

      await Promise.all([secondaryPromise, primaryPromise]);
      setAllErphs(prev => prev.map(e => weekRPHs.some(wr => wr.id === e.id) ? { ...e, status: ERPHStatus.SELESAI } : e));
      setTimeout(handleSyncCloud, 3000); 
      showNotification(`✅ Minggu ${week} telah berjaya dihantar!`, 'success');
      setView('DASHBOARD');
      setPreviewErphs([]);
    } catch (e: any) { 
      console.error("Submission Error:", e);
    } finally { 
      setIsProcessingBundle(false); 
    }
  };

  const handleReviewBundle = (bundleId: string, status: string, comment: string, signature: string, reviewedBy: string, reviewedPdfBase64?: string) => {
    const bundle = bundles.find(b => b.id_minggu === bundleId);
    
    // Optimistic update for UI
    if (status === "DISEMAK") {
      // Add to local cache to prevent reappearing during slow sync
      setLocallyReviewedIds(prev => new Set(prev).add(bundleId));

      if (bundle) {
        let rphIds: string[] = [];
        try {
          rphIds = JSON.parse(bundle.rphIds || "[]");
        } catch (e) {
          if (typeof bundle.rphIds === 'string') {
            rphIds = bundle.rphIds.split(',').map(id => id.trim());
          }
        }

        if (rphIds.length === 0) {
          const weekMatch = String(bundle.week).match(/\d+/);
          const weekNum = weekMatch ? parseInt(weekMatch[0], 10) : null;
          if (weekNum !== null) {
            setAllErphs(prev => prev.map(e => {
              const eWeekMatch = String(e.week).match(/\d+/);
              const eWeekNum = eWeekMatch ? parseInt(eWeekMatch[0], 10) : null;
              return (String(e.teacherName || "").trim().toLowerCase() === String(bundle.teacherName).trim().toLowerCase() && eWeekNum === weekNum)
                ? { ...e, status: ERPHStatus.REVIEWED, reviewComment: comment, reviewSignature: signature, reviewedBy: reviewedBy } 
                : e;
            }));
          }
        } else {
          setAllErphs(prev => prev.map(e => rphIds.includes(e.id) ? { 
            ...e, 
            status: ERPHStatus.REVIEWED, 
            reviewComment: comment, 
            reviewSignature: signature, 
            reviewedBy: reviewedBy 
          } : e));
        }
        
        // Also update bundles state locally so it disappears from "Pending" immediately
        setBundles(prev => prev.map(b => b.id_minggu === bundleId ? { ...b, status_proses: "DISEMAK" } : b));

        if (bundle.teacherId) {
          sendDirectNotification(`RPH anda untuk Minggu ${bundle.week} telah disemak dan disahkan oleh ${reviewedBy}.`, bundle.teacherId, 'SYSTEM');
        }
      }
    }

    // Add to background queue with metadata for secondary script
    setReviewQueue(prev => [...prev, { 
      bundleId, 
      status, 
      comment, 
      signature, 
      reviewedBy, 
      reviewedPdfBase64,
      teacherName: bundle?.teacherName || "",
      week: bundle?.week || "",
      teacherId: bundle?.teacherId || ""
    }]);
  };

  // Background Queue Processor
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessingQueue || reviewQueue.length === 0) return;

      setIsProcessingQueue(true);
      const task = reviewQueue[0];

      try {
        const pdfBase64 = task.reviewedPdfBase64 || "";
        const pdfSize = pdfBase64.length;
        const pdfSizeKB = Math.round(pdfSize / 1024);
        console.log(`[QUEUE] Memproses hantaran: ${task.bundleId} (Saiz PDF: ${pdfSizeKB}KB) (${reviewQueue.length} baki)`);
        setSyncStatus('SYNCING');
        
        // Send to BOTH scripts to ensure redundancy and sheet updates
        const bundle = bundles.find(b => b.id_minggu === task.bundleId);
        const payload = { 
          logType: "BUNDLE_REVIEW", 
          action: "review",
          id_minggu: task.bundleId, 
          id: task.bundleId,
          ID_Minggu: task.bundleId,
          method: "review",
          status: task.status, 
          status_proses: task.status,
          comment: task.comment, 
          signature: task.signature, 
          reviewedBy: task.reviewedBy,
          teacherName: task.teacherName,
          week: task.week,
          teacherId: task.teacherId,
          rphIds: bundle?.rphIds || "[]",
          reviewedPdfBase64: task.reviewedPdfBase64, // Added for secondary script
          URL_PDF: task.reviewedPdfBase64, // Added for secondary script
          sheetName: "Copy of Hantaran_Mingguan",
          // Explicit column mapping for scripts that use header-based matching
          "rekod semakan": task.status,
          "Ulasan Penyemak": task.comment,
          "tandatangan penyemak": task.signature,
          "Disemak oleh": task.reviewedBy,
          // Alternative keys used in some script versions
          "ulasan": task.comment,
          "reviewer": task.reviewedBy
        };

        // 1. Send Metadata and Full PDF to BOTH scripts
        console.log(`[QUEUE] Menghantar data semakan dan PDF ke kedua-dua GAS...`);
        const secondaryPromise = fetch(SECONDARY_GAS_URL, {
          method: 'POST', 
          mode: 'no-cors', 
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        // Small delay to prevent simultaneous spreadsheet access
        await new Promise(resolve => setTimeout(resolve, 1000));

        const primaryPromise = fetch(GAS_WEB_APP_URL, {
          method: 'POST', 
          mode: 'no-cors', 
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        await Promise.all([secondaryPromise, primaryPromise]);

        console.log(`[QUEUE] Berjaya dihantar ke kedua-dua GAS: ${task.bundleId}`);
        
        // Remove completed task
        setReviewQueue(prev => prev.slice(1));
        
        // Sync cloud after whole queue is processed with a safe delay
        if (reviewQueue.length === 1) {
          console.log(`[QUEUE] Semua tugasan selesai. Menunggu 8s sebelum sync...`);
          setTimeout(() => {
            setIsProcessingQueue(false);
            setSyncStatus('IDLE');
            handleSyncCloud();
          }, 8000);
        } else {
          console.log(`[QUEUE] Menunggu 5s sebelum hantaran seterusnya untuk mengelakkan had GAS...`);
          setTimeout(() => {
            setIsProcessingQueue(false);
            setSyncStatus('IDLE');
          }, 5000);
        }
      } catch (e) {
        console.error("[QUEUE] Ralat pemprosesan:", e);
        setReviewQueue(prev => prev.slice(1));
        setIsProcessingQueue(false);
        setSyncStatus('IDLE');
      }
    };

    processQueue();
  }, [reviewQueue, isProcessingQueue, handleSyncCloud, bundles]);

  const handleSyncMaster = async (updated: MasterData) => {
    setSyncStatus('SYNCING');
    try {
      await fetch(GAS_WEB_APP_URL, {
        method: 'POST', 
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ logType: "MASTER_DATA_UPDATE", masterData: updated })
      });
      setSyncStatus('IDLE');
      setTimeout(handleSyncCloud, 1500);
      return true;
    } catch(e) { setSyncStatus('OFFLINE'); return false; }
  };

  const handleUpdateTeacherPhoto = async (teacherId: string, photoBase64: string) => {
    // This function is now deprecated as users update their own photo URLs.
    // We can keep it for now in case admin override is needed later.
    console.log(`Admin photo update for ${teacherId} is deprecated.`);
  };

  const handleLogout = () => { 
    setUser(null); 
    setAdminUser(null);
    localStorage.removeItem('ssemj_user'); 
    setAllErphs([]);
    setBundles([]);
    setNotifications([]);
    // Keep allRegisteredTeachers to avoid empty login screen
    setView('REGISTER'); 
  };

  const handleUpdateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    localStorage.setItem('ssemj_user', JSON.stringify(updatedUser));

    // Also update the master list of teachers if the user is a teacher
    setAllRegisteredTeachers(prev => {
      const updated = prev.map(t => t.id === user.id ? updatedUser : t);
      localStorage.setItem('ssemj_registered_teachers', JSON.stringify(updated));
      return updated;
    });

    // Background sync
    try {
      await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          logType: "UPDATE_PROFILE", // Match GAS Workflow 3
          login: data.id || user.id, // Column A
          name: data.name || user.name, // Column B
          photoUrl: data.photoUrl !== undefined ? data.photoUrl : user.photoUrl, // Column C
          department: data.department || user.department, // Column D
          email: data.email || user.email, // Column E
          phone: data.phone || user.phone, // Column F
          grade: data.grade || user.grade // Column G
        })
      });
    } catch (e) {
      console.error("Profile Sync Error", e);
    }
  };

  const handleShareERPH = async (erph: ERPHData, recipientId: string) => {
    const recipient = allTeachers.find(t => t.id === recipientId);
    if (!recipient) return;

    const sharedData: ERPHData = {
      ...erph,
      id: Math.random().toString(36).substr(2, 9),
      teacherId: recipient.id,
      teacherName: recipient.name,
      status: ERPHStatus.DRAFT,
    };

    setSyncStatus('SYNCING');
    try {
      await fetch(GAS_WEB_APP_URL, {
        method: 'POST', 
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...sharedData, logType: "RPH_RECORD" })
      });
      setSyncStatus('IDLE');
      setTimeout(handleSyncCloud, 1500);
    } catch (err) { 
      setSyncStatus('OFFLINE'); 
    }
  };

  const sendDirectNotification = async (message: string, recipientId: string, type: 'SYSTEM' | 'MESSAGE' = 'SYSTEM') => {
    if (!user) return;
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: user.id,
      senderName: user.name,
      message,
      timestamp: new Date().toISOString(),
      type,
      read: false,
      recipientId,
    };

    // If sending to self, update local state immediately
    if (recipientId === user.id) {
      setNotifications(prev => {
        const next = [newNotif, ...prev];
        return next.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          if (isNaN(timeA) && isNaN(timeB)) return 0;
          if (isNaN(timeA)) return 1;
          if (isNaN(timeB)) return -1;
          return timeB - timeA;
        });
      });
    }

    try {
      await fetch(GAS_WEB_APP_URL, {
        method: 'POST', 
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...newNotif, logType: "NOTIFICATION" })
      });
      // Optional: Sync again to confirm, but optimistic update is enough for UI
      setTimeout(handleSyncCloud, 1500); 
    } catch (err) { 
      console.error("Failed to send direct notification", err);
    }
  };

  const handleSendNotification = async (message: string) => {
    if (!user) return;
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: user.id,
      senderName: user.name,
      message,
      timestamp: new Date().toISOString(),
      type: user.role === UserRole.ADMIN ? 'ANNOUNCEMENT' : 'MESSAGE',
      read: false,
    };

    setNotifications(prev => {
      const next = [newNotif, ...prev];
      return next.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        if (isNaN(timeA) && isNaN(timeB)) return 0;
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeB - timeA;
      });
    });
    setSyncStatus('SYNCING');
    try {
      await fetch(GAS_WEB_APP_URL, {
        method: 'POST', 
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...newNotif, logType: "NOTIFICATION" })
      });
      setSyncStatus('IDLE');
      // Optional: Sync again to confirm, but optimistic update is enough for UI
      setTimeout(handleSyncCloud, 1500); 
    } catch (err) { 
      setSyncStatus('OFFLINE'); 
      // Optional: Implement rollback on failure
      // setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
    }
  };

  const handleAddResource = async (resource: Omit<Resource, 'id' | 'uploadedAt'>) => {
    const newResource: Resource = {
      ...resource,
      id: Math.random().toString(36).substr(2, 9),
      uploadedAt: new Date().toISOString(),
      uploaderId: user?.id
    };

    const updatedResources = [newResource, ...masterData.resources];
    setMasterData(prev => ({ ...prev, resources: updatedResources }));

    // Background sync - HANYA kemaskini Resources
    try {
      setSyncStatus('SYNCING');
      await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          logType: "RESOURCE_UPDATE", 
          resources: updatedResources 
        })
      });
      setSyncStatus('IDLE');
    } catch (e) {
      console.error("Add Resource Error", e);
      setSyncStatus('OFFLINE');
    }
  };

  const handleDeleteResource = async (id: string) => {
    const updatedResources = masterData.resources.filter(r => r.id !== id);
    setMasterData(prev => ({ ...prev, resources: updatedResources }));

    // Background sync - HANYA kemaskini Resources
    try {
      setSyncStatus('SYNCING');
      await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          logType: "RESOURCE_UPDATE", 
          resources: updatedResources 
        })
      });
      setSyncStatus('IDLE');
    } catch (e) {
      console.error("Delete Resource Error", e);
      setSyncStatus('OFFLINE');
    }
  };


  const handleMarkAsRead = (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (!notif) return;
    
    const stableId = `${notif.timestamp}_${notif.senderId}`;

    setReadNotifIds(prev => {
      if (prev.includes(id) || prev.includes(stableId)) return prev;
      const next = [...prev, id, stableId];
      if (user) {
        localStorage.setItem(`ssemj_read_notifs_${user.id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout} 
      setView={(v) => setView(v as any)} 
      onUpdateProfile={handleUpdateProfile} 
      notifications={notifications}
      adminUser={adminUser}
      onReturnToAdmin={() => {
        if (adminUser) {
          setUser(adminUser);
          setAdminUser(null);
          setView('ADMIN');
          setNotification({
            message: `Kembali ke Admin Dashboard`,
            type: 'info'
          });
          setTimeout(() => setNotification(null), 3000);
        }
      }}
    >
      {isProcessingBundle && (
        <div className="fixed inset-0 z-[700] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="p-12 bg-white rounded-[3rem] shadow-2xl flex flex-col items-center text-center max-w-sm">
            <Loader2 className="animate-spin text-blue-600 mb-6" size={48} />
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Menghantar...</h3>
            <p className="text-slate-400 font-bold mt-2 uppercase text-[9px] tracking-widest">Sila tunggu sebentar...</p>
          </div>
        </div>
      )}

      {reviewQueue.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[600] animate-slideUp">
          <div className="bg-white p-4 rounded-2xl shadow-2xl border border-blue-100 flex items-center gap-4 min-w-[280px]">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Loader2 className="animate-spin" size={20} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Menyimpan Semakan...</p>
              <div className="w-full h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-500" 
                  style={{ width: `${(1 / (reviewQueue.length + 1)) * 100}%` }}
                ></div>
              </div>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-widest">
                {reviewQueue.length} hantaran dalam barisan
              </p>
            </div>
          </div>
        </div>
      )}

      <React.Suspense fallback={<div className="flex items-center justify-center h-[80vh]"><Loader2 className="animate-spin w-12 h-12 text-blue-600" /></div>}>
      {view === 'REGISTER' && (
        <Register 
          teachers={allTeachers}
          isLoading={syncStatus === 'SYNCING'}
          isOffline={syncStatus === 'OFFLINE'}
          onSync={handleSyncCloud}
          onSelectRole={(role, teacherProfile) => {
            if (role === UserRole.GURU && teacherProfile) {
              setUser(teacherProfile);
              localStorage.setItem('ssemj_user', JSON.stringify(teacherProfile));
              setView('DASHBOARD');
            } else {
              const newUser: UserProfile = {
                id: role === UserRole.ADMIN ? 'admin-1' : 'teacher-1',
                name: role === UserRole.ADMIN ? 'Pentadbir SSEMJ' : 'Guru SSEMJ',
                email: '',
                phone: '',
                role: role,
                designation: role === UserRole.ADMIN ? 'Pentadbir' : 'Guru Akademik',
                department: role === UserRole.ADMIN ? 'Pentadbiran' : 'Bidang Kesenian',
                grade: 'DG41',
                photoUrl: "",
              };
              setUser(newUser);
              localStorage.setItem('ssemj_user', JSON.stringify(newUser));
              setView(role === UserRole.ADMIN ? 'ADMIN' : 'DASHBOARD');
            }
          }} 
        />
      )}

      {user && view === 'DASHBOARD' && (
        <TeacherDashboard 
          user={user} 
          adminUser={adminUser}
          erphs={allErphs.filter(e => 
            (String(e.teacherId || "").trim().toLowerCase() === String(user.id || "").trim().toLowerCase()) ||
            (String(e.teacherName || "").trim().toLowerCase() === String(user.name || "").trim().toLowerCase())
          )} 
          bundles={bundles.filter(b => 
            (String(b.teacherId || "").trim().toLowerCase() === String(user.id || "").trim().toLowerCase()) ||
            (String(b.teacherName || "").trim().toLowerCase() === String(user.name || "").trim().toLowerCase())
          )}
          teachers={allTeachers}
          masterSchedule={masterSchedule}
          masterData={masterData}
          onAddNew={() => { setEditingErph(null); setView('FORM'); }}
          onEdit={(erph) => { setEditingErph(erph); setView('FORM'); }}
          onCopy={(erph) => { setEditingErph({ ...erph, id: Math.random().toString(36).substr(2, 9), status: ERPHStatus.DRAFT }); setView('FORM'); }}
          onView={(erph) => { setPreviewErphs([erph]); setView('PREVIEW'); }}
          onShare={handleShareERPH}
          onDelete={handleDeleteERPH}
          onViewWeek={(week) => {
            const weekRPHs = allErphs.filter(e => 
              ((String(e.teacherId || "").trim().toLowerCase() === String(user.id || "").trim().toLowerCase()) ||
               (String(e.teacherName || "").trim().toLowerCase() === String(user.name || "").trim().toLowerCase())) && 
              e.week === week
            );
            setPreviewErphs(weekRPHs);
            setView('PREVIEW');
          }}
          onBulkSubmit={handleBulkSubmitWeek}
          onSync={handleSyncCloud}
          syncStatus={syncStatus}
          onAddResource={handleAddResource}
          onDeleteResource={handleDeleteResource}
          onSelectScheduleSlot={(slot) => {
            // 1. Find the latest unsubmitted week
            const submittedWeekNums = bundles.map(b => {
              const m = b.week.match(/\d+/);
              return m ? parseInt(m[0]) : 0;
            });
            const latestUnsubmittedWeek = WEEKS.find(w => !submittedWeekNums.includes(w)) || 1;

            // 2. Try to find a reference date for this week
            let targetDate = new Date().toISOString().split('T')[0];
            const daysMap: Record<string, number> = { 'ISNIN': 1, 'SELASA': 2, 'RABU': 3, 'KHAMIS': 4, 'JUMAAT': 5, 'SABTU': 6, 'AHAD': 0 };
            const targetDayIdx = daysMap[slot.day?.toUpperCase() || 'ISNIN'];

            // Find any RPH as a reference to calculate the date for the target week
            const sortedRPHs = [...allErphs].sort((a, b) => b.week - a.week);
            if (sortedRPHs.length > 0) {
              const refRPH = sortedRPHs[0];
              const refDate = new Date(refRPH.date + 'T12:00:00');
              const refDayIdx = daysMap[refRPH.day?.toUpperCase() || 'ISNIN'];
              
              const weekDiff = latestUnsubmittedWeek - refRPH.week;
              const dayDiff = targetDayIdx - refDayIdx;
              refDate.setDate(refDate.getDate() + (weekDiff * 7) + dayDiff);
              targetDate = refDate.toISOString().split('T')[0];
            } else {
              // If no RPHs at all, use today as a reference for the current week
              // This is a fallback and might not be perfectly accurate without a school calendar start date
              const today = new Date();
              const todayDayIdx = today.getDay();
              const dayDiff = targetDayIdx - todayDayIdx;
              today.setDate(today.getDate() + dayDiff);
              targetDate = today.toISOString().split('T')[0];
            }

            setEditingErph({
              ...slot,
              id: Math.random().toString(36).substr(2, 9),
              week: latestUnsubmittedWeek,
              date: targetDate,
              status: ERPHStatus.DRAFT,
              objective: '',
              activities: '',
              reflection: '',
              language: 'BM',
              bbm: 'Buku Teks'
            } as ERPHData);
            setView('FORM');
          }}
          onNavigate={(v) => setView(v as any)}
          notifications={notifications}
        />
      )}

      {user && view === 'FORM' && (
        <ERPHForm 
          user={user} 
          masterData={masterData} 
          erphs={allErphs}
          masterSchedule={masterSchedule}
          initialData={editingErph || undefined}
          onSave={handleSaveERPH}
          onCancel={() => setView('DASHBOARD')}
          groqApiKey={groqApiKey}
        />
      )}

      {user && view === 'ADMIN' && (
        <AdminDashboard 
          user={user}
          teachers={allTeachers} // Pass the generated teachers list
          erphs={allErphs}
          bundles={bundles}
          masterData={masterData}
          setMasterData={setMasterData}
          onReview={(id, status, comment, signature) => {
            const erph = allErphs.find(e => e.id === id);
            if (erph) handleSaveERPH({ ...erph, status, reviewComment: comment, reviewSignature: signature, reviewedAt: new Date().toISOString() });
          }}
          onReviewBundle={handleReviewBundle}
          onSyncMaster={handleSyncMaster}
          onRefresh={handleSyncCloud}
          onLogout={handleLogout} // Pass the handleLogout function
          onNavigate={(v) => setView(v as any)}
          onAddResource={handleAddResource}
          onDeleteResource={handleDeleteResource}
          onLoginAsTeacher={(teacher) => {
            // Save the current admin user
            setAdminUser(user);
            // Set the user to the selected teacher
            setUser(teacher);
            // Change view to teacher dashboard
            setView('DASHBOARD');
            // Show a notification
            setNotification({
              message: `Anda kini log masuk sebagai ${teacher.name}`,
              type: 'info'
            });
            setTimeout(() => setNotification(null), 3000);
          }}
        />
      )}

      {user && view === 'PREVIEW' && (
        <ERPHPreview 
          erphs={previewErphs} 
          onBack={() => setView('DASHBOARD')}
          onSubmit={(week, pdfBase64) => handleBulkSubmitWeek(week, pdfBase64)}
        />
      )}

      {user && view === 'SETTINGS' && (
        <Settings 
          groqApiKey={groqApiKey}
          onSaveApiKey={handleSaveGroqApiKey}
          onBack={() => setView(user.role === UserRole.ADMIN ? 'ADMIN' : 'DASHBOARD')}
        />
      )}

      {user && view === 'ANALYSIS' && (
        <Analysis 
          teachers={allTeachers}
          bundles={bundles}
          onBack={() => setView(user.role === UserRole.ADMIN ? 'ADMIN' : 'DASHBOARD')}
        />
      )}

      {user && view === 'CHAT' && (
        <Notifications 
          user={user}
          notifications={notifications}
          onSend={handleSendNotification}
          onRead={handleMarkAsRead}
          onBack={() => setView(user.role === UserRole.ADMIN ? 'ADMIN' : 'DASHBOARD')}
        />
      )}

      {user && view === 'TIMETABLE' && (
        <Timetable 
          user={user}
          schedule={masterSchedule}
          erphs={allErphs}
          masterData={masterData}
          onAddSlot={(slot) => {
            const next = [...masterSchedule, slot];
            setMasterSchedule(next);
            localStorage.setItem('ssemj_master_schedule', JSON.stringify(next));
            handleSaveSchedule(next.filter(s => s.teacherId === user.id));
          }}
          onDeleteSlot={(id) => {
            const next = masterSchedule.filter(s => s.id !== id);
            setMasterSchedule(next);
            localStorage.setItem('ssemj_master_schedule', JSON.stringify(next));
            handleSaveSchedule(next.filter(s => s.teacherId === user.id));
          }}
          onSelectSlot={(slot) => {
            setEditingErph({
              ...slot,
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString().split('T')[0],
              status: ERPHStatus.DRAFT,
              objective: '',
              activities: '',
              reflection: '',
              language: 'BM',
              bbm: 'Buku Teks'
            } as ERPHData);
            setView('FORM');
          }}
          onBack={() => setView(user.role === UserRole.ADMIN ? 'ADMIN' : 'DASHBOARD')}
        />
      )}

      {user && view === 'PENCERAPAN' && (
        <Pencerapan 
          user={user}
          teachers={allTeachers}
          erphs={allErphs}
          onBack={() => setView('ADMIN')}
          onSubmitObservation={(erphId, status, comment, signature, reviewerName, reviewerDesignation, isObservation) => {
            const erph = allErphs.find(e => e.id === erphId);
            if (erph) {
              const updatedErph = { ...erph, status };
              
              if (isObservation) {
                updatedErph.isObservation = true;
                updatedErph.observationComment = comment;
                updatedErph.observationSignature = signature;
                updatedErph.observedBy = reviewerName;
                updatedErph.observerDesignation = reviewerDesignation;
                updatedErph.observedAt = new Date().toISOString();
              } else {
                updatedErph.reviewComment = comment;
                updatedErph.reviewSignature = signature;
                updatedErph.reviewedBy = reviewerName;
                updatedErph.reviewerDesignation = reviewerDesignation;
                updatedErph.reviewedAt = new Date().toISOString();
              }

              handleSaveERPH(updatedErph);

              if (erph.teacherId) {
                const notifMsg = isObservation 
                  ? `RPH anda pada ${erph.date} telah dicerap oleh ${reviewerName}.`
                  : `RPH anda pada ${erph.date} telah disemak oleh ${reviewerName}.`;
                sendDirectNotification(notifMsg, erph.teacherId, 'SYSTEM');
              }
            }
          }}
        />
      )}

      {user && view === 'REKOD_PENCERAPAN' && (
        <RekodPencerapan 
          user={user}
          erphs={allErphs}
          teachers={allTeachers}
          onBack={() => setView(user.role === UserRole.ADMIN ? 'ADMIN' : 'DASHBOARD')}
          onView={(erph) => { setPreviewErphs([erph]); setView('PREVIEW'); }}
        />
      )}

      {user && view === 'MASTER_DATA_MANAGER' && (
        <MasterDataManager 
          masterData={masterData}
          onSave={async (newData) => {
            const success = await handleSyncMaster(newData);
            if (success) {
              setMasterData(newData);
              localStorage.setItem('ssemj_master_data', JSON.stringify(newData));
              showNotification("Data Utama telah dikemaskini!", 'success');
            } else {
              showNotification("Gagal mengemaskini Data Utama ke awan.", 'error');
            }
          }}
          onBack={() => setView('ADMIN')}
        />
      )}
      </React.Suspense>

      <div ref={hiddenRenderRef} className="fixed left-[-9999px] top-[-9999px] opacity-0 pointer-events-none print:hidden">
        {previewErphs.length > 0 && <ERPHPreview erphs={previewErphs} onBack={() => {}} />}
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp border ${
          notification.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : 
          notification.type === 'error' ? 'bg-rose-500 text-white border-rose-400' : 
          'bg-slate-900 text-white border-slate-800'
        }`}>
          <span className="text-xs font-black uppercase tracking-widest">{notification.message}</span>
        </div>
      )}
    </Layout>
  );
};

export default App;