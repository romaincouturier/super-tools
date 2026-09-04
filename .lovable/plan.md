# Plan — Nettoyage du hero de la landing Academy

## Objectif
Supprimer complètement le bloc ajouté en bas du hero (« 4 formations gratuites pour découvrir l’Academy et passer à l’action. ») et la ligne horizontale qui l’accompagne, sans toucher au reste de la page.

## Fichier concerné
- `src/pages/Landing.tsx`

## Modification
- Dans la première `<section>` (hero), supprimer le bloc :
  ```tsx
  <div className="mt-14 hidden lg:block">
    <div className="flex items-center gap-6 border-t-2 border-primary-foreground/30 pt-6">
      <p className="text-6xl font-black text-primary-foreground">4</p>
      <p className="max-w-md text-lg font-semibold leading-7 text-primary-foreground/80">
        formations gratuites pour découvrir l’Academy et passer à l’action.
      </p>
    </div>
  </div>
  ```
- Vérifier que le hero se termine bien après le H1, le paragraphe et le CTA « Voir les formations gratuites ».
- Réajuster si nécessaire les espacements/padding du hero pour retrouver les proportions de la capture de référence.

## Vérification
- Aperçu desktop : s’assurer que le chiffre 4 et le texte associé ont entièrement disparu du hero.
- Confirmer que le header, les textes, les couleurs et les sections suivantes sont inchangés.
