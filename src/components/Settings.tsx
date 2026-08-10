import React, { useState } from 'react';

interface SettingsProps {
  groqApiKey: string | null;
  onSaveApiKey: (key: string) => void;
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ groqApiKey, onSaveApiKey, onBack }) => {
  const [apiKey, setApiKey] = useState(groqApiKey || '');

  const handleSave = () => {
    onSaveApiKey(apiKey);
    alert('Kunci API Groq telah disimpan!');
    onBack();
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Tetapan</h1>
        
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Kunci API Groq</h2>
          <p className="text-sm text-gray-500 mb-4">
            Untuk menggunakan penjanaan AI, anda memerlukan Kunci API Groq. Sila masukkan kunci anda di bawah.
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="gsk_..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="mb-6 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Bagaimana untuk mendapatkan Kunci API Groq?</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Layari <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Groq Console</a>.</li>
            <li>Daftar masuk dengan akaun anda.</li>
            <li>Klik pada butang "Create API Key".</li>
            <li>Salin kunci yang dijana dan tampalkannya di ruangan di atas.</li>
          </ol>
        </div>

        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md" role="alert">
          <p className="font-bold">Peringatan Penting</p>
          <p>Jangan kongsikan Kunci API anda dengan sesiapa pun. Kunci ini adalah rahsia dan terikat dengan akaun anda.</p>
        </div>

        <div className="mt-8 flex justify-between items-center">
           <button
            onClick={onBack}
            className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Kembali
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Simpan Kunci API
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;