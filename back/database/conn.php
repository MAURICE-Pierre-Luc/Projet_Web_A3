<?php

include_once "requests.php";

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);


function loadEnv(string $filepath): array {
    $env = [];

    // Vérifie si le fichier existe et est lisible
    if (!is_readable($filepath)) {
        throw new Exception("Fichier non lisible ou inexistant : $filepath");
    }

    // Ouvre et lit le fichier ligne par ligne
    $lines = file($filepath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        // Sépare à la première occurrence de '='
        $parts = explode('=', $line, 2);

        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $value = trim($parts[1]);
            $env[$key] = $value;
        }
    }

    return $env;
}





$env = loadEnv(__DIR__ . '/.env');

$host = $env['DB_HOST'];
$dbname = $env['DB_NAME'];
$username = $env['DB_USER'];
$password = $env['DB_PASSWORD'];




$databaseConnected = false;

try {
    // On fait un PDO pour mysql
    $conn = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $databaseConnected = true;
} 
catch (PDOException $e1) {
    try {
        // On fait le PDO pour postgres si jamais celui pour mysql a fail (au cas ou on serais sur la bdd dev)
        $conn = new PDO("pgsql:host=$host;dbname=$dbname", $username, $password);
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $databaseConnected = true;
    }
    catch (PDOException $e2){
        echo "Erreur (connection mysql) : " . $e1->getMessage() . "<br>";
        echo "Erreur (connection postgres) : " . $e2->getMessage() . "<br>";
    }

}


/*

Création des instances de tables

*/


$Station = new db($conn, 'station', 'id', ['id','nom_enseigne','adresse_station','longitude','latitude','tarif_eur_kwh','puissance_max_kw','nbre_pdc','reservation','date_mise_en_service','id_operateur','id_condition_acces','id_restriction_gabarit','id_accessibilite_pmr','id_implantation']);

$Restriction_Gabarit = new db($conn, 'restriction_gabarit', 'id', ['id','libelle']);
$Implantation = new db($conn, 'implantation', 'id', ['id','libelle']);
$Condition_Acces = new db($conn, 'condition_acces', 'id', ['id','libelle']);
$Accessibilite_PMR = new db($conn, 'accessibilite_pmr', 'id', ['id','libelle']);

$Operateur = new db($conn, 'operateur', 'id', ['id','nom','contact','telephone']);

$Horaire = new db($conn, 'horaire', 'id', ['id','jour','heure_debut','heure_fin']);
$Station_Horaire = new db($conn, 'station_horaire', 'id', ['id','id_station','id_horaire']);

$Type_Prise = new db($conn, 'type_prise', 'id', ['id','libelle']);
$Station_Prise = new db($conn, 'station_prise', 'id', ['id', 'id_station', 'id_type_prise']);

$Utilisateur = new db($conn, 'utilisateur', 'id',['id','nom_utilisateur', 'mot_de_passe']);

/* 
    La variable $databaseTables est utilisée pour faire correspondre une instance de classe a un parametre passé dans les requetes GET !
    La clé doit etre le nom du parametre qui devrai correspondre dans un $_GET
*/

$databaseTables = [
    'station' => $Station,
    'restriction_gabarit' => $Restriction_Gabarit,
    'implantation' => $Implantation,
    'condition_acces' => $Condition_Acces,
    'accessibilite_pmr' => $Accessibilite_PMR,

    'operateur' => $Operateur,

    'horaire' => $Horaire,
    'station_horaire' => $Station_Horaire,

    'type_prise' => $Type_Prise,
    'station_prise' => $Station_Prise,

    'utilisateur' => $Utilisateur
]
?> 
