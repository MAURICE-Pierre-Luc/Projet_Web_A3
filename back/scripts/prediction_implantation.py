import os
import re
import json
import argparse
import numpy as np
import pandas as pd
import joblib
from collections import defaultdict
from sklearn.preprocessing import OrdinalEncoder


MODELS_DIR = "./"
PREPROCESSOR_PATH = os.path.join(MODELS_DIR, "preprocessor_implantation.joblib")
MODEL_PATH = os.path.join(MODELS_DIR, "modele_implantation.pkl")
ORDINAL_ENCODER_PATH = os.path.join(MODELS_DIR, "ordinalencoder_implantation.joblib")


# ---------------- LOAD ----------------

def load_artifacts():
    preprocessor = joblib.load(PREPROCESSOR_PATH)
    model = joblib.load(MODEL_PATH)
    encoder_cat = joblib.load(ORDINAL_ENCODER_PATH)
    return preprocessor, model, encoder_cat


# ---------------- FEATURES ----------------

BOOL_COLS = [
    "paiement_acte",
    "paiement_cb",
    "paiement_autre",
    "reservation",
    "cable_t2_attache",
]

CAT_COLS = [
    "nom_operateur",
    "restriction_gabarit",
    "raccordement",
]

FEATURE_COLS = BOOL_COLS + CAT_COLS + [
    "annee_mise_en_service",
    "horaires",
]


# ---------------- TRANSFORM UTILS ----------------

def convertir_booleen(valeur):
    correspondances = {
        "true": 1.0,
        "false": 0.0,
        "inconnu": np.nan,
        True: 1.0,
        False: 0.0,
    }
    cle = str(valeur).strip().lower()
    return correspondances.get(cle, np.nan)


def extraire_annee(valeur):
    if pd.isna(valeur) or str(valeur).strip().lower() == "inconnu":
        return np.nan
    try:
        return float(str(valeur).strip()[:4])
    except:
        return np.nan


DAYS_ORDER = ["mo", "tu", "we", "th", "fr", "sa", "su"]


def expand_days(day_part):
    day_part = day_part.strip()
    if "," in day_part:
        out = []
        for d in day_part.split(","):
            out.extend(expand_days(d.strip()))
        return out
    if "-" in day_part:
        start, end = day_part.split("-")
        if start not in DAYS_ORDER or end not in DAYS_ORDER:
            return []
        i1, i2 = DAYS_ORDER.index(start), DAYS_ORDER.index(end)
        return DAYS_ORDER[i1:i2+1] if i1 <= i2 else DAYS_ORDER[i1:] + DAYS_ORDER[:i2+1]
    return [day_part] if day_part in DAYS_ORDER else []


def parse_hours(h):
    m = re.match(r"^\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*$", h)
    if not m:
        return None
    return m.group(1), m.group(2)


def parse_line(line):
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
    h, m = map(int, t.split(":"))
    return h * 60 + m


def weekly_hours(schedule):
    total = 0
    for periods in schedule.values():
        for start, end in periods:
            total += time_to_minutes(end) - time_to_minutes(start)
    return round(total / 60, 2)


# ---------------- PREPROCESS ----------------

def preprocess(df, encoder_cat):
    for col in BOOL_COLS:
        if col in df.columns:
            df[col] = df[col].map(convertir_booleen)

    for col in CAT_COLS:
        df[col] = df[col].replace("inconnu", np.nan)

    df[CAT_COLS] = encoder_cat.transform(df[CAT_COLS])

    df["annee_mise_en_service"] = df["date_mise_en_service"].map(extraire_annee)
    df.drop(columns=["date_mise_en_service"], inplace=True)

    df["horaires"] = df["horaires"].map(parse_line)
    df["horaires"] = df["horaires"].map(weekly_hours)

    return df


# ---------------- CLI ----------------

def main():
    parser = argparse.ArgumentParser()

    # catégoriel
    parser.add_argument("--nom-operateur", required=True)
    parser.add_argument("--restriction-gabarit", required=True)
    parser.add_argument("--raccordement", required=True)

    # bool
    parser.add_argument("--paiement-acte", required=True)
    parser.add_argument("--paiement-cb", required=True)
    parser.add_argument("--paiement-autre", required=True)
    parser.add_argument("--reservation", required=True)
    parser.add_argument("--cable-t2-attache", required=True)

    # autres
    parser.add_argument("--date-mise-en-service", required=True)
    parser.add_argument("--horaires", required=True)

    args = parser.parse_args()

    preprocessor, model, encoder_cat = load_artifacts()

    df = pd.DataFrame([{
        "nom_operateur": args.nom_operateur,
        "restriction_gabarit": args.restriction_gabarit,
        "raccordement": args.raccordement,
        "paiement_acte": args.paiement_acte,
        "paiement_cb": args.paiement_cb,
        "paiement_autre": args.paiement_autre,
        "reservation": args.reservation,
        "cable_t2_attache": args.cable_t2_attache,
        "date_mise_en_service": args.date_mise_en_service,
        "horaires": args.horaires,
    }])

    try:
        df = preprocess(df, encoder_cat)
        X = df[FEATURE_COLS]
        X_prep = preprocessor.transform(X)

        pred = model.predict(X_prep)[0]

        print(json.dumps({
            "success": True,
            "prediction": str(pred)
        }))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))


if __name__ == "__main__":
    main()