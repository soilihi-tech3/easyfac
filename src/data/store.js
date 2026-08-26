// EasyFac - Data Store (API based with Offline Sync Engine)

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// ---- Active Currency Information for Dynamic Viewing ----
let activeViewDevise = 'FCFA';
let baseDevise = 'FCFA';
let activeRates = null;

export const setActiveCurrencyInfo = (viewDevise, base, rates) => {
  activeViewDevise = viewDevise || 'FCFA';
  baseDevise = base || 'FCFA';
  activeRates = rates;
};

export const convertCurrency = (amount, fromDevise, toDevise, rates) => {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return 0;
  if (!fromDevise || !toDevise || fromDevise === toDevise) return Number(amount);
  
  const ratesObj = rates || activeRates;
  if (!ratesObj) return Number(amount);
  
  const fromKey = fromDevise === 'FCFA' ? 'XOF' : fromDevise;
  const toKey = toDevise === 'FCFA' ? 'XOF' : toDevise;
  
  const fromRate = ratesObj[fromKey];
  const toRate = ratesObj[toKey];
  
  if (!fromRate || !toRate) return Number(amount);
  
  const amountInUSD = Number(amount) / fromRate;
  return amountInUSD * toRate;
};

const convertFactureToView = (f) => {
  if (!f) return f;
  const cloned = { ...f };
  cloned.prixKg = convertCurrency(f.prixKg, baseDevise, activeViewDevise);
  cloned.fraisFret = convertCurrency(f.fraisFret, baseDevise, activeViewDevise);
  cloned.montantTotal = convertCurrency(f.montantTotal, baseDevise, activeViewDevise);
  cloned.montantPaye = convertCurrency(f.montantPaye, baseDevise, activeViewDevise);
  cloned.montantComores = convertCurrency(f.montantComores, baseDevise, activeViewDevise);
  
  if (cloned.articles) {
    cloned.articles = cloned.articles.map(a => ({
      ...a,
      prixUnitaire: convertCurrency(a.prixUnitaire, baseDevise, activeViewDevise),
      total: convertCurrency(a.total, baseDevise, activeViewDevise)
    }));
  }
  return cloned;
};

const convertFactureToBase = (data) => {
  if (!data) return data;
  const cloned = JSON.parse(JSON.stringify(data));
  cloned.prixKg = convertCurrency(cloned.prixKg, activeViewDevise, baseDevise);
  cloned.fraisFret = convertCurrency(cloned.fraisFret, activeViewDevise, baseDevise);
  cloned.montantTotal = convertCurrency(cloned.montantTotal, activeViewDevise, baseDevise);
  cloned.montantPaye = convertCurrency(cloned.montantPaye, activeViewDevise, baseDevise);
  cloned.montantComores = convertCurrency(cloned.montantComores, activeViewDevise, baseDevise);
  
  if (cloned.articles) {
    cloned.articles = cloned.articles.map(a => {
      a.prixUnitaire = convertCurrency(a.prixUnitaire, activeViewDevise, baseDevise);
      a.total = convertCurrency(a.total, activeViewDevise, baseDevise);
      return a;
    });
  }
  return cloned;
};

const convertDepenseToView = (d) => {
  if (!d) return d;
  return {
    ...d,
    montant: convertCurrency(d.montant, baseDevise, activeViewDevise)
  };
};

const convertEpargneToView = (e) => {
  if (!e) return e;
  return {
    ...e,
    montant: convertCurrency(e.montant, baseDevise, activeViewDevise)
  };
};

// Network helper for unique ID generation
const generateLocalId = () => `local-${Math.random().toString(36).substr(2, 9)}`;

// Network checking
export const isOnline = () => window.navigator.onLine;

// ---- Local Cache Helpers ----
const getLocalCache = (key) => {
  try {
    const data = localStorage.getItem(`ef_cache_${key}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const setLocalCache = (key, data) => {
  try {
    localStorage.setItem(`ef_cache_${key}`, JSON.stringify(data));
  } catch (e) {
    console.error(`Error caching ${key}:`, e);
  }
};

// Queue operations
const getSyncQueue = () => {
  try {
    return JSON.parse(localStorage.getItem('ef_sync_queue') || '[]');
  } catch (e) {
    return [];
  }
};

const setSyncQueue = (queue) => {
  localStorage.setItem('ef_sync_queue', JSON.stringify(queue));
};

const pushToSyncQueue = (action) => {
  const queue = getSyncQueue();
  queue.push(action);
  setSyncQueue(queue);
  console.log('Action pushed to sync queue:', action);
  // Attempt sync if network is active
  if (isOnline()) {
    syncOfflineData();
  }
};

// ---- Synchronizer Status state ----
let isSyncing = false;

export const syncOfflineData = async (onSyncProgress) => {
  if (isSyncing) return;
  if (!isOnline()) return;

  const queue = getSyncQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  console.log(`Starting synchronization of ${queue.length} offline operations...`);

  let currentQueue = [...queue];
  const idMap = {}; // Maps temp local-xxx IDs to server IDs

  try {
    while (currentQueue.length > 0) {
      const action = currentQueue[0];
      const token = localStorage.getItem('token');

      // Swap any temporary IDs in the body/url of the request
      let updatedUrl = action.url;
      let updatedBody = action.body ? { ...action.body } : null;

      // Swap in URL (e.g. update/delete of local item)
      Object.keys(idMap).forEach(tempId => {
        if (updatedUrl.includes(tempId)) {
          updatedUrl = updatedUrl.replace(tempId, idMap[tempId]);
        }
      });

      // Swap in Body (e.g. invoice referring to expediteurId / destinataireId / voyageId)
      if (updatedBody) {
        Object.keys(updatedBody).forEach(key => {
          const val = updatedBody[key];
          if (typeof val === 'string' && idMap[val]) {
            updatedBody[key] = idMap[val];
          } else if (typeof val === 'object' && val !== null) {
            // Nested object (like expediteur/destinataire subfields)
            if (val.id && idMap[val.id]) {
              val.id = idMap[val.id];
            }
          }
        });
      }

      console.log(`Syncing action: ${action.method} ${updatedUrl}`, updatedBody);

      // Perform fetch request
      const options = {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      };
      if (updatedBody) options.body = JSON.stringify(updatedBody);

      const res = await fetch(`${API_URL}${updatedUrl}`, options);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur synchronisation API');
      }

      const result = await res.json();

      // If we created a resource, map its temporary local ID to the new official server ID
      if (action.tempId && result.id) {
        idMap[action.tempId] = result.id;
        console.log(`Mapped local ID ${action.tempId} -> Server ID ${result.id}`);
      }

      // Shift successful item from the queue
      currentQueue.shift();
      setSyncQueue(currentQueue);

      if (onSyncProgress) onSyncProgress(currentQueue.length);
    }

    console.log('Synchronization completed successfully!');
    
    // Clear temp objects from cache and trigger clean server refresh
    // We clean all local caches so they are fetched clean from server
    localStorage.removeItem('ef_cache_clients');
    localStorage.removeItem('ef_cache_voyages');
    localStorage.removeItem('ef_cache_factures');
    localStorage.removeItem('ef_cache_depenses');
    localStorage.removeItem('ef_cache_epargnes');

    // Notify layouts
    window.dispatchEvent(new Event('offline-sync-completed'));
  } catch (err) {
    console.error('Offline synchronization failed:', err.message);
  } finally {
    isSyncing = false;
  }
};

// ---- Helpers ----
const apiCall = async (url, method = 'GET', body = null) => {
  const token = localStorage.getItem('token');
  const options = { 
    method, 
    cache: 'no-store',
    headers: { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    } 
  };
  if (body) options.body = JSON.stringify(body);

  if (!isOnline()) {
    throw new Error('OFFLINE');
  }

  const res = await fetch(`${API_URL}${url}`, options);
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Le serveur backend a retourné une réponse non-JSON ou est en cours de démarrage.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erreur réseau');
  }
  return res.json();
};

// Listen to browser network reconnection events automatically
window.addEventListener('online', () => {
  console.log('Internet connection restored. Triggering sync...');
  syncOfflineData();
});

// ---- Seed Demo Data ----
export const seedDemoData = async () => {
  if (localStorage.getItem('ef_seeded_api')) return;
  localStorage.setItem('ef_seeded_api', '1');
};

// ---- CLIENTS ----
export const getClients = async () => {
  try {
    if (isOnline()) {
      const data = await apiCall('/api/clients');
      setLocalCache('clients', data);
      return data;
    }
  } catch (e) {
    console.log('Falling back to local cache for clients...');
  }
  return getLocalCache('clients');
};

export const addClient = async (data) => {
  if (!isOnline()) {
    const tempId = generateLocalId();
    const newClient = { id: tempId, ...data, createdAt: new Date().toISOString() };
    const list = getLocalCache('clients');
    list.push(newClient);
    setLocalCache('clients', list);

    pushToSyncQueue({ method: 'POST', url: '/api/clients', body: data, tempId });
    return newClient;
  }

  const res = await apiCall('/api/clients', 'POST', data);
  const list = getLocalCache('clients');
  list.push(res);
  setLocalCache('clients', list);
  return res;
};

export const updateClient = async (id, data) => {
  if (!isOnline()) {
    const list = getLocalCache('clients');
    const idx = list.findIndex(c => c.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
      setLocalCache('clients', list);
    }
    pushToSyncQueue({ method: 'PUT', url: `/api/clients/${id}`, body: data });
    return { id, ...data };
  }

  const res = await apiCall(`/api/clients/${id}`, 'PUT', data);
  const list = getLocalCache('clients');
  const idx = list.findIndex(c => c.id === id);
  if (idx !== -1) {
    list[idx] = res;
    setLocalCache('clients', list);
  }
  return res;
};

export const deleteClient = async (id) => {
  if (!isOnline()) {
    const list = getLocalCache('clients');
    setLocalCache('clients', list.filter(c => c.id !== id));
    pushToSyncQueue({ method: 'DELETE', url: `/api/clients/${id}` });
    return { success: true };
  }

  await apiCall(`/api/clients/${id}`, 'DELETE');
  const list = getLocalCache('clients');
  setLocalCache('clients', list.filter(c => c.id !== id));
  return { success: true };
};

// ---- VOYAGES ----
export const getVoyages = async () => {
  try {
    if (isOnline()) {
      const data = await apiCall('/api/voyages');
      setLocalCache('voyages', data);
      return data;
    }
  } catch (e) {
    console.log('Falling back to local cache for voyages...');
  }
  return getLocalCache('voyages');
};

export const addVoyage = async (data) => {
  if (!isOnline()) {
    const tempId = generateLocalId();
    const newVoyage = { id: tempId, ...data, statut: 'en_cours', createdAt: new Date().toISOString() };
    const list = getLocalCache('voyages');
    list.push(newVoyage);
    setLocalCache('voyages', list);

    pushToSyncQueue({ method: 'POST', url: '/api/voyages', body: data, tempId });
    return newVoyage;
  }

  const res = await apiCall('/api/voyages', 'POST', data);
  const list = getLocalCache('voyages');
  list.push(res);
  setLocalCache('voyages', list);
  return res;
};

export const updateVoyage = async (id, data) => {
  if (!isOnline()) {
    const list = getLocalCache('voyages');
    const idx = list.findIndex(v => v.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
      setLocalCache('voyages', list);
    }
    pushToSyncQueue({ method: 'PUT', url: `/api/voyages/${id}`, body: data });
    return { id, ...data };
  }

  const res = await apiCall(`/api/voyages/${id}`, 'PUT', data);
  const list = getLocalCache('voyages');
  const idx = list.findIndex(v => v.id === id);
  if (idx !== -1) {
    list[idx] = res;
    setLocalCache('voyages', list);
  }
  return res;
};

export const deleteVoyage = async (id) => {
  if (!isOnline()) {
    const list = getLocalCache('voyages');
    setLocalCache('voyages', list.filter(v => v.id !== id));
    pushToSyncQueue({ method: 'DELETE', url: `/api/voyages/${id}` });
    return { success: true };
  }

  await apiCall(`/api/voyages/${id}`, 'DELETE');
  const list = getLocalCache('voyages');
  setLocalCache('voyages', list.filter(v => v.id !== id));
  return { success: true };
};

// ---- FACTURES ----
export const getFactures = async () => {
  let data;
  try {
    if (isOnline()) {
      data = await apiCall('/api/factures');
      setLocalCache('factures', data);
    } else {
      data = getLocalCache('factures');
    }
  } catch (e) {
    console.log('Falling back to local cache for factures...');
    data = getLocalCache('factures');
  }
  return data.map(convertFactureToView);
};

export const getNextNumero = async () => {
  const params = await getParametres();
  const format = params.config?.formatNumero || 'Fac-{YEAR2}-{NUM2}';
  
  // Calculate count local size of factures to find next count
  const factures = getLocalCache('factures');
  const count = factures.length + (getSyncQueue().filter(q => q.url === '/api/factures').length) + 1;

  const year = new Date().getFullYear();
  const year2 = String(year).slice(-2);
  const num4 = String(count).padStart(4, '0');
  const num2 = String(count).padStart(2, '0');
  return format
    .replace('{YEAR}', year)
    .replace('{YEAR2}', year2)
    .replace('{NUM}', num4)
    .replace('{NUM2}', num2);
};

const processFactureClients = async (data) => {
  let expId = data.expediteur?.id;
  if (!expId && data.expediteur?.nom) {
    const exp = await addClient(data.expediteur);
    expId = exp.id;
  }
  let destId = data.destinataire?.id;
  if (!destId && data.destinataire?.nom) {
    const dest = await addClient(data.destinataire);
    destId = dest.id;
  }
  return { ...data, expediteurId: expId, destinataireId: destId };
};

export const addFacture = async (data) => {
  const baseData = convertFactureToBase(data);
  const processedData = await processFactureClients(baseData);

  if (!isOnline()) {
    const tempId = generateLocalId();
    const newFacture = {
      id: tempId,
      ...processedData,
      createdAt: new Date().toISOString(),
      creePar: { nom: 'Admin', prenom: 'Super', role: 'admin' }
    };
    
    const list = getLocalCache('factures');
    list.unshift(newFacture);
    setLocalCache('factures', list);

    pushToSyncQueue({ method: 'POST', url: '/api/factures', body: processedData, tempId });
    return convertFactureToView(newFacture);
  }

  const res = await apiCall('/api/factures', 'POST', processedData);
  const list = getLocalCache('factures');
  list.unshift(res);
  setLocalCache('factures', list);
  return convertFactureToView(res);
};

export const updateFacture = async (id, data) => {
  const baseData = convertFactureToBase(data);
  const processedData = await processFactureClients(baseData);

  if (!isOnline()) {
    const list = getLocalCache('factures');
    const idx = list.findIndex(f => f.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...processedData };
      setLocalCache('factures', list);
    }
    pushToSyncQueue({ method: 'PUT', url: `/api/factures/${id}`, body: processedData });
    return convertFactureToView({ id, ...processedData });
  }

  const res = await apiCall(`/api/factures/${id}`, 'PUT', processedData);
  const list = getLocalCache('factures');
  const idx = list.findIndex(f => f.id === id);
  if (idx !== -1) {
    list[idx] = res;
    setLocalCache('factures', list);
  }
  return convertFactureToView(res);
};

export const deleteFacture = async (id) => {
  if (!isOnline()) {
    const list = getLocalCache('factures');
    setLocalCache('factures', list.filter(f => f.id !== id));
    pushToSyncQueue({ method: 'DELETE', url: `/api/factures/${id}` });
    return { success: true };
  }

  await apiCall(`/api/factures/${id}`, 'DELETE');
  const list = getLocalCache('factures');
  setLocalCache('factures', list.filter(f => f.id !== id));
  return { success: true };
};

// ---- DEPENSES ----
export const getDepenses = async () => {
  let data;
  try {
    if (isOnline()) {
      data = await apiCall('/api/depenses');
      setLocalCache('depenses', data);
    } else {
      data = getLocalCache('depenses');
    }
  } catch (e) {
    console.log('Falling back to local cache for depenses...');
    data = getLocalCache('depenses');
  }
  return data.map(convertDepenseToView);
};

export const addDepense = async (data) => {
  const baseData = {
    ...data,
    montant: convertCurrency(data.montant, activeViewDevise, baseDevise)
  };

  if (!isOnline()) {
    const tempId = generateLocalId();
    const newDepense = {
      id: tempId,
      ...baseData,
      createdAt: new Date().toISOString(),
      creePar: { nom: 'Admin', prenom: 'Super', role: 'admin' }
    };
    const list = getLocalCache('depenses');
    list.unshift(newDepense);
    setLocalCache('depenses', list);

    pushToSyncQueue({ method: 'POST', url: '/api/depenses', body: baseData, tempId });
    return convertDepenseToView(newDepense);
  }

  const res = await apiCall('/api/depenses', 'POST', baseData);
  const list = getLocalCache('depenses');
  list.unshift(res);
  setLocalCache('depenses', list);
  return convertDepenseToView(res);
};

export const updateDepense = async (id, data) => {
  const baseData = {
    ...data,
    montant: convertCurrency(data.montant, activeViewDevise, baseDevise)
  };

  if (!isOnline()) {
    const list = getLocalCache('depenses');
    const idx = list.findIndex(d => d.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...baseData };
      setLocalCache('depenses', list);
    }
    pushToSyncQueue({ method: 'PUT', url: `/api/depenses/${id}`, body: baseData });
    return convertDepenseToView({ id, ...baseData });
  }

  const res = await apiCall(`/api/depenses/${id}`, 'PUT', baseData);
  const list = getLocalCache('depenses');
  const idx = list.findIndex(d => d.id === id);
  if (idx !== -1) {
    list[idx] = res;
    setLocalCache('depenses', list);
  }
  return convertDepenseToView(res);
};

export const deleteDepense = async (id) => {
  if (!isOnline()) {
    const list = getLocalCache('depenses');
    setLocalCache('depenses', list.filter(d => d.id !== id));
    pushToSyncQueue({ method: 'DELETE', url: `/api/depenses/${id}` });
    return { success: true };
  }

  await apiCall(`/api/depenses/${id}`, 'DELETE');
  const list = getLocalCache('depenses');
  setLocalCache('depenses', list.filter(d => d.id !== id));
  return { success: true };
};

// ---- EPARGNES ----
export const getEpargnes = async () => {
  let data;
  try {
    if (isOnline()) {
      data = await apiCall('/api/epargnes');
      setLocalCache('epargnes', data);
    } else {
      data = getLocalCache('epargnes');
    }
  } catch (e) {
    console.log('Falling back to local cache for epargnes...');
    data = getLocalCache('epargnes');
  }
  return data.map(convertEpargneToView);
};

export const addEpargne = async (data) => {
  const baseData = {
    ...data,
    montant: convertCurrency(data.montant, activeViewDevise, baseDevise)
  };

  if (!isOnline()) {
    const tempId = generateLocalId();
    const newEpargne = {
      id: tempId,
      ...baseData,
      createdAt: new Date().toISOString(),
      creePar: { nom: 'Admin', prenom: 'Super', role: 'admin' }
    };
    const list = getLocalCache('epargnes');
    list.unshift(newEpargne);
    setLocalCache('epargnes', list);

    pushToSyncQueue({ method: 'POST', url: '/api/epargnes', body: baseData, tempId });
    return convertEpargneToView(newEpargne);
  }

  const res = await apiCall('/api/epargnes', 'POST', baseData);
  const list = getLocalCache('epargnes');
  list.unshift(res);
  setLocalCache('epargnes', list);
  return convertEpargneToView(res);
};

export const updateEpargne = async (id, data) => {
  const baseData = {
    ...data,
    montant: convertCurrency(data.montant, activeViewDevise, baseDevise)
  };

  if (!isOnline()) {
    const list = getLocalCache('epargnes');
    const idx = list.findIndex(e => e.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...baseData };
      setLocalCache('epargnes', list);
    }
    pushToSyncQueue({ method: 'PUT', url: `/api/epargnes/${id}`, body: baseData });
    return convertEpargneToView({ id, ...baseData });
  }

  const res = await apiCall(`/api/epargnes/${id}`, 'PUT', baseData);
  const list = getLocalCache('epargnes');
  const idx = list.findIndex(e => e.id === id);
  if (idx !== -1) {
    list[idx] = res;
    setLocalCache('epargnes', list);
  }
  return convertEpargneToView(res);
};

export const deleteEpargne = async (id) => {
  if (!isOnline()) {
    const list = getLocalCache('epargnes');
    setLocalCache('epargnes', list.filter(e => e.id !== id));
    pushToSyncQueue({ method: 'DELETE', url: `/api/epargnes/${id}` });
    return { success: true };
  }

  await apiCall(`/api/epargnes/${id}`, 'DELETE');
  const list = getLocalCache('epargnes');
  setLocalCache('epargnes', list.filter(e => e.id !== id));
  return { success: true };
};

// ---- PARAMETRES ----
export const getParametres = async () => {
  try {
    if (isOnline()) {
      const data = await apiCall('/api/parametres');
      if (data.config && Object.keys(data.config).length > 0) {
        localStorage.setItem('ef_cache_parametres', JSON.stringify(data));
        return data;
      }
    }
  } catch (err) {
    console.log('Falling back to local cache for parametres...');
  }

  try {
    const data = localStorage.getItem('ef_cache_parametres');
    if (data) return JSON.parse(data);
  } catch (e) {}

  return {
    entreprise: { nom: 'Mon Entreprise', telephone1: '', email: '', adresse: '', lieuComores: '', telComores1: '', telComores2: '' },
    config: { prixKg: 6000, devise: 'FCFA', couleurPrimaire: '#6366f1', modeSombre: true, formatNumero: 'Fac-{YEAR2}-{NUM2}', modeleFacture: 'moderne', compteur: 0 },
  };
};

export const updateParametres = async (data) => {
  if (!isOnline()) {
    localStorage.setItem('ef_cache_parametres', JSON.stringify(data));
    pushToSyncQueue({ method: 'PUT', url: '/api/parametres', body: data });
    return data;
  }

  const current = await getParametres();
  const merged = { ...current, ...data };
  const res = await apiCall('/api/parametres', 'PUT', merged);
  localStorage.setItem('ef_cache_parametres', JSON.stringify(merged));
  return res;
};

// ---- STATISTIQUES ----
export const getStats = async () => {
  const [factures, depenses, clients] = await Promise.all([
    getFactures(), getDepenses(), getClients()
  ]);

  const totalCA = factures.reduce((s, f) => s + Number(f.montantTotal || 0), 0);
  const totalPaye = factures.reduce((s, f) => s + Number(f.montantPaye || 0), 0);
  const totalResteAPayer = totalCA - totalPaye;
  const totalDepenses = depenses.reduce((s, d) => s + (Number(d.montant) * Number(d.quantite || 1)), 0);
  const beneficeNet = totalPaye - totalDepenses;

  const facturesPaye = factures.filter(f => f.statut === 'paye').length;
  const facturesPartiel = factures.filter(f => f.statut === 'partiel').length;
  const facturesImpaye = factures.filter(f => f.statut === 'non_paye').length;

  const monthly = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthly[key] = { mois: d.toLocaleDateString('fr-FR', { month: 'short' }), ca: 0, paye: 0 };
  }
  factures.forEach(f => {
    if (!f.createdAt) return;
    const d = new Date(f.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthly[key]) {
      monthly[key].ca += Number(f.montantTotal || 0);
      monthly[key].paye += Number(f.montantPaye || 0);
    }
  });

  return {
    totalCA, totalPaye, totalResteAPayer, totalDepenses, beneficeNet,
    facturesPaye, facturesPartiel, facturesImpaye,
    totalClients: clients.length,
    totalFactures: factures.length,
    monthly: Object.values(monthly),
  };
};

export const getStatsVoyage = async (voyageId) => {
  const [facturesAll, depensesAll] = await Promise.all([getFactures(), getDepenses()]);
  const factures = facturesAll.filter(f => f.voyageId === voyageId);
  const depenses = depensesAll.filter(d => d.voyageId === voyageId);
  const totalEncaisse = factures.reduce((s, f) => s + Number(f.montantPaye || 0), 0);
  const totalDepenses = depenses.reduce((s, d) => s + (Number(d.montant) * Number(d.quantite || 1)), 0);
  return { totalEncaisse, totalDepenses, benefice: totalEncaisse - totalDepenses, nbFactures: factures.length };
};

// Utils
export const formatCurrency = (amount, devise = 'FCFA') => {
  let displayAmount = amount || 0;
  let displayDevise = devise;

  if (activeViewDevise && activeRates) {
    if (devise === baseDevise) {
      displayAmount = convertCurrency(amount, baseDevise, activeViewDevise);
      displayDevise = activeViewDevise;
    }
  }

  return new Intl.NumberFormat('fr-FR').format(displayAmount || 0) + ' ' + displayDevise;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Synchronous Cache Getters for Instant UI Rendering (SWR Pattern)
export const getClientsCache = () => getLocalCache('clients');
export const getFacturesCache = () => getLocalCache('factures').map(convertFactureToView);
export const getVoyagesCache = () => getLocalCache('voyages');
export const getDepensesCache = () => getLocalCache('depenses').map(convertDepenseToView);
export const getEpargnesCache = () => getLocalCache('epargnes').map(convertEpargneToView);
export const getParametresCache = () => {
  try {
    const data = localStorage.getItem('ef_cache_parametres');
    if (data) return JSON.parse(data);
  } catch (e) {}
  return {
    entreprise: { nom: 'Mon Entreprise', telephone1: '', email: '', adresse: '', lieuComores: '', telComores1: '', telComores2: '' },
    config: { prixKg: 6000, devise: 'FCFA', couleurPrimaire: '#6366f1', modeSombre: true, formatNumero: 'Fac-{YEAR2}-{NUM2}', modeleFacture: 'moderne', compteur: 0 },
  };
};

// ---- SUPERADMIN ----
export const getSuperAdminBoutiques = async () => {
  return apiCall('/api/superadmin/boutiques');
};

export const createSuperAdminBoutique = async (data) => {
  return apiCall('/api/superadmin/boutiques', 'POST', data);
};

export const updateSuperAdminBoutique = async (id, data) => {
  return apiCall(`/api/superadmin/boutiques/${id}`, 'PUT', data);
};

export const deleteSuperAdminBoutique = async (id) => {
  return apiCall(`/api/superadmin/boutiques/${id}`, 'DELETE');
};

export const changeBoutiquePassword = async (id, newPassword) => {
  return apiCall(`/api/superadmin/boutiques/${id}/change-password`, 'PUT', { newPassword });
};

export const getSuperAdminStats = async () => {
  return apiCall('/api/superadmin/statistics');
};

export const getSuperAdminEpargnes = async () => {
  return apiCall('/api/superadmin/epargnes');
};

export const createSuperAdminEpargne = async (data) => {
  return apiCall('/api/superadmin/epargnes', 'POST', data);
};

export const deleteSuperAdminEpargne = async (id) => {
  return apiCall(`/api/superadmin/epargnes/${id}`, 'DELETE');
};

// Boutique Payments
export const getSuperAdminPayments = async () => {
  return apiCall('/api/superadmin/payments');
};

export const createSuperAdminPayment = async (data) => {
  return apiCall('/api/superadmin/payments', 'POST', data);
};

export const deleteSuperAdminPayment = async (id) => {
  return apiCall(`/api/superadmin/payments/${id}`, 'DELETE');
};

export const sendBoutiquePaymentReminder = async (data) => {
  return apiCall('/api/superadmin/payments/reminder', 'POST', data);
};

// Admin Personal Expenses
export const getSuperAdminDepenses = async () => {
  return apiCall('/api/superadmin/depenses');
};

export const createSuperAdminDepense = async (data) => {
  return apiCall('/api/superadmin/depenses', 'POST', data);
};

export const deleteSuperAdminDepense = async (id) => {
  return apiCall(`/api/superadmin/depenses/${id}`, 'DELETE');
};


