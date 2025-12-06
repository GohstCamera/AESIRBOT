const mysql = require('mysql2/promise');

// Crée une connexion à la base de données
const connection = mysql.createPool({
    host: 'bretelle.o2switch.net', // <-- REMPLACEZ PAR VOTRE HÔTE
    user: 'erad9507_DISCORDBOT', // <-- REMPLACEZ PAR VOTRE NOM D'UTILISATEUR
    password: ',jijKcpU87AX', // <-- REMPLACEZ PAR VOTRE MOT DE PASSE
    database: 'erad9507_AESIRBOT' // Nom de la base de données
});

module.exports = connection;