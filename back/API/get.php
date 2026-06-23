<?php
/**
 * get.php - Version Batch Processing
 */

header("Content-Type: application/json; charset=utf-8");

$db_host = "localhost";
$db_name = "fallie28";
$db_user = "fallie28";
$db_pass = "OfO4xqpiSVGo8ua8";

$python_dir = __DIR__ . "/../scripts/";          
$script     = $python_dir . "script_cluster.py"; 
$python_bin = "python3"; 

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

// 1. Récupération de TOUS les points en une seule fois
try {
    
    $sql = "SELECT latitude, longitude FROM STATION WHERE latitude IS NOT NULL AND longitude IS NOT NULL";
    $stmt = $pdo->query($sql);
    $points = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Requête BDD échouée : " . $e->getMessage()]);
    exit;
}

if (empty($points)) {
    echo json_encode([]);
    exit;
}

// 2. Préparation de la commande pour ouvrir un processus Python
$commande = "cd " . escapeshellarg($python_dir) . " && $python_bin " . escapeshellarg($script);

// Définition des descripteurs de flux : 0 = STDIN (écriture), 1 = STDOUT (lecture), 2 = STDERR (erreurs)
$descriptorspec = [
    0 => ["pipe", "r"], 
    1 => ["pipe", "w"], 
    2 => ["pipe", "w"]  
];

$process = proc_open($commande, $descriptorspec, $pipes);

if (is_resource($process)) {
    // On envoie le tableau de points encodé en JSON à Python via STDIN
    fwrite($pipes[0], json_encode($points));
    fclose($pipes[0]);

    // On récupère la réponse de Python (le JSON final contenant les clusters)
    $sortie Python = stream_get_contents($pipes[1]);
    fclose($pipes[1]);

    // Gestion des erreurs Python potentielles
    $erreurs = stream_get_contents($pipes[2]);
    fclose($pipes[2]);

    $return_value = proc_close($process);

    if ($return_value !== 0) {
        http_response_code(500);
        echo json_encode(["error" => "Erreur script Python", "details" => $erreurs]);
        exit;
    }

    // 3. Optionnel : Appliquer le filtre de cluster côté PHP si le paramètre GET est présent
    $filtre_cluster = isset($_GET["cluster"]) ? intval($_GET["cluster"]) : null;
    
    if ($filtre_cluster !== null) {
        $donnees_completes = json_decode($sortiePython, true);
        $donnees_filtrees = array_filter($donnees_completes, function($point) use ($filtre_cluster) {
            return intval($point['cluster']) === $filtre_cluster;
        });
        // Réindexation du tableau pour éviter d'avoir des clés associatives en JSON
        echo json_encode(array_values($donnees_filtrees));
    } else {
        // Si aucun filtre, on renvoie directement la sortie brute de Python
        echo $sortiePython;
    }

} else {
    http_response_code(500);
    echo json_encode(["error" => "Impossible d'exécuter le processus Python."]);
}