import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import { getParametres, updateParametres, seedDemoData, API_URL, setActiveCurrencyInfo, convertCurrency, getAppModules, updateAppModules } from '../data/store';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [params, setParams] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [viewDevise, setViewDevise] = useState(() => localStorage.getItem('ef_view_devise') || 'FCFA');
  const [rates, setRates] = useState(null);

  const baseDevise = params?.config?.devise || 'FCFA';

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

    // 🔄 Background Polling Sync (60s) to prevent API rate limits
    const interval = setInterval(() => {
      setRefresh(r => r + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch exchange rates from the backend API
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/exchange-rates`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setRates(data.rates);
        }
      } catch (err) {
        console.error('Error fetching exchange rates:', err);
      }
    };
    fetchRates();
  }, [refresh]);

  // Synchronize store.js whenever devise, baseDevise or rates change
  useEffect(() => {
    setActiveCurrencyInfo(viewDevise, baseDevise, rates);
  }, [viewDevise, baseDevise, rates]);

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

  const changeViewDevise = useCallback((newDevise) => {
    setViewDevise(newDevise);
    localStorage.setItem('ef_view_devise', newDevise);
    setRefresh(r => r + 1); // trigger reload on components
  }, []);

  const [modules, setModules] = useState({
    factures: true, clients: true, voyages: true, depenses: true,
    remboursements: true, communiques: true, flyer: true, epargne: true,
    statistiques: true, parametres: true, employes: true, devise: true
  });

  // 🚀 Fast Sync & Real-Time Broadcast for Modules (0ms cross-tab + 3s poll)
  useEffect(() => {
    let channel;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('easyfac_modules_channel');
      channel.onmessage = (event) => {
        if (event.data && event.data.type === 'MODULES_UPDATED' && event.data.modules) {
          setModules(event.data.modules);
        }
      };
    }

    const handleStorageChange = (e) => {
      if (e.key === 'ef_cache_modules' && e.newValue) {
        try {
          setModules(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const fetchFastModules = async () => {
      try {
        const m = await getAppModules();
        if (m) {
          setModules(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(m)) return m;
            return prev;
          });
        }
      } catch (err) {}
    };

    fetchFastModules();
    const pollInterval = setInterval(fetchFastModules, 3000);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, []);

  const isModuleActive = useCallback((key) => {
    if (!modules) return true;
    return modules[key] !== false;
  }, [modules]);

  const updateModules = useCallback(async (newModules) => {
    setModules(newModules);
    try {
      await updateAppModules(newModules);
      setRefresh(r => r + 1);
    } catch (err) {
      console.error('Error updating modules:', err);
    }
  }, []);

  const devise       = viewDevise;
  const prixKg       = convertCurrency(params?.config?.prixKg || 6000, baseDevise, viewDevise, rates);
  const nomEntreprise = params?.entreprise?.nom    || 'EasyFac';
  const isDark       = params?.config?.modeSombre !== false;

  const ToastIcon = ({ type }) => {
    if (type === 'success') return <CheckCircle size={15} />;
    if (type === 'error')   return <XCircle     size={15} />;
    return                         <Info        size={15} />;
  };

  return (
    <AppContext.Provider value={{
      params, refreshData, toast, toggleTheme, devise, prixKg, nomEntreprise, isDark,
      refresh, viewDevise, changeViewDevise, rates, baseDevise, convertCurrency,
      modules, isModuleActive, updateModules
    }}>
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
