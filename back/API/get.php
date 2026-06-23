<?php
/**
 * get_clusters.php
 *
 * Récupère les points de charge depuis la BDD, appelle le script Python
 * predict_cluster.py pour chaque point, et retourne un tableau JSON.
 *
 * Paramètre GET optionnel :
 *   ?cluster=0|1|2|3|4  → filtre sur un cluster précis
 *
 * Réponse JSON : [{ "lat": ..., "lon": ..., "cluster": ..., "nom_station": ... }, ...]
 */

header("Content-Type: application/json; charset=utf-8");

/* ============================================================
   CONFIGURATION BASE DE DONNÉES
   ============================================================ */
$db_host = "localhost";
$db_name = "fallie28";
$db_user = "fallie28";
$db_pass = "OfO4xqpiSVGo8ua8";

$ia_dir      = __DIR__ . "/../scripts/";          
$script      = $ia_dir . "predict_cluster.py";
$python_bin  = "python3";                    // ou "python" selon le serveur

/* ============================================================
   CONNEXION PDO
   ============================================================ */
try {
    $pdo = new PDO(
        "mysql:host=$db_host;dbname=$db_name;charset=utf8",
        $db_user,
        $db_pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Connexion BDD échouée : " . $e->getMessage()]);
    exit;
}

/* ============================================================
   RÉCUPÉRATION DES POINTS DEPUIS LA BDD
   Adapter les noms de colonnes selon votre MCD
   ============================================================ */
try {
    $sql = "SELECT latitude, longitude
            FROM STATION
            WHERE latitude IS NOT NULL
            AND longitude IS NOT NULL";
    $stmt = $pdo->query($sql);
    $points = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Requête BDD échouée : " . $e->getMessage()]);
    exit;
}

/* ============================================================
   APPEL DU SCRIPT PYTHON POUR CHAQUE POINT
   ============================================================ */
$filtre_cluster = isset($_GET["cluster"]) ? intval($_GET["cluster"]) : null;

$resultats = [];

foreach ($points as $point) {
    $lat = floatval($point["latitude"]);
    $lon = floatval($point["longitude"]);

    // Échappement des arguments pour la sécurité
    $lat_arg = escapeshellarg($lat);
    $lon_arg = escapeshellarg($lon);

    // On se place dans le dossier IA pour que les .pkl soient trouvés
    $commande = "cd " . escapeshellarg($ia_dir) . " && $python_bin script_cluster.py -lat $lat_arg -lon $lon_arg 2>/dev/null";
    $sortie = shell_exec($commande);

    // Parsing de la sortie : "Cluster prédit :X"
    if ($sortie !== null && preg_match('/Cluster prédit\s*:(\d+)/i', trim($sortie), $matches)) {
        $cluster = intval($matches[1]);
    } else {
        // Prédiction impossible : on ignore ce point
        continue;
    }

    // Filtre par cluster si demandé
    if ($filtre_cluster !== null && $cluster !== $filtre_cluster) {
        continue;
    }

    $resultats[] = [
        "lat"         => $lat,
        "lon"         => $lon,
        "cluster"     => $cluster,
    ];
}

echo json_encode($resultats);