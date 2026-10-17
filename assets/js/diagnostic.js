/* Diagnostic avant / après : 10 questions conceptuelles, réponses gardées dans le navigateur (localStorage). */
(() => {
  const L = window.Lab || {};
  const T = (fr, en) => (document.documentElement.lang === 'en' ? en : fr);
  const KEY = 'phy321.diagnostic.v1';
  const Q = [
    { c: T('Mesure', 'Measurement'), q: T('On mesure \\(S_z\\) sur un spin préparé dans un état propre de \\(S_x\\). Le résultat est :', 'We measure \\(S_z\\) on a spin prepared in an eigenstate of \\(S_x\\). The result is:'),
      o: [T('toujours \\(+\\hbar/2\\)', 'always \\(+\\hbar/2\\)'), T('\\(+\\hbar/2\\) ou \\(-\\hbar/2\\), avec probabilité ½ chacun', '\\(+\\hbar/2\\) or \\(-\\hbar/2\\), probability ½ each'), T('0', '0')], a: 1,
      e: T('Les états propres de \\(S_x\\) sont des superpositions égales des états propres de \\(S_z\\).', 'Eigenstates of \\(S_x\\) are equal superpositions of eigenstates of \\(S_z\\).') },
    { c: T('Indétermination', 'Indeterminacy'), q: T('Avant la mesure de \\(S_z\\) sur \\(\\ket{+x}\\), la valeur de \\(S_z\\) est :', 'Before measuring \\(S_z\\) on \\(\\ket{+x}\\), the value of \\(S_z\\) is:'),
      o: [T('définie mais inconnue de nous', 'definite but unknown to us'), T('non définie dans cet état (formalisme du cours)', 'not defined in this state (course formalism)'), T('égale à zéro', 'equal to zero')], a: 1,
      e: T('Indétermination et non simple ignorance : dans le formalisme du cours, l’état ne donne pas de valeur définie à \\(S_z\\) (Styer, 1996).', 'Indeterminacy, not mere ignorance: in the course formalism, the state gives no definite value to \\(S_z\\) (Styer, 1996).') },
    { c: T('Superposition', 'Superposition'), q: T('Quelle préparation donne le résultat \\(+\\) avec certitude lors d’une mesure de \\(S_x\\) ?', 'Which preparation gives outcome \\(+\\) with certainty in a measurement of \\(S_x\\)?'),
      o: [T('un mélange moitié \\(\\ket0\\), moitié \\(\\ket1\\)', 'a mixture of half \\(\\ket0\\), half \\(\\ket1\\)'), T('l’état \\((\\ket0+\\ket1)/\\sqrt2\\)', 'the state \\((\\ket0+\\ket1)/\\sqrt2\\)'), T('l’état \\(\\ket0\\)', 'the state \\(\\ket0\\)')], a: 1,
      e: T('Une superposition n’est pas un mélange : les deux termes interfèrent.', 'A superposition is not a mixture: the two terms interfere.') },
    { c: T('Mesure', 'Measurement'), q: T('Après avoir obtenu \\(+\\) sur \\(S_z\\), une seconde mesure immédiate de \\(S_z\\) donne :', 'After obtaining \\(+\\) on \\(S_z\\), an immediate second measurement of \\(S_z\\) gives:'),
      o: [T('\\(+\\) avec certitude', '\\(+\\) with certainty'), T('\\(+\\) ou \\(-\\) avec probabilité ½', '\\(+\\) or \\(-\\) with probability ½'), T('\\(-\\) avec certitude', '\\(-\\) with certainty')], a: 0,
      e: T('La première mesure projette l’état sur l’état propre obtenu.', 'The first measurement projects the state onto the eigenstate obtained.') },
    { c: T('Indétermination', 'Indeterminacy'), q: T('La relation \\(\\Delta x\\,\\Delta p \\ge \\hbar/2\\) traduit :', 'The relation \\(\\Delta x\\,\\Delta p \\ge \\hbar/2\\) expresses:'),
      o: [T('la précision limitée de nos instruments', 'the limited precision of our instruments'), T('une propriété de l’état : \\(x\\) et \\(p\\) ne peuvent être simultanément définis avec une précision arbitraire', 'a property of the state: \\(x\\) and \\(p\\) cannot both be sharply defined at once'), T('la perturbation causée par l’appareil sur le système', 'the disturbance the apparatus causes on the system')], a: 1,
      e: T('Ce n’est ni un défaut d’instrument ni seulement une perturbation : c’est inscrit dans l’état.', 'It is neither an instrument flaw nor merely a disturbance: it is written into the state.') },
    { c: T('Intrication', 'Entanglement'), q: T('Deux boîtes contiennent un gant gauche et un gant droit ; ouvrir l’une révèle l’autre. C’est :', 'Two boxes hold a left glove and a right glove; opening one reveals the other. This is:'),
      o: [T('de l’intrication', 'entanglement'), T('une corrélation classique', 'a classical correlation'), T('de la télépathie quantique', 'quantum telepathy')], a: 1,
      e: T('Ce modèle respecte l’inégalité CHSH \\(S \\le 2\\) ; l’intrication peut aller jusqu’à \\(2\\sqrt2\\).', 'This model obeys the CHSH inequality \\(S \\le 2\\); entanglement can reach \\(2\\sqrt2\\).') },
    { c: T('Intrication', 'Entanglement'), q: T('Alice mesure sa moitié d’une paire de Bell. Bob, loin d’elle :', 'Alice measures her half of a Bell pair. Bob, far away:'),
      o: [T('peut en déduire son choix de mesure sans lui parler', 'can infer her measurement choice without talking to her'), T('ne voit que du hasard 50/50 tant qu’il ne compare pas avec Alice', 'sees only 50/50 randomness until he compares with Alice'), T('peut modifier à distance le résultat d’Alice', 'can remotely alter Alice’s result')], a: 1,
      e: T('Pas de signal : les corrélations ne se voient qu’en comparant les résultats par un canal classique.', 'No signalling: correlations show up only when results are compared over a classical channel.') },
    { c: T('Décohérence', 'Decoherence'), q: T('Pourquoi ne voit-on pas de superposition d’un objet macroscopique ?', 'Why do we not see superpositions of a macroscopic object?'),
      o: [T('la mécanique quantique cesse de s’appliquer', 'quantum mechanics stops applying'), T('l’interaction avec l’environnement détruit très vite la cohérence', 'interaction with the environment destroys coherence very quickly'), T('les objets lourds n’ont pas de fonction d’onde', 'heavy objects have no wave function')], a: 1,
      e: T('La décohérence supprime les interférences entre états macroscopiquement distincts.', 'Decoherence suppresses interference between macroscopically distinct states.') },
    { c: T('Analogies', 'Analogies'), q: T('Une analogie entre un récit traditionnel et une notion de physique quantique peut être :', 'An analogy between a traditional narrative and a notion of quantum physics can be:'),
      o: [T('une preuve que le récit contenait la physique', 'proof that the narrative contained the physics'), T('un pont évocatif pour réfléchir, sans valeur de preuve', 'an evocative bridge for reflection, with no probative value'), T('une explication physique du phénomène', 'a physical explanation of the phenomenon')], a: 1,
      e: T('La règle du carnet : jamais un argument de preuve.', 'The notebook’s rule: never an argument of proof.') },
    { c: T('Quantification', 'Quantisation'), q: T('L’énergie du fondamental d’un oscillateur harmonique quantique est :', 'The ground-state energy of a quantum harmonic oscillator is:'),
      o: [T('0', '0'), T('\\(\\hbar\\omega/2\\)', '\\(\\hbar\\omega/2\\)'), T('\\(\\hbar\\omega\\)', '\\(\\hbar\\omega\\)')], a: 1,
      e: T('\\(E_n=\\hbar\\omega(n+\\tfrac12)\\) : l’indétermination interdit \\(x=p=0\\).', '\\(E_n=\\hbar\\omega(n+\\tfrac12)\\): indeterminacy forbids \\(x=p=0\\).') }
  ];

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* stockage bloqué : on continue */ } };
  const form = document.getElementById('diag-form');
  const out = document.getElementById('diag-result');
  if (!form) return;

  form.innerHTML = Q.map((x, i) => `<fieldset class="diag-q"><legend><span class="mono">${i + 1}</span> ${x.q}</legend>` +
    x.o.map((o, j) => `<label class="choice"><input type="radio" name="q${i}" value="${j}">${o}</label>`).join('') + '</fieldset>').join('');
  const mode = () => document.querySelector('input[name=mode]:checked').value;

  function scoreOf(ans) { return ans.reduce((s, a, i) => s + (a === Q[i].a ? 1 : 0), 0); }
  function byTheme(ans) {
    const m = {};
    Q.forEach((x, i) => { m[x.c] = m[x.c] || [0, 0]; m[x.c][1]++; if (ans[i] === x.a) m[x.c][0]++; });
    return m;
  }
  function summary() {
    const d = load(), lines = [];
    ['pre', 'post'].forEach(k => { if (d[k]) lines.push(`${k === 'pre' ? T('Avant', 'Before') : T('Après', 'After')} : ${scoreOf(d[k].a)}/${Q.length}`); });
    if (d.pre && d.post) {
      const a = byTheme(d.pre.a), b = byTheme(d.post.a);
      Object.keys(a).forEach(c => lines.push(`${c} : ${a[c][0]}/${a[c][1]} → ${b[c][0]}/${b[c][1]}`));
    }
    return lines;
  }
  function show(withCorr) {
    const d = load(); let html = '';
    const lines = summary();
    html += lines.length ? '<ul class="plain">' + lines.map(l => `<li>${l}</li>`).join('') + '</ul>' : '';
    if (withCorr && d.post) {
      html += '<ol class="diag-corr">' + Q.map((x, i) => `<li class="${d.post.a[i] === x.a ? 'ok' : 'ko'}"><strong>${d.post.a[i] === x.a ? T('Exact.', 'Correct.') : T('À revoir.', 'To review.')}</strong> ${x.e}</li>`).join('') + '</ol>';
    }
    out.innerHTML = html;
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([out]).catch(() => {});
  }
  document.getElementById('diag-submit').addEventListener('click', () => {
    const ans = Q.map((_, i) => { const c = form.querySelector(`input[name=q${i}]:checked`); return c ? Number(c.value) : -1; });
    if (ans.includes(-1)) { out.textContent = T('Répondez à toutes les questions avant de valider.', 'Answer every question before submitting.'); return; }
    const d = load(); d[mode()] = { a: ans, t: new Date().toISOString().slice(0, 10) }; save(d);
    show(mode() === 'post');
  });
  /* Export anonyme : lignes lisibles + bloc machine « PHY321-DIAG v1 » (1 = bonne réponse, une valeur par question),
     lu par outils/analyser_diagnostic.py. Aucun nom, aucun identifiant. */
  function exportText() {
    const d = load(), code = ['PHY321-DIAG v1'];
    ['pre', 'post'].forEach(k => { if (d[k]) code.push(`${k}=${d[k].a.map((v, i) => (v === Q[i].a ? 1 : 0)).join('')}`); });
    return summary().join('\n') + '\n\n' + code.join('\n');
  }
  document.getElementById('diag-copy').addEventListener('click', async () => {
    const txt = exportText();
    let copied = false;
    try { await navigator.clipboard.writeText(txt); copied = true; } catch { /* presse-papiers refusé : on affiche le texte */ }
    const pre = document.createElement('pre'); pre.id = 'diag-export'; pre.textContent = txt;
    out.innerHTML = `<p>${copied ? T('Résultats copiés. Les voici :', 'Results copied. Here they are:') : T('Copie impossible : sélectionnez le texte ci-dessous.', 'Copy not possible: select the text below.')}</p>`;
    out.appendChild(pre);
  });
  document.getElementById('diag-reset').addEventListener('click', () => { save({}); form.reset(); out.textContent = T('Réponses effacées.', 'Answers cleared.'); });
  show(false);
})();
