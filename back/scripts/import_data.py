import pandas as pd
import re
from collections import defaultdict

csv_path = "./IRVE_clean_web.csv"

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



print(df["condition_acces"].unique())
print(df["accessibilite_pmr"].unique())
print(df["restriction_gabarit"].unique())
print(df["implantation_station"].unique())


print(df.head())



