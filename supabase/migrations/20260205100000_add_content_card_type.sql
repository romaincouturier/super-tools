-- Neutralisée : content_cards.card_type a déjà été ajoutée sept minutes plus
-- tôt par 20260205093150, en TEXT. Cette migration tentait de la recréer en
-- ENUM et n'a jamais pu s'appliquer — la base de production a bien card_type
-- en TEXT et ne connaît pas le type content_card_type. Elle faisait échouer
-- tout rejeu de l'historique. Conservée vide pour ne pas déplacer l'ordre des
-- migrations déjà enregistrées.
SELECT 1;
