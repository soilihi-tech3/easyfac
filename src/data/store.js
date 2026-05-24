// EasyFac - Data Store (API based)

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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
  const res = await fetch(`${API_URL}${url}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erreur réseau');
  }
  return res.json();
};

// ---- Seed Demo Data ----
export const seedDemoData = async () => {
  if (localStorage.getItem('ef_seeded_api')) return;
  // Optionnel : Appel à /api/seed si implémenté côté serveur
  localStorage.setItem('ef_seeded_api', '1');
};

// ---- CLIENTS ----
export const getClients = () => apiCall('/api/clients');
export const addClient = (data) => apiCall('/api/clients', 'POST', data);
export const updateClient = (id, data) => apiCall(`/api/clients/${id}`, 'PUT', data);
export const deleteClient = (id) => apiCall(`/api/clients/${id}`, 'DELETE');

// ---- VOYAGES ----
export const getVoyages = () => apiCall('/api/voyages');
export const addVoyage = (data) => apiCall('/api/voyages', 'POST', data);
export const updateVoyage = (id, data) => apiCall(`/api/voyages/${id}`, 'PUT', data);
export const deleteVoyage = (id) => apiCall(`/api/voyages/${id}`, 'DELETE');

// ---- FACTURES ----
export const getFactures = () => apiCall('/api/factures');

export const getNextNumero = async () => {
  const params = await getParametres();
  const format = params.config?.formatNumero || 'Fac-{YEAR2}-{NUM2}';
  const count = (params.config?.compteur || 0) + 1;
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
  const processedData = await processFactureClients(data);
  const res = await apiCall('/api/factures', 'POST', processedData);
  return res;
};

export const updateFacture = async (id, data) => {
  const processedData = await processFactureClients(data);
  return apiCall(`/api/factures/${id}`, 'PUT', processedData);
};
export const deleteFacture = (id) => apiCall(`/api/factures/${id}`, 'DELETE');

// ---- DEPENSES ----
export const getDepenses = () => apiCall('/api/depenses');
export const addDepense = (data) => apiCall('/api/depenses', 'POST', data);
export const updateDepense = (id, data) => apiCall(`/api/depenses/${id}`, 'PUT', data);
export const deleteDepense = (id) => apiCall(`/api/depenses/${id}`, 'DELETE');

// ---- PARAMETRES ----
export const getParametres = async () => {
  try {
    const data = await apiCall('/api/parametres');
    if (!data.config || Object.keys(data.config).length === 0) {
      return {
        entreprise: { nom: 'Mon Entreprise', telephone1: '', email: '', adresse: '', lieuComores: '', telComores1: '', telComores2: '' },
        config: { prixKg: 6000, devise: 'FCFA', couleurPrimaire: '#6366f1', modeSombre: true, formatNumero: 'Fac-{YEAR2}-{NUM2}', modeleFacture: 'moderne', compteur: 0 },
      };
    }
    return data;
  } catch (err) {
    return { entreprise: {}, config: {} };
  }
};

export const updateParametres = async (data) => {
  const current = await getParametres();
  const merged = { ...current, ...data };
  return apiCall('/api/parametres', 'PUT', merged);
};

// ---- STATISTIQUES ----
// Local computation using the data from API
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
  return new Intl.NumberFormat('fr-FR').format(amount || 0) + ' ' + devise;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
