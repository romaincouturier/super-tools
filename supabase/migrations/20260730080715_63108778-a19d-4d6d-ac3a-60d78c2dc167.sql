UPDATE public.email_templates SET html_content = 'Bonjour {{first_name}},

J''ai vu que vous vous êtes inscrit(e) à la formation en ligne <strong>"{{training_name}}"</strong> il y a quelques jours, et je voulais prendre 2 minutes pour vous faire un petit coucou.

Vous n''avez pas encore eu l''occasion de démarrer, et c''est tout à fait normal : la vie va vite et caler une formation dans son agenda n''est jamais évident. Il est <strong>encore largement temps de vous lancer</strong>, le rythme reste totalement libre.

Toute votre formation se trouve dans votre espace apprenant SuperTilt. Pour y accéder, c''est très simple :

<ol><li>Cliquez sur le bouton ci-dessous</li><li>Créez votre mot de passe (ou connectez-vous si vous avez déjà un compte)</li><li>Vous arrivez directement sur votre tableau de bord, avec votre formation</li></ol>

<p style="margin: 24px 0;"><a href="{{access_link}}" style="display:inline-block;padding:12px 24px;background-color:#ffd100;color:#101820;text-decoration:none;border-radius:8px;font-weight:bold;">Accéder à ma formation</a></p>

Ce lien est personnel, valable 1 an et réutilisable autant de fois que nécessaire pendant cette période.

Si quelque chose vous freine (manque de temps, un point pas clair, un besoin spécifique...), <strong>répondez-moi directement à ce mail</strong> : on regarde ensemble comment ajuster.

À très vite,' WHERE template_type = 'elearning_start_reminder_vous';

UPDATE public.email_templates SET html_content = 'Bonjour {{first_name}},

J''ai vu que tu t''es inscrit(e) à la formation en ligne <strong>"{{training_name}}"</strong> il y a quelques jours, et je voulais juste prendre 2 minutes pour te faire un petit coucou.

Tu n''as pas encore eu l''occasion de démarrer, et c''est complètement OK : la vie va vite et caler une formation dans son agenda n''est jamais évident. Il est <strong>encore largement temps de te lancer</strong>, le rythme reste totalement libre.

Toute ta formation se trouve dans ton espace apprenant SuperTilt. Pour y accéder, c''est très simple :

<ol><li>Clique sur le bouton ci-dessous</li><li>Crée ton mot de passe (ou connecte-toi si tu as déjà un compte)</li><li>Tu arrives directement sur ton tableau de bord, avec ta formation</li></ol>

<p style="margin: 24px 0;"><a href="{{access_link}}" style="display:inline-block;padding:12px 24px;background-color:#ffd100;color:#101820;text-decoration:none;border-radius:8px;font-weight:bold;">Accéder à ma formation</a></p>

Ce lien est personnel, valable 1 an et réutilisable autant de fois que nécessaire pendant cette période.

Si quelque chose te freine (manque de temps, un point pas clair, un besoin spécifique...), <strong>réponds-moi directement à ce mail</strong> : on regarde ensemble comment ajuster.

À très vite,' WHERE template_type = 'elearning_start_reminder_tu';