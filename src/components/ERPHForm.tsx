
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Groq from "groq-sdk";
import { UserProfile, ERPHData, ERPHStatus, MasterData, ScheduleSlot } from '../types';
import { WEEKS, LANGUAGES } from '../constants';
import { 
  Sparkles, X, Loader2, Database, Clock, Calendar, 
  Book, Send, ChevronRight, Languages, Edit3, 
  Layers, Target, Activity, PenTool, MessageSquare, Info, RefreshCw, CheckCircle, Eye, LayoutGrid
} from 'lucide-react';
import ERPHPreview from './ERPHPreview';

interface ERPHFormProps {
  user: UserProfile;
  onSave: (data: ERPHData) => void;
  onCancel: () => void;
  masterData: MasterData;
  erphs?: ERPHData[];
  masterSchedule?: ScheduleSlot[];
  initialData?: ERPHData;
  groqApiKey: string | null;
}

const ERPHForm: React.FC<ERPHFormProps> = ({ user, onSave, onCancel, masterData, erphs = [], masterSchedule = [], initialData, groqApiKey }) => {
  const bbmOptions = masterData.bbmOptions || [
    'Buku Teks',
    'Nota',
    'Latihan',
    'Slide',
    'Komputer',
    'Lain-lain (nyatakan)'
  ];
  
  const parseInitialBbm = (bbmStr: string | undefined) => {
    if (!bbmStr) return { bbm: 'Buku Teks', custom: '' };
    const items = bbmStr.split(',').map(s => s.trim()).filter(Boolean);
    const standardItems: string[] = [];
    const customItems: string[] = [];
    
    items.forEach(item => {
      if (bbmOptions.includes(item) && item !== 'Lain-lain (nyatakan)') {
        standardItems.push(item);
      } else if (item === 'Lain-lain (nyatakan)') {
        standardItems.push(item);
      } else {
        customItems.push(item);
      }
    });

    if (customItems.length > 0 && !standardItems.includes('Lain-lain (nyatakan)')) {
      standardItems.push('Lain-lain (nyatakan)');
    }

    return {
      bbm: standardItems.length > 0 ? standardItems.join(', ') : 'Buku Teks',
      custom: customItems.join(', ')
    };
  };

  const [loading, setLoading] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const initialBbmParsed = parseInitialBbm(initialData?.bbm);
  const [customBbm, setCustomBbm] = useState(initialBbmParsed.custom);
  const [showPreview, setShowPreview] = useState(false);
  
  const filledWeeks = useMemo(() => {
    const weeks = new Set<number>();
    erphs.forEach(e => {
      if (e.teacherId === user.id) {
        weeks.add(Number(e.week));
      }
    });
    return weeks;
  }, [erphs, user.id]);

  const latestWeek = useMemo(() => {
    if (filledWeeks.size === 0) return 1;
    return Math.max(...Array.from(filledWeeks));
  }, [filledWeeks]);

  const [formData, setFormData] = useState<Partial<ERPHData>>(() => {
    const today = new Date();
    const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
    const defaults = {
      id: Math.random().toString(36).substr(2, 9),
      teacherId: user.id,
      teacherName: user.name,
      week: 1, // Will be updated by useEffect if not initialData
      date: today.toISOString().split('T')[0],
      day: days[today.getDay()],
      startTime: '08:00',
      endTime: '09:00',
      className: '',
      classTitle: '',
      subject: '',
      title: '',
      field: '',
      sk: '',
      sp: '',
      core: '',
      language: 'BM' as 'BM' | 'BI',
      status: ERPHStatus.DRAFT,
      bbm: 'Buku Teks',
      objective: '',
      activities: '',
      reflection: ''
    };

    const cleanInitialData: Partial<ERPHData> = {};
    if (initialData && typeof initialData === 'object') {
      for (const key in initialData) {
        const k = key as keyof ERPHData;
        const value = initialData[k];
        if (typeof value === 'string' || typeof value === 'number') {
          (cleanInitialData as any)[k] = value;
        }
      }
    }

    const combinedData = { ...defaults, ...cleanInitialData };

    if (combinedData.date) {
      const dateObj = new Date(combinedData.date + 'T12:00:00');
      const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
      combinedData.day = days[dateObj.getDay()];
    }

    const parsedBbm = parseInitialBbm(combinedData.bbm);
    combinedData.bbm = parsedBbm.bbm;

    return combinedData;
  });

  const [availableForms, setAvailableForms] = useState<string[]>([]);
  const [availableClassTitles, setAvailableClassTitles] = useState<string[]>([]);
  const [availableTitles, setAvailableTitles] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [availableSKs, setAvailableSKs] = useState<string[]>([]);
  const [availableSPs, setAvailableSPs] = useState<string[]>([]);
  const [selectedSKs, setSelectedSKs] = useState<string[]>([]);
  const [selectedSPs, setSelectedSPs] = useState<string[]>([]);
  const [selectedCores, setSelectedCores] = useState<string[]>([]);

  const hierarchy = useMemo(() => masterData.hierarchy || {}, [masterData.hierarchy]);
  const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '').replace(/tingkatan/g, 't').trim();

  

  useEffect(() => {
    if (formData.subject) {
      if (hierarchy[formData.subject] && Object.keys(hierarchy[formData.subject]).length > 0) {
        setAvailableForms(Object.keys(hierarchy[formData.subject]).sort());
      } else if (masterData.classes && Object.keys(masterData.classes).length > 0) {
        setAvailableForms(Object.keys(masterData.classes).sort());
      } else {
        setAvailableForms([]);
      }
    } else {
      setAvailableForms([]);
    }
  }, [formData.subject, hierarchy, masterData.classes]);

  useEffect(() => {
    if (formData.className && masterData.classes) {
      const normalizedSelectedForm = normalize(formData.className);
      const levelKey = Object.keys(masterData.classes).find(k => {
        const normalizedKey = normalize(k);
        if (normalizedKey === normalizedSelectedForm) return true;
        const num1 = k.match(/\d+/);
        const num2 = formData.className?.match(/\d+/);
        return num1 && num2 && num1[0] === num2[0];
      });

      if (levelKey && masterData.classes[levelKey]) {
        setAvailableClassTitles(masterData.classes[levelKey]);
      } else {
        setAvailableClassTitles([]);
      }
    } else {
      setAvailableClassTitles([]);
    }
  }, [formData.className, masterData.classes]);

  useEffect(() => {
    if (formData.subject && formData.className && hierarchy[formData.subject]?.[formData.className]) {
      setAvailableTitles(Object.keys(hierarchy[formData.subject][formData.className]).sort());
    } else setAvailableTitles([]);
  }, [formData.subject, formData.className, hierarchy]);

  useEffect(() => {
    if (formData.subject && formData.className && formData.title) {
      const titles = formData.title.split('; ').filter(t => t.trim() !== '');
      const allFields = new Set<string>();
      titles.forEach(title => {
        const fieldsObj = hierarchy[formData.subject]?.[formData.className]?.[title];
        if (fieldsObj) {
          Object.keys(fieldsObj).forEach(f => allFields.add(f));
        }
      });
      setAvailableFields(Array.from(allFields).sort());
    } else setAvailableFields([]);
  }, [formData.subject, formData.className, formData.title, hierarchy]);

  useEffect(() => {
    if (formData.subject && formData.className && formData.title && formData.field) {
      const titles = formData.title.split('; ').filter(t => t.trim() !== '');
      const fields = formData.field.split('; ').filter(f => f.trim() !== '');
      const allSKs = new Set<string>();
      titles.forEach(title => {
        fields.forEach(field => {
          const sksObj = hierarchy[formData.subject]?.[formData.className]?.[title]?.[field];
          if (sksObj) {
            Object.keys(sksObj).forEach(sk => allSKs.add(sk));
          }
        });
      });
      setAvailableSKs(Array.from(allSKs).sort());
    } else setAvailableSKs([]);
  }, [formData.subject, formData.className, formData.title, formData.field, hierarchy]);

  useEffect(() => {
    if (formData.subject && formData.className && formData.title && formData.field && selectedSKs.length > 0) {
      const titles = formData.title.split('; ').filter(t => t.trim() !== '');
      const fields = formData.field.split('; ').filter(f => f.trim() !== '');
      const allSPs = new Set<string>();
      selectedSKs.forEach(sk => {
        titles.forEach(title => {
          fields.forEach(field => {
            const sps = hierarchy[formData.subject]?.[formData.className]?.[title]?.[field]?.[sk];
            if (sps) {
              Object.keys(sps).forEach(sp => allSPs.add(sp));
            }
          });
        });
      });
      setAvailableSPs(Array.from(allSPs).sort());
    } else {
      setAvailableSPs([]);
    }
  }, [formData.subject, formData.className, formData.title, formData.field, selectedSKs, hierarchy]);

  useEffect(() => {
    if (initialData?.sk) {
      const sks = initialData.sk.split('; ').filter(s => s.trim() !== '');
      setSelectedSKs(sks);
    }
    if (initialData?.sp) {
      const sps = initialData.sp.split('; ').filter(s => s.trim() !== '');
      setSelectedSPs(sps);
    }
  }, [initialData]);

  useEffect(() => {
    if (formData.subject && formData.className && formData.title && formData.field && selectedSKs.length > 0 && selectedSPs.length > 0) {
      const titles = formData.title.split('; ').filter(t => t.trim() !== '');
      const fields = formData.field.split('; ').filter(f => f.trim() !== '');
      const cores = new Set<string>();
      selectedSKs.forEach(sk => {
        selectedSPs.forEach(sp => {
          titles.forEach(title => {
            fields.forEach(field => {
              const core = hierarchy[formData.subject]?.[formData.className]?.[title]?.[field]?.[sk]?.[sp];
              if (core) cores.add(core);
            });
          });
        });
      });
      const uniqueCores = Array.from(cores).filter(c => c !== '');
      setSelectedCores(uniqueCores);
      setFormData(prev => ({ ...prev, core: uniqueCores.join('; ') || 'N/A' }));
    } else if (selectedSPs.length === 0) {
      setSelectedCores([]);
      setFormData(prev => ({ ...prev, core: 'N/A' }));
    }
  }, [selectedSPs, selectedSKs, hierarchy, formData.subject, formData.className, formData.title, formData.field]);

  useEffect(() => {
    if (!initialData && latestWeek > 1) {
      setFormData(prev => ({ ...prev, week: latestWeek }));
    }
  }, [latestWeek, initialData]);

  const handleFieldChange = (field: keyof ERPHData, value: string | number) => {
    const updates: any = { [field]: value };
    if (field === 'date') {
      const dateObj = new Date((value as string) + 'T12:00:00');
      const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
      updates.day = days[dateObj.getDay()];
    }
    else if (field === 'subject') { updates.className = ''; updates.classTitle = ''; updates.title = ''; updates.field = ''; updates.sk = ''; updates.sp = ''; updates.core = ''; setSelectedSKs([]); setSelectedSPs([]); }
    else if (field === 'className') { updates.classTitle = ''; updates.title = ''; updates.field = ''; updates.sk = ''; updates.sp = ''; updates.core = ''; setSelectedSKs([]); setSelectedSPs([]); }
    else if (field === 'title') { updates.field = ''; updates.sk = ''; updates.sp = ''; updates.core = ''; setSelectedSKs([]); setSelectedSPs([]); }
    else if (field === 'field') { updates.sk = ''; updates.sp = ''; updates.core = ''; setSelectedSKs([]); setSelectedSPs([]); }
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleAddSK = (sk: string) => {
    if (!sk) return;
    if (selectedSKs.includes(sk)) return;
    
    const newSKs = [...selectedSKs, sk];
    setSelectedSKs(newSKs);
    setFormData(prev => ({ ...prev, sk: newSKs.join('; ') }));
  };

  const handleRemoveSK = (sk: string) => {
    const newSKs = selectedSKs.filter(s => s !== sk);
    setSelectedSKs(newSKs);
    setFormData(prev => ({ ...prev, sk: newSKs.join('; ') }));
    
    const validSPs = new Set<string>();
    const titles = (formData.title || '').split('; ').filter(t => t.trim() !== '');
    const fields = (formData.field || '').split('; ').filter(f => f.trim() !== '');
    newSKs.forEach(k => {
      titles.forEach(title => {
        fields.forEach(field => {
          const sps = hierarchy[formData.subject]?.[formData.className]?.[title]?.[field]?.[k];
          if (sps) {
            Object.keys(sps).forEach(sp => validSPs.add(sp));
          }
        });
      });
    });
    
    const newSPs = selectedSPs.filter(sp => validSPs.has(sp));
    setSelectedSPs(newSPs);
    setFormData(prev => ({ ...prev, sp: newSPs.join('; ') }));
  };

  const handleAddSP = (sp: string) => {
    if (!sp) return;
    if (selectedSPs.includes(sp)) return;
    
    const newSPs = [...selectedSPs, sp];
    setSelectedSPs(newSPs);
    setFormData(prev => ({ ...prev, sp: newSPs.join('; ') }));
  };

  const handleRemoveSP = (sp: string) => {
    const newSPs = selectedSPs.filter(s => s !== sp);
    setSelectedSPs(newSPs);
    setFormData(prev => ({ ...prev, sp: newSPs.join('; ') }));
  };

    const handleBulkAiGenerate = async () => {
    if (!groqApiKey) {
      alert('Sila masukkan Kunci API Groq anda di halaman Tetapan terlebih dahulu.');
      return;
    }

    if (!formData.title || !formData.sk || !formData.sp) {
      alert("Sila lengkapkan pilihan DSKP dahulu.");
      return;
    }

    setLoading(true);
    const groq = new Groq({ apiKey: groqApiKey, dangerouslyAllowBrowser: true });

    try {
      const isBI = formData.language === 'BI';
      const langInstruction = isBI ? "Write in English." : "Tulis dalam Bahasa Melayu (Rumi).";
      
      // 1. Generate Objective
      const objStart = isBI ? "At the end of the lesson, pupils will be able to" : "Di akhir PDPC, murid dapat";
      const objectivePrompt = `Jana SATU (1) objektif PdPC yang sangat ringkas, padat dan boleh diukur berdasarkan SK: "${formData.sk}" dan SP: "${formData.sp}". Wajib mulakan dengan "${objStart}" dan sambungkan ayat tersebut dengan kata kerja seperti "menganalisis, menyatakan, menyenaraikan, memainkan, mengaplikasikan, menyebut" atau yang setaraf. Contoh format: "${objStart} [kata kerja] sekurang-kurangnya 2 [kandungan] dengan baik dan betul". ${langInstruction} Terus berikan hasil tanpa kata aluan.`;
      
      const objectiveResponse = await groq.chat.completions.create({
        messages: [{ role: "user", content: objectivePrompt }],
        model: "llama-3.3-70b-versatile",
      });
      const generatedObjective = objectiveResponse.choices[0]?.message?.content || '';

      // 2. Generate Activity
      const actStart = isBI ? "Pupils are" : "murid";
      const activityPrompt = `Jana aktiviti PdP dalam format "Numbered list" (1, 2, 3...) yang SANGAT ringkas dan padat berdasarkan Tajuk: "${formData.title}", SK: "${formData.sk}", SP: "${formData.sp}", dan Objektif: "${generatedObjective}". JANGAN berikan sebarang ayat pengenalan. Terus masuk pada point 1). Setiap ayat MESTI bermula dengan perkataan "${actStart}" dan gunakan ayat pasif (Contoh: ${isBI ? 'Pupils are shown, Pupils are demonstrated' : 'murid dipertontonkan, murid didemonstrasikan, murid ditunjukkan'}). Maksimum 5 aktiviti. ${langInstruction} Terus berikan hasil tanpa kata aluan.`;
      
      const activityResponse = await groq.chat.completions.create({
        messages: [{ role: "user", content: activityPrompt }],
        model: "llama-3.3-70b-versatile",
      });
      const generatedActivity = activityResponse.choices[0]?.message?.content || '';

      // 3. Generate Reflection
      const refStart = isBI ? "___ out of ____ pupils were able to" : "____ daripada ___ orang murid dapat";
      const reflectionPrompt = `Jana satu refleksi pengajaran yang SANGAT ringkas berdasarkan objektif: "${generatedObjective}". Wajib gunakan format "${refStart} [isi objektif]". ${langInstruction} Terus berikan hasil tanpa kata aluan.`;

      const reflectionResponse = await groq.chat.completions.create({
        messages: [{ role: "user", content: reflectionPrompt }],
        model: "llama-3.3-70b-versatile",
      });
      const generatedReflection = reflectionResponse.choices[0]?.message?.content || '';

      // 4. Generate Teaching Aids
      const teachingAidsPrompt = `Senaraikan MAKSIMUM LIMA (5) Bahan Bantu Mengajar (BBM) (nama sahaja, jangan huraikan) yang relevan berpandukan Tajuk: "${formData.title}" dan Aktiviti: "${generatedActivity}". Contoh BBM: Buku, Nota, Latihan, Slide, Komputer. ${langInstruction} Terus berikan senarai tanpa kata aluan.`;
      const teachingAidsResponse = await groq.chat.completions.create({
        messages: [{ role: "user", content: teachingAidsPrompt }],
        model: "llama-3.3-70b-versatile",
      });
      const generatedTeachingAids = teachingAidsResponse.choices[0]?.message?.content || '';

      // 5. Update state ONCE with all generated content
      setFormData(prev => ({
        ...prev,
        objective: generatedObjective,
        activities: generatedActivity,
        reflection: generatedReflection,
        bbm: 'Lain-lain (nyatakan)',
      }));
      setCustomBbm(generatedTeachingAids);

    } catch (error: any) {
      console.error("Groq AI Error Details:", error);
      const finalMessage = `Gagal menjana kandungan AI.\n\nPunca Sebenar: ${error.message}\n\nSila pastikan Kunci API anda sah dan akaun Groq anda aktif.`;
      alert(finalMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleJawiConversion = async () => {
    if (!groqApiKey) {
      alert('Sila masukkan Kunci API Groq anda di halaman Tetapan terlebih dahulu.');
      return;
    }

    if (!formData.objective && !formData.activities) {
      alert("Sila jana kandungan RPH rumi terlebih dahulu.");
      return;
    }

    setLoading(true);
    const groq = new Groq({ apiKey: groqApiKey, dangerouslyAllowBrowser: true });

    try {
      const conversionPrompt = `
Anda adalah pakar penulisan Jawi Pendidikan Islam KPM yang paling teliti. Tugas anda adalah menukar teks Rumi di bawah kepada Jawi yang 100% tepat tanpa sebarang ralat karakter.

PERATURAN KERAS (STRICT RULES):
1. NO ENGLISH/RUMI: Harami sebarang penggunaan huruf Rumi (a-z) dalam output. Contoh: "untuk" -> (اونتوق), "atau" -> (اتاو), "group" -> (كومڤولن).
2. Karakter Bersih: Jangan gunakan sebarang simbol pelik atau huruf dari bahasa lain (seperti Kirilik/Slavic/Devanagari). Gunakan hanya Unicode Jawi/Arabic yang sah.
3. Ejaan Pendidikan Islam: 
   - 'di-' imbuhan mesti bersambung (دبتاچ).
   - 'ke-' imbuhan mesti bersambung (كماءنسيأن).
   - Istilah Syarak: (Al-Quran = القرءان), (Ayat = اية), (Surah = سورة), (Ali Imran = آل عمران).
4. Angka Jawi: Wajib tukar 1, 2, 3... kepada ١, ٢, ٣...
5. No Formatting: Jangan gunakan "bold" (**), jangan gunakan "bullet points" (*), dan jangan gunakan "code blocks" (\`\`\`).

Output Format:
Sila berikan jawapan dalam format JSON dengan kunci: "objective", "activities", "reflection", "bbm".
SETIAP nilai dalam JSON mesti dibungkus dalam tag ini:
<div dir="rtl" style="text-align: right; font-family: 'Amiri', 'Lateef', serif; font-size: 14pt;"> [MASUKKAN_JAWI_DI_SINI] </div>

Teks Rumi Untuk Ditukar:
Objective: ${formData.objective}
Activities: ${formData.activities}
Reflection: ${formData.reflection}
BBM: ${(formData.bbm || '').split(',').map(s => s.trim()).map(item => item === 'Lain-lain (nyatakan)' ? customBbm : item).filter(Boolean).join(', ')}

HANYA berikan JSON sahaja tanpa sebarang teks lain.`;

      const response = await groq.chat.completions.create({
        messages: [{ role: "user", content: conversionPrompt }],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      setFormData(prev => ({
        ...prev,
        objective: result.objective || prev.objective,
        activities: result.activities || prev.activities,
        reflection: result.reflection || prev.reflection,
        language: 'JAWI',
        bbm: 'Lain-lain (nyatakan)'
      }));
      
      if (result.bbm) {
        setCustomBbm(result.bbm);
      }

    } catch (error: any) {
      console.error("Jawi Conversion Error:", error);
      alert(`Gagal menukar ke Jawi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bbmArray = (formData.bbm || '').split(',').map(s => s.trim()).filter(Boolean);
    const finalBbmValue = bbmArray.map(item => item === 'Lain-lain (nyatakan)' ? customBbm : item).filter(Boolean).join(', ');
    const fullData: ERPHData = {
      id: formData.id || Math.random().toString(36).substr(2, 9),
      teacherId: user.id,
      teacherName: user.name,
      week: formData.week || 1,
      date: formData.date || new Date().toISOString().split('T')[0],
      day: formData.day || 'Isnin',
      startTime: formData.startTime || '08:00',
      endTime: formData.endTime || '09:00',
      className: formData.className || '',
      classTitle: formData.classTitle || '',
      subject: formData.subject || '',
      title: formData.title || '',
      field: formData.field || '',
      sk: formData.sk || '',
      sp: formData.sp || '',
      core: formData.core || '',
      language: formData.language || 'BM',
      objective: formData.objective || '',
      activities: formData.activities || '',
      reflection: formData.reflection || '',
      bbm: finalBbmValue,
      status: ERPHStatus.SELESAI,
    };
    onSave(fullData);
  };

  const handleSaveDraft = () => {
    const bbmArray = (formData.bbm || '').split(',').map(s => s.trim()).filter(Boolean);
    const finalBbmValue = bbmArray.map(item => item === 'Lain-lain (nyatakan)' ? customBbm : item).filter(Boolean).join(', ');
    const fullData: ERPHData = {
      id: formData.id || Math.random().toString(36).substr(2, 9),
      teacherId: user.id,
      teacherName: user.name,
      week: formData.week || 1,
      date: formData.date || new Date().toISOString().split('T')[0],
      day: formData.day || 'Isnin',
      startTime: formData.startTime || '08:00',
      endTime: formData.endTime || '09:00',
      className: formData.className || '',
      classTitle: formData.classTitle || '',
      subject: formData.subject || '',
      title: formData.title || '',
      field: formData.field || '',
      sk: formData.sk || '',
      sp: formData.sp || '',
      core: formData.core || '',
      language: formData.language || 'BM',
      objective: formData.objective || '',
      activities: formData.activities || '',
      reflection: formData.reflection || '',
      bbm: finalBbmValue,
      status: ERPHStatus.DRAFT,
    };
    onSave(fullData);
    
    setDraftSaved(true);
    setTimeout(() => {
      setDraftSaved(false);
      onCancel(); // Close form after saving draft
    }, 2000);
  };

  const isPendidikanIslam = formData.subject === 'Pendidikan Islam';
  const isJawiUI = formData.language === 'JAWI' || isPendidikanIslam;

  const scheduleSlots = useMemo(() => {
    if (masterSchedule && masterSchedule.length > 0) {
      return masterSchedule;
    }
    const teacherSlots = erphs.filter(e => e.teacherId === user.id);
    const uniqueSlots = new Map();
    teacherSlots.forEach(s => {
      const key = `${s.subject}-${s.className}-${s.classTitle}`;
      if (!uniqueSlots.has(key)) {
        uniqueSlots.set(key, s);
      }
    });
    return Array.from(uniqueSlots.values());
  }, [erphs, user.id, masterSchedule]);

  const labels = {
    title: isPendidikanIslam ? 'ڤنيضاءن سمار‌ت ر.ڤ.ه' : (initialData ? 'Kemaskini SMART RPH' : 'Penyediaan SMART RPH'),
    weekDate: isPendidikanIslam ? 'ميڠڬو & تاريخ' : 'Minggu & Tarikh',
    timeSlot: isPendidikanIslam ? 'سلوت وقتو ڤڠاجرن' : 'Slot Waktu PdP',
    to: isPendidikanIslam ? 'ك' : 'KE',
    curriculum: isPendidikanIslam ? 'كاندوڠن كوريكولوم' : 'Kandungan Kurikulum',
    subject: isPendidikanIslam ? 'مات ڤلاجرن' : 'Mata Pelajaran',
    form: isPendidikanIslam ? 'تيڠكتن' : 'Tingkatan',
    className: isPendidikanIslam ? 'نام كلس' : 'Nama Kelas',
    pdpTitle: isPendidikanIslam ? 'تاجوق ڤڠاجرن' : 'Tajuk PdP',
    field: isPendidikanIslam ? 'بيدڠ / تيما' : 'Bidang / Tema',
    sk: isPendidikanIslam ? 'ستندرد كاندوڠن' : 'Standard Kandungan (SK)',
    sp: isPendidikanIslam ? 'ستندرد ڤمبلاجرن' : 'Standard Pembelajaran (SP)',
    core: isPendidikanIslam ? 'نيلاي / كماهيرن / ترس' : 'Nilai / Kemahiran / Teras',
    objective: isPendidikanIslam ? 'اوبجيكتيف ڤمبلاجرن' : 'Objektif Pembelajaran',
    activities: isPendidikanIslam ? 'اكتيويتي ڤڠاجرن' : 'Aktiviti PdP',
    bbm: isPendidikanIslam ? 'باهن بنتو مڠاجر' : 'BBM',
    reflection: isPendidikanIslam ? 'ريفليك‌سي' : 'Refleksi',
    saveDraft: isPendidikanIslam ? 'سيمڤن' : 'Simpan',
    preview: isPendidikanIslam ? 'ڤراتينجاو' : 'Preview RPH',
    generateAI: isPendidikanIslam ? 'جانا ا.ءي.' : 'Jana AI',
    jawiBtn: isPendidikanIslam ? 'جاوي' : 'JAWI',
    syncSchedule: isPendidikanIslam ? 'امبيل دري جدول' : 'Sync dari Jadual'
  };

  return (
    <div className="max-w-5xl mx-auto pb-10 animate-fadeIn relative text-left">
      <div className="bg-white rounded-[2rem] premium-shadow border border-slate-100 p-5 sm:p-8 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none rotate-12"><Book size={200} /></div>
        
        <div className={`flex justify-between items-center mb-6 sm:mb-8 relative z-10 ${isPendidikanIslam ? 'flex-row-reverse' : ''}`}>
          <div className={isPendidikanIslam ? 'text-right' : ''}>
            <h2 className={`text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight ${isPendidikanIslam ? 'font-jawi' : ''}`}>
              {labels.title}
            </h2>
            <p className="text-[8px] sm:text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">Portal Digital Warga SSEMJ</p>
          </div>
          <button onClick={onCancel} className="p-2 sm:p-3 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10" dir={isPendidikanIslam ? 'rtl' : 'ltr'}>
          {/* Header Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-4 sm:p-6 rounded-2xl border border-slate-100">
            <div className="space-y-1.5">
              <label className={`text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}>
                <Calendar size={12} className="text-blue-600" /> {labels.weekDate}
              </label>
              <div className="flex gap-2">
                <select className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" value={Number(formData.week ?? 1)} onChange={e => handleFieldChange('week', parseInt(e.target.value))}>
                  {WEEKS.map(w => (
                    <option key={w} value={w}>
                      M{w}{filledWeeks.has(w) ? ' .' : ''}
                    </option>
                  ))}
                </select>
                <input type="date" className="flex-[2] p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" value={formData.date} onChange={e => handleFieldChange('date', e.target.value)} />
              </div>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className={`text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}>
                  <Clock size={12} className="text-blue-600" /> {labels.timeSlot}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-3 h-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={formData.startTime === 'Sepanjang masa hari persekolahan'}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleFieldChange('startTime', 'Sepanjang masa hari persekolahan');
                        handleFieldChange('endTime', '');
                      } else {
                        handleFieldChange('startTime', '08:00');
                        handleFieldChange('endTime', '09:00');
                      }
                    }}
                  />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sepanjang masa hari persekolahan</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                {formData.startTime === 'Sepanjang masa hari persekolahan' ? (
                  <div className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-500 text-center uppercase tracking-widest">
                    Sepanjang masa hari persekolahan
                  </div>
                ) : (
                  <>
                    <input type="time" className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" value={formData.startTime} onChange={e => handleFieldChange('startTime', e.target.value)} />
                    <span className={`text-slate-300 font-black text-[10px] ${isPendidikanIslam ? 'font-jawi text-sm' : ''}`}>{labels.to}</span>
                    <input type="time" className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" value={formData.endTime} onChange={e => handleFieldChange('endTime', e.target.value)} />
                  </>
                )}
                <div className="flex bg-slate-200/50 p-1 rounded-lg ml-2">
                  {LANGUAGES.map(l => (
                    <button key={l.value} type="button" onClick={() => handleFieldChange('language', l.value)} className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all ${formData.language === l.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                      {l.value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Sync from Schedule */}
          {scheduleSlots.length > 0 && (
            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-3">
              <div className={`flex items-center justify-between ${isPendidikanIslam ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-2 ${isPendidikanIslam ? 'flex-row-reverse' : ''}`}>
                  <LayoutGrid size={14} className="text-indigo-600" />
                  <span className={`text-[9px] font-black text-indigo-400 uppercase tracking-widest ${isPendidikanIslam ? 'font-jawi text-sm' : ''}`}>{labels.syncSchedule}</span>
                </div>
                <span className="text-[8px] font-bold text-indigo-300 uppercase">Pilihan Pantas</span>
              </div>
              <div className={`flex flex-wrap gap-2 ${isPendidikanIslam ? 'flex-row-reverse' : ''}`}>
                {scheduleSlots.slice(0, 5).map((slot, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        subject: slot.subject,
                        className: slot.className,
                        classTitle: slot.classTitle,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        day: slot.day,
                        title: '',
                        field: '',
                        sk: '',
                        sp: '',
                        core: ''
                      }));
                      setSelectedSKs([]);
                      setSelectedSPs([]);
                    }}
                    className="px-3 py-2 bg-white border border-indigo-100 rounded-xl text-[10px] font-black text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2 group"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 group-hover:bg-white"></div>
                    {slot.subject} ({slot.classTitle})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Curriculum Selection Section */}
          <div className="space-y-4">
            <div className={`flex items-center gap-2 ${isPendidikanIslam ? 'flex-row-reverse' : ''}`}>
              <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
              <h3 className={`text-sm font-black text-slate-900 uppercase tracking-tight ${isPendidikanIslam ? 'font-jawi text-xl' : ''}`}>{labels.curriculum}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>{labels.subject}</label>
                <select className="w-full p-3.5 bg-white border border-slate-200 rounded-xl font-extrabold text-xs outline-none" value={String(formData.subject ?? '')} onChange={e => handleFieldChange('subject', e.target.value)}>
                  <option value="">Pilih Subjek</option>
                  {masterData.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
               </div>
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>{labels.form}</label>
                <select className="w-full p-3.5 bg-white border border-slate-200 rounded-xl font-extrabold text-xs outline-none disabled:opacity-30" disabled={!formData.subject} value={String(formData.className ?? '')} onChange={e => handleFieldChange('className', e.target.value)}>
                  <option value="">Pilih Tingkatan</option>
                  {availableForms.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
               </div>
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-blue-600 uppercase ml-1 tracking-widest ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>{labels.className}</label>
                <select className="w-full p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl font-black text-xs outline-none" disabled={!formData.className} value={String(formData.classTitle ?? '')} onChange={e => handleFieldChange('classTitle', e.target.value)}>
                  <option value="">Pilih Nama Kelas</option>
                  {availableClassTitles.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                </select>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><Edit3 size={12}/> {labels.pdpTitle}</label>
               <div className="space-y-2">
                 <select 
                   className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" 
                   disabled={!formData.className} 
                   value="" 
                   onChange={e => {
                     const val = e.target.value;
                     if (!val) return;
                     const current = (formData.title || '').split('; ').filter(Boolean);
                     if (!current.includes(val)) {
                       handleFieldChange('title', [...current, val].join('; '));
                     }
                   }}
                 >
                   <option value="">Pilih Tajuk (Boleh pilih lebih dari satu)</option>
                   {availableTitles.map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
                 
                 {(formData.title || '').split('; ').filter(Boolean).length > 0 && (
                   <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                     {(formData.title || '').split('; ').filter(Boolean).map(t => (
                       <div key={t} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm animate-fadeIn">
                         <span className="text-[10px] font-bold text-slate-700">{t}</span>
                         <button 
                           type="button" 
                           onClick={() => {
                             const current = (formData.title || '').split('; ').filter(Boolean);
                             handleFieldChange('title', current.filter(item => item !== t).join('; '));
                           }}
                           className="text-slate-400 hover:text-red-500 transition-colors"
                         >
                           <X size={12} />
                         </button>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
               </div>
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><Layers size={12}/> {labels.field}</label>
               <div className="space-y-2">
                 <select 
                   className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" 
                   disabled={!formData.title} 
                   value="" 
                   onChange={e => {
                     const val = e.target.value;
                     if (!val) return;
                     const current = (formData.field || '').split('; ').filter(Boolean);
                     if (!current.includes(val)) {
                       handleFieldChange('field', [...current, val].join('; '));
                     }
                   }}
                 >
                   <option value="">Pilih Bidang (Boleh pilih lebih dari satu)</option>
                   {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
                 </select>
                 
                 {(formData.field || '').split('; ').filter(Boolean).length > 0 && (
                   <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                     {(formData.field || '').split('; ').filter(Boolean).map(f => (
                       <div key={f} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm animate-fadeIn">
                         <span className="text-[10px] font-bold text-slate-700">{f}</span>
                         <button 
                           type="button" 
                           onClick={() => {
                             const current = (formData.field || '').split('; ').filter(Boolean);
                             handleFieldChange('field', current.filter(item => item !== f).join('; '));
                           }}
                           className="text-slate-400 hover:text-red-500 transition-colors"
                         >
                           <X size={12} />
                         </button>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><Target size={12}/> {labels.sk}</label>
                <div className="space-y-2">
                  <select 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium text-[11px] outline-none" 
                    disabled={!formData.field} 
                    value="" 
                    onChange={e => handleAddSK(e.target.value)}
                  >
                    <option value="">Pilih SK (Boleh pilih lebih dari satu)</option>
                    {availableSKs.map(sk => <option key={sk} value={sk}>{sk}</option>)}
                  </select>
                  
                  {selectedSKs.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                      {selectedSKs.map(sk => (
                        <div key={sk} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm animate-fadeIn">
                          <span className="text-[10px] font-bold text-slate-700">{sk}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveSK(sk)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
               </div>
               <div className="space-y-1.5">
                <label className={`text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><Activity size={12}/> {labels.sp}</label>
                <div className="space-y-2">
                  <select 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium text-[11px] outline-none" 
                    disabled={selectedSKs.length === 0} 
                    value="" 
                    onChange={e => handleAddSP(e.target.value)}
                  >
                    <option value="">Pilih SP (Boleh pilih lebih dari satu)</option>
                    {availableSPs.map(sp => <option key={sp} value={sp}>{sp}</option>)}
                  </select>
                  
                  {selectedSPs.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                      {selectedSPs.map(sp => (
                        <div key={sp} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm animate-fadeIn">
                          <span className="text-[10px] font-bold text-slate-700">{sp}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveSP(sp)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
               </div>
            </div>

            <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="bg-white/20 p-2 rounded-lg hidden sm:block"><Info size={16} /></div>
              <div className="flex-1">
                <p className={`text-[8px] font-black uppercase tracking-widest text-blue-100 ${isPendidikanIslam ? 'font-jawi text-lg text-right' : ''}`}>{labels.core}</p>
                <p className={`text-xs sm:text-sm font-black italic ${isPendidikanIslam ? 'text-right' : ''}`}>{formData.core || "Sila lengkapkan pilihan SP..."}</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button 
                  type="button" 
                  onClick={handleBulkAiGenerate} 
                  disabled={loading} 
                  className="flex-1 sm:flex-none justify-center bg-white text-blue-600 px-4 py-3 sm:py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-blue-50 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {labels.generateAI}
                </button>
                <button 
                  type="button" 
                  onClick={handleJawiConversion} 
                  disabled={loading || (!formData.objective && !formData.activities)} 
                  className="flex-1 sm:flex-none justify-center bg-blue-500 text-white px-4 py-3 sm:py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-blue-400 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {labels.jawiBtn}
                </button>
              </div>
            </div>
          </div>

          {/* AI Content Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className={`text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><PenTool size={12}/> {labels.objective}</label>
              <textarea rows={4} dir={isJawiUI ? "rtl" : "ltr"} className={`w-full p-4 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none leading-relaxed ${isJawiUI ? 'font-jawi text-2xl' : ''}`} value={formData.objective || ''} onChange={e => handleFieldChange('objective', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={`text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><Activity size={12}/> {labels.activities}</label>
              <div className="relative">
                <textarea 
                  rows={4} 
                  dir={isJawiUI ? "rtl" : "ltr"}
                  className={`w-full p-4 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none leading-relaxed ${isJawiUI ? 'font-jawi text-2xl' : ''}`} 
                  value={formData.activities || ''} 
                  onChange={e => handleFieldChange('activities', e.target.value)} 
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={`text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><Layers size={12}/> {labels.bbm}</label>
              <div className="space-y-2">
                <select 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" 
                  value="" 
                  onChange={e => {
                    const val = e.target.value;
                    if (!val) return;
                    const current = (formData.bbm || '').split(',').map(s => s.trim()).filter(Boolean);
                    if (!current.includes(val)) {
                      handleFieldChange('bbm', [...current, val].join(', '));
                    }
                  }}
                >
                  <option value="">Pilih BBM (Boleh pilih lebih dari satu)</option>
                  {bbmOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                
                {(formData.bbm || '').split(',').map(s => s.trim()).filter(Boolean).length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                    {(formData.bbm || '').split(',').map(s => s.trim()).filter(Boolean).map(opt => (
                      <div key={opt} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm animate-fadeIn">
                        <span className="text-[10px] font-bold text-slate-700">{opt}</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            const current = (formData.bbm || '').split(',').map(s => s.trim()).filter(Boolean);
                            handleFieldChange('bbm', current.filter(item => item !== opt).join(', '));
                          }}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {(formData.bbm || '').includes('Lain-lain (nyatakan)') && (
                  <input type="text" className={`w-full p-3 bg-blue-50/50 border border-blue-100 rounded-xl font-bold text-xs outline-none ${isJawiUI ? 'font-jawi text-xl' : ''}`} placeholder="Nyatakan BBM..." value={customBbm} onChange={e => setCustomBbm(e.target.value)} />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={`text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-2 ${isPendidikanIslam ? 'font-jawi text-lg flex-row-reverse' : ''}`}><MessageSquare size={12}/> {labels.reflection}</label>
              <textarea rows={3} dir={isJawiUI ? "rtl" : "ltr"} className={`w-full p-4 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none leading-relaxed ${isJawiUI ? 'font-jawi text-2xl' : ''}`} value={formData.reflection || ''} onChange={e => handleFieldChange('reflection', e.target.value)} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
            <motion.button 
              type="button" 
              onClick={handleSaveDraft} 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={draftSaved}
              className={`flex-[2] py-4 rounded-xl font-black text-base shadow-lg transition-all flex items-center justify-center gap-3 relative overflow-hidden ${
                draftSaved ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
            >
              <AnimatePresence mode="wait">
                {draftSaved ? (
                  <motion.div 
                    key="saved"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle size={22} className="text-white" />
                    <span>Draf Disimpan!</span>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="save"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle size={18} /> {labels.saveDraft}
                  </motion.div>
                )}
              </AnimatePresence>
              
              {draftSaved && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 4, opacity: 0.2 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 bg-white rounded-full"
                />
              )}
            </motion.button>
            <motion.button 
              type="button" 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowPreview(true)} 
              className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-black text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <Eye size={16} /> {labels.preview}
            </motion.button>
          </div>
        </form>
      </div>

      {showPreview && (
        <ERPHPreview 
          erphs={[{ ...formData, bbm: (formData.bbm || '').split(',').map(s => s.trim()).map(item => item === 'Lain-lain (nyatakan)' ? customBbm : item).filter(Boolean).join(', ') } as ERPHData]} 
          onBack={() => setShowPreview(false)} 
        />
      )}
    </div>
  );
};

export default ERPHForm;