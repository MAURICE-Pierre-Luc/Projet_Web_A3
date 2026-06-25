<?php

include_once "../database/conn.php"; // Important pour le $databaseTables
header('Content-Type: application/json');


if (!isset($_GET['table']) || !isset($databaseTables[$_GET['table']])) { //If the table is missing/invalid, we can't do anything
    echo json_encode([
        'status' => 'error',
        'message' => 'Paramètre table manquant ou invalide (Est-ce que la table est définie dans la conn?)'
    ]);
    exit;
}

$DatabaseInstance = $databaseTables[$_GET['table']];

// Définition des méthodes disponibles
$allowedMethods = [
    'request' => ['id'], //Request prend seulment l'id et renvoie l'entiertée de la ligne 
    'predict' => ['cible', 'info'] //Fait la prédiction en fonction des parmètres entrés
];


// Détection automatique de la méthode à appeler
$calledMethod = null;
$methodParams = [];

foreach ($allowedMethods as $method => $expectedParams) { //Boucle sur chaque clé du dico et prend en compte les valeures associées
    $getKeys = array_keys($_GET); //Crée un dico a partir des parametres de l'url (que pour GET !)
    $filteredKeys = array_diff($getKeys, ['table', 'method']); // Retire les clé table et method du nouveau dictionnaire (on en a pas besoin !)

    $unsortedParams = $expectedParams;

    sort($expectedParams);
    sort($filteredKeys);

    if ($expectedParams === $filteredKeys) { //check si on a les memes clés que la fonction qu'on verifie
        $calledMethod = $method; //On choisi donc celle ci a appelé
        
        //$methodParams = array_map(fn($param) => $_GET[$param], $unsortedParams); //Recupere les valeures de toute les clés de expectedParams dans le $_GET
        $methodParams = array_map(function ($param) {
            return $_GET[$param];
        }, $unsortedParams);
        break;
    }
}


if ($calledMethod === 'request' && method_exists($DatabaseInstance, 'request')) {
    try {
        $result = call_user_func_array([$DatabaseInstance, 'request'], $methodParams);
        $result = prediction($result);

        echo json_encode([
            'status' => 'success',
            'called_method' => $calledMethod,
            'parameters' => $methodParams,
            'data' => $result
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Erreur interne',
            'error' => $e->getMessage()
        ]);
    }

} elseif ($calledMethod === 'predict') {
    try {
        // $methodParams = [$cible, $info] dans l'ordre défini dans $allowedMethods
        $result = prediction(['cible' => $methodParams[0], 'info' => $methodParams[1]]);

        echo json_encode([
            'status' => 'success',
            'called_method' => $calledMethod,
            'parameters' => $methodParams,
            'data' => $result
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Erreur interne',
            'error' => $e->getMessage()
        ]);
    }

} else {
    echo json_encode([
        'status' => 'error',
        'message' => 'Aucune méthode valide détectée ou paramètres manquants',
        'available_methods' => array_keys($allowedMethods),
        'received' => $_GET
    ]);
}

function prediction(array $data): array {
    if (!isset($data['cible'])) {
        if ($data['id_implantation'] === null) {
            $data['id_implantation'] = predictImplantation($data);
        }
        if ($data['puissance_max_kw'] === null) {
            $data['puissance_max_kw'] = predictPuissance($data);
        }
        return $data;
    }

    if ($data['cible'] === 'implantation') {
        return ['resultat' => predictImplantation($data['info'])];
    } elseif ($data['cible'] === 'puissance') {
        return ['resultat' => predictPuissance($data['info'])];
    }

    throw new InvalidArgumentException("Cible inconnue : " . $data['cible']);
}

function predictImplantation($data){
    
}

function predictPuissance($data){

}

?>