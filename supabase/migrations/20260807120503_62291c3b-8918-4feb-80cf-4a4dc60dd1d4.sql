UPDATE lms_lesson_blocks
SET content = jsonb_set(
  content,
  '{html}',
  to_jsonb(
    replace(
      replace(
        content->>'html',
        '<p>Je vous encourage à me donner <a target="_blank" rel="noopener noreferrer nofollow" class="text-primary underline cursor-pointer" href="https://supertilt.fr/courses/facilitation-graphique-communiquer-avec-le-visuel/lessons/module-5-le-parler-dessiner/topic/questionnaire-devaluation/"><strong>votre avis sur qualité de la formation et du formateur :).</strong></a> Vos retours sont indispensables pour faire évoluer et améliorer notre travail.</p>',
        '<p>Je vous encourage à me donner <strong>votre avis sur la qualité de la formation et du formateur</strong> en complétant le questionnaire d''évaluation ci-dessous. Vos retours sont indispensables pour faire évoluer et améliorer notre travail.</p>'
      ),
      '<p>Si vous avez terminé tous les modules, vous pouvez télécharger votre certificat (colonne de gauche rubrique “Vos certificats”).</p>',
      '<p>Dès que le questionnaire d''évaluation est envoyé, votre certificat de réalisation est généré et vous est adressé par email. Il reste ensuite disponible dans votre espace apprenant.</p>'
    )
  )
)
WHERE id = '254241fa-09d4-423d-be66-526dfda4679d';

INSERT INTO lms_lesson_blocks (lesson_id, type, position, content, hidden)
SELECT '790c240f-67dc-4277-b1b6-7a4b8e9d2727', 'shortcode', 1,
  '{"code":"evaluation","title":"Questionnaire d''évaluation de la formation"}'::jsonb, false
WHERE NOT EXISTS (
  SELECT 1 FROM lms_lesson_blocks
  WHERE lesson_id = '790c240f-67dc-4277-b1b6-7a4b8e9d2727' AND type = 'shortcode'
);