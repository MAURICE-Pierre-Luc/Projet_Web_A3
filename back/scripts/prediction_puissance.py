import sys
import pandas as pd
import joblib
import numpy as np

def main():
    print("🔌   PROJET IRVE - SYSTÈME DE PRÉDICTION DE PUISSANCE     ")

    # 1. Chargement des fichiers de sauvegarde (.pkl)
    try:
        preprocesseur = joblib.load('./Besoin_Client_4/preprocessor_besoin4.pkl')
        model = joblib.load('./Besoin_Client_4/best_classifier_besoin4.pkl')
        print("[INFO] Modèle d'IA et préprocesseur chargés avec succès !\n")
    except FileNotFoundError:
        print("Erreur : Les fichiers '.pkl' sont introuvables dans ce dossier.")
        print("Veuillez vérifier que vous avez bien exécuté les cellules précédentes.")
        return

    # 2. Formulaire interactif pour le client
    print("--- Saisie des caractéristiques de la nouvelle station ---")

    nom_operateur = input("Nom de l'opérateur (ex: Freshmile, TotalEnergies, IECharge) : ")
    nom_enseigne = input("Nom de l'enseigne (ex: E.Leclerc, METRO, Autre) : ")
    implantation_station = input("Implantation (ex: Parking privé ouvert au public, Station-service) : ")
    accessibilite_pmr = input("Accessibilité PMR (accessible / non accessible) : ")
    condition_acces = input("Condition d'accès (ex: Accès libre, Réservé aux clients) : ")
    gratuit = input("Est-ce gratuit ? (true / false) : ")

    print("\n--- Types de prises installées sur la borne ---")
    prise_type_ef = input("Présence Prise Type EF / Domestique ? (true / false) : ")
    prise_type_2 = input("Présence Prise Type 2 ? (true / false) : ")
    prise_type_combo_ccs = input("Présence Prise Type Combo CCS ? (true / false) : ")
    prise_type_chademo = input("Présence Prise Type CHAdeMO ? (true / false) : ")
    prise_type_autre = input("Présence Autre type de prise ? (true / false) : ")

    print("\n--- Coordonnées Géographiques & Capacité ---")
    try:
        consolidated_longitude = float(input("Longitude de la borne (ex: 2.3522) : "))
        consolidated_latitude = float(input("Latitude de la borne (ex: 48.8566) : "))
        nbre_pdc = int(input("Nombre total de points de charge sur la station (ex: 4) : "))
    except ValueError:
        print("\n Erreur : La longitude, la latitude et le nombre de bornes doivent être des nombres numériques !")
        return

    # 3. Encapsulation des réponses dans un DataFrame au format strict de l'entraînement
    nouvelle_borne = pd.DataFrame([{
        'nom_operateur': nom_operateur,
        'nom_enseigne': nom_enseigne,
        'implantation_station': implantation_station,
        'accessibilite_pmr': accessibilite_pmr,
        'condition_acces': condition_acces,
        'gratuit': gratuit,
        'prise_type_ef': prise_type_ef,
        'prise_type_2': prise_type_2,
        'prise_type_combo_ccs': prise_type_combo_ccs,
        'prise_type_chademo': prise_type_chademo,
        'prise_type_autre': prise_type_autre,
        'consolidated_longitude': consolidated_longitude,
        'consolidated_latitude': consolidated_latitude,
        'nbre_pdc': nbre_pdc
    }])

    # 4. Encodage automatique des textes saisis via le préprocesseur enregistré
    try:
        borne_encodee = preprocesseur.transform(nouvelle_borne)
    except Exception as e:
        print(f"\n Erreur lors du traitement des données textuelles : {e}")
        return

    # 5. Prédiction finale
    puissance_predite = model.predict(borne_encodee)[0]

    print("🔮 RÉSULTAT DE L'INTELLIGENCE ARTIFICIELLE :")
    print(f"La puissance nominale estimée pour cette configuration est de : {float(puissance_predite):.1f} kW")

if __name__ == "__main__":
    main()
