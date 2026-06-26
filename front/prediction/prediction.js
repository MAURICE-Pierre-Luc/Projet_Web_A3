/* ============================================================
   prediction.js
   Gère :
     - La récupération des paramètres de l'URL
     - L'appel AJAX pour obtenir les prédictions du PDC sélectionné
     - La mise à jour dynamique du DOM (textes et barres de progression)
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const idPdc = params.get("id");

    if (!idPdc) {
        alert("Erreur : Aucun point de charge n'a été sélectionné.");
        return;
    }

    // On n'envoie que l'ID !
    chargerPrevisions(idPdc);
});

/* ============================================================
   Appel AJAX
============================================================ */
function chargerPrevisions(id) {
    // L'URL magique attendue par ton collègue
    const urlFetch = `${api_link}predictions.php?table=station&id=${id}`;

    fetch(urlFetch)
        .then(function (response) {
            if (!response.ok) throw new Error("Erreur HTTP " + response.status);
            return response.json();
        })
        .then(function (json) {
            if (json.status === 'success') {
                // On passe les données de la station (json.data) à l'interface
                mettreAJourInterface(json.data);
            } else {
                console.error("Erreur PHP :", json.message);
            }
        })
        .catch(function (error) {
            console.error("Erreur lors de la récupération des prédictions :", error);
        });
}

/* ============================================================
   Mise à jour de l'interface
============================================================ */
async function mettreAJourInterface(donnees) {
    // Attention : on utilise les noms des colonnes de la BDD telles que renvoyées par le PHP

    // --- 1. Bloc Type d'implantation ---
    // Si l'IA a fait une prédiction, elle a remplacé la valeur null par un texte (ex: "Parking public")
    if (donnees.id_implantation) {

        let implantation = await getData(api_link + "request.php", "?table=implantation&id="+donnees.id_implantation);
        implantation = implantation.libelle
        document.querySelector(".card:nth-child(1) .card-value").textContent = implantation;
    } else {
        document.querySelector(".card:nth-child(1) .card-value").textContent = "Non défini";
    }
    
    // --- 2. Bloc Puissance nominale ---
    // Pareil, l'IA remplit la colonne puissance_max_kw si elle était nulle
    if (donnees.puissance_max_kw) {
        document.querySelector(".card:nth-child(2) .card-value").textContent = donnees.puissance_max_kw + " kW";
    } else {
        document.querySelector(".card:nth-child(2) .card-value").textContent = "Non défini";
    }

}




async function getData(url, args = "?table=station", details = false) {
    const res = await fetch(url + args);

    if (!res.ok) throw new Error("Network error: " + res.statusText);

    if(details){
        console.log(res)
    }

    const result = JSON.parse(await res.text());

    if (!result?.data) throw new Error("Invalid data format");

    return result.data;
}