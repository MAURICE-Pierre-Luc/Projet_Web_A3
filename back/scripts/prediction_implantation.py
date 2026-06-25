import os
import re
import numpy as np
import pandas as pd
import joblib
from collections import defaultdict
from sklearn.preprocessing import OrdinalEncoder


#Il est très important que le csv ait subit le prétraitement R que le csv utilisé pour l'entrainement à subit

# Chemins vers les artefacts models, encoders et ordinal encoder sauvegardés lors de l'entraînement
MODELS_DIR = "./Besoin_Client_3/"
PREPROCESSOR_PATH = os.path.join(MODELS_DIR, "preprocessor.joblib")
MODEL_PATH = os.path.join(MODELS_DIR, "tuned_random_forest_model.pkl")
ORDINAL_ENCODER_PATH = os.path.join(MODELS_DIR, "ordinalencoder.joblib")



def load_artifacts():
    preprocessor = joblib.load(PREPROCESSOR_PATH)
    model = joblib.load(MODEL_PATH)
    encoder_cat = joblib.load(ORDINAL_ENCODER_PATH)
    return preprocessor, model, encoder_cat

# Colonnes booléennes (stockées comme chaînes "true"/"false" dans le CSV)
BOOL_COLS = [
    "paiement_acte",
    "paiement_cb",
    "paiement_autre",
    "reservation",
    "cable_t2_attache",
]

# Colonnes catégorielles nominales (texte → encodage ordinal)
CAT_COLS = [
    "nom_operateur",
    "restriction_gabarit",
    "raccordement",
]

# Colonnes numériques continues
NUM_COLS = [
    "annee_mise_en_service",  # extraite depuis date_mise_en_service (bloc 8)
    "horaires",               # convertie en heures/semaine (bloc 9)
]

TARGET = "implantation_station"
FEATURE_COLS = BOOL_COLS + CAT_COLS + NUM_COLS


def convertir_booleen(valeur):
    # Correspondance entre les valeurs texte/Python et les floats 0.0/1.0
    # "inconnu" et toute valeur non reconnue sont converties en NaN
    # pour être imputées plus tard par le pipeline
    correspondances = {
        "true": 1.0,
        "false": 0.0,
        "inconnu": np.nan,
        True: 1.0,
        False: 0.0,
    }
    cle = str(valeur).strip().lower()
    return correspondances.get(cle, np.nan)




# Conversion des catégories texte en entiers (0, 1, 2…)
# Les valeurs inconnues et les NaN sont encodés en -1 (valeur sentinelle)
# pour les distinguer des vraies catégories.
# Ces -1 seront reconvertis en NaN avant l'imputation (voir bloc 10).
encoder_cat = OrdinalEncoder(
    handle_unknown="use_encoded_value",
    unknown_value=-1,
    encoded_missing_value=-1,
)



def extraire_annee(valeur):
    # On extrait les 4 premiers caractères de la date (= l'année)
    # Les valeurs invalides ou "inconnu" sont converties en NaN
    if pd.isna(valeur) or str(valeur).strip().lower() == "inconnu":
        return np.nan
    try:
        return float(str(valeur).strip()[:4])
    except ValueError:
        return np.nan


DAYS_ORDER = ["mo", "tu", "we", "th", "fr", "sa", "su"]

def expand_days(day_part):
    # Développe une expression de jours en liste atomique
    # Supporte les virgules ("mo,we") et les plages ("mo-fr")
    day_part = day_part.strip()
    if "," in day_part:
        result = []
        for d in day_part.split(","):
            result.extend(expand_days(d.strip()))
        return result
    if "-" in day_part:
        start, end = day_part.split("-")
        if start not in DAYS_ORDER or end not in DAYS_ORDER:
            return []
        i1, i2 = DAYS_ORDER.index(start), DAYS_ORDER.index(end)
        if i1 <= i2:
            return DAYS_ORDER[i1:i2 + 1]
        # Gestion des plages qui passent minuit (ex: sa-mo)
        return DAYS_ORDER[i1:] + DAYS_ORDER[:i2 + 1]
    return [day_part] if day_part in DAYS_ORDER else []

def parse_hours(h):
    # Extrait les bornes d'une plage horaire au format "HH:MM-HH:MM"
    m = re.match(r"^\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*$", h)
    if not m:
        return None
    return m.group(1), m.group(2)

def parse_line(line):
    # Parse une ligne d'horaires complète en dict {jour: [(début, fin), …]}
    if not isinstance(line, str):
        return {}
    result = defaultdict(list)
    line = line.replace(";", ",")
    line = re.sub(r"\s+", " ", line.strip())
    blocks = re.findall(r"([a-z, -]+)\s+(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})", line)
    for days_raw, hours_raw in blocks:
        days = expand_days(days_raw)
        hours = parse_hours(hours_raw)
        if not days or not hours:
            continue
        start, end = hours
        for d in days:
            result[d].append((start, end))
    return dict(result)


def time_to_minutes(t):
    # Convertit "HH:MM" en nombre de minutes depuis minuit
    h, m = map(int, t.split(":"))
    return h * 60 + m

def weekly_hours(schedule):
    # Somme toutes les plages horaires de la semaine et retourne le total en heures
    total_minutes = 0
    for periods in schedule.values():
        for start, end in periods:
            total_minutes += time_to_minutes(end) - time_to_minutes(start)
    return round(total_minutes / 60, 2)




def preprocess(df, encoder_cat):
    # bool
    for col in BOOL_COLS:
        if col in df.columns:
            df[col] = df[col].map(convertir_booleen)

    # cat
    for col in CAT_COLS:
        if col in df.columns:
            df[col] = df[col].replace("inconnu", np.nan)

    df[CAT_COLS] = encoder_cat.transform(df[CAT_COLS])

    # date
    df["annee_mise_en_service"] = df["date_mise_en_service"].map(extraire_annee)
    df.drop(columns=["date_mise_en_service"], inplace=True)

    # horaires (IDENTIQUE TRAINING)
    df["horaires"] = df["horaires"].map(parse_line)
    df["horaires"] = df["horaires"].map(weekly_hours)

    return df

def predict(csv_path):
    preprocessor, model, encoder_cat = load_artifacts()

    df = pd.read_csv(csv_path, encoding="utf-8")
    print(f"CSV chargé : {len(df)} lignes")


    # preprocessing custom (identique training)
    df = preprocess(df, encoder_cat)

    # features final
    X = df[FEATURE_COLS]



    # sklearn preprocessing
    X_prep = preprocessor.transform(X)

    # prediction
    df["prediction"] = model.predict(X_prep)

    return df


if __name__ == "__main__":
    csv_path = "./Besoin_Client_3/IRVE_clean_IA.csv"
    df_result = predict(csv_path)

    print(df_result[["horaires", "prediction"]].head(10))


