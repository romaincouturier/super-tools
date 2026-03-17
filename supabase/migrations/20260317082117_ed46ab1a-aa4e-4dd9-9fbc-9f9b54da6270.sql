
INSERT INTO email_templates (template_type, template_name, subject, html_content, is_default)
VALUES
  ('trainer_today_reminder', 'Rappel formateur – session du jour', '📋 Rappel : Session "{{training_name}}" aujourd''hui',
   E'Bonjour {{trainer_first_name}},\n\nPour rappel, vous animez aujourd''hui une session de la formation <strong>"{{training_name}}"</strong>.\n\n<strong>📅 Horaires :</strong> {{schedule}}\n\n{{#meeting_url}}<p>🔗 <strong>Lien visio :</strong> <a href="{{meeting_url}}">Rejoindre la classe virtuelle</a></p>\n\n{{/meeting_url}}{{#has_attendance}}<p>📝 <strong>Émargement :</strong> Pensez à faire signer les feuilles d''émargement aux participants à chaque demi-journée.</p>\n\n{{/has_attendance}}Bonne session !', true),

  ('trainer_live_reminder', 'Rappel formateur – live du jour', '📺 Rappel : Live "{{live_title}}" aujourd''hui – {{training_name}}',
   E'Bonjour {{trainer_first_name}},\n\nPour rappel, vous animez un live collectif aujourd''hui dans le cadre de la formation <strong>"{{training_name}}"</strong> :\n\n<ul>\n<li><strong>{{live_title}}</strong></li>\n<li>📅 {{live_date}} à {{live_time}}</li>\n</ul>\n\n{{#meeting_url}}<p><a href="{{meeting_url}}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Rejoindre le live</a></p>\n\n{{/meeting_url}}{{#has_attendance}}<p>📝 <strong>Émargement :</strong> Pensez à faire signer les feuilles d''émargement aux participants.</p>\n\n{{/has_attendance}}Bonne session !', true);
