import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Database } from 'lucide-react';
import { MasterData } from '../types';

interface DSKPUploaderProps {
  masterData: MasterData;
  onUpdateMasterData: (data: MasterData) => Promise<boolean>;
}

const DSKPUploader: React.FC<DSKPUploaderProps> = ({ masterData, onUpdateMasterData }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processData = async (data: any[]) => {
    try {
      if (data.length === 0) throw new Error("Fail kosong.");
      
      const hierarchy: any = {};
      
      data.forEach((row, index) => {
        const subject = String(row.SUBJECT || "").trim();
        const form = String(row.FORM || "").trim();
        const title = String(row.TITLE || "").trim();
        const field = String(row.FIELD || "").trim();
        const sk = String(row.SK || "").trim();
        const sp = String(row.SP || "").trim();
        const core = String(row.CORE || "Teras").trim();

        if (!subject || !form || !title || !field || !sk || !sp) return; // Skip invalid rows

        if (!hierarchy[subject]) hierarchy[subject] = {};
        if (!hierarchy[subject][form]) hierarchy[subject][form] = {};
        if (!hierarchy[subject][form][title]) hierarchy[subject][form][title] = {};
        if (!hierarchy[subject][form][title][field]) hierarchy[subject][form][title][field] = {};
        if (!hierarchy[subject][form][title][field][sk]) hierarchy[subject][form][title][field][sk] = {};
        
        hierarchy[subject][form][title][field][sk][sp] = core;
      });

      const subjects = Object.keys(hierarchy);
      if (subjects.length === 0) {
        throw new Error("Tiada data DSKP yang sah ditemui. Pastikan nama kolum betul: SUBJECT, FORM, TITLE, FIELD, SK, SP, CORE.");
      }

      setStatus({ type: 'idle', message: 'Menyimpan data ke pangkalan data...' });

      const updatedMasterData = {
        ...masterData,
        hierarchy,
        subjects
      };

      const success = await onUpdateMasterData(updatedMasterData);
      
      if (success) {
        setStatus({ type: 'success', message: `Berjaya memuat naik ${subjects.length} subjek DSKP!` });
      } else {
        throw new Error("Gagal menyimpan ke pangkalan data.");
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || "Ralat tidak diketahui semasa memproses fail." });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatus({ type: 'idle', message: 'Memproses fail...' });

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data);
        },
        error: (error) => {
          setStatus({ type: 'error', message: `Ralat CSV: ${error.message}` });
          setIsUploading(false);
        }
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          processData(json);
        } catch (error: any) {
          setStatus({ type: 'error', message: `Ralat Excel: ${error.message}` });
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        setStatus({ type: 'error', message: 'Gagal membaca fail Excel.' });
        setIsUploading(false);
      };
      reader.readAsArrayBuffer(file);
    } else {
      setStatus({ type: 'error', message: 'Format fail tidak disokong. Sila muat naik CSV atau Excel.' });
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-violet-100 text-violet-600 rounded-2xl">
            <Database size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Muat Naik DSKP (CSV / Excel)</h2>
            <p className="text-sm text-slate-500">Kemas kini pangkalan data DSKP secara terus melalui fail CSV atau Excel (.xlsx).</p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
            <AlertCircle size={16} /> Format Fail Mesti Tepat
          </h3>
          <p className="text-xs text-amber-800 mb-4">
            Fail CSV atau Excel anda mesti mempunyai tajuk kolum (header) berikut pada baris pertama:
          </p>
          <div className="flex flex-wrap gap-2">
            {['SUBJECT', 'FORM', 'TITLE', 'FIELD', 'SK', 'SP', 'CORE'].map(col => (
              <span key={col} className="px-3 py-1 bg-white border border-amber-200 text-amber-900 rounded-lg text-xs font-mono font-bold">
                {col}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:bg-slate-50 transition-colors">
            <input
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
              id="csv-upload"
              disabled={isUploading}
            />
            <label 
              htmlFor="csv-upload"
              className={`flex flex-col items-center justify-center cursor-pointer ${isUploading ? 'opacity-50' : ''}`}
            >
              <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center mb-4">
                {isUploading ? <Loader2 size={32} className="animate-spin" /> : <FileSpreadsheet size={32} />}
              </div>
              <span className="text-sm font-bold text-slate-900 mb-1">
                {isUploading ? 'Memproses...' : 'Klik untuk pilih fail CSV atau Excel'}
              </span>
              <span className="text-xs text-slate-500">
                Hanya fail berformat .csv, .xlsx, atau .xls dibenarkan
              </span>
            </label>
          </div>

          <div className="border-2 border-slate-200 rounded-3xl p-8 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                <Database size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Pautan Google Sheet (CSV)</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Pastikan Google Sheet anda telah diterbitkan ke web (File &gt; Share &gt; Publish to web) dalam format <strong>CSV</strong>.
            </p>
            <div className="flex flex-col gap-3">
              <input 
                type="url" 
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-violet-100 outline-none"
                id="sheet-url"
              />
              <button 
                onClick={() => {
                  const url = (document.getElementById('sheet-url') as HTMLInputElement).value;
                  if (!url) return;
                  setIsUploading(true);
                  setStatus({ type: 'idle', message: 'Memuat turun data dari pautan...' });
                  
                  Papa.parse(url, {
                    download: true,
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                      processData(results.data);
                    },
                    error: (error) => {
                      setStatus({ type: 'error', message: `Ralat Pautan: ${error.message}` });
                      setIsUploading(false);
                    }
                  });
                }}
                disabled={isUploading}
                className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-violet-600 transition-colors disabled:opacity-50"
              >
                Muat Turun & Proses
              </button>
            </div>
          </div>
        </div>

        {status.type !== 'idle' && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 ${
            status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="text-sm font-medium">{status.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DSKPUploader;
