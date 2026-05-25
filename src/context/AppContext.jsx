import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import { getParametres, seedDemoData } from '../data/store';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [params, setParams] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const init = async () => {
      await seedDemoData();
      const p = await getParametres();
      setParams(p);
      if (p.config?.modeSombre !== false) {
        document.body.classList.remove('light');
      } else {
        document.body.classList.add('light');
      }
    };
    init();

    // 🔄 Real-time Background Polling Sync (1.5s)
    const interval = setInterval(() => {
      setRefresh(r => r + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const refreshData = useCallback(async () => {
    const p = await getParametres();
    setParams(p);
    setRefresh(r => r + 1);
  }, []);

  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const toggleTheme = useCallback(async () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    try {
      const p = await getParametres();
      const updated = { ...p, config: { ...p.config, modeSombre: !isLight } };
      await updateParametres(updated);
      setParams(updated);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const devise       = params?.config?.devise     || 'FCFA';
  const prixKg       = params?.config?.prixKg     || 6000;
  const nomEntreprise = params?.entreprise?.nom    || 'EasyFac';
  const isDark       = params?.config?.modeSombre !== false;

  const ToastIcon = ({ type }) => {
    if (type === 'success') return <CheckCircle size={15} />;
    if (type === 'error')   return <XCircle     size={15} />;
    return                         <Info        size={15} />;
  };

  return (
    <AppContext.Provider value={{ params, refreshData, toast, toggleTheme, devise, prixKg, nomEntreprise, isDark, refresh }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-icon">
              <ToastIcon type={t.type} />
            </div>
            {t.msg}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
