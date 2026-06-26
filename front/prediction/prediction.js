/* ============================================================
   prediction.js
   Gère :
     - La récupération des paramètres de l'URL
     - L'appel AJAX pour obtenir les prédictions du PDC sélectionné
     - La mise à jour dynamique du DOM (textes et barres de progression)
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {
    // 1. Récupérer l'ID du point de charge dans l'URL (ex: prediction.html?id=123)
    const params = new URLSearchParams(window.location.search);
    const idPdc = params.get("id");

    if (!idPdc) {
        console.error("Aucun identifiant de point de charge fourni dans l'URL.");
        alert("Erreur : Aucun point de charge n'a été sélectionné.");
        return;
    }

    // 2. Charger les prédictions depuis le PHP
    chargerPrevisions(idPdc);
});

/* Appel AJAX pour récupérer les données de prédiction
   @param {string} id - L'identifiant du point de charge
*/
function chargerPrevisions(id) {
    // Ajuste le chemin vers ton script PHP si nécessaire
    fetch(`php/get_prediction.php?id=${id}`)
        .then(function (response) {
            if (!response.ok) throw new Error("Erreur HTTP " + response.status);
            return response.json();
        })
        .then(function (data) {
            // data doit contenir : type_predit, probabilite_type, puissance_predite, probabilite_puissance
            mettreAJourInterface(data);
        })
        .catch(function (error) {
            console.error("Erreur lors de la récupération des prédictions :", error);
            // Optionnel : Afficher un message d'erreur visuel dans les cartes
        });
}

/* Met à jour les éléments HTML avec les résultats du modèle
   @param {Object} donnees - Les prédictions renvoyées par le serveur
*/
function mettreAJourInterface(donnees) {
    // --- 1. Bloc Type d'implantation ---
    if (donnees.type_predit) {
        // Libellé du type (ex: "Parking public")
        document.querySelector(".card:nth-child(1) .card-value").textContent = donnees.type_predit;
        
        // Indice "Fra..." ou département si tu veux le dynamiser (optionnel)
        if (donnees.commune_prefixe) {
            document.querySelector(".card:nth-child(1) .card-hint").textContent = donnees.commune_prefixe;
        }
    }
    
    if (donnees.probabilite_type) {
        const probaType = parseInt(donnees.probabilite_type);
        // Badge de pourcentage
        document.querySelector(".badge-blue").textContent = probaType + "%";
        // Largeur de la barre de progression
        document.querySelector(".bg-blue").style.width = probaType + "%";
    }

    // --- 2. Bloc Puissance nominale ---
    if (donnees.puissance_predite) {
        // Valeur de la puissance (ex: "22 kW")
        document.querySelector(".card:nth-child(2) .card-value").textContent = donnees.puissance_predite + " kW";
        
        if (donnees.commune_prefixe) {
            document.querySelector(".card:nth-child(2) .card-hint").textContent = donnees.commune_prefixe;
        }
    }
    
    if (donnees.probabilite_puissance) {
        const probaPuissance = parseInt(donnees.probabilite_puissance);
        // Badge de pourcentage
        document.querySelector(".badge-green").textContent = probaPuissance + "%";
        // Largeur de la barre de progression
        document.querySelector(".bg-green").style.width = probaPuissance + "%";
    }
}



