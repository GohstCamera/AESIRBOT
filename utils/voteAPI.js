const axios = require('axios');

class VoteAPI {
    constructor() {
        this.topServeursToken = process.env.TOP_SERVEURS_TOKEN; // À configurer dans votre .env
        this.serverId = '1002926708086800394';
    }

    // Vérifier un vote sur Top-Serveurs.net
    async checkTopServeursVote(userId) {
        try {
            const response = await axios.get(`https://api.top-serveurs.net/v1/servers/${this.serverId}/players/${userId}/votes`);
            
            if (response.data && response.data.data) {
                // Vérifier si l'utilisateur a voté dans les dernières 12 heures
                const lastVote = response.data.data.last_vote;
                if (lastVote) {
                    const lastVoteTime = new Date(lastVote * 1000);
                    const now = new Date();
                    const hoursSinceLastVote = (now - lastVoteTime) / (1000 * 60 * 60);
                    
                    return hoursSinceLastVote <= 12;
                }
            }
            return false;
        } catch (error) {
            console.error('Erreur lors de la vérification du vote Top-Serveurs:', error);
            return false;
        }
    }

    // Pour Disboard, malheureusement ils n'ont pas d'API publique
    // Nous devons nous fier au webhook ou au message du bot
    async checkDisboardVote(userId) {
        // Pour Disboard, nous devons nous fier au message du bot
        // mais nous pourrions implémenter une vérification supplémentaire ici
        return true;
    }
}

module.exports = new VoteAPI();
