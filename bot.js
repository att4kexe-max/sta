require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const prefix = process.env.BOT_PREFIX || '.';
const configPath = path.join(__dirname, 'statutrole_config.json');
const activeStatuses = new Set(['online', 'idle', 'dnd']);

if (!token) {
  throw new Error('DISCORD_TOKEN manquant. Configure cette variable dans le panel FadeHost ou dans .env.');
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
      console.error('Impossible de lire statutrole_config.json :', error);
    }
    return {};
  }
}

const config = loadConfig();

function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getSettings(guildId) {
  if (!config[guildId]) {
    config[guildId] = { text: '', roleId: null, enabled: false };
  }
  return config[guildId];
}

function hasMatchingStatus(member, settings) {
  const phrase = String(settings.text || '').trim().toLocaleLowerCase();
  const presence = member.presence;
  if (!settings.enabled || !settings.roleId || !phrase || !presence || !activeStatuses.has(presence.status)) {
    return false;
  }

  const customStatus = presence.activities.find((activity) => activity.type === ActivityType.Custom);
  const statusText = String(customStatus?.state || customStatus?.name || '').toLocaleLowerCase();
  return statusText.includes(phrase);
}

async function updateMemberRole(member) {
  if (!member || member.user.bot) return;

  const settings = config[member.guild.id];
  if (!settings?.roleId) return;

  const role = member.guild.roles.cache.get(settings.roleId);
  if (!role || role.id === member.guild.id || role.managed) return;

  const hasRole = member.roles.cache.has(role.id);
  const wantsRole = hasMatchingStatus(member, settings);
  try {
    if (wantsRole && !hasRole) {
      await member.roles.add(role, 'Statut personnalisé correspondant');
    } else if (!wantsRole && hasRole) {
      await member.roles.remove(role, 'Statut personnalisé ne correspondant plus');
    }
  } catch (error) {
    console.error(`Impossible de mettre à jour le rôle ${role.name} :`, error.message);
  }
}

async function refreshGuild(guild) {
  for (const member of guild.members.cache.values()) {
    await updateMemberRole(member);
  }
}

function panelEmbed(guildId) {
  const settings = config[guildId] || {};
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Configuration du rôle par statut')
    .addFields(
      { name: 'Texte recherché', value: settings.text || 'Non configuré', inline: true },
      { name: 'Rôle attribué', value: settings.roleId ? `<@&${settings.roleId}>` : 'Non configuré', inline: true },
      { name: 'État', value: settings.enabled ? 'Activé' : 'Désactivé', inline: true },
    );
}

function panelButtons(guildId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`sr:text:${guildId}`).setLabel('Définir le texte').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`sr:role:${guildId}`).setLabel('Choisir le rôle').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`sr:toggle:${guildId}`).setLabel('Activer / désactiver').setStyle(ButtonStyle.Success),
  );
}

function canManagePanel(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Connecté en tant que ${readyClient.user.tag} (préfixe : ${prefix})`);
  for (const guild of readyClient.guilds.cache.values()) {
    refreshGuild(guild).catch((error) => console.error(`Erreur de synchronisation dans ${guild.name} :`, error));
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.author.bot || !message.content.startsWith(prefix)) return;
  const command = message.content.slice(prefix.length).trim().split(/\s+/, 1)[0]?.toLowerCase();
  if (command !== 'statutrole') return;

  if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await message.reply('Tu dois avoir la permission Gérer les rôles pour utiliser cette commande.');
    return;
  }

  await message.channel.send({
    embeds: [panelEmbed(message.guild.id)],
    components: [panelButtons(message.guild.id)],
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    const [, action, guildId] = interaction.customId.split(':');
    if (!interaction.guild || interaction.guild.id !== guildId) return;
    if (!canManagePanel(interaction)) {
      await interaction.reply({ content: 'Tu dois avoir la permission Gérer les rôles.', ephemeral: true });
      return;
    }

    const settings = getSettings(guildId);
    if (action === 'text') {
      const modal = new ModalBuilder().setCustomId(`sr:text-submit:${guildId}`).setTitle('Texte du statut personnalisé');
      const input = new TextInputBuilder()
        .setCustomId('phrase')
        .setLabel('Texte à rechercher dans le statut')
        .setPlaceholder('Exemple : joue à Minecraft')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(128)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    if (action === 'role') {
      const selector = new RoleSelectMenuBuilder()
        .setCustomId(`sr:role-submit:${guildId}`)
        .setPlaceholder('Choisir le rôle à attribuer')
        .setMinValues(1)
        .setMaxValues(1);
      await interaction.reply({
        content: 'Sélectionne le rôle à attribuer :',
        components: [new ActionRowBuilder().addComponents(selector)],
        ephemeral: true,
      });
      return;
    }

    if (action === 'toggle') {
      settings.enabled = !settings.enabled;
      saveConfig();
      await interaction.update({ embeds: [panelEmbed(guildId)], components: [panelButtons(guildId)] });
      await refreshGuild(interaction.guild);
    }
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('sr:text-submit:')) {
    const guildId = interaction.customId.split(':')[2];
    if (!interaction.guild || interaction.guild.id !== guildId || !canManagePanel(interaction)) {
      await interaction.reply({ content: 'Tu ne peux pas modifier ce panneau.', ephemeral: true });
      return;
    }
    getSettings(guildId).text = interaction.fields.getTextInputValue('phrase').trim();
    saveConfig();
    await interaction.reply({ content: 'Texte enregistré. Le rôle sera mis à jour pour les membres concernés.', ephemeral: true });
    await refreshGuild(interaction.guild);
    return;
  }

  if (interaction.isRoleSelectMenu() && interaction.customId.startsWith('sr:role-submit:')) {
    const guildId = interaction.customId.split(':')[2];
    if (!interaction.guild || interaction.guild.id !== guildId || !canManagePanel(interaction)) {
      await interaction.reply({ content: 'Tu ne peux pas modifier ce panneau.', ephemeral: true });
      return;
    }

    const role = interaction.guild.roles.cache.get(interaction.values[0]);
    const botMember = interaction.guild.members.me;
    if (!role || role.managed || role.id === guildId || !botMember || botMember.roles.highest.comparePositionTo(role) <= 0) {
      await interaction.reply({ content: 'Ce rôle ne peut pas être attribué par le bot. Vérifie sa position dans la hiérarchie.', ephemeral: true });
      return;
    }

    getSettings(guildId).roleId = role.id;
    saveConfig();
    await interaction.update({ content: `Rôle configuré : ${role}`, components: [] });
    await refreshGuild(interaction.guild);
  }
});

client.on(Events.PresenceUpdate, async (before, after) => {
  await updateMemberRole(after.member);
});

client.login(token);