

/* ------ État global ------ */
let tousLesPoints   = [];   // données brutes reçues du PHP
let pointsFiltres   = [];   // données après filtre/recherche
let pageCourante    = 1;
const LIGNES_PAR_PAGE = 10;

let carteInitialisee  = false;
let instanceCarte     = null;
let idSelectionne     = null;

/* ------ Couleurs des clusters pour la carte ------ */
const COULEURS_CLUSTER = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];

/* ============================================================
   INITIALISATION */
document.addEventListener("DOMContentLoaded", function () {
    chargerPointsDeCharge();
});

/* 
   ONGLETS — basculer entre Tableau et Carte */

function basculerOnglet(onglet) {
    const vueTableau = document.getElementById("vue-tableau");
    const vueCarte   = document.getElementById("vue-carte");
    const btnTableau = document.getElementById("btn-onglet-tableau");
    const btnCarte   = document.getElementById("btn-onglet-carte");

    if (onglet === "tableau") {
        vueTableau.classList.remove("cache");
        vueCarte.classList.add("cache");
        btnTableau.classList.add("actif");
        btnCarte.classList.remove("actif");
    } else {
        vueTableau.classList.add("cache");
        vueCarte.classList.remove("cache");
        btnTableau.classList.remove("actif");
        btnCarte.classList.add("actif");

        // Initialiser la carte uniquement la première fois
        if (!carteInitialisee) {
            initialiserCarte();
            carteInitialisee = true;
        }
    }
}

/* 
   TABLEAU — Chargement des données via AJAX */
function chargerPointsDeCharge() {
    fetch(api_link + "get_visualisation.php")
        .then(function (rep) {
            if (!rep.ok) throw new Error("Erreur HTTP " + rep.status);
            return rep.json();
        })
        .then(function (donnees) {
            tousLesPoints  = donnees;
            pointsFiltres  = donnees;

            // Mettre à jour le compteur en haut de page
            document.getElementById("compteurs").textContent =
                donnees.length.toLocaleString("fr-FR") + " Stations"
                d

            afficherPage(1);
        })
        .catch(function (err) {
            console.error("Erreur chargement points de charge :", err);
            document.getElementById("corps-tableau").innerHTML =
                '<tr><td colspan="6" class="chargement">Impossible de charger les données.</td></tr>';
        });
}

/* ============================================================
   TABLEAU — Afficher une page donnée
   @param {number} page - numéro de page (commence à 1)
============================================================ */
function afficherPage(page) {
    pageCourante = page;

    const debut = (page - 1) * LIGNES_PAR_PAGE;
    const fin   = debut + LIGNES_PAR_PAGE;
    const lignes = pointsFiltres.slice(debut, fin);

    // Mettre à jour le compteur de résultats
    document.getElementById("nb-resultats").textContent =
        pointsFiltres.length.toLocaleString("fr-FR") + " résultats";

    // Construire les lignes HTML
    const corps = document.getElementById("corps-tableau");

    if (lignes.length === 0) {
        corps.innerHTML = '<tr><td colspan="6" class="chargement">Aucun résultat trouvé.</td></tr>';
        document.getElementById("pagination").innerHTML = "";
        return;
    }

    let html = "";
    lignes.forEach(function (pdc) {
        const selectionClass = (pdc.id === idSelectionne) ? " selectionnee" : "";
        html += `
        <tr class="${selectionClass}" onclick="selectionnerLigne(this, ${pdc.id})">
            <td>${pdc.adresse || "—"}</td>
            <td>${pdc.acces || "—"}</td>
            <td>${pdc.type_implantation || "—"}</td>
            <td>${pdc.puissance_nominale || "—"}</td>
            <td>${pdc.nb_pdc || "—"}</td>
            <td>${pdc.operateur || "—"}</td>
        </tr>`;
    });

    corps.innerHTML = html;
    afficherPagination();
}

/* ============================================================
   TABLEAU — Générer la pagination
============================================================ */
function afficherPagination() {
    const totalPages = Math.ceil(pointsFiltres.length / LIGNES_PAR_PAGE);
    const pagination = document.getElementById("pagination");

    if (totalPages <= 1) {
        pagination.innerHTML = "";
        return;
    }

    // Afficher au maximum 5 numéros de page autour de la page courante
    let html = "";

    // Bouton précédent
    html += `<button class="page-btn fleche" onclick="afficherPage(${pageCourante - 1})"
        ${pageCourante === 1 ? "disabled" : ""}>‹</button>`;

    // Calculer la plage de pages à afficher
    let debut = Math.max(1, pageCourante - 2);
    let fin   = Math.min(totalPages, debut + 4);
    if (fin - debut < 4) debut = Math.max(1, fin - 4);

    for (let i = debut; i <= fin; i++) {
        const activeClass = (i === pageCourante) ? " active" : "";
        html += `<button class="page-btn${activeClass}" onclick="afficherPage(${i})">${i}</button>`;
    }

    // Bouton suivant
    html += `<button class="page-btn fleche" onclick="afficherPage(${pageCourante + 1})"
        ${pageCourante === totalPages ? "disabled" : ""}>›</button>`;

    pagination.innerHTML = html;
}

/* ============================================================
   TABLEAU — Filtre par colonne + recherche textuelle
============================================================ */
function filtrerTableau() {
    const colonneFiltre = document.getElementById("select-filtre").value;
    const texteRecherche = document.getElementById("input-recherche").value.toLowerCase().trim();

    pointsFiltres = tousLesPoints.filter(function (pdc) {
        if (!texteRecherche) return true;

        // Si une colonne de filtre est sélectionnée, chercher uniquement dans cette colonne
        if (colonneFiltre) {
            const valeur = String(pdc[colonneFiltre] || "").toLowerCase();
            return valeur.includes(texteRecherche);
        }

        // Sinon, chercher dans toutes les colonnes affichées
        return (
            String(pdc.adresse          || "").toLowerCase().includes(texteRecherche) ||
            String(pdc.acces            || "").toLowerCase().includes(texteRecherche) ||
            String(pdc.type_implantation|| "").toLowerCase().includes(texteRecherche) ||
            String(pdc.operateur        || "").toLowerCase().includes(texteRecherche)
        );
    });

    afficherPage(1);
}

/* ============================================================
   TABLEAU — Sélection d'une ligne
   @param {HTMLElement} ligne - la balise <tr> cliquée
   @param {number} id - identifiant du point de charge
============================================================ */
function selectionnerLigne(ligne, id) {
    // Retirer la surbrillance de toutes les lignes
    document.querySelectorAll("#corps-tableau tr").forEach(function (l) {
        l.classList.remove("selectionnee");
    });

    ligne.classList.add("selectionnee");
    idSelectionne = id;
}

/* ============================================================
   CARTE — Initialisation Leaflet
============================================================ */
function initialiserCarte() {
    instanceCarte = L.map("carte").setView([46.8, 2.3], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
    }).addTo(instanceCarte);

    chargerStations();
}

/* ============================================================
   CARTE — Chargement des stations via AJAX
============================================================ */
function chargerStations() {
    fetch(api_link + "get_visualisation.php")
        .then(function (rep) {
            if (!rep.ok) throw new Error("Erreur HTTP " + rep.status);
            return rep.json();
        })
        .then(function (stations) {
            afficherMarqueurs(stations);
        })
        .catch(function (err) {
            console.error("Erreur chargement stations :", err);
        });
}

/* ============================================================
   CARTE — Ajout des marqueurs avec popups détaillées
   @param {Array} stations - tableau d'objets JSON
============================================================ */
function afficherMarqueurs(stations) {
    stations.forEach(function (station) {
        if (!station.latitude || !station.longitude) return;

        // Couleur du marqueur selon le cluster (si disponible)
        const cluster = station.cluster !== undefined ? parseInt(station.cluster) : -1;
        const couleur = (cluster >= 0) ? COULEURS_CLUSTER[cluster % COULEURS_CLUSTER.length] : "#2D0A6E";

        // Icône circulaire colorée
        const icone = L.divIcon({
            className: "",
            html: `<div style="
                width: 14px; height: 14px;
                border-radius: 50%;
                background-color: ${couleur};
                border: 2px solid white;
                box-shadow: 0 1px 4px rgba(0,0,0,0.4);
            "></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
        });

        // Contenu de la popup (fidèle à la maquette)
        const nomCluster = cluster >= 0
            ? `${cluster} – Résidentiel / Destination`
            : "Non défini";

        const popupHtml = `
            <div class="popup-titre">${station.nom_station}</div>
            <div class="popup-adresse">${station.adresse || ""}</div>
            <div class="popup-ligne">
                <span class="popup-label">Type</span>
                <span class="popup-valeur">${station.type_implantation || "—"}</span>
            </div>
            <div class="popup-ligne">
                <span class="popup-label">Puissance</span>
                <span class="popup-valeur puissance">${station.puissance_nominale || "—"} kW</span>
            </div>
            <div class="popup-ligne">
                <span class="popup-label">PDC</span>
                <span class="popup-valeur">${station.nb_pdc || "—"}</span>
            </div>
            <div class="popup-ligne">
                <span class="popup-label">Opérateur</span>
                <span class="popup-valeur operateur">${station.operateur || "—"}</span>
            </div>
            <div class="popup-ligne">
                <span class="popup-label">Cluster</span>
                <span class="popup-valeur cluster">${nomCluster}</span>
            </div>`;

        L.marker([station.latitude, station.longitude], { icon: icone })
            .bindPopup(popupHtml)
            .addTo(instanceCarte);
    });
}

/* ============================================================
   NAVIGATION — Vers les pages de prédiction
   @param {string} cible - "implantation", "clusters" ou "puissance"
============================================================ */
function allerPrediction(cible) {
    if (cible === "clusters") {
        // Pas besoin de sélection pour les clusters (tous les PDC)
        window.location.href = "../cluster/cluster.html";
        return;
    }

    if (!idSelectionne) {
        alert("Veuillez sélectionner un point de charge dans le tableau.");
        return;
    }

    window.location.href = "prediction.html?id=" + idSelectionne + "&cible=" + cible;
}

