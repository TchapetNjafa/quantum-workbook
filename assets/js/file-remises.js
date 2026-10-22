/* File d'attente des remises faites sans réseau (Vercel seulement). Les remises sont gardées dans l'appareil
   (localStorage) puis envoyées dès que le réseau revient. Le serveur décide seul de l'heure de remise (heure de réception) ;
   l'heure notée ici (declared_at) n'est qu'indicative. Une remise reçue plus de 24 h après la fermeture est refusée. */
(() => {
  'use strict';
  const CLE = 'phy321.file.v1';
  const lire = () => { try { return JSON.parse(localStorage.getItem(CLE)) || []; } catch { return []; } };
  const ecrire = l => { try { l.length ? localStorage.setItem(CLE, JSON.stringify(l)) : localStorage.removeItem(CLE); } catch { /* stockage bloqué */ } };
  const prevenir = () => window.dispatchEvent(new CustomEvent('phy321:file'));
  let enCours = false;

  const File = {
    liste: lire,
    /** Garde une remise sur l'appareil (une seule par devoir : la plus récente remplace l'autre). */
    ajouter({ devoir, titre, limite, reponses }) {
      const l = lire().filter(x => x.devoir !== devoir);
      l.push({ id: `${devoir}-${Date.now()}`, devoir, titre, limite, reponses, declared_at: new Date().toISOString(), etat: 'attente' });
      ecrire(l); prevenir();
    },
    retirer(id) { ecrire(lire().filter(x => x.id !== id)); prevenir(); },
    /** Envoie les remises en attente. S'arrête au premier échec réseau ; marque « refusée » les rejets définitifs du serveur. */
    async flush() {
      if (enCours) return; enCours = true;
      try {
        for (const item of lire().filter(x => x.etat === 'attente')) {
          let r;
          try {
            r = await fetch(`/api/devoirs/${item.devoir}/remise`, {
              method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reponses: item.reponses, declared_at: item.declared_at, offline: true })
            });
          } catch { break; }                       // toujours hors connexion : on réessaiera
          if (r.status === 401 || r.status >= 500) break; // pas connecté ou serveur indisponible : on garde la remise
          if (r.ok) { File.retirer(item.id); continue; }
          const j = await r.json().catch(() => ({}));
          const l = lire().map(x => (x.id === item.id ? { ...x, etat: 'refusee', raison: j.error || String(r.status) } : x));
          ecrire(l); prevenir();
        }
      } finally { enCours = false; }
    }
  };
  window.phy321File = File;
  addEventListener('online', () => File.flush());
})();
