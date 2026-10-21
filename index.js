require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('DISCORD_TOKEN manquant dans les variables Fadehost.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
  console.log(`Bot connecté : ${client.user.tag}`);
});

client.login(token);
