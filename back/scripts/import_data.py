import pandas as pd
import re
from collections import defaultdict
import mysql.connector
import ast



DB_CONFIG = {
    "host":     "localhost",
    "user":     "plmaur28",
    "password": "RogFyVroBIxSipNQ",
    "database": "plmaur28",
}


csv_path = "../../IRVE_clean_web.csv"

df = pd.read_csv(csv_path, encoding="UTF-8")

columns_to_keep = ["nom_operateur","contact_operateur","telephone_operateur","nom_enseigne","id_station_itinerance","implantation_station","adresse_station","coordonneesXY","nbre_pdc","puissance_nominale","prise_type_ef","prise_type_2","prise_type_combo_ccs","prise_type_chademo","prise_type_autre", "tarification_eur_kWh","condition_acces","horaires","accessibilite_pmr","restriction_gabarit","date_mise_en_service"]

df = df[columns_to_keep]

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

df["horaires"] = df["horaires"].map(parse_line)



conn = mysql.connector.connect(**DB_CONFIG)
cursor = conn.cursor()
 
# Vérification rapide que les tables existent bien
cursor.execute("SHOW TABLES")
tables_existantes = {t[0].lower() for t in cursor.fetchall()}
tables_attendues  = {
    "station", "operateur", "horaire", "station_horaire",
    "type_prise", "station_prise", "condition_acces",
    "restriction_gabarit", "accessibilite_pmr", "implantation"
}
manquantes = tables_attendues - tables_existantes
if manquantes:
    raise RuntimeError(f"Tables manquantes dans la BD : {manquantes}")
 
df = df.replace("inconnu", None)


enum_cache = {}
 
def get_or_create(table, libelle):
    """Retourne l'id d'un libellé dans une table enum, le crée si absent."""
    if libelle is None:
        return None
    key = (table, libelle)
    if key in enum_cache:
        return enum_cache[key]
    cursor.execute(f"SELECT id FROM {table} WHERE libelle = %s", (libelle,))
    row = cursor.fetchone()
    if row:
        enum_cache[key] = row[0]
    else:
        cursor.execute(f"INSERT INTO {table} (libelle) VALUES (%s)", (libelle,))
        enum_cache[key] = cursor.lastrowid
    return enum_cache[key]


operateur_cache = {}
 
def get_or_create_operateur(nom, contact, telephone):
    if nom is None:
        return None
    if nom in operateur_cache:
        return operateur_cache[nom]
    cursor.execute("SELECT id FROM OPERATEUR WHERE nom = %s", (nom,))
    row = cursor.fetchone()
    if row:
        operateur_cache[nom] = row[0]
    else:
        cursor.execute(
            "INSERT INTO OPERATEUR (nom, contact, telephone) VALUES (%s, %s, %s)",
            (nom, contact, telephone)
        )
        operateur_cache[nom] = cursor.lastrowid
    return operateur_cache[nom]


horaire_cache = {}
 
def get_or_create_horaire(jour, heure_debut, heure_fin):
    key = (jour, heure_debut, heure_fin)
    if key in horaire_cache:
        return horaire_cache[key]
    cursor.execute(
        "SELECT id FROM HORAIRE WHERE jour = %s AND heure_debut = %s AND heure_fin = %s",
        (jour, heure_debut, heure_fin)
    )
    row = cursor.fetchone()
    if row:
        horaire_cache[key] = row[0]
    else:
        cursor.execute(
            "INSERT INTO HORAIRE (jour, heure_debut, heure_fin) VALUES (%s, %s, %s)",
            (jour, heure_debut, heure_fin)
        )
        horaire_cache[key] = cursor.lastrowid
    return horaire_cache[key]


PRISES = {
    "prise_type_ef":        "EF",
    "prise_type_2":         "Type 2",
    "prise_type_combo_ccs": "Combo CCS",
    "prise_type_chademo":   "CHAdeMO",
    "prise_type_autre":     "Autre",
}


for _, row in df.iterrows():
 
    # -- Opérateur --
    id_operateur = get_or_create_operateur(
        row.get("nom_operateur"),
        row.get("contact_operateur"),
        row.get("telephone_operateur"),
    )
 
    # -- Tables enum --
    id_condition_acces     = get_or_create("CONDITION_ACCES",     row.get("condition_acces"))
    id_restriction_gabarit = get_or_create("RESTRICTION_GABARIT", row.get("restriction_gabarit"))
    id_accessibilite_pmr   = get_or_create("ACCESSIBILITE_PMR",   row.get("accessibilite_pmr"))
    id_implantation        = get_or_create("IMPLANTATION",        row.get("implantation_station"))
 
    # -- Coordonnées --
    longitude, latitude = None, None
    if row.get("coordonneesXY"):
        try:
            coords = ast.literal_eval(row["coordonneesXY"])
            longitude, latitude = coords[0], coords[1]
        except Exception:
            pass
 
    # -- Date --
    date_mise_en_service = row.get("date_mise_en_service") or None
 
    # -- Station --
    cursor.execute("""
        INSERT INTO STATION (
            id_station, nom_enseigne, adresse_station,
            longitude, latitude, tarif_eur_kwh, puissance_max_kw,
            nbre_pdc, reservation, date_mise_en_service,
            id_operateur, id_condition_acces, id_restriction_gabarit,
            id_accessibilite_pmr, id_implantation
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE id_station = id_station
    """, (
        row["id_station_itinerance"],
        row.get("nom_enseigne"),
        row.get("adresse_station"),
        longitude,
        latitude,
        row.get("tarification_eur_kWh"),
        row.get("puissance_nominale"),
        row.get("nbre_pdc"),
        False,  # reservation : non présent dans le CSV conservé
        date_mise_en_service,
        id_operateur,
        id_condition_acces,
        id_restriction_gabarit,
        id_accessibilite_pmr,
        id_implantation,
    ))
 
    id_station = row["id_station_itinerance"]
 
    # -- Types de prise --
    for col, libelle in PRISES.items():
        valeur = row.get(col)
        if valeur is True or str(valeur).strip().upper() == "TRUE":
            id_type_prise = get_or_create("TYPE_PRISE", libelle)
            cursor.execute("""
                INSERT IGNORE INTO STATION_PRISE (id_station, id_type_prise)
                VALUES (%s, %s)
            """, (id_station, id_type_prise))
 
    # -- Horaires --
    horaires_raw = row.get("horaires")
    if horaires_raw:
        try:
            # Format attendu après ta transformation :
            # {'mo': [('07:45', '12:00'), ('13:45', '19:00')], ...}
            if isinstance(horaires_raw, str):
                horaires_raw = ast.literal_eval(horaires_raw)
            for jour, plages in horaires_raw.items():
                for (heure_debut, heure_fin) in plages:
                    id_horaire = get_or_create_horaire(jour, heure_debut, heure_fin)
                    cursor.execute("""
                        INSERT IGNORE INTO STATION_HORAIRE (id_station, id_horaire)
                        VALUES (%s, %s)
                    """, (id_station, id_horaire))
        except Exception:
            pass


conn.commit()
cursor.close()
conn.close()

