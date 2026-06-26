<?php

include_once "../database/conn.php"; // Important pour le $databaseTables
header('Content-Type: application/json');


if (!isset($_GET['table']) || !isset($databaseTables[$_GET['table']])) { //If the table is missing/invalid, we can't do anything
    echo json_encode([
        'status' => 'error',
        'message' => 'Paramètre table manquant ou invalide Est-ce que la table est définie dans la conn?'
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
        return ['resultat' => predictPuissance($data['info'], )];
    }

    throw new InvalidArgumentException("Cible inconnue : " . $data['cible']);
}

function predictImplantation(array $data): string {
    global $conn;

    // --- Résolution des FK ---
    $operateur = $conn->prepare("SELECT nom FROM OPERATEUR WHERE id = ?");
    $operateur->execute([$data['id_operateur']]);
    $nomOperateur = $operateur->fetchColumn();

    $gabarit = $conn->prepare("SELECT libelle FROM RESTRICTION_GABARIT WHERE id = ?");
    $gabarit->execute([$data['id_restriction_gabarit']]);
    $libelleGabarit = $gabarit->fetchColumn();

    // --- Horaires : construction de la string ---
    $horaires = $conn->prepare("
        SELECT h.jour, h.heure_debut, h.heure_fin
        FROM STATION_HORAIRE sh
        JOIN HORAIRE h ON sh.id_horaire = h.id
        WHERE sh.id_station = ?
    ");
    $horaires->execute([$data['id']]);
    $rows = $horaires->fetchAll(PDO::FETCH_ASSOC);

    // Construit "mo 08:00-20:00, tu 08:00-20:00, ..."
    $horairesStr = implode(', ', array_map(
        fn($r) => $r['jour'] . ' ' . $r['heure_debut'] . '-' . $r['heure_fin'],
        $rows
    ));

    // --- Résolution raccordement ---
    $raccordement = $conn->prepare("SELECT libelle FROM RACCORDEMENT WHERE id = ?");
    $raccordement->execute([$data['id_raccordement']]);
    $libelleRaccordement = $raccordement->fetchColumn() ?? 'inconnu';

    // --- Booléens directement dans $data ---
    $reservation   = $data['reservation']      ? 'true' : 'false';
    $paiementActe  = $data['paiement_acte']    ? 'true' : 'false';
    $paiementCb    = $data['paiement_cb']      ? 'true' : 'false';
    $paiementAutre = $data['paiement_autre']   ? 'true' : 'false';
    $cableT2       = $data['cable_t2_attache'] ? 'true' : 'false';

    // --- Appel Python ---
    $cmd = sprintf(
    'python3 /chemin/vers/predict_implantation.py ' .
    '--nom-operateur %s ' .
    '--restriction-gabarit %s ' .
    '--raccordement %s ' .
    '--paiement-acte %s ' .
    '--paiement-cb %s ' .
    '--paiement-autre %s ' .
    '--reservation %s ' .
    '--cable-t2-attache %s ' .
    '--date-mise-en-service %s ' .
    '--horaires %s',
    escapeshellarg($nomOperateur),       // --nom-operateur
    escapeshellarg($libelleGabarit),     // --restriction-gabarit
    escapeshellarg($libelleRaccordement),// --raccordement
    $paiementActe,                       // --paiement-acte
    $paiementCb,                         // --paiement-cb
    $paiementAutre,                      // --paiement-autre
    $reservation,                        // --reservation
    $cableT2,                            // --cable-t2-attache
    escapeshellarg($data['date_mise_en_service']), // --date-mise-en-service
    escapeshellarg($horairesStr)         // --horaires
);

    $output = shell_exec($cmd);

    if ($output === null) {
        throw new RuntimeException("Le script Python n'a pas répondu");
    }

    $result = json_decode(trim($output), true);

    if (!isset($result['implantation'])) {
        throw new RuntimeException("Réponse Python invalide : " . $output);
    }

    return $result['implantation'];
}

function predictPuissance(array $data): float {

    global $conn

    // --- Résolution des FK ---
    $operateur = $pdo->prepare("SELECT nom FROM OPERATEUR WHERE id = ?");
    $operateur->execute([$data['id_operateur']]);
    $nomOperateur = $operateur->fetchColumn();

    $implantation = $pdo->prepare("SELECT libelle FROM IMPLANTATION WHERE id = ?");
    $implantation->execute([$data['id_implantation']]);
    $libelleImplantation = $implantation->fetchColumn();

    $pmr = $pdo->prepare("SELECT libelle FROM ACCESSIBILITE_PMR WHERE id = ?");
    $pmr->execute([$data['id_accessibilite_pmr']]);
    $libellePmr = $pmr->fetchColumn();

    $condition = $pdo->prepare("SELECT libelle FROM CONDITION_ACCES WHERE id = ?");
    $condition->execute([$data['id_condition_acces']]);
    $libelleCondition = $condition->fetchColumn();

    // --- Types de prises (one-hot) ---
    $prises = $pdo->prepare("
        SELECT tp.libelle 
        FROM STATION_PRISE sp
        JOIN TYPE_PRISE tp ON sp.id_type_prise = tp.id
        WHERE sp.id_station = ?
    ");
    $prises->execute([$data['id']]);
    $libellesPrises = $prises->fetchAll(PDO::FETCH_COLUMN);

    $typesPrises = [
        'ef'        => in_array('EF', $libellesPrises)        ? 'true' : 'false',
        'type2'     => in_array('Type 2', $libellesPrises)    ? 'true' : 'false',
        'comboccs'  => in_array('Combo CCS', $libellesPrises) ? 'true' : 'false',
        'chademo'   => in_array('CHAdeMO', $libellesPrises)   ? 'true' : 'false',
        'autre'     => in_array('Autre', $libellesPrises)     ? 'true' : 'false',
    ];

    // --- Gratuit ---
    $gratuit = ($data['tarif_eur_kwh'] == 0 || $data['tarif_eur_kwh'] === null) ? 'true' : 'false';

    // --- Appel Python ---
    $cmd = sprintf(
        'python3 /chemin/vers/predict_puissance.py ' .
        '--nom-operateur %s ' .
        '--nom-enseigne %s ' .
        '--implantation-station %s ' .
        '--accessibilite-pmr %s ' .
        '--condition-acces %s ' .
        '--gratuit %s ' .
        '--prise-type-ef %s ' .
        '--prise-type-2 %s ' .
        '--prise-type-combo-ccs %s ' .
        '--prise-type-chademo %s ' .
        '--prise-type-autre %s ' .
        '--longitude %s ' .
        '--latitude %s ' .
        '--nbre-pdc %s',
        escapeshellarg($nomOperateur),
        escapeshellarg($data['nom_enseigne']),
        escapeshellarg($libelleImplantation),
        escapeshellarg($libellePmr),
        escapeshellarg($libelleCondition),
        $gratuit,
        $typesPrises['ef'],
        $typesPrises['type2'],
        $typesPrises['comboccs'],
        $typesPrises['chademo'],
        $typesPrises['autre'],
        $data['longitude'],
        $data['latitude'],
        $data['nbre_pdc']
    );

    $output = shell_exec($cmd);

    if ($output === null) {
        throw new RuntimeException("Le script Python n'a pas répondu");
    }

    $result = json_decode(trim($output), true);

    if (!isset($result['puissance'])) {
        throw new RuntimeException("Réponse Python invalide : " . $output);
    }

    return (float) $result['puissance'];
}

?>