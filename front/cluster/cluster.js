
/**
 * cluster.js
 * Gestion de la carte Leaflet pour la page Prédiction du cluster géographique.
 *
 * Fonctionnement :
 *  1. Appel AJAX vers back/API/get qui :
 *     - Récupère les stations (lat, lon) depuis la BDD
 *     - Appelle script_cluster.py via exec() pour chaque point
 *     - Retourne un tableau JSON : [{lat, lon, cluster}]
 *  2. Placement des marqueurs colorés sur la carte Leaflet
 *  3. Filtre interactif par cluster (select + cartes légende)
 */


/* ============================================================
   COULEURS PAR CLUSTER
   ============================================================ */
const CLUSTER_COULEURS = {
  0: "#e53e3e",   
  1: "#3182ce",  
  2: "#38a169",   
};

const CLUSTER_NOMS = {
  0: "Façade Atlantique & Sud-Ouest",
  1: "Hub Parisien & Grand Nord-Est",
  2: "Grand Sud-Est & Méditerranée",
};

/* ============================================================
   INITIALISATION DE LA CARTE LEAFLET
   ============================================================ */
const map = L.map("map", { preferCanvas: true }).setView([46.6, 2.3], 6); // centrée sur la France

// Fond de carte OpenStreetMap
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 18,
}).addTo(map);

/* ============================================================
   VARIABLES GLOBALES
   ============================================================ */
let tousLesMarqueurs = []; // tableau de { marker, cluster }
const loader = document.getElementById("map-loader");


/* ============================================================
   CHARGEMENT DES POINTS DEPUIS LE SERVEUR PHP
   Le PHP récupère les coordonnées des points depuis la BDD et appelle le script Python pour prédire le cluster de chacun.
   ============================================================ */
function chargerPoints(filtre = "all") {
  // Afficher le loader
  loader.classList.remove("hidden");

  // Supprimer les marqueurs existants
  tousLesMarqueurs.forEach(({ marker }) => map.removeLayer(marker));
  tousLesMarqueurs = [];

  // Construire l'URL avec le filtre optionnel
  const url =
    filtre === "all"
      ? "/back/API/get.php"
      : `/back/API/get.php?cluster=${filtre}`;

  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Erreur HTTP : ${response.status}`);
      }
      return response.json();
    })
    .then((points) => {
      //Debug
      console.log("3 premiers points :", points.slice(0,3));
      // Placer chaque point sur la carte
      points.forEach((point) => {
        const couleur = CLUSTER_COULEURS[point.cluster] ?? "#64748B";
        //On utilise circleMarker pour éviter au JS de créer 4000 éléménts HTML et de faire lag la page web
        const marker = L.circleMarker([point.lat, point.lon], {
          radius: 5,           // Taille du point
          fillColor: couleur,  // Couleur de l'IA
          color: "#FFFFFF",    // Bordure blanche
          weight: 1,           // Épaisseur de la bordure
          opacity: 1,
          fillOpacity: 0.9
        })
          .bindPopup(
            `<b>${point.nom_station ?? "Station"}</b><br>
             Cluster ${point.cluster} – ${CLUSTER_NOMS[point.cluster] ?? ""}<br>
             <small>Lat : ${point.lat} | Lon : ${point.lon}</small>`
          )
          .addTo(map);

        tousLesMarqueurs.push({ marker, cluster: point.cluster });
      });
      // Masquer le loader
      loader.classList.add("hidden");
    })
    .catch((err) => {
      console.error("Erreur lors du chargement des points :", err);
      loader.innerHTML = "<span style='color:#e53e3e'>Erreur de chargement des données.</span>";
    });
}

/* ============================================================
   FILTRE VIA LE SELECT
   ============================================================ */
document.getElementById("filtre-cluster").addEventListener("change", function () {
  const valeur = this.value;

  // Mettre à jour l'état actif sur les cartes légende
  document.querySelectorAll(".legende-card").forEach((card) => {
    const clusterCard = card.dataset.cluster;
    card.classList.toggle(
      "active",
      valeur !== "all" && clusterCard === valeur
    );
  });

  chargerPoints(valeur);
});

/* ============================================================
   FILTRE VIA LES CARTES LÉGENDE (clic sur une carte)
   ============================================================ */
document.querySelectorAll(".legende-card").forEach((card) => {
  card.addEventListener("click", function () {
    const cluster = this.dataset.cluster;
    const select = document.getElementById("filtre-cluster");

    // Vérifier si on clique sur le cluster déjà actif → revenir à "tous"
    const dejaActif = this.classList.contains("active");

    document.querySelectorAll(".legende-card").forEach((c) =>
      c.classList.remove("active")
    );

    if (dejaActif) {
      select.value = "all";
      chargerPoints("all");
    } else {
      this.classList.add("active");
      select.value = cluster;
      chargerPoints(cluster);
    }
  });
});

/* ============================================================
   CHARGEMENT INITIAL – tous les clusters
   ============================================================ */
chargerPoints("all");