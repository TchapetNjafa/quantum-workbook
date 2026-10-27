/* Page enseignant PHY321 (Vercel seulement) : verrou, liste des devoirs, création, publication, remises.
   Le serveur contrôle tout (compte Google de l'enseignant + mot de passe) ; ce script n'est qu'une interface. */
(() => {
  'use strict';
  const EN = (document.documentElement.lang || 'fr').startsWith('en');
  const t = (fr, en) => (EN ? en : fr);
  const root = document.getElementById('prof');
  if (!root) return;

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const quand = iso => (iso ? new Date(iso).toLocaleString(EN ? 'en-GB' : 'fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const api = (path, opt) => fetch(path, { credentials: 'same-origin', ...opt });
  const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const montrer = html => { root.innerHTML = html; };
  const local = iso => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  // ---------- ZIP sans compression, construit dans le navigateur (aucune bibliothèque) ----------
  const TABLE_CRC = (() => { const tb = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tb[n] = c >>> 0; } return tb; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = TABLE_CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(fichiers) {
    const enc = new TextEncoder(), parts = [], centr = []; let pos = 0;
    const d = new Date(), heure = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), jour = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of fichiers) {
      const nom = enc.encode(f.nom), crc = crc32(f.donnees), n = f.donnees.length;
      const lh = new DataView(new ArrayBuffer(30)); // en-tête local
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, heure, true); lh.setUint16(12, jour, true); lh.setUint32(14, crc, true); lh.setUint32(18, n, true); lh.setUint32(22, n, true); lh.setUint16(26, nom.length, true);
      const ch = new DataView(new ArrayBuffer(46)); // entrée du répertoire central
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, heure, true); ch.setUint16(14, jour, true); ch.setUint32(16, crc, true); ch.setUint32(20, n, true); ch.setUint32(24, n, true); ch.setUint16(28, nom.length, true); ch.setUint32(42, pos, true);
      parts.push(new Uint8Array(lh.buffer), nom, f.donnees); centr.push(new Uint8Array(ch.buffer), nom);
      pos += 30 + nom.length + n;
    }
    const taille = centr.reduce((s, p) => s + p.length, 0), fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, fichiers.length, true); fin.setUint16(10, fichiers.length, true); fin.setUint32(12, taille, true); fin.setUint32(16, pos, true);
    return new Blob([...parts, ...centr, new Uint8Array(fin.buffer)], { type: 'application/zip' });
  }
  const telecharger = (blob, nom) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000); };
  const noteTxt = x => {
    if (x.note === null) return '—';
    const auto = x.total > 0 ? `${x.note} / ${x.total}` : '';
    const manuel = x.total_manuel > 0 ? `${x.note_manuelle === null ? t('? (à noter)', '? (to mark)') : x.note_manuelle} / ${x.total_manuel}` : '';
    return [auto, manuel].filter(Boolean).join(' + ') || '—';
  };

  if (/\.github\.io$/.test(location.hostname) || location.protocol === 'file:') {
    montrer(`<p class="muted">${t('Cette page n’existe que sur le site hébergé sur Vercel.', 'This page only exists on the Vercel-hosted site.')}</p>`);
    return;
  }

  const EXEMPLE = {
    titre: t('Devoir 1 : états quantiques', 'Assignment 1: quantum states'),
    ouvre: new Date(Date.now() + 3600e3).toISOString(), ferme: new Date(Date.now() + 7 * 864e5).toISOString(),
    publie: false, resultat_visible: false,
    questions: [
      { type: 'qcm', question: t('Quelle est la probabilité de mesurer |0⟩ pour |ψ⟩ = (|0⟩ + |1⟩)/√2 ?', 'What is the probability of measuring |0⟩ for |ψ⟩ = (|0⟩ + |1⟩)/√2?'), options: ['1', '1/2', '1/4'], correct_answer: 1, points: 1 },
      { type: 'vrai_faux', question: t('Deux états proportionnels représentent le même état physique.', 'Two proportional states represent the same physical state.'), correct_answer: true },
      { type: 'numerical', question: t('Pour |ψ⟩ = 0,6|0⟩ + 0,8|1⟩, donnez P(|1⟩) en %.', 'For |ψ⟩ = 0.6|0⟩ + 0.8|1⟩, give P(|1⟩) in %.'), correct_answer: 64, tolerance: 0.5, unit: '%' }
    ]
  };

  async function verrou() {
    montrer(`<p>${t('Saisissez le mot de passe enseignant.', 'Enter the teacher password.')}</p>
      <form class="prof-ligne" data-verrou><input type="password" name="pw" autocomplete="current-password" required aria-label="${t('Mot de passe', 'Password')}">
      <button class="btn accent" type="submit">${t('Déverrouiller', 'Unlock')}</button></form><div data-msg role="status" aria-live="polite"></div>`);
    root.querySelector('[data-verrou]').onsubmit = async e => {
      e.preventDefault();
      const r = await post('/api/prof/login', { password: e.target.pw.value });
      if (r.ok) return tableau().catch(erreur);
      root.querySelector('[data-msg]').textContent = (await r.json().catch(() => ({}))).error || r.status;
    };
  }

  async function tableau() {
    const r = await api('/api/prof/devoirs');
    if (r.status === 401) return verrou();
    if (!r.ok) throw new Error('prof');
    const { devoirs } = await r.json();
    montrer(`<h2>${t('Devoirs', 'Assignments')}</h2>
      ${devoirs.length ? `<div class="tableau"><table class="plain-table"><thead><tr><th>${t('Titre', 'Title')}</th><th>${t('Ouvre', 'Opens')}</th><th>${t('Ferme', 'Closes')}</th><th>${t('Publié', 'Published')}</th><th>${t('Résultats visibles', 'Results visible')}</th><th>${t('Remises', 'Submissions')}</th><th></th></tr></thead><tbody>
      ${devoirs.map(d => `<tr data-id="${d.id}"><td>${esc(d.titre)} <span class="muted">(${d.nb_questions} q.)</span></td><td>${esc(quand(d.ouvre))}</td><td>${esc(quand(d.ferme))}</td>
        <td>${d.publie ? t('oui', 'yes') : t('non', 'no')}</td><td>${d.resultat_visible ? t('oui', 'yes') : t('non', 'no')}</td><td>${d.nb_remises}<br><span class="muted">${d.purge ? t('données supprimées le ', 'data deleted on ') + esc(quand(d.purge)) : t('suppression des remises et copies le ', 'submissions and papers deleted on ') + esc(quand(d.donnees_supprimees_le))}</span></td>
        <td><div class="prof-ligne"><button class="btn small ${d.publie ? 'ghost' : 'accent'}" type="button" data-act="publie">${d.publie ? t('Dépublier', 'Unpublish') : t('Publier', 'Publish')}</button>
        <button class="btn small ghost" type="button" data-act="visible">${d.resultat_visible ? t('Masquer les résultats', 'Hide results') : t('Montrer les résultats', 'Show results')}</button>
        <button class="btn small ghost" type="button" data-act="copie">${d.copie ? t('Copie déposée : oui', 'Paper upload: on') : t('Copie déposée : non', 'Paper upload: off')}</button>
        <button class="btn small ghost" type="button" data-act="sujet">${d.sujet ? t('Remplacer le sujet PDF', 'Replace the PDF assignment') : t('Ajouter un sujet PDF', 'Add a PDF assignment')}</button>
        <button class="btn small ghost" type="button" data-act="remises">${t('Remises', 'Submissions')}</button>
        <button class="btn small ghost" type="button" data-act="dates">${t('Dates', 'Dates')}</button></div></td></tr>`).join('')}
      </tbody></table></div>` : `<p class="muted">${t('Aucun devoir.', 'No assignment.')}</p>`}
      <div data-detail></div>
      <div class="prof-ligne"><button class="btn small ghost" type="button" data-notifier>${t('Renvoyer la notification aux étudiants', 'Send the notification to students again')}</button>
        <span class="muted" data-msg-notif role="status" aria-live="polite">${t('Les étudiants abonnés sont prévenus automatiquement à la publication d’un devoir.', 'Subscribed students are notified automatically when an assignment is published.')}</span></div>
      <h2>${t('Nouveau devoir', 'New assignment')}</h2>
      <form data-nouveau>
        <p class="muted">${t('Devoir à copie déposée : les étudiants téléchargent le sujet (PDF), composent, puis déposent leur copie (PDF ou photo). Vous attribuez ensuite la note à la main.',
          'Paper assignment: students download the PDF assignment, work it out, then upload their paper (PDF or photo). You then enter the mark by hand.')}</p>
        <div class="prof-ligne"><label>${t('Titre', 'Title')} <input type="text" name="titre" required maxlength="200" size="40"></label></div>
        <div class="prof-ligne"><label>${t('Ouvre', 'Opens')} <input type="datetime-local" name="o" required></label>
          <label>${t('Ferme', 'Closes')} <input type="datetime-local" name="f" required></label></div>
        <div class="prof-ligne"><label>${t('Sujet PDF (2 Mo maximum, facultatif)', 'PDF assignment (2 MB maximum, optional)')} <input type="file" name="sujet" accept="application/pdf"></label></div>
        <div class="prof-ligne"><label>${t('Barème (points)', 'Total mark (points)')} <input type="number" name="bareme" min="1" max="100" step="1" value="20"></label></div>
        <div class="prof-ligne"><label><input type="checkbox" name="publie"> ${t('Publier tout de suite', 'Publish now')}</label>
          <label><input type="checkbox" name="visible"> ${t('Montrer les notes après la fin du délai', 'Show marks after the deadline')}</label></div>
        <div class="btn-row"><button class="btn accent" type="submit">${t('Créer le devoir', 'Create assignment')}</button></div>
      </form>
      <div data-msg-nouveau role="status" aria-live="polite"></div>
      <details><summary>${t('Avancé : devoir avec questions (JSON)', 'Advanced: assignment with questions (JSON)')}</summary>
        <p class="muted">${t('Collez le devoir au format JSON. Types corrigés automatiquement : qcm, vrai_faux, numerical (tolérance absolue) ; interpretation : correction manuelle. Ajoutez "copie": true pour permettre aussi le dépôt d’une copie. Les réponses ne sont jamais envoyées aux étudiants.',
          'Paste the assignment as JSON. Automatically marked types: qcm, vrai_faux, numerical (absolute tolerance); interpretation: manual marking. Add "copie": true to also allow a paper upload. Answers are never sent to students.')}</p>
        <textarea data-json rows="14" spellcheck="false"></textarea>
        <div class="btn-row"><button class="btn accent" type="button" data-creer>${t('Créer le devoir', 'Create assignment')}</button>
        <button class="btn ghost" type="button" data-exemple>${t('Insérer un exemple', 'Insert an example')}</button></div>
        <div data-msg role="status" aria-live="polite"></div>
      </details>`);

    // ----- formulaire « devoir à copie déposée » -----
    const fm = root.querySelector('[data-nouveau]'), mn = root.querySelector('[data-msg-nouveau]');
    fm.o.value = local(new Date()); fm.f.value = local(new Date(Date.now() + 7 * 864e5));
    fm.onsubmit = async e => {
      e.preventDefault();
      const ouvre = new Date(fm.o.value), ferme = new Date(fm.f.value);
      if (!(ferme > ouvre)) { mn.innerHTML = `<p class="prof-erreurs">${t('La fermeture doit suivre l’ouverture.', 'The closing time must follow the opening time.')}</p>`; return; }
      const fichier = fm.sujet.files[0];
      if (fichier && fichier.size > 2 * 1024 * 1024) { mn.innerHTML = `<p class="prof-erreurs">${t('Le sujet dépasse 2 Mo.', 'The PDF is larger than 2 MB.')}</p>`; return; }
      mn.textContent = t('Création…', 'Creating…');
      // créé non publié : le sujet est envoyé AVANT la publication, pour que les étudiants le trouvent dès l'ouverture
      const rep = await post('/api/prof/devoirs', { titre: fm.titre.value.trim(), ouvre: ouvre.toISOString(), ferme: ferme.toISOString(), copie: true, questions: [],
        bareme: Number(fm.bareme.value) || 20, publie: false, resultat_visible: fm.visible.checked });
      const j = await rep.json().catch(() => ({}));
      if (rep.status === 401) return verrou();
      if (!rep.ok) { mn.innerHTML = `<p class="prof-erreurs">${esc(j.error || rep.status)}</p>${(j.erreurs || []).length ? `<ul>${j.erreurs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`; return; }
      let avertissement = '';
      if (fichier) {
        const up = await api(`/api/prof/devoirs/${j.id}/sujet`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: fichier });
        if (!up.ok) avertissement = t('Le devoir est créé mais le sujet n’a pas pu être envoyé : ', 'The assignment is created but the PDF could not be uploaded: ') + ((await up.json().catch(() => ({}))).error || up.status);
      }
      if (fm.publie.checked && !avertissement) await post(`/api/prof/devoirs/${j.id}`, { publie: true });
      await tableau();
      if (avertissement) root.querySelector('[data-msg-nouveau]').innerHTML = `<p class="prof-erreurs">${esc(avertissement)}</p>`;
    };

    // ----- profils des étudiants : matricule ↔ nom ↔ adresse, et réinitialisation en cas d'erreur -----
    const prf = document.createElement('div');
    prf.innerHTML = `<h2>${t('Profils des étudiants', 'Student profiles')}</h2>
      <p class="muted">${t('Le matricule est obligatoire pour remettre un devoir, figurer au classement et jouer un défi. Les données du classement sont supprimées 5 mois après la dernière activité.', 'The student number is required to submit assignments, appear in the leaderboard and play challenges. Leaderboard data is deleted 5 months after the last activity.')}</p>
      <div class="btn-row"><button class="btn small ghost" type="button" data-profils>${t('Afficher les profils', 'Show profiles')}</button></div><div data-profils-res></div>`;
    root.appendChild(prf);
    prf.querySelector('[data-profils]').onclick = async () => {
      const sortie = prf.querySelector('[data-profils-res]');
      const r = await api('/api/prof/profils');
      if (r.status === 401) return verrou();
      if (!r.ok) { sortie.textContent = r.status; return; }
      const { profils } = await r.json();
      sortie.innerHTML = profils.length ? `<div class="tableau"><table class="plain-table"><thead><tr><th>${t('Matricule', 'Student number')}</th><th>${t('Nom', 'Name')}</th><th>${t('Adresse', 'Address')}</th><th>${t('Dernière activité', 'Last activity')}</th><th></th></tr></thead><tbody>
        ${profils.map(p => `<tr><td><b>${esc(p.matricule)}</b></td><td>${esc(p.nom)}</td><td>${esc(p.email)}</td><td>${esc(quand(p.activite))}</td>
          <td><button class="btn small ghost" type="button" data-reinit="${esc(p.email)}">${t('Réinitialiser', 'Reset')}</button></td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">${t('Aucun profil.', 'No profile.')}</p>`;
      sortie.querySelectorAll('[data-reinit]').forEach(b => {
        b.onclick = async () => {
          if (!confirm(t(`Effacer le matricule et le classement de ${b.dataset.reinit} ? L’étudiant devra en enregistrer un nouveau.`, `Erase the student number and leaderboard data of ${b.dataset.reinit}? The student will have to register a new one.`))) return;
          const rep = await post(`/api/prof/profils/${encodeURIComponent(b.dataset.reinit)}/reinitialiser`, {});
          if (rep.ok) prf.querySelector('[data-profils]').click();
        };
      });
    };

    // ----- liste de classe : matricule ↔ nom ↔ adresse (fichier CSV exporté du tableur) -----
    const cls = document.createElement('div');
    cls.innerHTML = `<h2>${t('Liste de classe', 'Class list')}</h2>
      <p class="muted">${t('Importez un fichier CSV : colonnes <b>matricule ; nom ; adresse</b> (l’adresse peut manquer). Une fois la liste importée, chaque étudiant ne peut enregistrer que le matricule qui lui correspond : celui de son adresse, ou, sans adresse dans la liste, un matricule de la liste encore libre. Un nouvel import remplace le précédent. La liste reste sur le serveur jusqu’à ce que vous la vidiez.',
        'Import a CSV file: columns <b>student number ; name ; address</b> (the address may be missing). Once a list is imported, each student can only register the number that belongs to them: the one tied to their address or, when the list has no address, a free number from the list. A new import replaces the previous one. The list stays on the server until you empty it.')}</p>
      <div class="btn-row"><input type="file" accept=".csv,.txt,text/csv" data-liste-fichier>
        <button class="btn small ghost" type="button" data-liste-voir>${t('Voir la liste', 'Show the list')}</button>
        <button class="btn small ghost" type="button" data-liste-vider>${t('Vider la liste', 'Empty the list')}</button></div><div data-liste-res role="status" aria-live="polite"></div>`;
    root.appendChild(cls);
    const lres = cls.querySelector('[data-liste-res]');
    const lignesCsv = texte => texte.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim()).map(l => {
      const sep = [';', '\t', ','].find(c => l.includes(c)) || ';', cases = []; let cur = '', guill = false;
      for (const ch of l) { if (ch === '"') guill = !guill; else if (ch === sep && !guill) { cases.push(cur); cur = ''; } else cur += ch; }
      cases.push(cur); return { matricule: cases[0].trim(), nom: (cases[1] || '').trim(), email: (cases[2] || '').trim() };
    }).filter((l, i) => !(i === 0 && /matricule|student/i.test(l.matricule)));
    cls.querySelector('[data-liste-fichier]').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const lignes = lignesCsv(await f.text());
      if (!confirm(t(`Importer ${lignes.length} lignes ? Elles remplacent la liste actuelle.`, `Import ${lignes.length} rows? They replace the current list.`))) { e.target.value = ''; return; }
      const rep = await post('/api/prof/liste-classe', { lignes }); const j = await rep.json().catch(() => ({}));
      e.target.value = '';
      if (rep.status === 401) return verrou();
      lres.innerHTML = rep.ok
        ? `<p>${t(`${j.importees} lignes importées (${j.sans_adresse} sans adresse).`, `${j.importees} rows imported (${j.sans_adresse} without address).`)}</p>${j.ignorees.length ? `<p class="prof-erreurs">${t('Lignes ignorées', 'Rows ignored')} (${j.ignorees.length}) :</p><ul>${j.ignorees.map(x => `<li>${esc(x.matricule)} ${esc(x.nom)} — ${esc(x.raison)}</li>`).join('')}</ul>` : ''}`
        : `<p class="prof-erreurs">${esc(j.error || rep.status)}</p>`;
    };
    cls.querySelector('[data-liste-voir]').onclick = async () => {
      const rep = await api('/api/prof/liste-classe'); if (rep.status === 401) return verrou();
      const j = await rep.json();
      lres.innerHTML = `<p>${t(`${j.total} étudiants dans la liste, ${j.inscrits} ont déjà enregistré leur profil.`, `${j.total} students in the list, ${j.inscrits} have already registered.`)}</p>` + (j.total ? `<div class="tableau"><table class="plain-table"><thead><tr><th>${t('Matricule', 'Student number')}</th><th>${t('Nom', 'Name')}</th><th>${t('Adresse', 'Address')}</th><th>${t('Profil', 'Profile')}</th></tr></thead><tbody>
        ${j.lignes.map(l => `<tr><td><b>${esc(l.matricule)}</b></td><td>${esc(l.nom)}</td><td>${esc(l.email || '—')}</td><td>${l.inscrit ? t('oui', 'yes') : t('non', 'no')}</td></tr>`).join('')}</tbody></table></div>` : '');
    };
    cls.querySelector('[data-liste-vider]').onclick = async () => {
      const c = prompt(t('Supprime la liste de classe ; les profils déjà créés restent. Tapez SUPPRIMER pour confirmer.', 'Deletes the class list; profiles already created stay. Type SUPPRIMER to confirm.')); if (c === null) return;
      const rep = await post('/api/prof/liste-classe/vider', { confirmation: c }); const j = await rep.json().catch(() => ({}));
      lres.innerHTML = rep.ok ? `<p>${t(`${j.supprimees} lignes supprimées.`, `${j.supprimees} rows deleted.`)}</p>` : `<p class="prof-erreurs">${esc(j.error || rep.status)}</p>`;
    };

    // ----- défis en cours (tous les étudiants) -----
    const dfi = document.createElement('div');
    dfi.innerHTML = `<h2>${t('Défis en cours', 'Challenges in progress')}</h2>
      <p class="muted">${t('Défis valables 30 jours. Ouvrez le détail depuis la page Classement avec le code.', 'Challenges stay valid for 30 days. Open the details from the Leaderboard page with the code.')}</p>
      <div class="btn-row"><button class="btn small ghost" type="button" data-defis>${t('Afficher les défis', 'Show challenges')}</button></div><div data-defis-res></div>`;
    root.appendChild(dfi);
    dfi.querySelector('[data-defis]').onclick = async () => {
      const sortie = dfi.querySelector('[data-defis-res]'); const r = await api('/api/prof/defis');
      if (r.status === 401) return verrou(); if (!r.ok) { sortie.textContent = r.status; return; }
      const { defis } = await r.json();
      sortie.innerHTML = defis.length ? `<div class="tableau"><table class="plain-table"><thead><tr><th>${t('Code', 'Code')}</th><th>${t('Chapitre', 'Chapter')}</th><th>${t('Questions', 'Questions')}</th><th>${t('Créateur', 'Creator')}</th><th>${t('Joueurs', 'Players')}</th><th>${t('Créé le', 'Created')}</th></tr></thead><tbody>
        ${defis.map(d => `<tr><td><b>${esc(d.code)}</b></td><td>${d.chapitre ?? t('Tous', 'All')}</td><td>${d.n}</td><td>${esc(d.createur ?? '—')}</td><td>${d.joueurs}</td><td>${esc(quand(d.cree))}</td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">${t('Aucun défi en cours.', 'No challenge in progress.')}</p>`;
    };

    // ----- test de la configuration réelle du serveur (variables, base, stockage privé) -----
    const diag = document.createElement('div');
    diag.innerHTML = `<h2>${t('Configuration', 'Configuration')}</h2><div class="btn-row"><button class="btn small ghost" type="button" data-diag>${t('Tester la configuration (base, stockage)', 'Test the configuration (database, storage)')}</button></div><div data-diag-res role="status" aria-live="polite"></div>`;
    root.appendChild(diag);
    diag.querySelector('[data-diag]').onclick = async () => {
      const sortie = diag.querySelector('[data-diag-res]'); sortie.textContent = t('Test en cours…', 'Testing…');
      const r = await api('/api/prof/diagnostic');
      if (r.status === 401) return verrou();
      if (!r.ok) { sortie.textContent = t('Le test lui-même a échoué : ', 'The test itself failed: ') + r.status; return; }
      const j = await r.json(), v = j.variables;
      const ok = b => (b ? t('présent', 'present') : t('ABSENT', 'MISSING'));
      const res = x => (x.ok ? t('fonctionne', 'works') : t('ÉCHEC : ', 'FAILED: ') + esc(x.erreur));
      sortie.innerHTML = `<ul>
        <li>GOOGLE_CLIENT_ID : ${ok(v.GOOGLE_CLIENT_ID)}</li><li>SESSION_SECRET (32 caractères ou plus) : ${ok(v.SESSION_SECRET)}</li>
        <li>TEACHER_EMAIL : ${ok(v.TEACHER_EMAIL)}</li><li>TEACHER_PASSWORD : ${ok(v.TEACHER_PASSWORD)}</li><li>${t('Adresse de la base', 'Database address')} : ${ok(v.BASE_DE_DONNEES)}</li>
        <li>${t('Authentification du stockage', 'Storage authentication')} : <b>${esc(v.BLOB_AUTHENTIFICATION)}</b> ${v.BLOB_AUTHENTIFICATION === 'aucun' ? t('(ni jeton ni BLOB_STORE_ID : le dépôt de fichiers ne marchera pas)', '(neither token nor BLOB_STORE_ID: file uploads will not work)') : ''}</li>
        <li>${t('Base de données', 'Database')} : ${res(j.base)}</li><li>${t('Stockage privé (écriture, lecture, suppression)', 'Private storage (write, read, delete)')} : ${res(j.stockage)}</li></ul>`;
    };

    root.querySelector('[data-exemple]').onclick = () => { root.querySelector('[data-json]').value = JSON.stringify(EXEMPLE, null, 2); };
    root.querySelector('[data-creer]').onclick = async () => {
      const msg = root.querySelector('[data-msg]'); let corps;
      try { corps = JSON.parse(root.querySelector('[data-json]').value); } catch { msg.innerHTML = `<p class="prof-erreurs">${t('JSON invalide.', 'Invalid JSON.')}</p>`; return; }
      const rep = await post('/api/prof/devoirs', corps); const j = await rep.json().catch(() => ({}));
      if (rep.status === 401) return verrou();
      if (rep.ok) return tableau().catch(erreur);
      msg.innerHTML = `<p class="prof-erreurs">${esc(j.error || rep.status)}</p>${(j.erreurs || []).length ? `<ul>${j.erreurs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
    };
    root.querySelector('[data-notifier]').onclick = async () => {
      const m = root.querySelector('[data-msg-notif]'), rep = await post('/api/prof/notifier', {});
      if (rep.status === 401) return verrou();
      const j = await rep.json().catch(() => ({}));
      m.textContent = !rep.ok ? (j.error || rep.status) : !j.configure ? t('Notifications non configurées sur le serveur (clés VAPID absentes).', 'Notifications are not set up on the server (VAPID keys missing).')
        : t(`${j.envoyes} notification(s) envoyée(s) sur ${j.abonnes} appareil(s) abonné(s)${j.expires ? `, ${j.expires} abonnement(s) expiré(s) retiré(s)` : ''}${j.echecs ? `, ${j.echecs} échec(s)` : ''}.`,
          `${j.envoyes} notification(s) sent to ${j.abonnes} subscribed device(s)${j.expires ? `, ${j.expires} expired subscription(s) removed` : ''}${j.echecs ? `, ${j.echecs} failure(s)` : ''}.`);
    };
    root.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => agir(b.closest('tr').dataset.id, b.dataset.act, devoirs.find(d => String(d.id) === b.closest('tr').dataset.id)).catch(erreur); });
  }

  async function agir(id, act, d) {
    const detail = root.querySelector('[data-detail]');
    if (act === 'publie' || act === 'visible') {
      await post(`/api/prof/devoirs/${id}`, act === 'publie' ? { publie: !d.publie } : { resultat_visible: !d.resultat_visible });
      return tableau();
    }
    if (act === 'copie') {
      await post(`/api/prof/devoirs/${id}`, { copie: !d.copie });
      return tableau();
    }
    if (act === 'sujet') {
      detail.innerHTML = `<h3>${esc(d.titre)}</h3><div class="prof-ligne"><label>${t('Sujet au format PDF (2 Mo maximum)', 'Assignment as PDF (2 MB maximum)')} <input type="file" accept="application/pdf"></label>
        <button class="btn small accent" type="button" data-ok>${t('Envoyer', 'Upload')}</button></div><div data-msg2 role="status" aria-live="polite"></div>`;
      detail.querySelector('[data-ok]').onclick = async () => {
        const f = detail.querySelector('input[type=file]').files[0], m = detail.querySelector('[data-msg2]');
        if (!f) { m.textContent = t('Choisissez un PDF.', 'Choose a PDF.'); return; }
        const rep = await api(`/api/prof/devoirs/${id}/sujet`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: f });
        if (rep.status === 401) return verrou();
        if (rep.ok) return tableau();
        m.textContent = (await rep.json().catch(() => ({}))).error || rep.status;
      };
      return;
    }
    if (act === 'dates') {
      detail.innerHTML = `<h3>${esc(d.titre)}</h3><div class="prof-ligne"><label>${t('Ouvre', 'Opens')} <input type="datetime-local" name="o" value="${local(d.ouvre)}"></label>
        <label>${t('Ferme', 'Closes')} <input type="datetime-local" name="f" value="${local(d.ferme)}"></label><button class="btn small accent" type="button" data-ok>${t('Enregistrer', 'Save')}</button></div><div data-msg2></div>`;
      detail.querySelector('[data-ok]').onclick = async () => {
        const rep = await post(`/api/prof/devoirs/${id}`, { ouvre: new Date(detail.querySelector('[name=o]').value).toISOString(), ferme: new Date(detail.querySelector('[name=f]').value).toISOString() });
        if (rep.ok) return tableau(); detail.querySelector('[data-msg2]').textContent = (await rep.json().catch(() => ({}))).error || rep.status;
      };
      return;
    }
    const r = await api(`/api/prof/devoirs/${id}/remises`);
    if (r.status === 401) return verrou();
    const { remises } = await r.json();
    detail.innerHTML = `<h3>${esc(d.titre)} — ${t('remises', 'submissions')}</h3>` + (remises.length
      ? `<div class="tableau"><table class="plain-table"><thead><tr><th>${t('Étudiant', 'Student')}</th><th>${t('Note auto', 'Auto mark')}</th><th>${t('Reçue (serveur)', 'Received (server)')}</th><th>${t('Ouverte (serveur)', 'Opened (server)')}</th><th>${t('Déclarée (appareil, non vérifiable)', 'Declared (device, unverifiable)')}</th><th>${t('Retard', 'Late')}</th><th>${t('Copie', 'Paper')}</th></tr></thead><tbody>
        ${remises.map(x => `<tr><td>${esc(x.nom)} <b>${esc(x.matricule ?? t('(sans matricule)', '(no student number)'))}</b> <span class="muted">${esc(x.email)}</span></td><td>${esc(noteTxt(x))} ${x.total_manuel > 0 ? `<button class="btn small ghost" type="button" data-corriger="${esc(x.email)}">${t('Corriger', 'Mark')}</button>` : ''}</td><td>${esc(quand(x.recu))}</td><td>${esc(quand(x.debut))}</td><td>${esc(quand(x.declare))}${x.hors_ligne ? t(' <span class="muted">(préparée hors connexion)</span>', ' <span class="muted">(prepared offline)</span>') : ''}</td><td>${x.recu ? (x.retard ? t('oui', 'yes') : t('non', 'no')) : '—'}</td>
          <td>${x.copie_taille ? `<a href="/api/prof/devoirs/${id}/copie/${encodeURIComponent(x.email)}">${t('Télécharger', 'Download')}</a> <span class="muted">(${Math.max(1, Math.round(x.copie_taille / 1024))} ${t('Ko', 'KB')}, ${esc(quand(x.copie_recu))}${x.copie_retard ? t(', en retard', ', late') : ''})</span>` : '—'}</td></tr>`).join('')}</tbody></table></div>`
      : `<p class="muted">${t('Aucune remise.', 'No submission.')}</p>`);

    // ----- outils du devoir : export, copies, suppression -----
    const bar = document.createElement('div'); bar.className = 'prof-ligne';
    bar.innerHTML = `<a class="btn small ghost" href="/api/prof/devoirs/${id}/export.csv">${t('Exporter les notes (CSV)', 'Export marks (CSV)')}</a>
      <button class="btn small ghost" type="button" data-zip>${t('Télécharger toutes les copies (ZIP)', 'Download all papers (ZIP)')}</button>
      <button class="btn small ghost" type="button" data-purger disabled title="${t('Téléchargez d’abord le ZIP', 'Download the ZIP first')}">${t('Supprimer les copies du serveur', 'Delete papers from the server')}</button>
      <button class="btn small ghost" type="button" data-supprimer>${t('Supprimer le devoir', 'Delete the assignment')}</button>`;
    detail.appendChild(bar);
    const info = document.createElement('div'); info.setAttribute('role', 'status'); info.setAttribute('aria-live', 'polite'); detail.appendChild(info);
    const purger = bar.querySelector('[data-purger]');
    let manifeste = null;

    bar.querySelector('[data-zip]').onclick = async () => {
      const avec = remises.filter(x => x.copie_taille);
      if (!avec.length) { info.textContent = t('Aucune copie déposée.', 'No paper uploaded.'); return; }
      const fichiers = [];
      for (const [i, x] of avec.entries()) {
        info.textContent = t(`Téléchargement ${i + 1} / ${avec.length}…`, `Downloading ${i + 1} / ${avec.length}…`);
        const r = await api(`/api/prof/devoirs/${id}/copie/${encodeURIComponent(x.email)}`);
        if (r.status === 401) return verrou();
        if (!r.ok) { info.textContent = t('Échec du téléchargement de ', 'Download failed for ') + x.email; return; }
        const ext = ({ 'application/pdf': 'pdf', 'image/png': 'png' })[r.headers.get('content-type')] || 'jpg';
        fichiers.push({ nom: `${x.email.split('@')[0]}.${ext}`, donnees: new Uint8Array(await r.arrayBuffer()) });
      }
      telecharger(zip(fichiers), `copies-devoir-${id}.zip`);
      manifeste = avec.map(x => ({ email: x.email, recu: x.copie_recu })); // la suppression ne portera que sur ces versions exactes
      info.textContent = t(`ZIP de ${fichiers.length} copie(s) téléchargé. Vérifiez qu’il s’ouvre ; vous pouvez ensuite supprimer les copies du serveur.`, `ZIP of ${fichiers.length} paper(s) downloaded. Check that it opens; you can then delete the papers from the server.`);
      purger.disabled = false;
    };
    purger.onclick = async () => {
      const c = prompt(t('Action définitive : toutes les copies de ce devoir seront effacées du serveur (les notes sont conservées). Tapez SUPPRIMER pour confirmer.', 'This cannot be undone: all papers of this assignment will be erased from the server (marks are kept). Type SUPPRIMER to confirm.'));
      if (c === null) return;
      const rep = await post(`/api/prof/devoirs/${id}/purger-copies`, { confirmation: c, manifeste: manifeste || [] });
      const j = await rep.json().catch(() => ({}));
      if (rep.status === 401) return verrou();
      if (!rep.ok) { info.textContent = j.error || rep.status; return; }
      await agir(id, 'remises', d);
      root.querySelector('[data-detail] [role=status]').textContent = t(`${j.supprimes} copie(s) supprimée(s)${j.echecs ? `, ${j.echecs} échec(s) : réessayez` : ''}${j.conservees ? `, ${j.conservees} conservée(s) (absente(s) du ZIP)` : ''}.`, `${j.supprimes} paper(s) deleted${j.echecs ? `, ${j.echecs} failure(s): try again` : ''}${j.conservees ? `, ${j.conservees} kept (not in the ZIP)` : ''}.`);
    };
    bar.querySelector('[data-supprimer]').onclick = async () => {
      const c = prompt(t(`Action définitive : le devoir, ses remises, ses copies et son sujet seront supprimés. Tapez le titre exact pour confirmer :\n${d.titre}`, `This cannot be undone: the assignment, its submissions, papers and PDF will be deleted. Type the exact title to confirm:\n${d.titre}`));
      if (c === null) return;
      const rep = await post(`/api/prof/devoirs/${id}/supprimer`, { confirmation: c });
      if (rep.status === 401) return verrou();
      if (rep.ok) return tableau();
      info.textContent = (await rep.json().catch(() => ({}))).error || rep.status;
    };
    // Correction : une fenêtre (dialog) avec les réponses de l'étudiant et les points de chaque question ; elle se referme à la validation.
    detail.querySelectorAll('[data-corriger]').forEach(b => {
      b.onclick = async () => {
        const email = b.dataset.corriger, x = remises.find(r => r.email === email) || {};
        const r = await api(`/api/prof/devoirs/${id}/remises/${encodeURIComponent(email)}`);
        if (r.status === 401) return verrou();
        const j = await r.json();
        const dlg = document.createElement('dialog');
        dlg.className = 'corr'; dlg.setAttribute('aria-labelledby', 'corr-titre');
        const champ = (q, nom) => `<label class="corr-pts">${t('Points', 'Points')} <input type="number" inputmode="decimal" min="0" max="${q.points}" step="0.25" name="${nom}" value="${q.note ?? ''}"> / ${q.points}</label>`;
        const global = !j.questions.length; // devoir à copie déposée : une seule note
        const ancienne = !global && j.note_manuelle !== null && j.questions.every(q => q.note === null);
        dlg.innerHTML = `<header><h3 id="corr-titre">${t('Correction', 'Marking')} — ${esc(x.nom || email)} ${x.matricule ? `<b>${esc(x.matricule)}</b>` : ''}</h3><p class="muted">${esc(email)}</p></header>
          <div class="corr-corps">${global
            ? `<p class="muted">${t('Devoir à copie déposée : téléchargez la copie dans la colonne « Copie », puis saisissez la note.', 'Paper assignment: download the paper from the “Paper” column, then enter the mark.')}</p>
               <label class="corr-pts">${t('Note', 'Mark')} <input type="number" inputmode="decimal" min="0" max="${j.total_manuel}" step="0.25" name="global" value="${j.note_manuelle ?? ''}"> / ${j.total_manuel}</label>`
            : (ancienne ? `<p class="muted">${t(`Une note globale de ${j.note_manuelle} / ${j.total_manuel} avait été saisie ; elle sera remplacée par la somme des points ci-dessous.`, `An overall mark of ${j.note_manuelle} / ${j.total_manuel} was entered earlier; it will be replaced by the sum of the points below.`)}</p>` : '')
              + j.questions.map((q, i) => `<section class="corr-q"><p><b>${t('Question', 'Question')} ${esc(q.id.slice(1))}</b> — ${esc(q.question)}</p>
                <pre>${esc(q.reponse || t('(pas de réponse)', '(no answer)'))}</pre>${champ(q, 'q_' + q.id)}</section>`).join('')}</div>
          <footer><span data-total></span><span data-msg role="status" aria-live="polite"></span>
            <button class="btn small ghost" type="button" data-annuler>${t('Annuler', 'Cancel')}</button>
            <button class="btn small accent" type="button" data-valider>${t('Valider', 'Confirm')}</button></footer>`;
        document.body.appendChild(dlg);
        const champs = [...dlg.querySelectorAll('input[type=number]')], total = dlg.querySelector('[data-total]'), msg = dlg.querySelector('[data-msg]');
        const maj = () => {
          const vides = champs.filter(c => c.value === '').length, somme = champs.reduce((s, c) => s + (Number(c.value) || 0), 0);
          total.textContent = global ? '' : t(`Total : ${somme} / ${j.total_manuel}`, `Total: ${somme} / ${j.total_manuel}`) + (vides ? t(` — ${vides} question(s) sans points`, ` — ${vides} question(s) without points`) : '');
        };
        champs.forEach(c => c.addEventListener('input', maj)); maj();
        const fermer = () => { dlg.close(); dlg.remove(); };
        dlg.addEventListener('cancel', () => setTimeout(() => dlg.remove())); // Échap
        dlg.querySelector('[data-annuler]').onclick = fermer;
        dlg.querySelector('[data-valider]').onclick = async () => {
          const corps = { recu: j.recu };
          if (global) corps.points = champs[0].value === '' ? null : Number(champs[0].value);
          else corps.notes = Object.fromEntries(j.questions.map((q, i) => [q.id, champs[i].value === '' ? null : Number(champs[i].value)]));
          const rep = await post(`/api/prof/devoirs/${id}/remises/${encodeURIComponent(email)}/note`, corps);
          if (rep.status === 401) { fermer(); return verrou(); }
          if (!rep.ok) { msg.textContent = (await rep.json().catch(() => ({}))).error || rep.status; return; }
          fermer();
          agir(id, 'remises', d); // la note de l'étudiant est mise à jour dans le tableau
        };
        dlg.showModal();
        (champs[0] || dlg.querySelector('[data-annuler]')).focus();
      };
    });
  }

  const erreur = () => montrer(`<p class="muted">${t('Impossible de joindre le serveur. Vérifiez votre connexion internet puis réessayez.', 'Cannot reach the server. Check your internet connection and try again.')}</p>`);

  (async () => {
    const me = await api('/api/me');
    if (me.status === 401) return montrer(`<p>${t('Connectez-vous avec votre compte enseignant.', 'Sign in with your teacher account.')}</p><p><a class="btn accent" href="${EN ? '/en/login.html' : '/connexion.html'}">${t('Se connecter', 'Sign in')}</a></p>`);
    const j = await me.json();
    if (!j.teacher) return montrer(`<p>${t('Cette page est réservée à l’enseignant.', 'This page is reserved for the teacher.')}</p>`);
    return j.verrou ? verrou() : tableau();
  })().catch(erreur);
})();
