# Travaux différés

Ce fichier regroupe les tâches intentionnellement reportées, avec le contexte
nécessaire pour les reprendre proprement sans relancer l'investigation depuis
zéro. À traiter dans les prochaines semaines/mois, pas en urgence.

---

## [LOGISTICS-01] Supprimer les triggers de sync et les colonnes `*_booked` legacy

- **Date d'ajout** : 2026-04-17
- **Contexte** : La refonte "logistique configurable" (volets 1-4) a introduit
  la table `logistics_checklist_items` + une UI de checklist éditable +
  un canal d'alerte basé sur `due_date` / `notify_days_before`.
  Pour ne pas casser la production, les colonnes historiques
  (`missions.train_booked`, `missions.hotel_booked`,
  `trainings.train_booked/hotel_booked/restaurant_booked/room_rental_booked/equipment_ready`,
  `events.train_booked/hotel_booked/room_rental_booked/restaurant_booked`)
  ont été laissées en place et sont synchronisées avec les items de
  checklist via deux triggers PostgreSQL :
    - `_sync_legacy_logistics_field` (item → colonne)
    - `_sync_logistics_from_legacy` (colonne → item)

- **Pourquoi attendre** : `fetchReservationAlerts` dans
  `supabase/functions/_shared/daily-data-fetchers.ts` continue de lire
  exclusivement les `*_booked` pour générer la section "Réservations à
  faire" du digest quotidien. Couper les triggers avant que cette fonction
  ne soit migrée retirerait ces alertes pour toute entité créée après la
  coupure.

- **À faire quand on repasse dessus** (dans 2-4 semaines après soak prod) :
  1. Migrer `fetchReservationAlerts` pour lire depuis
     `logistics_checklist_items` au lieu des `*_booked`. Garder la même
     sortie (`ReservationItem[]` avec `needsTrain/needsHotel/...`) pour
     ne rien changer côté rendu email.
  2. Vérifier qu'aucun autre appelant ne lit les colonnes :
     `grep -rn 'train_booked\|hotel_booked\|restaurant_booked\|room_rental_booked\|equipment_ready' src/ supabase/`
  3. Supprimer les 2 triggers + leurs fonctions dans une migration :
     ```sql
     DROP TRIGGER IF EXISTS trg_logistics_sync_legacy ON public.logistics_checklist_items;
     DROP TRIGGER IF EXISTS trg_logistics_reverse_sync_mission ON public.missions;
     DROP TRIGGER IF EXISTS trg_logistics_reverse_sync_training ON public.trainings;
     DROP FUNCTION IF EXISTS public._sync_legacy_logistics_field();
     DROP FUNCTION IF EXISTS public._sync_logistics_from_legacy();
     ```
  4. Dropper les colonnes legacy (optionnel — elles peuvent aussi rester
     dormantes) :
     ```sql
     ALTER TABLE public.missions   DROP COLUMN train_booked, DROP COLUMN hotel_booked;
     ALTER TABLE public.trainings  DROP COLUMN train_booked, DROP COLUMN hotel_booked,
                                   DROP COLUMN restaurant_booked, DROP COLUMN room_rental_booked,
                                   DROP COLUMN equipment_ready;
     ALTER TABLE public.events     DROP COLUMN train_booked, DROP COLUMN hotel_booked,
                                   DROP COLUMN room_rental_booked, DROP COLUMN restaurant_booked;
     ```
  5. Retirer aussi les boutons UI legacy :
     - `LogisticsBookingButtons` dans `MissionDetailDrawer`
     - Les `DropdownMenuItem` Train/Hôtel/Restaurant/Salle/Matériel dans
       `FormationDetailHeader`
     - Les références `*_booked` dans les types TypeScript
       (`src/types/missions.ts`, `src/hooks/useFormationDetail.ts`, etc.)
  6. Supprimer le hook `legacy_field` dans la table ? Pas forcément —
     il peut servir à d'autres synchros futures. À discuter.

- **Risque** : régression silencieuse des alertes quotidiennes si l'étape 1
  est bâclée. Une checklist de test manuel avant de merger la migration
  cleanup s'impose.

---

## [TESTIMONIAL-01] Valider la migration du pipeline témoignages après soak

- **Date d'ajout** : 2026-04-16
- **Contexte** : La feature "emails à valider" (témoignages Google / vidéo)
  a été supprimée puis restaurée avec une UI dédiée (`/emails-a-valider`)
  au lieu d'un onglet par mission.
- **À faire** : dans 1 mois, vérifier que le cron `process-mission-testimonials`
  tourne bien et que les brouillons apparaissent dans les daily actions de
  la chargée de communication. Si tout va bien, retirer les colonnes dormantes
  `missions.testimonial_status` et `missions.testimonial_last_sent_at` qui
  ne sont plus écrites que par un cron éventuellement réactivé ailleurs —
  à vérifier avant toute suppression destructive.
