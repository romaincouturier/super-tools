# Make the attendance-sheet export visible

## What happens today (AI4Product, Apicil, 4 participants)

In the attendance-signature block, "Exporter PDF" then "toute la session" (whole session) creates the PDF but does not download it. It only saves it on the training. The message "Le document a été ajouté aux documents de la formation" (the document was added to the training's documents) never says where it is.

The file is saved: it appears under "Documents et communication" > "Feuilles d'émargement" (attendance sheets), much higher up the page. On this training there are even 2 copies, generated tonight a few seconds apart.

Two defects:
- The success message appears even when saving fails, because the error is not checked.
- Each new export adds another copy instead of replacing the previous one, because the rule meant to replace the old version never matches the file name.

## Changes

1. **Direct download**: exporting the whole session downloads the PDF straight away, like the per-participant export does. A copy is still saved on the training.
2. **Clear message**: "PDF téléchargé et enregistré dans Documents et communication > Feuilles d'émargement" (PDF downloaded and saved in Documents et communication > Feuilles d'émargement). If saving fails, the message says the file is downloaded but not saved.
3. **No more duplicates**: a new export replaces the previous electronic sheet. Sheets uploaded by hand stay untouched.
4. **Cleanup on the Apicil training**: delete the older of the 2 copies and keep the most recent one.

## Technical details

- `src/components/formations/attendance/attendancePdfExport.ts`: call `doc.save(filename)` for the whole session too. Check `uploadError` and return a distinct message.
- `filterPattern`: replace `"/emargement_electronique_"` with `"_emargement_electronique_"`. The stored name is `attendance_sheets_urls_<ts>_emargement_electronique_<ts>.pdf`, so the old pattern never matches.
- Data: remove the older URL (`..._1791750523523_...`) from `attendance_sheets_urls` on training `724bba99`, and delete the matching storage file.
