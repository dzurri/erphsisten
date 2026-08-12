
import React, { useRef, useState } from 'react';
import { ERPHData, ERPHStatus } from '../types';
import { formatDate, formatTime } from '../constants';
import { Printer, X, FileText, Calendar, Clock, BookOpen, Layers, CheckCircle2, SendHorizontal, Loader2, ChevronLeft, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ERPHPreviewProps {
  erphs: ERPHData[];
  onBack: () => void;
  onSubmit?: (week: number, pdfBase64: string) => Promise<void>;
  hideModal?: boolean;
}

const ERPHPreview: React.FC<ERPHPreviewProps> = ({ erphs, onBack, onSubmit, hideModal = false }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const generateJsPDF = async (): Promise<{ pdf: jsPDF; base64: string }> => {
    if (!printRef.current) throw new Error("Tiada elemen untuk dicetak");

    const pdf = new jsPDF('p', 'mm', 'a4');
    const a4Width = pdf.internal.pageSize.getWidth();
    const a4Height = pdf.internal.pageSize.getHeight();
    const targetWidth = a4Width * 0.95; // 95% width

    const rphElements = Array.from(printRef.current.querySelectorAll('.a4-page'));

    for (let i = 0; i < rphElements.length; i++) {
      const element = rphElements[i] as HTMLElement;
      try {
        const canvas = await html2canvas(element, {
          scale: 1.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: element.offsetWidth,
          height: element.offsetHeight,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.65);
        const imgProps = pdf.getImageProperties(imgData);
        const ratio = imgProps.height / imgProps.width;
        let finalHeight = targetWidth * ratio;

        if (finalHeight > a4Height * 0.95) {
          finalHeight = a4Height * 0.95;
        }
        const xOffset = (a4Width - targetWidth) / 2;
        const yOffset = (a4Height - finalHeight) / 2;

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'JPEG', xOffset, yOffset, targetWidth, finalHeight);
      } catch (canvasError) {
        console.error(`Error rendering page ${i + 1} with html2canvas:`, canvasError);
        throw new Error(`Gagal menjana muka surat ${i + 1}.`);
      }
    }

    const dataUri = pdf.output('datauristring');
    const base64 = dataUri.includes('base64,') ? dataUri.split('base64,')[1] : dataUri;
    return { pdf, base64 };
  };

  const openPrintWindow = () => {
    // 1. Open new window synchronously inside user click event to bypass PWA/Chrome popup blocker
    const printWin = window.open('', '_blank');
    if (!printWin) {
      // Fallback directly to native window.print() if new window creation is blocked by strict PWA policy
      try {
        window.print();
      } catch (e) {
        console.error("Direct print fallback failed:", e);
      }
      return;
    }

    // Show initial loading indicator in new window
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Menjana Halaman Cetak...</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
            .box { text-align: center; padding: 30px; background: white; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
            .spin { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="spin"></div>
            <h3 style="margin:0 0 8px; font-size:18px;">Menyediakan Halaman Cetakan RPH...</h3>
            <p style="margin:0; color:#64748b; font-size:14px;">Dialog cetak Chrome akan muncul secara automatik.</p>
          </div>
        </body>
      </html>
    `);

    setTimeout(() => {
      if (!printRef.current) return;

      // Extract all parent stylesheets so Tailwind and Google Fonts render accurately
      const stylesHtml = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(style => style.outerHTML)
        .join('\n');

      const teacherName = erphs[0]?.teacherName ? erphs[0].teacherName.replace(/[^a-zA-Z0-9]/g, '_') : 'Guru';
      const weekNum = erphs[0]?.week || 1;

      printWin.document.open();
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Cetak RPH Minggu ${weekNum} - ${teacherName}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            ${stylesHtml}
            <style>
              @page {
                size: A4 portrait;
                margin: 5mm;
              }
              *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                background: #f1f5f9 !important;
                margin: 0 !important;
                padding: 0 !important;
                font-family: system-ui, -apple-system, sans-serif;
              }
              .a4-page {
                width: 210mm !important;
                min-height: 295mm !important;
                margin: 20px auto !important;
                padding: 10mm !important;
                background: white !important;
                box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1) !important;
                border: 1px solid #cbd5e1 !important;
                page-break-after: always !important;
                break-after: page !important;
              }
              @media print {
                .no-print {
                  display: none !important;
                }
                body {
                  background: white !important;
                }
                .a4-page {
                  margin: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="no-print" style="position: sticky; top: 0; background: #0f172a; color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 99999;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">🖨️ Cetakan RPH Minggu ${weekNum}</span>
              </div>
              <div style="display: flex; gap: 10px;">
                <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 10px 20px; font-weight: 800; border-radius: 8px; cursor: pointer; font-size: 12px; text-transform: uppercase;">
                  🖨️ CETAK / SIMPAN PDF
                </button>
                <button onclick="window.close()" style="background: #334155; color: white; border: none; padding: 10px 16px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 12px; text-transform: uppercase;">
                  TUTUP TAB
                </button>
              </div>
            </div>
            <div style="padding: 10px 0;">
              ${printRef.current.innerHTML}
            </div>
            <script>
              setTimeout(() => {
                window.print();
              }, 500);
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    }, 150);
  };

  const openPDFWindow = async () => {
    // 1. Open new window synchronously inside user click event to bypass PWA/Chrome popup blocker
    const pdfWin = window.open('', '_blank');
    if (!pdfWin) {
      // Fallback: Generate PDF and trigger direct download
      try {
        setIsPrinting(true);
        const { pdf } = await generateJsPDF();
        const teacherName = erphs[0]?.teacherName ? erphs[0].teacherName.replace(/[^a-zA-Z0-9]/g, '_') : 'Guru';
        const weekNum = erphs[0]?.week || 1;
        pdf.save(`RPH_Minggu_${weekNum}_${teacherName}.pdf`);
      } catch (e) {
        window.print();
      } finally {
        setIsPrinting(false);
      }
      return;
    }

    // Show loading state in new window
    pdfWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Menjana Fail PDF...</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
            .box { text-align: center; padding: 30px; background: white; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
            .spin { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="spin"></div>
            <h3 style="margin:0 0 8px; font-size:18px;">Sedang Menjana Fail PDF RPH...</h3>
            <p style="margin:0; color:#64748b; font-size:14px;">Halaman PDF akan dipaparkan dalam beberapa saat.</p>
          </div>
        </body>
      </html>
    `);

    try {
      setIsPrinting(true);
      const { pdf } = await generateJsPDF();
      const teacherName = erphs[0]?.teacherName ? erphs[0].teacherName.replace(/[^a-zA-Z0-9]/g, '_') : 'Guru';
      const weekNum = erphs[0]?.week || 1;
      const filename = `RPH_Minggu_${weekNum}_${teacherName}.pdf`;

      // Trigger standard browser download
      try {
        pdf.save(filename);
      } catch (saveErr) {
        console.warn("Direct pdf.save failed:", saveErr);
      }

      // Create PDF Blob URL
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);

      // Navigate open window directly to Blob URL so Chrome's native PDF viewer displays it natively
      if (pdfWin && !pdfWin.closed) {
        pdfWin.location.href = blobUrl;
      }
    } catch (err) {
      console.error("PDF Window Error:", err);
      alert("Gagal menjana PDF. Sila cuba guna [ CETAK (TAB BARU) ].");
      if (pdfWin && !pdfWin.closed) {
        pdfWin.close();
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrint = async () => {
    // Synchronously open dedicated print tab (foolproof in Chrome PWA Standalone & Mobile)
    openPrintWindow();
  };

  const handleDownloadPDF = async () => {
    // Synchronously open dedicated PDF view/download tab
    openPDFWindow();
  };

  const generatePDFBase64 = async (): Promise<string> => {
    const { base64 } = await generateJsPDF();
    return base64;
  };

  const handleBulkSubmit = async () => {
    if (!onSubmit || erphs.length === 0) return;
    
    setIsGenerating(true);
    try {
      const pdfBase64 = await generatePDFBase64();
      await onSubmit(erphs[0].week, pdfBase64);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Gagal menjana PDF. Sila cuba lagi.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (erphs.length === 0) return null;

  const getLabels = (isPendidikanIslam: boolean) => ({
    schoolName: isPendidikanIslam ? 'سكوله سني مليسيا جوهر' : 'SEKOLAH SENI MALAYSIA JOHOR',
    rphTitle: isPendidikanIslam ? 'رنچڠن ڤڠاجرن هارين' : 'Rancangan Pengajaran Harian',
    teacherName: isPendidikanIslam ? 'نام ڬورو' : 'NAMA GURU',
    subject: isPendidikanIslam ? 'مات ڤلاجرن' : 'MATA PELAJARAN',
    class: isPendidikanIslam ? 'كلس' : 'KELAS',
    dateDay: isPendidikanIslam ? 'تاريخ / هاري' : 'TARIKH / HARI',
    time: isPendidikanIslam ? 'ماس' : 'MASA',
    themeTitle: isPendidikanIslam ? 'تيما / تاجوق' : 'TEMA / TAJUK',
    sk: isPendidikanIslam ? 'ستندرد كاندوڠن' : 'STANDARD KANDUNGAN',
    sp: isPendidikanIslam ? 'ستندرد ڤمبلاجرن' : 'STANDARD PEMBELAJARAN',
    objective: isPendidikanIslam ? 'اوبجيكتيف ڤڠاجرن' : 'OBJEKTIF PDP',
    activities: isPendidikanIslam ? 'اكتيويتي ڤڠاجرن' : 'AKTIVITI PDP',
    bbm: isPendidikanIslam ? 'باهن بنتو مڠاجر' : 'BAHAN BANTU MENGAJAR',
    reflection: isPendidikanIslam ? 'ريفليك‌سي' : 'REFLEKSI',
    observationComment: isPendidikanIslam ? 'اولسن ڤنچرڤن' : 'ULASAN PENCERAPAN',
    observer: isPendidikanIslam ? 'ڤنچرڤ' : 'PENCERAP',
    confirmationTitle: isPendidikanIslam ? 'ڤڠسهن رنچڠن ڤڠاجرن هارين' : 'Pengesahan Rancangan Pengajaran Harian',
    weeklyComment: isPendidikanIslam ? 'اولسن ميڠڬوان' : 'Ulasan Mingguan',
    admin: isPendidikanIslam ? 'ڤنتدبير' : 'PENTADBIR'
  });

  const content = (
    <div ref={printRef} className={`flex-1 p-6 md:p-12 space-y-12 bg-slate-50/30 custom-scrollbar print:p-0 print:bg-white print:overflow-visible ${hideModal ? 'bg-white h-auto overflow-visible' : 'overflow-y-auto'}`}>
      {erphs.map((erph, idx) => {
        const isPendidikanIslam = erph.subject === 'Pendidikan Islam';
        const labels = getLabels(isPendidikanIslam);
        
        return (
        <div key={erph.id || idx} className="a4-page bg-white p-4 sm:p-6 md:p-10 shadow-lg relative overflow-hidden print:shadow-none print:border-none print:p-0 print:m-0 print:break-after-page max-w-[210mm] mx-auto border border-slate-200">
          

          {/* Formal Header */}
          <div className={`flex items-center gap-4 sm:gap-6 mb-6 sm:mb-8 border-b-4 border-slate-900 pb-4 sm:pb-6 ${isPendidikanIslam ? 'flex-row-reverse text-right' : ''}`}>
            <img 
              src="https://lh3.googleusercontent.com/d/1tyJ5QLBbqarYBYAzkFmPJ7ZBZ0fYp97u" 
              alt="Logo SSEMJ" 
              className="h-16 w-16 sm:h-24 sm:w-24 object-contain"
            />
            <div className={`flex-1 ${isPendidikanIslam ? 'pr-0 pl-16 sm:pl-24' : 'pr-16 sm:pr-24 text-center'}`}>
              <h1 className={`text-xl sm:text-2xl font-black text-slate-900 leading-tight uppercase tracking-wider ${isPendidikanIslam ? 'font-jawi text-2xl sm:text-3xl' : ''}`}>
                {labels.schoolName}
              </h1>
              <h2 className={`text-base sm:text-lg font-bold text-slate-700 uppercase mt-1 ${isPendidikanIslam ? 'font-jawi text-xl sm:text-2xl' : ''}`}>
                {labels.rphTitle} (M{erph.week})
              </h2>
            </div>
          </div>

          {/* Formal Table Layout */}
          <table className="w-full border-collapse text-[11px]" dir={isPendidikanIslam ? 'rtl' : 'ltr'}>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 w-[25%] uppercase text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.teacherName}
                </td>
                <td colSpan={3} className="p-3 font-semibold uppercase text-slate-800">{erph.teacherName}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 w-[25%] uppercase text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.subject}
                </td>
                <td className={`p-3 font-semibold uppercase text-slate-800 w-[35%] ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>{isPendidikanIslam ? 'ڤنديديقن اسلام' : erph.subject}</td>
                <td className={`p-3 font-bold bg-slate-50 w-[15%] uppercase text-center text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.class}
                </td>
                <td className="p-3 font-semibold uppercase text-slate-800">{erph.className} ({erph.classTitle})</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 w-[25%] uppercase text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.dateDay}
                </td>
                <td className="p-3 font-semibold uppercase text-slate-800 w-[35%]">{formatDate(erph.date)} ({['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'][new Date(erph.date + 'T12:00:00').getDay()]})</td>
                <td className={`p-3 font-bold bg-slate-50 w-[15%] uppercase text-center text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.time}
                </td>
                <td className="p-3 font-semibold uppercase text-slate-800">
                  {formatTime(erph.startTime)}
                  {erph.endTime ? ` - ${formatTime(erph.endTime)}` : ''}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 uppercase text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.themeTitle}
                </td>
                <td colSpan={3} className="p-3 font-semibold uppercase leading-relaxed text-slate-800">{erph.field} / {erph.title}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 uppercase text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.sk}
                </td>
                <td colSpan={3} className="p-3 font-semibold uppercase leading-relaxed text-slate-800">{erph.sk}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 uppercase text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.sp}
                </td>
                <td colSpan={3} className="p-3 font-semibold uppercase leading-relaxed text-slate-800">{erph.sp}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 uppercase align-top text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.objective}
                </td>
                <td colSpan={3} className={`p-3 font-medium leading-relaxed whitespace-pre-wrap text-slate-800 ${erph.language === 'JAWI' ? 'font-jawi text-lg' : ''}`} dir={erph.language === 'JAWI' ? 'rtl' : 'ltr'}>
                  {erph.language === 'JAWI' && erph.objective?.trim().startsWith('<div') ? (
                    <div dangerouslySetInnerHTML={{ __html: erph.objective }} />
                  ) : (
                    erph.objective
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 uppercase align-top text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.activities}
                </td>
                <td colSpan={3} className={`p-3 font-medium leading-relaxed whitespace-pre-wrap text-slate-800 ${erph.language === 'JAWI' ? 'font-jawi text-lg' : ''}`} dir={erph.language === 'JAWI' ? 'rtl' : 'ltr'}>
                  {erph.language === 'JAWI' && erph.activities?.trim().startsWith('<div') ? (
                    <div dangerouslySetInnerHTML={{ __html: erph.activities }} />
                  ) : (
                    erph.activities
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className={`p-3 font-bold bg-slate-50 uppercase align-top text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.bbm}
                </td>
                <td colSpan={3} className={`p-3 font-medium leading-relaxed whitespace-pre-wrap text-slate-800 ${erph.language === 'JAWI' ? 'font-jawi text-lg' : ''}`} dir={erph.language === 'JAWI' ? 'rtl' : 'ltr'}>
                  {erph.language === 'JAWI' && erph.bbm?.trim().startsWith('<div') ? (
                    <div dangerouslySetInnerHTML={{ __html: erph.bbm }} />
                  ) : (
                    erph.bbm
                  )}
                </td>
              </tr>
              <tr>
                <td className={`p-3 font-bold bg-slate-50 uppercase align-top text-slate-500 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                  {labels.reflection}
                </td>
                <td colSpan={3} className={`p-3 font-medium leading-relaxed whitespace-pre-wrap text-slate-800 ${erph.language === 'JAWI' ? 'font-jawi text-lg' : ''}`} dir={erph.language === 'JAWI' ? 'rtl' : 'ltr'}>
                  {erph.language === 'JAWI' && erph.reflection?.trim().startsWith('<div') ? (
                    <div dangerouslySetInnerHTML={{ __html: erph.reflection }} />
                  ) : (
                    erph.reflection
                  )}
                </td>
              </tr>
              {(erph.status === ERPHStatus.REVIEWED || erph.status === ERPHStatus.SELESAI) && (erph.observationComment || erph.isObservation) && (
                <tr className="border-t-2 border-emerald-100 bg-emerald-50/30">
                  <td className={`p-3 font-bold bg-emerald-50/50 uppercase align-top text-emerald-700 ${isPendidikanIslam ? 'font-jawi text-lg' : ''}`}>
                    {labels.observationComment}
                  </td>
                  <td colSpan={3} className="p-4">
                    <div className="flex flex-col gap-3">
                      <p className="font-medium italic text-emerald-800 whitespace-pre-wrap leading-relaxed">"{erph.observationComment}"</p>
                      <div className="flex items-center gap-4 mt-2 pt-3 border-t border-emerald-100/50">
                        {erph.observationSignature && erph.observationSignature.trim() !== "" && (
                          <img src={erph.observationSignature} alt="Tandatangan" className="h-12 object-contain mix-blend-multiply" />
                        )}
                        <div>
                          <p className={`text-xs font-black uppercase tracking-widest text-emerald-900 ${isPendidikanIslam ? 'font-jawi text-base' : ''}`}>{erph.observedBy || labels.observer}</p>
                          {erph.observerDesignation && (
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">{erph.observerDesignation}</p>
                          )}
                          {erph.observedAt && (
                            <p className="text-[9px] font-medium text-emerald-500 mt-0.5">{new Date(erph.observedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    })}

      {/* Helaian Tambahan untuk Ulasan Mingguan */}
      {(erphs[0]?.status === ERPHStatus.REVIEWED || erphs[0]?.status === ERPHStatus.SELESAI) && (
        <div className="a4-page bg-white p-4 sm:p-6 md:p-10 shadow-lg relative overflow-hidden print:shadow-none print:border-none print:p-0 print:m-0 print:break-after-page max-w-[210mm] mx-auto border border-slate-200 flex flex-col">
          {/* Formal Header */}
          <div className={`flex items-center gap-4 sm:gap-6 mb-6 sm:mb-8 border-b-4 border-slate-900 pb-4 sm:pb-6 ${erphs[0].subject === 'Pendidikan Islam' ? 'flex-row-reverse text-right' : ''}`}>
            <img 
              src="https://lh3.googleusercontent.com/d/1tyJ5QLBbqarYBYAzkFmPJ7ZBZ0fYp97u" 
              alt="Logo SSEMJ" 
              className="h-16 w-16 sm:h-24 sm:w-24 object-contain"
            />
            <div className={`flex-1 ${erphs[0].subject === 'Pendidikan Islam' ? 'pr-0 pl-16 sm:pl-24' : 'pr-16 sm:pr-24 text-center'}`}>
              <h1 className={`text-xl sm:text-2xl font-black text-slate-900 leading-tight uppercase tracking-wider ${erphs[0].subject === 'Pendidikan Islam' ? 'font-jawi text-2xl sm:text-3xl' : ''}`}>
                {getLabels(erphs[0].subject === 'Pendidikan Islam').schoolName}
              </h1>
              <h2 className={`text-base sm:text-lg font-bold text-slate-700 uppercase mt-1 ${erphs[0].subject === 'Pendidikan Islam' ? 'font-jawi text-xl sm:text-2xl' : ''}`}>
                {getLabels(erphs[0].subject === 'Pendidikan Islam').confirmationTitle} (M{erphs[0].week})
              </h2>
            </div>
          </div>

          <div className="flex-1 flex flex-col mt-4" dir={erphs[0].subject === 'Pendidikan Islam' ? 'rtl' : 'ltr'}>
            <h3 className={`text-xl font-bold text-slate-800 uppercase mb-6 border-b-2 border-slate-200 pb-2 ${erphs[0].subject === 'Pendidikan Islam' ? 'font-jawi text-2xl' : ''}`}>{getLabels(erphs[0].subject === 'Pendidikan Islam').weeklyComment}</h3>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex-1">
              <p className="text-lg font-medium italic text-slate-800 whitespace-pre-wrap leading-relaxed">
                "{erphs[0].reviewComment}"
              </p>
            </div>
            
            <div className={`mt-16 pt-8 border-t-2 border-slate-900 flex flex-col ${erphs[0].subject === 'Pendidikan Islam' ? 'items-start' : 'items-end'}`}>
              <div className="text-center w-72">
                {erphs[0].reviewSignature && erphs[0].reviewSignature.trim() !== "" && (
                  <img src={erphs[0].reviewSignature} alt="Tandatangan" className="h-24 object-contain mix-blend-multiply mx-auto mb-4" />
                )}
                <p className={`text-sm font-black uppercase tracking-widest text-slate-900 border-t border-slate-400 pt-2 ${erphs[0].subject === 'Pendidikan Islam' ? 'font-jawi text-lg' : ''}`}>
                  {erphs[0].reviewedBy || getLabels(erphs[0].subject === 'Pendidikan Islam').admin}
                </p>
                {erphs[0].reviewerDesignation && (
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mt-1">
                    {erphs[0].reviewerDesignation}
                  </p>
                )}
                {erphs[0].reviewedAt && (
                  <p className="text-xs font-medium text-slate-500 mt-2">
                    Tarikh: {new Date(erphs[0].reviewedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (hideModal) return content;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-fadeIn print:static print:inset-auto print:z-auto print:p-0 print:bg-transparent print:block print:overflow-visible">
      <div className="bg-white w-full max-w-5xl h-full rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20 print:static print:w-full print:max-w-none print:h-auto print:rounded-none print:shadow-none print:border-none print:overflow-visible print:block">
        {/* Header */}
        <div className="p-4 sm:p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white sticky top-0 z-10 print:hidden">
          <button 
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-xs uppercase transition-all self-start sm:self-auto"
          >
            <ChevronLeft size={18} /> KEMBALI
          </button>
          
          <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full sm:w-auto justify-end">
            <button 
              type="button"
              onClick={handleDownloadPDF}
              disabled={isPrinting || isGenerating}
              className="flex items-center gap-1.5 md:gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 md:px-5 py-2.5 md:py-3 rounded-xl font-black text-[10px] uppercase transition-all border border-slate-200 active:scale-95 cursor-pointer disabled:opacity-50"
              title="Buka fail PDF RPH di tab Chrome baharu untuk muat turun"
            >
              {isPrinting ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Download size={16} />}
              <span>MUAT TURUN PDF (TAB BARU)</span>
            </button>

            <button 
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || isGenerating}
              className="flex items-center gap-1.5 md:gap-2 bg-slate-900 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-black text-[10px] uppercase hover:bg-slate-800 transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
              title="Buka halaman cetak di tab Chrome baharu"
            >
              <Printer size={16} />
              <span>CETAK (TAB BARU)</span>
            </button>
            
            {onSubmit && (
              <button 
                type="button"
                onClick={handleBulkSubmit}
                disabled={isGenerating || isPrinting}
                className="flex items-center gap-1.5 md:gap-2 bg-blue-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-black text-[10px] uppercase hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />} 
                {isGenerating ? 'MENJANA...' : 'Sah & Hantar'}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {content}

        {/* Footer Actions */}
        <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-center gap-4 print:hidden">
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sistem Rekod Pengajaran Harian Pintar &copy; 2026</p>
        </div>
      </div>
    </div>
  );
};

export default ERPHPreview;
