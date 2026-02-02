
# Plan de Sécurité Anti-Brute Force

## Analyse de la Situation Actuelle

### Ce qui est déjà en place (points positifs)
- Politique de mot de passe forte (8 caractères minimum, majuscule, minuscule, chiffre, caractère spécial)
- Indicateur visuel de force du mot de passe
- Restriction d'accès à un seul email autorisé (romain@supertilt.fr)
- Messages d'erreur génériques qui ne révèlent pas si l'email existe
- Système de changement de mot de passe forcé si trop faible

### Ce qui manque (vulnérabilités)
- Aucune protection contre les attaques par force brute
- Pas de limitation du nombre de tentatives de connexion
- Pas de délai progressif entre les tentatives
- Pas de notification en cas de tentatives suspectes
- Pas de verrouillage temporaire du compte

---

## Stratégie de Sécurité Proposée

### Niveau 1 : Protection Anti-Brute Force (Prioritaire)

**Limitation des tentatives de connexion :**
- Maximum **5 tentatives** échouées par adresse IP en 15 minutes
- Maximum **3 tentatives** échouées par email en 15 minutes
- Après dépassement : blocage temporaire de 15 minutes

**Délai progressif (rate limiting intelligent) :**
- 1ère-3ème tentative : immédiat
- 4ème tentative : attente de 5 secondes
- 5ème tentative : attente de 15 secondes
- Au-delà : blocage temporaire

### Niveau 2 : Alertes et Monitoring

**Notifications par email :**
- Alerte après 3 tentatives échouées consécutives
- Notification à chaque connexion réussie depuis une nouvelle IP
- Résumé hebdomadaire si tentatives suspectes

### Niveau 3 : Interface Utilisateur Ergonomique

**Feedback clair sans révéler d'informations :**
- Affichage du nombre de tentatives restantes
- Compte à rebours visible pendant le blocage temporaire
- Message rassurant expliquant la protection

---

## Détails Techniques d'Implémentation

### 1. Nouvelle Table de Base de Données

```text
+----------------------------------+
|        login_attempts            |
+----------------------------------+
| id (uuid)                        |
| ip_address (text)                |
| email (text)                     |
| attempted_at (timestamp)         |
| success (boolean)                |
| user_agent (text)                |
+----------------------------------+
```

Avec un index sur `(ip_address, attempted_at)` et `(email, attempted_at)` pour des requêtes rapides.

### 2. Fonction Backend de Vérification

Une fonction serveur qui :
- Compte les tentatives récentes par IP et par email
- Retourne si la connexion est autorisée ou bloquée
- Calcule le temps de déblocage restant

### 3. Modifications Frontend

**Page Auth.tsx :**
- Appel à la fonction de vérification avant chaque tentative
- Affichage du blocage avec compte à rebours
- Animation de "shake" sur erreur pour feedback visuel

**Nouveau composant LoginAttemptFeedback :**
- Indicateur du nombre de tentatives restantes
- Timer de déblocage si nécessaire

### 4. Edge Function pour les Alertes

Envoi d'email automatique vers romain@supertilt.fr en cas de :
- 3+ tentatives échouées consécutives
- Connexion depuis une nouvelle IP
- Tentative de réinitialisation de mot de passe

---

## Fichiers à Créer/Modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| Migration SQL | Créer | Table `login_attempts` + index |
| `supabase/functions/check-login-attempt/index.ts` | Créer | Vérification des limites |
| `supabase/functions/log-login-attempt/index.ts` | Créer | Enregistrement des tentatives |
| `supabase/functions/send-security-alert/index.ts` | Créer | Alertes par email |
| `src/pages/Auth.tsx` | Modifier | Intégration du rate limiting |
| `src/components/LoginAttemptFeedback.tsx` | Créer | UI du compte à rebours |
| `src/hooks/useLoginAttempts.ts` | Créer | Hook pour gérer l'état |

---

## Expérience Utilisateur

### En fonctionnement normal
1. L'utilisateur entre ses identifiants
2. Si erreur : message "Email ou mot de passe incorrect" + indication "4 tentatives restantes"
3. La connexion fonctionne normalement

### Après plusieurs erreurs
1. Message : "Trop de tentatives. Réessayez dans 12:45"
2. Compte à rebours visible
3. Le bouton "Se connecter" est désactivé
4. Option "Mot de passe oublié" reste accessible

### Notification reçue par l'admin
```
Sujet : ⚠️ Alerte sécurité SuperTools

3 tentatives de connexion échouées détectées
Email : romain@supertilt.fr
IP : 87.89.xxx.xxx
Heure : 02/02/2026 12:25

Si ce n'était pas vous, nous vous recommandons de 
changer votre mot de passe immédiatement.
```

---

## Sécurité Renforcée (Bonus Recommandé)

### Nettoyage automatique
- Suppression des logs de tentatives > 30 jours
- Job planifié quotidien pour maintenance

### Protection du endpoint de reset password
- Limiter à 3 demandes par email par heure
- Éviter le spam de demandes de réinitialisation

---

## Résumé des Protections

| Attaque | Protection |
|---------|------------|
| Brute force par robot | Rate limiting 5 tentatives/15min |
| Attaque distribuée | Limitation par email en plus de l'IP |
| Énumération d'emails | Messages génériques, même comportement |
| Accès non autorisé | Alerte email immédiate |
| Mot de passe faible | Politique stricte + indicateur visuel |

Cette stratégie offre une protection robuste tout en restant simple et ergonomique pour l'utilisateur légitime.
