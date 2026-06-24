<?php

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");

// 1. Définir le chemin vers le fichier .env
// __DIR__ représente le dossier actuel (back/API). On remonte d'un cran (../) pour trouver le .env
$envPath = realpath(__DIR__ . '/../database/.env');

// 2. Lire le fichier .env
if (!file_exists($envPath)) {
    http_response_code(500);
    echo json_encode(["error" => "Erreur critique : Fichier d'environnement introuvable.",
    "chemin_fouillé_par_php" => $envPath,]);
    
    exit;
}

$env = parse_ini_file($envPath);

// 3. Récupérer les variables
$db_host = $env['DB_HOST'];
$db_name = $env['DB_NAME'];
$db_user = $env['DB_USER'];
$db_pass = $env['DB_PASSWORD'];

// 4. Connexion PDO avec ces variables
try {
    $pdo = new PDO(
        "mysql:host=$db_host;dbname=$db_name;charset=utf8",
        $db_user,
        $db_pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // Requête avec jointures (LEFT JOIN) pour récupérer les textes à la place des ID
    $sql = "SELECT 
                s.id AS id,
                s.nom_enseigne AS nom_station,
                s.adresse_station AS adresse,
                ca.libelle AS acces,
                imp.libelle AS type_implantation,
                s.puissance_max_kw AS puissance_nominale,
                s.nbre_pdc AS nb_pdc,
                op.nom AS operateur,
                s.latitude,
                s.longitude
            FROM station s
            LEFT JOIN condition_acces ca ON s.id_condition_acces = ca.id
            LEFT JOIN implantation imp ON s.id_implantation = imp.id
            LEFT JOIN operateur op ON s.id_operateur = op.id
            WHERE s.latitude IS NOT NULL 
              AND s.longitude IS NOT NULL
              AND s.latitude BETWEEN 41.15 AND 51.5 
              AND s.longitude BETWEEN -10.0 AND 10.0
            ORDER BY s.nom_enseigne ASC";
           
    $stmt = $pdo->query($sql);
    $stations = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Conversion des coordonnées pour Leaflet
    foreach ($stations as &$station) {
        $station['latitude'] = (float)$station['latitude'];
        $station['longitude'] = (float)$station['longitude'];
        $station['cluster'] = -1; // Par défaut, pas de cluster IA sur cette page
    }

    echo json_encode($stations, JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Erreur BDD : " . $e->getMessage()]);
}