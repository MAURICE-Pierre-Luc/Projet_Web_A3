import sys
import json
import argparse
import pandas as pd
import joblib


def convertir_booleen(valeur: str) -> bool:
    valeur = valeur.strip().lower()

    if valeur in ("true", "1", "oui", "yes"):
        return True
    if valeur in ("false", "0", "non", "no"):
        return False

    raise argparse.ArgumentTypeError(
        f"Valeur booléenne invalide : '{valeur}'. Utilisez true ou false."
    )


def main():
    parser = argparse.ArgumentParser(
        description="Prédiction de puissance nominale pour une station IRVE."
    )

    # Informations générales
    parser.add_argument("--nom-operateur", required=True)
    parser.add_argument("--nom-enseigne", required=True)
    parser.add_argument("--implantation-station", required=True)
    parser.add_argument("--accessibilite-pmr", required=True)
    parser.add_argument("--condition-acces", required=True)
    parser.add_argument("--gratuit", required=True)

    # Types de prises
    parser.add_argument("--prise-type-ef", required=True)
    parser.add_argument("--prise-type-2", required=True)
    parser.add_argument("--prise-type-combo-ccs", required=True)
    parser.add_argument("--prise-type-chademo", required=True)
    parser.add_argument("--prise-type-autre", required=True)

    # Localisation et capacité
    parser.add_argument("--longitude", required=True, type=float)
    parser.add_argument("--latitude", required=True, type=float)
    parser.add_argument("--nbre-pdc", required=True, type=int)

    args = parser.parse_args()

    try:
        preprocesseur = joblib.load(
            "./preprocessor_puissance.pkl"
        )
        model = joblib.load(
            "./modele_puissance.pkl"
        )
    except FileNotFoundError:
        print(json.dumps({
            "success": False,
            "error": "Les fichiers de modèle .pkl sont introuvables."
        }))
        sys.exit(1)

    nouvelle_borne = pd.DataFrame([{
        "nom_operateur": args.nom_operateur,
        "nom_enseigne": args.nom_enseigne,
        "implantation_station": args.implantation_station,
        "accessibilite_pmr": args.accessibilite_pmr,
        "condition_acces": args.condition_acces,
        "gratuit": args.gratuit,
        "prise_type_ef": args.prise_type_ef,
        "prise_type_2": args.prise_type_2,
        "prise_type_combo_ccs": args.prise_type_combo_ccs,
        "prise_type_chademo": args.prise_type_chademo,
        "prise_type_autre": args.prise_type_autre,
        "consolidated_longitude": args.longitude,
        "consolidated_latitude": args.latitude,
        "nbre_pdc": args.nbre_pdc
    }])

    try:
        borne_encodee = preprocesseur.transform(nouvelle_borne)
        puissance_predite = model.predict(borne_encodee)[0]

        print(json.dumps({
            "success": True,
            "puissance_predite_kw": round(float(puissance_predite), 1)
        }))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()