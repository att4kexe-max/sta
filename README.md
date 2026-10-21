# Bot Discord de rôle par statut

Le bot attribue un rôle aux membres dont le statut personnalisé contient le texte configuré. Il le retire si le texte ne correspond plus ou si le membre passe hors ligne. Les statuts en ligne, inactif et ne pas déranger sont pris en compte.

## Installation

1. Utilise Node.js 18 ou plus récent.
2. Installe les dépendances avec `npm install`.
3. Copie `.env.example` vers `.env` et renseigne `DISCORD_TOKEN`. Sur FadeHost, tu peux aussi ajouter `DISCORD_TOKEN` et `BOT_PREFIX` aux variables d'environnement du serveur.
4. Dans le portail développeur Discord, active les intents privilégiés **Server Members Intent**, **Presence Intent** et **Message Content Intent** pour le bot.
5. Invite le bot avec les permissions **Gérer les rôles** et **Lire/Envoyer des messages**. Place son rôle au-dessus du rôle qu'il doit attribuer.
6. Démarre le bot avec `npm start` ou configure FadeHost pour lancer `node bot.js`.

## Utilisation

Sur le serveur, exécute `.statutrole`. Le panneau permet de définir le texte recherché, choisir le rôle, puis activer ou désactiver l'attribution. La configuration est sauvegardée dans `statutrole_config.json`.

Le texte est recherché sans tenir compte des majuscules et peut être une partie du statut personnalisé. Le bot doit rester en ligne pour surveiller les changements de présence.