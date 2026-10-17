#!/usr/bin/env python3
"""Génère les 6 notebooks hors ligne (FR + EN) dans notebooks/fr et notebooks/en, puis les exécute.
Dépendances : numpy, matplotlib, nbformat, nbconvert (aucune connexion nécessaire pour les exécuter).
Usage : python3 outils/generer_notebooks.py            (génère et exécute)
        python3 outils/generer_notebooks.py --sans-exec  (génère seulement)"""
import sys, pathlib, subprocess
import nbformat as nbf

ROOT = pathlib.Path(__file__).resolve().parent.parent
SETUP = "import numpy as np\nimport matplotlib.pyplot as plt\nnp.set_printoptions(precision=4, suppress=True)\nrng = np.random.default_rng(321)  # {c}"

def nb(lang, title, intro, cells):
    fr = lang == 'fr'
    n = nbf.v4.new_notebook()
    n.metadata = {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}, "language_info": {"name": "python"}}
    head = f"# {title}\n\n{intro}\n\n" + ("*Carnet PHY321 — fonctionne sans connexion : numpy et matplotlib suffisent.*" if fr else "*PHY321 Notebook — works offline: numpy and matplotlib are enough.*")
    n.cells = [nbf.v4.new_markdown_cell(head), nbf.v4.new_code_cell(SETUP.format(c="graine fixe : résultats reproductibles" if fr else "fixed seed: reproducible results"))]
    for kind, src in cells:
        n.cells.append(nbf.v4.new_markdown_cell(src) if kind == 'md' else nbf.v4.new_code_cell(src))
    return n

def build(lang):
    t = (lambda a, b: a) if lang == 'fr' else (lambda a, b: b)
    NBS = {}

    NBS['1-qubit-bloch'] = nb(lang, t("Chapitre 1 — Qubit, sphère de Bloch et Mach-Zehnder", "Chapter 1 — Qubit, Bloch sphere and Mach-Zehnder"),
        t("Un état de qubit s'écrit $\\cos(\\theta/2)|0\\rangle + e^{i\\varphi}\\sin(\\theta/2)|1\\rangle$. On le place sur la sphère de Bloch, puis on retrouve numériquement $P(x)=\\cos^2(\\varphi/2)$ de l'exercice 1.9.",
          "A qubit state is $\\cos(\\theta/2)|0\\rangle + e^{i\\varphi}\\sin(\\theta/2)|1\\rangle$. We place it on the Bloch sphere, then recover $P(x)=\\cos^2(\\varphi/2)$ of exercise 1.9 numerically."),
        [('code', f"""theta, phi = 1.0, 0.5
psi = np.array([np.cos(theta/2), np.exp(1j*phi)*np.sin(theta/2)])
sx = np.array([[0,1],[1,0]]); sy = np.array([[0,-1j],[1j,0]]); sz = np.array([[1,0],[0,-1]])
bloch = np.array([np.real(psi.conj() @ s @ psi) for s in (sx, sy, sz)])
print({t('"vecteur de Bloch"', '"Bloch vector"')}, bloch, {t('"norme"', '"norm"')}, np.linalg.norm(bloch))
print("P(0) =", abs(psi[0])**2, "  cos^2(theta/2) =", np.cos(theta/2)**2)"""),
         ('code', f"""fig = plt.figure(figsize=(4.5, 4.5)); ax = fig.add_subplot(projection='3d')
u, v = np.mgrid[0:2*np.pi:40j, 0:np.pi:20j]
ax.plot_wireframe(np.cos(u)*np.sin(v), np.sin(u)*np.sin(v), np.cos(v), color='0.85', linewidth=0.4)
ax.quiver(0, 0, 0, *bloch, color='C3', linewidth=2)
ax.set_xlabel('x'); ax.set_ylabel('y'); ax.set_zlabel('z'); ax.set_title({t('"Sphère de Bloch"', '"Bloch sphere"')})
plt.show()"""),
         ('md', t("## Interféromètre de Mach-Zehnder\n\nSéparatrice $B$, paire de miroirs $M$, lame de phase $\\Phi$ (exercice 1.9).", "## Mach-Zehnder interferometer\n\nBeam splitter $B$, mirror pair $M$, phase plate $\\Phi$ (exercise 1.9).")),
         ('code', f"""B = np.array([[1, 1j], [1j, 1]]) / np.sqrt(2)
M = np.array([[0, 1j], [1j, 0]])
phis = np.linspace(0, 4*np.pi, 200)
Px = []
for ph in phis:
    Phi = np.diag([np.exp(1j*ph), 1])
    out = B @ M @ Phi @ B @ np.array([1, 0])
    Px.append(abs(out[0])**2)
Px = np.array(Px)
assert np.allclose(Px, np.cos(phis/2)**2)
plt.plot(phis, Px, label='P(x)'); plt.plot(phis, 1-Px, label='P(y)')
plt.xlabel({t('"déphasage φ (rad)"', '"phase shift φ (rad)"')}); plt.legend(); plt.show()
print({t('"P(x) = cos²(φ/2) vérifié sur 200 valeurs de φ"', '"P(x) = cos²(φ/2) checked on 200 values of φ"')})""")])

    NBS['2-mesure-statistiques'] = nb(lang, t("Chapitre 2 — Mesure, statistiques et indétermination", "Chapter 2 — Measurement, statistics and indeterminacy"),
        t("On mesure $\\sigma_n$ sur un état préparé, on compare la fréquence des résultats à la règle de Born, puis on vérifie la relation de Robertson $\\Delta\\sigma_x\\Delta\\sigma_y \\ge |\\langle\\sigma_z\\rangle|$.",
          "We measure $\\sigma_n$ on a prepared state, compare outcome frequencies with the Born rule, then check the Robertson relation $\\Delta\\sigma_x\\Delta\\sigma_y \\ge |\\langle\\sigma_z\\rangle|$."),
        [('code', f"""sx = np.array([[0,1],[1,0]]); sy = np.array([[0,-1j],[1j,0]]); sz = np.array([[1,0],[0,-1]])
theta, phi = 1.0, 0.5
psi = np.array([np.cos(theta/2), np.exp(1j*phi)*np.sin(theta/2)])
n = np.array([np.sin(1.2), 0, np.cos(1.2)])           # {t('direction de mesure', 'measurement direction')}
S = n[0]*sx + n[1]*sy + n[2]*sz
vals, vecs = np.linalg.eigh(S)                         # {t('valeurs propres ±1', 'eigenvalues ±1')}
p = np.abs(vecs.conj().T @ psi)**2                     # {t('règle de Born', 'Born rule')}
print({t('"valeurs propres"', '"eigenvalues"')}, vals, {t('"probabilités de Born"', '"Born probabilities"')}, p)"""),
         ('code', f"""Ns = np.unique(np.logspace(1, 5, 30).astype(int))
freq = []
for N in Ns:
    outcomes = rng.choice(2, size=N, p=p/p.sum())
    freq.append(np.mean(outcomes == 1))
plt.semilogx(Ns, freq, 'o-', ms=3); plt.axhline(p[1], color='C3', ls='--', label={t('"probabilité de Born"', '"Born probability"')})
plt.xlabel({t('"nombre de mesures N"', '"number of measurements N"')}); plt.ylabel({t('"fréquence du résultat +1"', '"frequency of outcome +1"')}); plt.legend(); plt.show()"""),
         ('md', t("## Indétermination (Robertson)", "## Indeterminacy (Robertson)")),
         ('code', f"""def mean(A): return np.real(psi.conj() @ A @ psi)
def dev(A): return np.sqrt(mean(A @ A) - mean(A)**2)
lhs = dev(sx) * dev(sy); rhs = abs(mean(sz))
print("Δσx·Δσy =", lhs, " >= |<σz>| =", rhs, {t('"→ vérifié"', '"→ holds"')}, lhs >= rhs - 1e-12)
# {t("égalité pour un état propre de σz ? (ΔσxΔσy = 1 = |<σz>|)", "equality for a σz eigenstate? (ΔσxΔσy = 1 = |<σz>|)")}
psi = np.array([1, 0], dtype=complex); print(dev(sx)*dev(sy), abs(mean(sz)))""")])

    NBS['3-schrodinger-rabi'] = nb(lang, t("Chapitre 3 — Schrödinger en un pas et oscillations de Rabi", "Chapter 3 — One-step Schrödinger and Rabi oscillations"),
        t("Avec $\\hbar=1$ et $\\tilde H=\\tfrac12(\\Omega\\sigma_x+\\Delta\\sigma_z)$, on propage l'état par $U(t)=e^{-i\\tilde Ht}$ (diagonalisation) et on compare à $P_1(t)=\\frac{\\Omega^2}{\\Omega'^2}\\sin^2(\\Omega' t/2)$.",
          "With $\\hbar=1$ and $\\tilde H=\\tfrac12(\\Omega\\sigma_x+\\Delta\\sigma_z)$, we propagate the state with $U(t)=e^{-i\\tilde Ht}$ (diagonalisation) and compare with $P_1(t)=\\frac{\\Omega^2}{\\Omega'^2}\\sin^2(\\Omega' t/2)$."),
        [('code', f"""sx = np.array([[0,1],[1,0]]); sz = np.array([[1,0],[0,-1]])
Om, De = 1.0, 0.3
H = 0.5*(Om*sx + De*sz)
E, V = np.linalg.eigh(H)
def U(t): return V @ np.diag(np.exp(-1j*E*t)) @ V.conj().T      # {t('propagateur exact', 'exact propagator')}
psi0 = np.array([1, 0], dtype=complex)                          # |0>
ts = np.linspace(0, 20, 400)
P1 = np.array([abs((U(t) @ psi0)[1])**2 for t in ts])
Omp = np.hypot(Om, De)
P1_th = (Om/Omp)**2 * np.sin(Omp*ts/2)**2
assert np.allclose(P1, P1_th)
plt.plot(ts, P1, label={t('"numérique"', '"numerical"')}); plt.plot(ts, P1_th, '--', label={t('"formule de Rabi"', '"Rabi formula"')})
plt.xlabel('t'); plt.ylabel('P(1)'); plt.legend(); plt.show()
print({t('"maximum de P1 ="', '"maximum of P1 ="')}, P1.max(), {t('"attendu"', '"expected"')}, (Om/Omp)**2)"""),
         ('md', t("## Résonance", "## Resonance")),
         ('code', f"""for De in (0.0, 0.5, 1.5):
    H = 0.5*(Om*sx + De*sz); E, V = np.linalg.eigh(H)
    P = [abs((V @ np.diag(np.exp(-1j*E*t)) @ V.conj().T @ psi0)[1])**2 for t in ts]
    plt.plot(ts, P, label=f"Δ = {{De}}")
plt.xlabel('t'); plt.ylabel('P(1)'); plt.legend(); plt.show()""")])

    NBS['4-intrication-bell'] = nb(lang, t("Chapitre 4 — Intrication et test de Bell", "Chapter 4 — Entanglement and Bell test"),
        t("On construit $|\\Phi^+\\rangle$, on calcule son état réduit et son entropie, puis on évalue $S$ (CHSH) : $2\\sqrt2$ pour l'état quantique, au plus $2$ pour toute stratégie locale déterministe.",
          "We build $|\\Phi^+\\rangle$, compute its reduced state and entropy, then evaluate $S$ (CHSH): $2\\sqrt2$ for the quantum state, at most $2$ for any local deterministic strategy."),
        [('code', f"""phi_plus = np.array([1, 0, 0, 1]) / np.sqrt(2)
rho = np.outer(phi_plus, phi_plus.conj()).reshape(2, 2, 2, 2)
rho_A = np.einsum('ijkj->ik', rho)                       # {t('trace partielle sur B', 'partial trace over B')}
w = np.linalg.eigvalsh(rho_A); w = w[w > 1e-12]
print("rho_A =", rho_A.real.tolist()); print({t('"entropie de von Neumann (bits) ="', '"von Neumann entropy (bits) ="')}, -(w*np.log2(w)).sum())"""),
         ('code', f"""sx = np.array([[0,1],[1,0]]); sz = np.array([[1,0],[0,-1]])
def obs(a): return np.cos(a)*sz + np.sin(a)*sx
def E(a, b): return np.real(phi_plus @ np.kron(obs(a), obs(b)) @ phi_plus)
a, a2, b, b2 = 0, np.pi/2, np.pi/4, -np.pi/4
S_q = E(a, b) + E(a, b2) + E(a2, b) - E(a2, b2)
print("S_quantique =", S_q, "  2*sqrt(2) =", 2*np.sqrt(2))
# {t('stratégies locales déterministes : A(a),A(a2),B(b),B(b2) ∈ {±1}', 'local deterministic strategies: A(a),A(a2),B(b),B(b2) ∈ {±1}')}
best = max(abs(A1*B1 + A1*B2 + A2*B1 - A2*B2) for A1 in (-1,1) for A2 in (-1,1) for B1 in (-1,1) for B2 in (-1,1))
print({t('"S maximal, stratégie locale ="', '"maximum S, local strategy ="')}, best)"""),
         ('md', t("## Échantillonnage de mesures\n\nOn tire des couples de résultats selon la règle de Born et on retrouve $E(a,b)=\\cos(a-b)$.", "## Sampling measurements\n\nWe draw outcome pairs from the Born rule and recover $E(a,b)=\\cos(a-b)$.")),
         ('code', f"""def sample_E(a, b, N=20000):
    A, Bm = obs(a), obs(b)
    _, va = np.linalg.eigh(A); _, vb = np.linalg.eigh(Bm)
    basis = np.array([np.kron(va[:, i], vb[:, j]) for i in range(2) for j in range(2)])  # {t('résultats (-1,-1),(-1,+1),(+1,-1),(+1,+1)', 'outcomes (-1,-1),(-1,+1),(+1,-1),(+1,+1)')}
    probs = np.abs(basis.conj() @ phi_plus)**2
    signs = np.array([-1*-1, -1*1, 1*-1, 1*1])
    return rng.choice(signs, size=N, p=probs/probs.sum()).mean()
print(sample_E(a, b), np.cos(a-b)); print(sample_E(a2, b2), np.cos(a2-b2))""")])

    NBS['5-paquet-gaussien'] = nb(lang, t("Chapitre 5 — Paquet d'ondes gaussien", "Chapter 5 — Gaussian wave packet"),
        t("Unités $\\hbar=m=1$. On vérifie $\\sigma_x\\sigma_p=\\hbar/2$ par transformée de Fourier, puis l'étalement libre $\\sigma(t)=\\sigma_0\\sqrt{1+(\\hbar t/2m\\sigma_0^2)^2}$.",
          "Units $\\hbar=m=1$. We check $\\sigma_x\\sigma_p=\\hbar/2$ with a Fourier transform, then free spreading $\\sigma(t)=\\sigma_0\\sqrt{1+(\\hbar t/2m\\sigma_0^2)^2}$."),
        [('code', f"""N, L = 4096, 160.0
x = (np.arange(N) - N//2) * (L/N); dx = L/N
k = 2*np.pi*np.fft.fftfreq(N, d=dx)
s0 = 1.0
psi = (2*np.pi*s0**2)**-0.25 * np.exp(-x**2/(4*s0**2)).astype(complex)   # {t('|ψ|² gaussienne d’écart-type σ0', '|ψ|² Gaussian with standard deviation σ0')}
def width(f, grid): 
    p = np.abs(f)**2; p = p/p.sum(); m = (grid*p).sum(); return np.sqrt(((grid-m)**2*p).sum())
phi = np.fft.fft(psi)
print("σx =", width(psi, x), "  σp =", width(phi, k), "  σxσp =", width(psi, x)*width(phi, k), {t('"(attendu 0,5)"', '"(expected 0.5)"')})"""),
         ('code', f"""def evolve(t): return np.fft.ifft(np.fft.fft(psi) * np.exp(-1j*k**2*t/2))
ts = [0, 2, 5, 10]
for t_ in ts:
    plt.plot(x, np.abs(evolve(t_))**2, label=f"t = {{t_}}")
plt.xlim(-25, 25); plt.xlabel('x'); plt.ylabel('|ψ|²'); plt.legend(); plt.show()
for t_ in ts:
    th = s0*np.sqrt(1 + (t_/(2*s0**2))**2)
    print(f"t = {{t_:>3}}   σ(num) = {{width(evolve(t_), x):.4f}}   σ(th) = {{th:.4f}}")"""),
         ('md', t("L'impulsion ne change pas : $\\sigma_p$ reste égal à $1/(2\\sigma_0)$, c'est la phase relative entre composantes qui étale le paquet.", "Momentum does not change: $\\sigma_p$ stays $1/(2\\sigma_0)$; it is the relative phase between components that spreads the packet.")),
         ('code', f"""print("σp(t=10) =", width(np.fft.fft(evolve(10)), k), "  1/(2σ0) =", 1/(2*s0))""")])

    NBS['6-oscillateur-coherent'] = nb(lang, t("Chapitre 6 — Oscillateur harmonique et états cohérents", "Chapter 6 — Harmonic oscillator and coherent states"),
        t("Opérateurs d'échelle tronqués à $N$ niveaux, états de Fock, puis un état cohérent $|\\alpha\\rangle$ : loi de Poisson, $\\langle N\\rangle=|\\alpha|^2$, $\\Delta N=|\\alpha|$ et mouvement de $\\langle x\\rangle$.",
          "Ladder operators truncated at $N$ levels, Fock states, then a coherent state $|\\alpha\\rangle$: Poisson law, $\\langle N\\rangle=|\\alpha|^2$, $\\Delta N=|\\alpha|$ and motion of $\\langle x\\rangle$."),
        [('code', f"""from math import lgamma
Nmax = 80
a = np.diag(np.sqrt(np.arange(1, Nmax)), 1)                # {t('opérateur d’annihilation tronqué', 'truncated annihilation operator')}
ad = a.T
comm = a @ ad - ad @ a
print({t('"[a, a†] = 1 hors du dernier niveau :"', '"[a, a†] = 1 away from the last level:"')}, np.allclose(np.diag(comm)[:-1], 1))
H = ad @ a + 0.5*np.eye(Nmax)                              # {t('en unités de ħω', 'in units of ħω')}
print({t('"niveaux d’énergie"', '"energy levels"')}, np.diag(H)[:5])"""),
         ('code', f"""alpha = 2.0
n = np.arange(Nmax)
logc = -abs(alpha)**2/2 + n*np.log(abs(alpha)) - np.array([lgamma(i+1)/2 for i in n])
c = np.exp(logc).astype(complex)                            # {t('coefficients de |α> dans la base de Fock', 'coefficients of |α> in the Fock basis')}
print({t('"norme ="', '"norm ="')}, np.linalg.norm(c))
print({t('"erreur sur a|α> = α|α> :"', '"error on a|α> = α|α>:"')}, np.linalg.norm(a @ c - alpha*c))
N_op = ad @ a
mN = np.real(c.conj() @ N_op @ c); dN = np.sqrt(np.real(c.conj() @ N_op @ N_op @ c) - mN**2)
print("<N> =", mN, " |α|² =", alpha**2, "  ΔN =", dN, " |α| =", abs(alpha))
from math import factorial
poisson = np.array([np.exp(-alpha**2) * alpha**(2*i) / factorial(i) for i in range(15)])
plt.bar(range(15), np.abs(c[:15])**2, alpha=0.6, label={t('"|<n|α>|²"', '"|<n|α>|²"')}); plt.plot(range(15), poisson, 'ko', ms=4, label={t('"Poisson"', '"Poisson"')})
plt.xlabel('n'); plt.legend(); plt.show()"""),
         ('md', t("## Évolution temporelle\n\nAvec $\\hat x=(a+a^\\dagger)/\\sqrt2$ (unités $\\sqrt{\\hbar/m\\omega}$), $\\langle x\\rangle(t)=\\sqrt2\\,\\alpha\\cos\\omega t$ pour $\\alpha$ réel, sans déformation du paquet.", "## Time evolution\n\nWith $\\hat x=(a+a^\\dagger)/\\sqrt2$ (units $\\sqrt{\\hbar/m\\omega}$), $\\langle x\\rangle(t)=\\sqrt2\\,\\alpha\\cos\\omega t$ for real $\\alpha$, with no spreading.")),
         ('code', f"""X = (a + ad)/np.sqrt(2)
ts = np.linspace(0, 2*np.pi, 100)
xm = []
for t_ in ts:
    ct = c * np.exp(-1j*(n + 0.5)*t_)
    xm.append(np.real(ct.conj() @ X @ ct))
xm = np.array(xm)
assert np.allclose(xm, np.sqrt(2)*alpha*np.cos(ts), atol=1e-6)
plt.plot(ts, xm); plt.xlabel('ωt'); plt.ylabel('<x>'); plt.show()
print({t('"<x>(t) = √2 α cos(ωt) vérifié"', '"<x>(t) = √2 α cos(ωt) checked"')})""")])
    return NBS

def main():
    execute = '--sans-exec' not in sys.argv
    for lang in ('fr', 'en'):
        out = ROOT / 'notebooks' / lang
        out.mkdir(parents=True, exist_ok=True)
        for name, n in build(lang).items():
            path = out / f"{name}.ipynb"
            nbf.write(n, path)
            if execute:
                subprocess.run([sys.executable, '-m', 'nbconvert', '--to', 'notebook', '--execute', '--inplace',
                                '--ExecutePreprocessor.timeout=120', str(path)], check=True, capture_output=True)
            print(path.relative_to(ROOT))

if __name__ == '__main__':
    main()
