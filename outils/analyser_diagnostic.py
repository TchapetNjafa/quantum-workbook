#!/usr/bin/env python3
"""Analyse du diagnostic avant / après (promotion pilote, critère C4).

Entrée : un fichier texte où chaque étudiant a collé le bloc exporté par la page « Diagnostic » :
    PHY321-DIAG v1
    pre=1101110111
    post=1111111111
(1 = bonne réponse ; une valeur par question ; blocs séparés par une ligne vide ou la ligne PHY321-DIAG).
Sortie : rapport Markdown (effectif apparié, moyennes, gain normalisé de Hake, taille d'effet, intervalle de confiance
par bootstrap, détail par question et par thème) et verdict sur les critères d'acceptation.

Usage : python3 outils/analyser_diagnostic.py resultats.txt [--lang fr|en] [--sortie rapport.md]
        python3 outils/analyser_diagnostic.py --test      (auto-contrôle sur données simulées)
Critères (proposés, à valider par l'enseignant) : n apparié >= 20 ; gain normalisé de classe >= 0,30 ;
borne basse de l'IC95 % de la différence moyenne > 0 ; aucun thème en recul."""
import argparse, math, random, re, statistics, sys

THEMES = {'fr': ['Mesure', 'Indétermination', 'Superposition', 'Mesure', 'Indétermination', 'Intrication', 'Intrication', 'Décohérence', 'Analogies', 'Quantification'],
          'en': ['Measurement', 'Indeterminacy', 'Superposition', 'Measurement', 'Indeterminacy', 'Entanglement', 'Entanglement', 'Decoherence', 'Analogies', 'Quantisation']}
NQ = 10
MIN_N, MIN_GAIN = 20, 0.30

def parse(text):
    """Renvoie une liste de dicts {'pre': [..] ou None, 'post': [..] ou None} (un par étudiant)."""
    out = []
    for blk in re.split(r'(?=PHY321-DIAG)', text):
        if 'PHY321-DIAG' not in blk:
            continue
        rec = {'pre': None, 'post': None}
        for k in ('pre', 'post'):
            m = re.search(rf'^\s*{k}=([01]+)\s*$', blk, re.M)
            if m:
                if len(m.group(1)) != NQ:
                    raise ValueError(f'{k}= doit contenir {NQ} chiffres : {m.group(1)!r}')
                rec[k] = [int(c) for c in m.group(1)]
        if rec['pre'] or rec['post']:
            out.append(rec)
    return out

def hake(pre_pct, post_pct):
    return None if pre_pct >= 100 else (post_pct - pre_pct) / (100 - pre_pct)

def bootstrap_ci(diffs, reps=5000, seed=321):
    rng = random.Random(seed)
    means = sorted(statistics.fmean(rng.choices(diffs, k=len(diffs))) for _ in range(reps))
    return means[int(0.025 * reps)], means[int(0.975 * reps) - 1]

def sign_test_p(diffs):
    """Test des signes bilatéral exact (les différences nulles sont écartées)."""
    pos = sum(d > 0 for d in diffs); neg = sum(d < 0 for d in diffs); n = pos + neg
    if n == 0:
        return 1.0
    k = min(pos, neg)
    return min(1.0, 2 * sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n)

def analyse(records, lang='fr'):
    T = (lambda a, b: a) if lang == 'fr' else (lambda a, b: b)
    pairs = [r for r in records if r['pre'] and r['post']]
    n = len(pairs)
    res = {'n': n, 'n_total': len(records)}
    if n == 0:
        res['verdict'] = False; res['report'] = T('Aucun étudiant avec avant ET après : analyse impossible.', 'No student with both before AND after: analysis impossible.')
        return res
    pre = [sum(r['pre']) for r in pairs]; post = [sum(r['post']) for r in pairs]
    mpre, mpost = statistics.fmean(pre) / NQ * 100, statistics.fmean(post) / NQ * 100
    g_class = hake(mpre, mpost)
    diffs = [b - a for a, b in zip(pre, post)]
    sd = statistics.stdev(diffs) if n > 1 else 0.0
    dz = statistics.fmean(diffs) / sd if sd else None   # non estimable si n < 2 ou écart-type nul
    lo, hi = bootstrap_ci(diffs) if n >= 2 else (float('-inf'), float('inf'))
    p_sign = sign_test_p(diffs)
    per_q = [(statistics.fmean(r['pre'][i] for r in pairs) * 100, statistics.fmean(r['post'][i] for r in pairs) * 100) for i in range(NQ)]
    acc = {}
    for i, th in enumerate(THEMES[lang]):
        acc.setdefault(th, []).append(per_q[i])
    themes = {k: (statistics.fmean(a for a, _ in v), statistics.fmean(b for _, b in v)) for k, v in acc.items()}
    regress = [k for k, (a, b) in themes.items() if b < a]
    crit = {'n': n >= MIN_N, 'gain': g_class is not None and g_class >= MIN_GAIN, 'ic': lo > 0, 'themes': not regress}
    res.update(verdict=all(crit.values()), criteria=crit, g=g_class, mpre=mpre, mpost=mpost, ci=(lo, hi), dz=dz, p_sign=p_sign, themes=themes)
    L = [f"# {T('Diagnostic avant / après — rapport', 'Before / after diagnostic — report')}", '',
         f"- {T('Étudiants avec avant et après', 'Students with before and after')} : **{n}** ({T('sur', 'out of')} {len(records)} {T('blocs lus', 'blocks read')})",
         f"- {T('Moyenne avant', 'Mean before')} : {mpre:.1f} % — {T('après', 'after')} : {mpost:.1f} %",
         f"- {T('Gain normalisé de classe (Hake)', 'Class normalised gain (Hake)')} : **{'n/a' if g_class is None else f'{g_class:.2f}'}** ({T('moyen si ≥ 0,30, élevé si ≥ 0,70', 'medium if ≥ 0.30, high if ≥ 0.70')})",
         f"- {T('Différence moyenne (points sur 10)', 'Mean difference (points out of 10)')} : {statistics.fmean(diffs):+.2f}, IC95 % {f'[{lo:+.2f} ; {hi:+.2f}] ({T("bootstrap", "bootstrap")})' if n >= 2 else T('non estimable (n < 2)', 'not estimable (n < 2)')}, d_z = {'n/a' if dz is None else f'{dz:.2f}'}, {T('test des signes', 'sign test')} p = {p_sign:.3f}", '',
         f"## {T('Par thème (% de bonnes réponses)', 'By theme (% correct)')}", '', f"| {T('Thème', 'Theme')} | {T('Avant', 'Before')} | {T('Après', 'After')} |", '|---|---|---|']
    L += [f"| {k} | {a:.0f} | {b:.0f} |" for k, (a, b) in themes.items()]
    L += ['', f"## {T('Par question', 'By question')}", '', f"| Q | {T('Thème', 'Theme')} | {T('Avant', 'Before')} | {T('Après', 'After')} |", '|---|---|---|---|']
    L += [f"| {i + 1} | {THEMES[lang][i]} | {a:.0f} | {b:.0f} |" for i, (a, b) in enumerate(per_q)]
    L += ['', f"## {T('Critères d’acceptation', 'Acceptance criteria')}", '']
    names = {'n': T(f'effectif apparié ≥ {MIN_N}', f'paired sample ≥ {MIN_N}'), 'gain': T(f'gain normalisé de classe ≥ {MIN_GAIN:.2f}', f'class normalised gain ≥ {MIN_GAIN:.2f}'),
             'ic': T('borne basse de l’IC95 % > 0', 'lower bound of the 95 % CI > 0'), 'themes': T('aucun thème en recul', 'no theme regressing')}
    L += [f"- {'OUI' if ok else 'NON'} — {names[k]}" for k, ok in crit.items()]
    L += ['', f"**{T('Verdict', 'Verdict')} : {T('critère atteint', 'criterion met') if res['verdict'] else T('critère non atteint', 'criterion not met')}**", '',
          T('Les critères par thème sont descriptifs (une ou deux questions par thème : fluctuations et effet plafond possibles). Limites : mêmes questions avant et après (effet de re-test possible), pas de groupe témoin, volontariat. Lire le résultat comme un indice, pas comme une preuve d’effet du carnet.',
            'Theme criteria are descriptive (one or two questions per theme: fluctuations and ceiling effects possible). Limits: same questions before and after (re-test effect possible), no control group, voluntary participation. Read the result as an indication, not as proof of an effect of the notebook.')]
    res['report'] = '\n'.join(L)
    return res

def self_test():
    rng = random.Random(7)
    def block(pre, post): return 'PHY321-DIAG v1\npre=' + ''.join(map(str, pre)) + '\npost=' + ''.join(map(str, post)) + '\n\n'
    # 30 étudiants : avant ~40 %, après ~80 %
    txt = ''.join(block([int(rng.random() < .4) for _ in range(NQ)], [int(rng.random() < .8) for _ in range(NQ)]) for _ in range(30))
    r = analyse(parse(txt)); assert r['n'] == 30 and r['g'] > 0.3 and r['verdict'], r.get('g')
    # aucun progrès : verdict négatif
    same = ''.join(block(b := [int(rng.random() < .5) for _ in range(NQ)], b) for _ in range(30))
    r2 = analyse(parse(same)); assert not r2['verdict'] and abs(r2['mpre'] - r2['mpost']) < 1e-9
    # effectif trop petit
    r3 = analyse(parse('PHY321-DIAG' + 'PHY321-DIAG'.join(txt.split('PHY321-DIAG')[1:6]))); assert r3['n'] == 5 and not r3['criteria']['n']
    # gain de Hake connu : 50 % -> 75 %  =>  0,5
    assert abs(hake(50, 75) - 0.5) < 1e-12 and hake(100, 100) is None
    # entrée invalide
    try: parse('PHY321-DIAG v1\npre=101\n'); raise SystemExit('une longueur invalide doit être refusée')
    except ValueError: pass
    print('auto-contrôle OK')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0]); ap.add_argument('fichier', nargs='?'); ap.add_argument('--lang', default='fr', choices=['fr', 'en']); ap.add_argument('--sortie'); ap.add_argument('--test', action='store_true')
    a = ap.parse_args()
    if a.test: self_test(); sys.exit(0)
    if not a.fichier: ap.error('fichier requis (ou --test)')
    rep = analyse(parse(open(a.fichier, encoding='utf-8').read()), a.lang)['report']
    if a.sortie: open(a.sortie, 'w', encoding='utf-8').write(rep + '\n')
    else: print(rep)
