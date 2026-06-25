/* ------ État global ------ */
let tousLesPoints   = [];   // données brutes reçues du PHP
let pointsFiltres   = [];   // données après filtre/recherche
let pageCourante    = 1;
const LIGNES_PAR_PAGE = 10;

let carteInitialisee  = false;
let instanceCarte     = null;
let idSelectionne     = null;

/* ============================================================
   INITIALISATION */
document.addEventListener("DOMContentLoaded", function () {
    chargerPointsDeCharge();
});

/* ============================================================
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


/* ============================================================
   UTILITAIRE — Enrichissement via API Gouv (Code repris de Pierre-Luc)
============================================================ */
async function enrichStationsWithDept(stations) {
    const BATCH = 100;
    const result = [];

    for (let i = 0; i < stations.length; i += BATCH) {
        const batch = stations.slice(i, i + BATCH);
        const enriched = await Promise.all(batch.map(async (station) => {
            try {
                // 1. On demande l'objet 'departement' au lieu de 'codeDepartement'
                const res = await fetch(
                    `https://geo.api.gouv.fr/communes?lat=${station.latitude}&lon=${station.longitude}&fields=departement&format=json`
                );
                const data = await res.json();
                
                // 2. L'API nous renvoie un objet contenant "code" et "nom"
                const deptObj = data[0]?.departement;
                
                // 3. On formate la chaîne de caractères (ex: "44 - Loire-Atlantique")
                const affichageDept = deptObj ? `${deptObj.code} - ${deptObj.nom}` : "—";

                return {
                    ...station,
                    departement: affichageDept
                };
            } catch {
                return { ...station, departement: "—" };
            }
        }));
        result.push(...enriched);
    }

    return result;
}

/* ============================================================
   TABLEAU & CARTE — Chargement des données via AJAX */
async function chargerPointsDeCharge() {
    const corpsTableau = document.getElementById("corps-tableau");
    
    // 1. Message d'attente explicite pendant les requêtes de l'API Gouv
    corpsTableau.innerHTML = '<tr><td colspan="7" class="chargement">Récupération des départements en cours... Veuillez patienter.</td></tr>';

    try {
        // 2. On récupère nos données brutes depuis notre PHP
        const rep = await fetch(api_link + "get_visualisation.php");
        if (!rep.ok) throw new Error("Erreur HTTP " + rep.status);
        const donneesBrutes = await rep.json();

        // 3. On enrichit avec l'API Gouv 
        const donneesEnrichies = await enrichStationsWithDept(donneesBrutes);

        // 4. On stocke le résultat final
        tousLesPoints = donneesEnrichies;
        pointsFiltres = donneesEnrichies;

        // Mise à jour du compteur
        document.getElementById("compteurs").textContent =
            donneesEnrichies.length.toLocaleString("fr-FR") + " Stations";

        // 5. On affiche enfin le tableau
        afficherPage(1);

        // Et la carte si elle est ouverte
        if (carteInitialisee && instanceCarte) {
            afficherMarqueurs(tousLesPoints);
        }

    } catch (err) {
        console.error("Erreur chargement via API :", err);
        corpsTableau.innerHTML =
            '<tr><td colspan="7" class="chargement">Impossible de charger les données.</td></tr>';
    }
}

/* ============================================================
   TABLEAU — Afficher une page donnée
============================================================ */
function afficherPage(page) {
    pageCourante = page;

    const debut = (page - 1) * LIGNES_PAR_PAGE;
    const fin   = debut + LIGNES_PAR_PAGE;
    const lignes = pointsFiltres.slice(debut, fin);

    document.getElementById("nb-resultats").textContent =
        pointsFiltres.length.toLocaleString("fr-FR") + " résultats";

    const corps = document.getElementById("corps-tableau");

    if (lignes.length === 0) {
        // Attention au colspan qui passe de 6 à 7 avec la nouvelle colonne !
        corps.innerHTML = '<tr><td colspan="7" class="chargement">Aucun résultat trouvé.</td></tr>';
        document.getElementById("pagination").innerHTML = "";
        return;
    }

    let html = "";
    lignes.forEach(function (pdc) {
        const estSelectionne = (pdc.id === idSelectionne);
        const selectionClass = estSelectionne ? " selectionnee" : "";
        const radioChecked = estSelectionne ? "checked" : "";
        
        // Un clic sur la ligne ou sur le radio appelle la même fonction
        html += `
        <tr class="${selectionClass}" onclick="selectionnerLigne(this,'${pdc.id}')">
            <td style="text-align: center;">
                <input type="radio" name="stationRadio" value="${pdc.id}" ${radioChecked} 
                       onclick="event.stopPropagation(); selectionnerLigne('${pdc.id}')">
            </td>
            <td>${pdc.departement || "—"}</td>
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

    let html = "";

    html += `<button class="page-btn fleche" onclick="afficherPage(${pageCourante - 1})"
        ${pageCourante === 1 ? "disabled" : ""}>‹</button>`;

    let debut = Math.max(1, pageCourante - 2);
    let fin   = Math.min(totalPages, debut + 4);
    if (fin - debut < 4) debut = Math.max(1, fin - 4);

    for (let i = debut; i <= fin; i++) {
        const activeClass = (i === pageCourante) ? " active" : "";
        html += `<button class="page-btn${activeClass}" onclick="afficherPage(${i})">${i}</button>`;
    }

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

        // Recherche ciblée sur un filtre précis
        if (colonneFiltre) {
            const valeur = String(pdc[colonneFiltre] || "").toLowerCase();
            return valeur.includes(texteRecherche);
        }

        // Recherche globale par défaut
        return (
            String(pdc.departement       || "").toLowerCase().includes(texteRecherche) ||
            String(pdc.acces             || "").toLowerCase().includes(texteRecherche) ||
            String(pdc.type_implantation || "").toLowerCase().includes(texteRecherche) ||
            String(pdc.operateur         || "").toLowerCase().includes(texteRecherche)
        );
    });

    afficherPage(1);
}

/* ============================================================
   AUTOCOMPLETE — Gestion de la complétion automatique
============================================================ */
function gererAutocomplete() {
    const input = document.getElementById("input-recherche");
    const texte = input.value.toLowerCase().trim();
    const liste = document.getElementById("autocomplete-liste");
    const colonneFiltre = document.getElementById("select-filtre").value;

    // 1. Filtrer le tableau en temps réel
    filtrerTableau();

    // 2. Cacher l'autocomplete si la saisie est trop courte
    if (texte.length < 2) {
        liste.innerHTML = "";
        liste.classList.add("cache");
        return;
    }

    // 3. Collecter les suggestions uniques
    const suggestionsUniques = new Set();

    tousLesPoints.forEach(function (pdc) {
        if (colonneFiltre) {
            const valeur = pdc[colonneFiltre];
            if (valeur && String(valeur).toLowerCase().includes(texte)) {
                suggestionsUniques.add(String(valeur));
            }
        } else {
            const champs = ["departement", "acces", "type_implantation", "operateur"];
            champs.forEach(function (champ) {
                const valeur = pdc[champ];
                if (valeur && String(valeur).toLowerCase().includes(texte)) {
                    suggestionsUniques.add(String(valeur));
                }
            });
        }
    });

    // 4. Limiter à 8 résultats pour ne pas surcharger l'écran
    const propositions = Array.from(suggestionsUniques).slice(0, 8);

    if (propositions.length === 0) {
        liste.innerHTML = "";
        liste.classList.add("cache");
        return;
    }

    // 5. Construire le HTML des suggestions
    let html = "";
    propositions.forEach(function (prop) {
        const propEchappee = prop.replace(/'/g, "\\'");
        html += `<div class="autocomplete-suggestion" onclick="selectionnerSuggestion('${propEchappee}')">${prop}</div>`;
    });

    liste.innerHTML = html;
    liste.classList.remove("cache");
}

/* AUTOCOMPLETE — Clic sur une suggestion */
function selectionnerSuggestion(valeur) {
    const input = document.getElementById("input-recherche");
    input.value = valeur; 

    const liste = document.getElementById("autocomplete-liste");
    liste.innerHTML = "";
    liste.classList.add("cache"); 

    // On applique le filtre final avec le mot complet
    filtrerTableau();
}



/* ============================================================
   TABLEAU — Sélection d'une ligne
============================================================ */
function selectionnerLigne(ligne, id) {
    idSelectionne = id;

    document.querySelectorAll("#corps-tableau tr").forEach(function (l) {
        l.classList.remove("selectionnee");
    });

    //Cocher le bouton radio correspondant et surligner sa ligne
    const radio = document.querySelector(`input[name="stationRadio"][value="${id}"]`);
    if (radio) {
        radio.checked = true;
        radio.closest("tr").classList.add("selectionnee");
    }
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

    // On utilise les points déjà récupérés lors du chargement de la page
    if (tousLesPoints.length > 0) {
        afficherMarqueurs(tousLesPoints);
    }
}

/* AUTOCOMPLETE — Fermer au clic ailleurs */
document.addEventListener("click", function (evenement) {
    const liste = document.getElementById("autocomplete-liste");
    const input = document.getElementById("input-recherche");
    
    if (liste && evenement.target !== input && !liste.contains(evenement.target)) {
        liste.classList.add("cache");
    }
});

/* ============================================================
   CARTE — Ajout des circleMarkers uniformes avec popups
============================================================ */
function afficherMarqueurs(stations) {
    stations.forEach(function (station) {
        if (!station.latitude || !station.longitude) return;

        // Contenu de la popup (épuré, sans la notion de Cluster)
        const popupHtml = `
            <div class="popup-titre">${station.nom_station || "Station"}</div>
            <div class="popup-adresse">${station.adresse || "—"}</div>
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
            </div>`;

        // Utilisation de circleMarker : beaucoup plus rapide à afficher que L.marker
        L.circleMarker([station.latitude, station.longitude], {
            radius: 5,             // Taille du cercle
            fillColor: "#3498db",  // Couleur unie (bleu)
            color: "#ffffff",      // Contour blanc
            weight: 1,             // Épaisseur du contour
            opacity: 1,            // Opacité du contour
            fillOpacity: 0.8       // Transparence du remplissage
        })
        .bindPopup(popupHtml)
        .addTo(instanceCarte);
    });
}

/* ============================================================
   NAVIGATION — Vers les pages de prédiction
============================================================ */
function allerPrediction(cible) {
    if (cible === "clusters") {
        window.location.href = "../cluster/cluster.html";
        return;
    }

    const radioCoche = document.querySelector('input[name="stationRadio"]:checked');

    // S'il n'y a aucun bouton coché
    if (!radioCoche) {
        const nomCible = (cible === 'implantation') ? "son implantation" : "sa puissance";
        alert(`Veuillez sélectionner une station dans le tableau pour prédire ${nomCible}.`);
        return;
    }

    // On récupère l'ID directement depuis la valeur du bouton radio
    const idStation = radioCoche.value;
    
    // Redirection =========================(REQUETE A ADAPTER)=====================
    window.location.href = "prediction.html?id=" + idStation + "&cible=" + cible;
}