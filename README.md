# Pito — chaque token a son ordinateur

Pito est un fork de Web4 porté sur **Ethereum mainnet** avec les lancements **Programmable** (Uniswap v4). Chaque token lancé reçoit un ordinateur GPU et une IA qui construit, en public, ce que son créateur décrit. Les holders regardent l'écran, parlent à l'IA, signalent des bugs et votent les fonctionnalités.

Site : https://pito-three.vercel.app

## Les pages

| Page | Ce qu'elle fait |
|---|---|
| `/` Discover | Hero, machines en ligne (tri newest / market cap), les 5 étapes |
| `/computers` | Stats (tokens lancés, ordinateurs, apps, market cap total) et tableau de tous les ordinateurs |
| `/originals` | Cloud Gaming, Open Models (chat gratuit pour les holders), Rent, Automation |
| `/rent` | Louer un ordinateur Pito (GPU au choix, template, paiement ETH à l'heure, Jupyter + terminal) |
| `/templates` | 33 templates GPU en 7 catégories, utilisables au lancement |
| `/developers` | Documentation de l'API publique |
| `/how-it-works` | Les 7 étapes, les frais |
| `/launch` | Wizard en 3 étapes : 01 Token · 02 Build, compute & budget · 03 Fund & launch |
| `/project/{id}` | Page projet : 01 écran en direct · 02 chat + votes · 03 mission, progression, jalons, journal · 04 ordinateur · 05 app |
| `/app/{id}` | L'app construite par la machine (servie depuis son propre ordinateur) |

## Le cycle d'une machine

1. **Create** — le créateur remplit le wizard et signe (sans gas). La machine existe en `prelaunch` avec sa page publique.
2. **Launch** — il lance le coin sur programmable.market (Ethereum) avec **le même wallet**, en mettant la page Pito comme site.
3. **Bind** — il colle l'adresse du token et signe. Le serveur vérifie sur le contrat Router de Programmable que le token a bien un *launch stamp* et que le signataire est le `launchWallet`. Statut `bound`.
4. **Fund** — n'importe qui envoie de l'ETH à la trésorerie Pito avec l'id de la machine en calldata. Vérifié onchain (2 confirmations), crédité en cents USD au cours du moment. En mode gratuit (`PITO_TREASURY` vide), chaque machine a `PITO_FREE_HOURS` offertes.
5. **Start** — Pito loue un pod RunPod (GPU choisi, template installé) et y démarre l'agent. Statut `starting` → `running` dès que l'agent répond.
6. **Work** — l'agent lit la mission, écrit un plan (jalons, étape, progression), exécute des commandes, écrit des fichiers, sert l'app sur le port 8080, répond aux holders, construit les demandes approuvées, diffuse une capture d'écran toutes les 12 s.
7. **Bill** — un cron toutes les 10 min facture le temps écoulé et arrête l'ordinateur quand le budget est épuisé. Refinancer le relance avec ses fichiers.

## L'agent (`public/agent/`)

- `bootstrap.sh` : lancé au boot du pod. Installe les outils, Chromium (captures), éventuellement Ollama pour un modèle local, sert `/workspace/app` sur 8080, puis exécute `agent.py` en boucle (redémarre s'il plante).
- `agent.py` : boucle *lire l'état → réfléchir → une action → rapporter*. Actions : `shell`, `write_file`, `plan`, `reply`, `request_status`, `note`, `app_live`, `idle`. Le modèle Claude est appelé **via Pito** (`/api/agent/{id}/llm`) : la clé Anthropic ne quitte jamais le serveur. Un modèle `local:` passe par Ollama sur le GPU.
- Règles intégrées : bugs corrigés tout de suite, features à 3 votes, gros changements à 10 ; jamais de clés privées, jamais de promesses financières.

## API publique (`/api/public/v1`, JSON, CORS ouvert, sans clé)

- `GET /tokens?sort=new|mcap&limit=&offset=` · `GET /tokens/{id}`
- `GET /computers/{id}` · `GET /computers/{id}/steps` · `GET /machine/frame?id=` (JPEG)
- `GET /tokens/{id}/messages` · `POST /tokens/{id}/messages` (signé par le wallet, holders uniquement)

## Déploiement

Comptes nécessaires : GitHub, Vercel, Supabase, Alchemy (RPC Ethereum), Anthropic, RunPod.

1. **Supabase** : SQL Editor → coller `supabase/schema.sql` → Run. (Réexécutable sans risque : il ajoute ce qui manque, y compris le bucket `frames`.)
2. **RunPod** : Settings → API Keys → créer une clé. Rien d'autre : Pito crée les pods lui-même.
3. **Vercel** : importer le dépôt, puis dans Environment Variables renseigner tout `.env.example` : `PITO_SITE_URL`, `CRON_SECRET`, `ETH_RPC_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RUNPOD_API_KEY`, et au choix `PITO_TREASURY` (payant) ou rien (gratuit, `PITO_FREE_HOURS`).
4. Le cron `/api/cron/tick` est déclaré dans `vercel.json` (toutes les 10 min).
5. **Open Models** (optionnel) : louer une machine Pito avec le template Ollama, exposer son port 11434 et mettre son URL dans `PITO_HOUSE_MODEL_URL`.

## Argent et sécurité

- Pito ne détient aucune clé. Le lancement, les frais créateur et le wallet restent au créateur. Les paiements de compute vont à `PITO_TREASURY` ; utilisez un wallet dédié.
- Toute action d'écriture est signée par le wallet (`personal_sign`, nonce unique, 10 min de validité, anti-rejeu). Les holders sont vérifiés par `balanceOf` onchain.
- Le pod n'a que son `agent_token` ; il ne voit ni la clé Anthropic ni Supabase.
- Les images des templates sont dans `lib/templates.ts` (base + script d'installation). Adaptez-les au besoin.

## Limites connues

- Le lancement du coin se fait sur programmable.market : leur système n'autorise pas un site tiers à lancer à leur place.
- Cloud Gaming liste les machines dont la mission est un jeu ; il n'y a pas (encore) de streaming de jeu natif.
- Automation : guide pour faire tourner l'agent en privé sur une machine louée ; les ordres signés par wallet sont à venir.
- Rien ici n'est un conseil financier. Les tokens peuvent perdre toute leur valeur.
