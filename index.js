const config = require('./config.json');
const Database = require('easy-json-database');
const db = new Database('./db.json');
const vinted = require('vinted-api');
const fetch = require("node-fetch");
const cheerio = require("cheerio");
if (!db.has('subscriptions')) db.set('subscriptions', []);
const Discord = require('discord.js');
const client = new Discord.Client({
    intents: [Discord.Intents.FLAGS.GUILDS]
});

const synchronizeSlashCommands = require('discord-sync-commands');
synchronizeSlashCommands(client, [
    {
        name: 'sub',
        description: 'Abonnez-vous à une URL de recherche',
        options: [
            {
                name: 'url',
                description: 'L\'URL de la recherche Vinted',
                type: 3,
                required: true
            },
            {
                name: 'channel',
                description: 'Le salon dans lequel vous souhaitez envoyer les notifications',
                type: 7,
                required: true
            }
        ]
    },
    {
        name: 'unsub',
        description: 'Désabonnez-vous d\'une URL de recherche',
        options: [
            {
                name: 'id',
                description: 'L\'identifiant de l\'abonnement (/subs)',
                type: 3,
                required: true
            }
        ]
    },
    {
        name: 'subs',
        description: 'Accèdez à la liste de tous vos subs',
        options: []
    }
], {
    debug: false,
    guildId: config.guildID
}).then((stats) => {
    console.log(`Commandes mises à jour ! ${stats.newCommandCount} commandes créées, ${stats.currentCommandCount} commandes existantes\n`);
});
let lastFetchFinished = true;

const syncSubscription = (sub) => {
    return new Promise((resolve) => {
        vinted.search(sub.url, false, false, {
            per_page: '20'
        }).then((res) => {
            const isFirstSync = db.get('is_first_sync');
            const lastItemTimestamp = db.get(`last_item_ts_${sub.id}`);
            const items = res.items
                .sort((a, b) => new Date(b.photo.high_resolution.timestamp).getTime() - new Date(a.photo.high_resolution.timestamp).getTime())
                .filter((item) => !lastItemTimestamp || new Date(item.photo.high_resolution.timestamp) > lastItemTimestamp);
            if (!items.length) return void resolve();
            const newLastItemTimestamp = new Date(items[0].photo.high_resolution.timestamp).getTime();
            if (!lastItemTimestamp || newLastItemTimestamp > lastItemTimestamp) {
                db.set(`last_item_ts_${sub.id}`, newLastItemTimestamp);
            }
            const itemsToSend = ((lastItemTimestamp && !isFirstSync) ? items.reverse() : [items[0]]);
            for (let item of itemsToSend) {

                if (item.is_for_swap == true) {
                    swap = 'Oui'
                    } else {
                        swap = 'Non'
                    }

                const URL = `https://www.vinted.fr/items/${item.id}`;

                const getRawData = (URL) => {
                    return fetch(URL)
                       .then((response) => response.text())
                       .then((data) => {
                          return data;
                       });
                 };
                const getCondition = async () => {
                    const rawData = await getRawData(URL);
                    const $ = cheerio.load(rawData);
                    state = $("*[itemprop = 'itemCondition']").text()
                    return state;
                };
                getCondition().then((state) => {
                    const embed = new Discord.MessageEmbed()
                        .setTitle(item.title)
                        .setURL(item.url)
                        .setImage(item.photo?.url)
                        .setColor(item.photo.dominant_color_opaque)
                        .setFooter({ text: `By clemsytoff | ID : ${sub.id} | ${item.brand_title}` })
                        .addField('Prix 💸', item.price + "0 €", true)
                        .addField('Vendeur 😄', item.user.login || 'vide', true)
                        .addField('Taille ℹ️', item.size_title || 'vide', true)
                        .addField('Echange 🔃', swap, true)
                    client.channels.cache.get(sub.channelID)?.send({ embeds: [embed], components: [
                        new Discord.MessageActionRow()
                            .addComponents([
                                new Discord.MessageButton()
                                    .setLabel('Détails')
                                    .setURL(item.url)
                                    .setEmoji('ℹ️')
                                    .setStyle('LINK'),
                                new Discord.MessageButton()
                                    .setLabel('Paiement')
                                    .setURL(`https://www.vinted.fr/transaction/buy/new?source_screen=item&transaction%5Bitem_id%5D=${item.id}`)
                                    .setEmoji('💳')
                                    .setStyle('LINK'),
                                new Discord.MessageButton()
                                    .setLabel('Négocier')
                                    .setURL(`https://www.vinted.fr/items/${item.id}/want_it/new?button_name=receiver_id=${item.id}`)
                                    .setEmoji('💸')
                                    .setStyle('LINK'),
                               new Discord.MessageButton()
                                    .setLabel('Contacter le vendeur')
                                    .setURL(`https://www.vinted.fr//items/${item.id}/want_it/new?button_name=receiver_id=${item.id}`)
                                    .setEmoji('📨')
                                    .setStyle('LINK')
                            ])
                    ]}
                    )                                    
                })
            }
            if (itemsToSend.length > 0) {
                console.log(`👕 ${itemsToSend.length} ${itemsToSend.length > 1 ? 'nouveaux articles trouvés' : 'nouvel article trouvé'} pour la recherche ${sub.id} 
!\n`);
            }
            resolve();
        }).catch((e) => {
            console.error('Vinted à rejeté votre/vos demande(s).', e);
            resolve();
        });
    });
};

const sync = () => {
    if (!lastFetchFinished) return;
    lastFetchFinished = false;
    console.log(`🔁\n`);
    const subscriptions = db.get('subscriptions');
    const promises = subscriptions.map((sub) => syncSubscription(sub));
    Promise.all(promises).then(() => {
        db.set('is_first_sync', false);
        console.log("Chargement des nouvelles offres...");
        lastFetchFinished = true;
    });
};

client.on('ready', () => {
    console.log(`🔗 Connecté sous ${client.user.tag} !\n`);

    const entries = db.all().filter((e) => e.key !== 'subscriptions' && !e.key.startsWith('last_item_ts'));
    entries.forEach((e) => {
        db.delete(e.key);
    });
    db.set('is_first_sync', true);
    console.log("Bot lancé avec succès, lectures des librairies Vinted terminée !");

    sync();
    setInterval(sync, 60000);

    client.user.setActivity(`https://dsc.gg/vinthost`);
});

client.on('interactionCreate', (interaction) => {

    if (!interaction.isCommand()) return;
    if (!config.adminIDs.includes(interaction.user.id)) return void interaction.reply(`:x: Vous ne disposez pas des droits pour effectuer cette action !`);

    switch (interaction.commandName) {
        case 'sub': {
            const sub = {
                id: Math.random().toString(36).substring(7),
                url: interaction.options.getString('url'),
                channelID: interaction.options.getChannel('channel').id
            }
            db.push('subscriptions', sub);
            db.set(`last_item_ts_${sub.id}`, null);
            interaction.reply(`:white_check_mark: Votre abonnement a été créé avec succès !\n**URL**: <${sub.url}>\n**Salon**: <#${sub.channelID}>`);
            break;
        }
        case 'unsub': {
            const subID = interaction.options.getString('id');
            const subscriptions = db.get('subscriptions')
            const subscription = subscriptions.find((sub) => sub.id === subID);
            if (!subscription) {
                return void interaction.reply(':x: Aucun abonnement trouvé pour votre recherche...');
            }
            const newSubscriptions = subscriptions.filter((sub) => sub.id !== subID);
            db.set('subscriptions', newSubscriptions);
            interaction.reply(`:white_check_mark: Abonnement supprimé avec succès !\n**URL**: <${subscription.url}>\n**Salon**: <#${subscription.channelID}>`);
            break;
        }
        case 'subs': {
            const subscriptions = db.get('subscriptions');
            const chunks = [];
    
            subscriptions.forEach((sub) => {
                const content = `**ID**: ${sub.id}\n**URL**: ${sub.url}\n**Salon**: <#${sub.channelID}>\n`;
                const lastChunk = chunks.shift() || [];
                if ((lastChunk.join('\n').length + content.length) > 1024) {
                    if (lastChunk) chunks.push(lastChunk);
                    chunks.push([ content ]);
                } else {
                    lastChunk.push(content);
                    chunks.push(lastChunk);
                }
            });
    
            interaction.reply(`:white_check_mark: **${subscriptions.length}** abonnements sont actifs !`);
    
            chunks.forEach((chunk) => {
                const embed = new Discord.MessageEmbed()
                .setColor('RED')
                .setDescription(chunk.join('\n'));
            
                interaction.channel.send({ embeds: [embed] });
            });
        }
    }
});
client.login(config.token)