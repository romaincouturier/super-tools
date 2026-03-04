

## Analyse

Le lien d'accès `https://supertilt.fr/commande/?add-to-cart=16686` est composé de :
- **Base URL** : `https://supertilt.fr/commande/?add-to-cart=` (fixe, propre a ton site WooCommerce)
- **Product ID** : `16686` (le `woocommerce_product_id` deja stocke dans les formules du catalogue)

Actuellement, ce lien est pris du champ `supertilt_link` de la formation, qui doit etre saisi manuellement. C'est redondant puisqu'on a deja le `woocommerce_product_id`.

## Plan

### 1. Ajouter un parametre `woocommerce_cart_base_url` dans app_settings

Nouveau parametre dans **Parametres → Integrations** (section WooCommerce existante) :
- Cle : `woocommerce_cart_base_url`
- Valeur par defaut : `https://supertilt.fr/commande/?add-to-cart=`
- Label : "URL de base du panier WooCommerce"

Cela permet de changer de domaine ou de chemin sans toucher au code.

### 2. Construire automatiquement `access_link` dans l'Edge Function

Dans `send-elearning-access`, au lieu de :
```
accessLink = training.supertilt_link || training.location
```

Faire :
1. Recuperer `woocommerce_cart_base_url` depuis `app_settings`
2. Recuperer le `woocommerce_product_id` de la formule ou du catalogue
3. Construire : `accessLink = baseUrl + productId`
4. Fallback sur `supertilt_link` si pas de product ID

### 3. Fichiers modifies

- `src/pages/Parametres.tsx` : ajouter le champ URL de base WooCommerce dans l'onglet Integrations
- `supabase/functions/send-elearning-access/index.ts` : construire `access_link` automatiquement depuis `app_settings` + `woocommerce_product_id`

