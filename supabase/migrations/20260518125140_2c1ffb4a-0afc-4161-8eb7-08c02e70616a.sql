INSERT INTO public.email_templates (template_type, template_name, subject, html_content, is_default) VALUES
('elearning_magic_link_vous', 'Accès e-learning (magic link, vouvoiement)',
'Votre accès à la formation e-learning "{{training_name}}"',
'Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Votre entreprise vient de vous inscrire à la formation en ligne "<strong>{{training_name}}</strong>"{{#start_date}} qui se déroule du <strong>{{start_date}}</strong> au <strong>{{end_date}}</strong>{{/start_date}}.

Toutes les informations concernant la formation sont disponibles dans votre espace apprenant SuperTilt.

Pour y accéder, c''est très simple :

<ol>
<li>Cliquez sur le bouton ci-dessous</li>
<li>Créez votre mot de passe (ou connectez-vous si vous avez déjà un compte)</li>
<li>Vous arrivez directement sur votre tableau de bord avec votre formation</li>
</ol>

<p style="margin: 24px 0;"><a href="{{access_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">🎓 Accéder à ma formation</a></p>

<p style="font-size: 13px; color: #666;">Ce lien est personnel, valable <strong>30 jours</strong> et réutilisable autant de fois que nécessaire pendant cette période. Au-delà, connectez-vous directement depuis votre espace apprenant.</p>

Je vous souhaite une bonne journée et à très bientôt sur SuperTilt.fr

Si vous avez le moindre souci, contactez-moi.', true),
('elearning_magic_link_tu', 'Accès e-learning (magic link, tutoiement)',
'Ton accès à la formation e-learning "{{training_name}}"',
'Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Ton entreprise vient de t''inscrire à la formation en ligne "<strong>{{training_name}}</strong>"{{#start_date}} qui se déroule du <strong>{{start_date}}</strong> au <strong>{{end_date}}</strong>{{/start_date}}.

Toutes les informations concernant la formation sont disponibles dans ton espace apprenant SuperTilt.

Pour y accéder, c''est très simple :

<ol>
<li>Clique sur le bouton ci-dessous</li>
<li>Crée ton mot de passe (ou connecte-toi si tu as déjà un compte)</li>
<li>Tu arrives directement sur ton tableau de bord avec ta formation</li>
</ol>

<p style="margin: 24px 0;"><a href="{{access_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">🎓 Accéder à ma formation</a></p>

<p style="font-size: 13px; color: #666;">Ce lien est personnel, valable <strong>30 jours</strong> et réutilisable autant de fois que nécessaire pendant cette période. Au-delà, connecte-toi directement depuis ton espace apprenant.</p>

Je te souhaite une bonne journée et à très bientôt sur SuperTilt.fr

Si tu as le moindre souci, contacte-moi.', true)
ON CONFLICT DO NOTHING;