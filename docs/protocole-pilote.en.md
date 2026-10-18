# Pilot-class protocol — before / after diagnostic (C4)

Aim: to find out, with a simple measure, whether using the notebook goes together with better understanding of the notions
students most often get wrong (measurement, indeterminacy versus ignorance, superposition versus mixture, entanglement versus
correlation, decoherence, the status of analogies).

## Procedure

1. **Week 1 (before the course).** Each student opens the *Diagnostic* page (`en/diagnostic.html`), chooses "Before the course",
   answers alone, without notes, in about 15 minutes, then submits. Corrections are not shown.
2. **End of term (after the course, before the exam).** Same procedure with "After the course". Corrections are shown.
3. **Collection.** Each student clicks "Copy my results" and hands in the copied text (no name, no identifier) through the form
   or document chosen by the teacher. They may also show it on their phone for manual entry.
4. **Analysis.** The teacher pastes all blocks into a text file `results.txt` and runs:

   ```bash
   python3 outils/analyser_diagnostic.py results.txt --lang en --sortie report.md
   python3 outils/analyser_diagnostic.py --test      # self-check of the tool
   ```

   The report gives the paired sample size, the means, Hake's normalised gain, the mean difference with its bootstrap
   confidence interval, the breakdown by theme and by question, and the verdict.

## Acceptance criterion (confirmed by the teacher on 2026-10-18)

The refinement is considered successful for the pilot class if all four conditions hold:

| Condition | Threshold |
|---|---|
| Paired sample (before AND after) | at least 20 students |
| Class normalised gain (Hake) | at least 0.30 |
| Mean before / after difference | lower bound of the 95 % CI above 0 |
| Themes | no theme regressing |

The normalised gain is \(g = (\text{after} - \text{before}) / (100 - \text{before})\), on class means (Hake, 1998). Usual
reference points: medium from 0.30, high from 0.70.

## Cautions

- The ten questions are identical before and after: part of the gain may come from re-testing. To limit this bias, do not
  correct at the pre-test and leave several weeks in between.
- No control group: the result is an indication, not proof that the notebook caused the gain.
- Participation is voluntary, anonymous and ungraded. Tell students the diagnostic is used to improve the course.
- A regressing theme or a weak gain is a lead to examine in light of initial scores and uncertainty (one or two questions per theme: fluctuations and ceiling effects are possible). "No theme regressing" is a descriptive criterion, with no statistical guarantee.
- Students' answers never leave their browser unless they copy the text themselves.
