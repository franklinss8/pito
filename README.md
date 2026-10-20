# Pito — chaque token a sa machine

Pito est une plateforme sur Ethereum mainnet. Un créateur lance son coin via **Programmable**, l'enregistre sur Pito avec une mission, et une machine GPU lui construit une application web pour ses holders.

## Comment ça marche

1. **Préparer** — le créateur remplit nom, ticker, description, image, liens, frais créateur et premier achat. Pito calcule les frais : 30 bps pour Programmable, plus les frais créateur.
2. **Lancer** — un bouton ouvre le builder Ethereum de Programmable. Le créateur colle les champs et signe dans son wallet. Pito ne touche jamais aux fonds du lancement.
3. **Enregistrer** — le créateur colle l'adresse du token et sa mission, puis signe un message (sans gas). Le serveur vérifie sur Ethereum que :
   - l'adresse est bien un token ERC-20 ;
   - le token a un « launch stamp » sur le Router de Programmable ;
   - le wallet qui signe est le `launchWallet` enregistré dans ce stamp.

   Personne d'autre que le vrai créateur ne peut donc enregistrer un token.
4. **Planifier** — Claude (API Anthropic) rédige le plan de construction.
5. **Construire** — le créateur lance un run. Un job part sur RunPod : un modèle de code open source (Qwen2.5-Coder 14B par défaut) écrit une application web complète sur un GPU dédié.
6. **Partager** — l'application s'affiche sur la page de la machine, dans un bac à sable sans accès réseau, sans accès aux wallets et sans accès aux cookies.

## Financement du GPU

Deux modes, choisis par les variables d'environnement :

- **Gratuit** (`PITO_TREASURY` vide) : chaque machine a `PITO_FREE_RUNS_PER_DAY` runs par 24 h. Ces runs sont à vos frais sur RunPod.
- **Payant** (`PITO_TREASURY` = votre adresse) : chaque run coûte `PITO_RUN_PRICE_ETH`. N'importe qui (créateur ou holder) peut acheter des crédits avec le bouton *Fund*. Le paiement part en ETH vers votre adresse, avec l'id de la machine dans les données de la transaction. Le serveur vérifie la transaction sur Ethereum (2 confirmations) avant de créditer.

Conseil : utilisez pour `PITO_TREASURY` un wallet dédié, pas votre wallet personnel. Le prix par défaut de 0,005 ETH couvre largement un run de 5 à 10 minutes sur un GPU de 48 Go.

---

## Déploiement pas à pas

Comptez environ 1 h la première fois. Vous aurez besoin de comptes GitHub, Vercel, Supabase, RunPod, Docker Hub, Anthropic (console.anthropic.com) et d'un fournisseur RPC Ethereum (Alchemy ou Infura, gratuits).

### 1. Supabase (base de données)
1. Sur supabase.com, créez un projet.
2. Ouvrez **SQL Editor → New query**, collez le contenu de `supabase/schema.sql`, puis cliquez sur **Run**.
3. Dans **Project Settings → API**, copiez l'**URL** et la clé **service_role**. Cette clé est secrète : elle ne va que dans Vercel.

### 2. RPC Ethereum
Sur alchemy.com, créez une app *Ethereum Mainnet* et copiez l'URL HTTPS.

### 3. Clé Claude
Sur console.anthropic.com, créez une clé API et ajoutez un peu de crédit.

### 4. Worker GPU sur RunPod
1. Installez Docker, puis dans le dossier `worker/` :
   ```
   docker build -t VOTRE_COMPTE/pito-worker:1 .
   docker push VOTRE_COMPTE/pito-worker:1
   ```
2. Sur runpod.io, ouvrez **Storage → New Network Volume** et créez un volume de 50 Go. Le modèle y est téléchargé une seule fois.
3. Ouvrez **Serverless → New Endpoint → Custom image** et indiquez `VOTRE_COMPTE/pito-worker:1`, avec ces réglages :
   - GPU : 48 GB (A6000, L40S ou A40) ;
   - Max workers : 1 à 3 ; Idle timeout : 5 s ; Execution timeout : 900 s ;
   - attachez le Network Volume ;
   - pour un modèle privé ou restreint, ajoutez la variable `HF_TOKEN`.
4. Testez l'endpoint avec le contenu de `worker/test_input.json`, via le bouton *Requests* de la console RunPod. Le premier run est lent, car le modèle se télécharge (~30 Go).
5. Copiez l'**Endpoint ID**, puis créez une clé API dans **Settings → API Keys**.

Pour un modèle plus puissant, changez `MODEL_NAME`, par exemple `Qwen/Qwen2.5-Coder-32B-Instruct-AWQ` sur un GPU de 48 Go.

### 5. Vercel (le site)
1. Poussez ce dossier sur un dépôt GitHub privé.
2. Sur vercel.com, ouvrez **Add New → Project**, puis importez le dépôt (le framework Next.js est détecté).
3. Dans **Environment Variables**, ajoutez toutes les variables de `.env.example` avec vos valeurs.
4. Cliquez sur **Deploy**. Ajoutez votre nom de domaine dans **Settings → Domains**.

### 6. Premier test réel
1. Lancez un petit coin sur Programmable (Ethereum), avec un petit premier achat.
2. Attendez la finalité, environ 15 minutes.
3. Sur votre site Pito, étape 3 : collez l'adresse du token, écrivez la mission et signez avec le **même wallet**.
4. Sur la page de la machine, cliquez sur **Run on GPU**. L'app apparaît en 3 à 10 minutes selon le démarrage du GPU.

## Développement local
```
cp .env.example .env.local   # remplissez les valeurs
npm install
npm run dev                  # http://localhost:3000
```

## Fichiers
- `app/` — pages et routes API (Next.js 14)
  - `api/machines` — liste et enregistrement (signature + vérification onchain + plan)
  - `api/machines/[id]` — état, sondage du job RunPod
  - `api/machines/[id]/run` — lance un run GPU (créateur uniquement)
  - `api/machines/[id]/plan` — redessine le plan (créateur uniquement)
  - `api/machines/[id]/deposit` — crédite un paiement ETH vérifié
  - `apps/[id]` — sert l'app générée, sous une CSP « sandbox »
- `lib/eth.ts` — lecture du token et du launch stamp Programmable (toutes les générations de Router du manifest)
- `lib/auth.ts` — vérification des signatures (wallets classiques et smart wallets), anti-rejeu par nonce
- `worker/` — worker GPU RunPod (vLLM)
- `supabase/schema.sql` — tables et fonctions

## Limites connues
- Le lancement du coin se fait sur programmable.market : Programmable n'autorise pas un site tiers à lancer à sa place.
- Chaque run produit une application web autonome, en un seul fichier. Pour des missions plus lourdes (serveur, chat LLM permanent pour les holders), il faudra ajouter un type de worker dédié.
- Le titre et la description des apps générées viennent du modèle. Surveillez les premières machines et retirez-en une si besoin, en supprimant sa ligne dans Supabase.
- Rien sur Pito n'est un conseil financier. Les tokens peuvent perdre toute leur valeur.
