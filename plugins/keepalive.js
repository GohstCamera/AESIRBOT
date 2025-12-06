const http = require('http');

/**
 * Crée et démarre un serveur HTTP simple pour maintenir le bot en ligne.
 * @param {number} port - Le port sur lequel le serveur doit écouter.
 */
function keepAlive(port = 3000) {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot is alive!');
    });

    server.listen(port, () => {
        console.log(`✅ Serveur Keep-Alive démarré sur le port ${port}.`);
    });
}

module.exports = keepAlive;