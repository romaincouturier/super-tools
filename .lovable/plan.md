
Objectif
- Éliminer définitivement l’écran/bloc blanc dans “Signature du formateur” depuis une fiche formation.
- Vérifier de façon explicite si une partie du problème peut venir du navigateur/appareil utilisateur, sans renvoyer la charge au user.

Constat actuel (à partir du replay, logs, code)
- Le dialogue s’ouvre correctement et le canvas est visible.
- L’utilisateur interagit bien avec le canvas, mais le trait n’apparaît pas.
- Aucun crash JS bloquant n’apparaît dans les logs au moment de l’action (seulement des warnings de refs sur ScheduledEmailsSummary).
- Le flux “public signature” (autres pages de signature) fonctionne avec un pattern d’initialisation canvas plus stable.

Do I know what the issue is?
- Oui, suffisamment pour corriger: l’initialisation de SignaturePad dans AttendanceSignatureBlock reste fragile au timing d’ouverture de la modale (animation/render), et n’offre pas de fallback robuste si le pad n’est pas prêt.  
- En plus, les warnings de refs (Dialog/AlertDialog headers/footers non forwardRef) polluent le debug et peuvent masquer les vrais signaux d’erreur.

Plan de correction
1) Rendre l’initialisation du pad robuste et observable
- Fichier: `src/components/formations/AttendanceSignatureBlock.tsx`
- Remplacer l’init “best effort” actuelle par une stratégie en 3 niveaux:
  1. attente dimensionnelle fiable (canvas réellement mesuré),
  2. initialisation contrôlée avec garde anti double-init,
  3. fallback utilisateur si init impossible.
- Détails techniques:
  - Ajouter un état `signaturePadReady` et `signatureInitError`.
  - Initialiser uniquement quand `showTrainerSignDialog === true` ET `canvasRef.current` présent.
  - Utiliser une logique de retry avec limite + délai (rAF + timeout de secours), puis basculer en erreur lisible si échec.
  - Encapsuler toute l’initialisation dans `try/catch` (y compris callback async/rAF) pour éviter qu’une erreur non capturée casse l’UI.
  - Détruire proprement l’instance en cleanup via `signaturePadRef.current?.off()` avant reset.
  - Mettre `Effacer`/`Valider` désactivés tant que `signaturePadReady` est faux.
  - Afficher un message in-dialog “Initialisation de la zone de signature…” puis “Impossible d’initialiser, Réessayer”.

2) Uniformiser la logique HiDPI avec les utilitaires existants
- Fichiers:  
  - `src/lib/signatureUtils.ts`  
  - `src/components/formations/AttendanceSignatureBlock.tsx`
- Réutiliser les utilitaires de dimensionnement (déjà présents) pour éviter les divergences entre pages.
- Garantir l’ordre:
  - canvas dimensionné/scalé correctement,
  - puis création de `SignaturePad`,
  - puis `clear()` initial.
- Ajouter fallback sur `getBoundingClientRect()` si `offsetWidth/offsetHeight` restent à 0 (cas devices/zoom/animation).

3) Ajouter un diagnostic “côté utilisateur” non intrusif
- Fichier: `src/components/formations/AttendanceSignatureBlock.tsx`
- Au moment où la modale s’ouvre, collecter (console debug + état interne) :
  - dimensions CSS et internes canvas,
  - devicePixelRatio,
  - disponibilité contexte 2D,
  - statut ready/error.
- Si le navigateur est dans un cas limite (canvas/context indisponible), montrer un message clair dans la modale (au lieu d’un “blanc” silencieux), avec action “Réessayer”.
- Cela permettra de prouver rapidement si l’environnement utilisateur est en cause.

4) Corriger les warnings React de refs (stabilité/debug)
- Fichier: `src/components/ui/alert-dialog.tsx`
- Convertir `AlertDialogHeader` et `AlertDialogFooter` en `React.forwardRef` (comme déjà fait pour `DialogHeader`/`DialogFooter`).
- Effet attendu: logs plus propres, tri plus facile des erreurs réellement liées à la signature.

5) Renforcer les tests unitaires
- Fichier: `src/lib/signatureUtils.test.ts`
- Ajouter des cas qui reproduisent le comportement “modale animée / dimensions tardives”:
  - init réussie après plusieurs frames,
  - fallback `getBoundingClientRect`,
  - échec contrôlé (retour false + message d’erreur côté composant).
- Vérifier qu’aucune exception asynchrone non catchée ne remonte.

Validation prévue (avant livraison)
- Desktop: ouvrir “Signature du formateur”, tracer à la souris, vérifier trait visible immédiatement, effacer, signer, persistance OK.
- Mobile: même scénario au doigt.
- Cas dégradé: simuler canvas non prêt → message d’erreur affiché, bouton Réessayer fonctionnel.
- Vérifier absence de warnings refs dans la console de la page formation.
- Vérifier qu’on distingue bien:
  - bug applicatif (pad non prêt, init échoue),
  - contrainte environnement utilisateur (context 2D indisponible, dimensions impossibles).

Risques et mitigation
- Risque: régression sur d’autres signatures.
  - Mitigation: ne toucher que le flux “formateur depuis formation” et réutiliser les utilitaires communs.
- Risque: double binding d’événements.
  - Mitigation: cleanup explicite `off()` à chaque fermeture et avant réinit.
- Risque: UX bloquée si init lente.
  - Mitigation: état de chargement explicite + retry manuel.

Résultat attendu
- Plus de “zone blanche” silencieuse.
- Signature visible et enregistrable de manière fiable.
- Diagnostic clair quand le contexte utilisateur pose problème.
- Console assainie des warnings de refs parasites.
