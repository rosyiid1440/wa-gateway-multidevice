const { jidNormalizedUser } = require('@whiskeysockets/baileys');

const formatJid = (number) => {
    if (number.includes('@')) {
        return jidNormalizedUser(number);
    }
    return number.endsWith('@g.us') ? number : `${number}@s.whatsapp.net`;
};

module.exports = { formatJid };