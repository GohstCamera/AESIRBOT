// A:/Asso/AESIR/AESIRBOT/utils/database.js
const mysql = require('mysql2/promise');

// Utilisez les variables d'environnement pour les informations de connexion
// Assurez-vous que ces variables sont définies dans votre fichier .env
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost', // L'adresse de votre serveur MySQL
    user: process.env.DB_USER || 'root',     // Votre nom d'utilisateur MySQL
    password: process.env.DB_PASSWORD || '', // Votre mot de passe MySQL
    database: process.env.DB_NAME || 'aesirbot_db', // Le nom de la base de données que vous avez créée
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test de la connexion
pool.getConnection()
    .then(connection => {
        console.log('✅ Connecté à la base de données MySQL !');
        connection.release(); // Libère la connexion
    })
    .catch(err => {
        console.error('❌ Erreur de connexion à la base de données MySQL :', err.message);
        process.exit(1); // Arrête l'application si la connexion échoue
    });

module.exports = pool;
