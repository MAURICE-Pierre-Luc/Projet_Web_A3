#!/usr/bin/env python3
import sys
import json
import os
import joblib
import pandas as pd

def main():
    # 1. Lecture des données envoyées par le PHP via STDIN
    try :
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"error": "Aucune donnée reçue sur STDIN"}))
            sys.exit(1)
        
        points = json.loads(input_data)
    except Exception as e:
        print(json.dumps({"error": f"Erreur décodage JSON d'entrée: {str(e)}"}))
        sys.exit(1)

    # 2. Chargement du modèle de clustering
    # Adapte le nom du fichier pkl selon ton projet
    model_path = os.path.join(os.path.dirname(__file__), "model_kmeans.pkl")
    
    if not os.path.exists(model_path):
        print(json.dumps({"error": f"Modèle introuvable à l'emplacement: {model_path}"}), file=sys.stderr)
        sys.exit(1)
        
    try :
        kmeans_model = joblib.load(model_path)
    except Exception as e:
        print(json.dumps({"error": f"Erreur lors du chargement du fichier pkl: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

    # 3. Conversion en DataFrame pour traitement vectorisé
    df = pd.DataFrame(points)
    
    # Assurons-nous d'extraire les colonnes dans le bon ordre requis par ton modèle
    # (Par exemple, si ton modèle a été entraîné sur ['latitude', 'longitude'])
    X = df[['latitude', 'longitude']].astype(float)

    # 4. Inférence en lot (Batch prediction) - Prend quelques millisecondes pour 3915 lignes
    try :
        predictions = kmeans_model.predict(X)
        # On ajoute les prédictions comme une nouvelle clé dans nos dictionnaires d'origine
        for i, point in enumerate(points):
            point['cluster'] = int(predictions[i])
            # Optionnel : Tu peux renommer les clés ici si ton JS attend 'lat' et 'lon' au lieu de 'latitude'/'longitude'
            point['lat'] = float(point.pop('latitude'))
            point['lon'] = float(point.pop('longitude'))
    except Exception as e:
        print(json.dumps({"error": f"Erreur lors de la prédiction KMeans: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

    # 5. On renvoie le résultat final au PHP via STDOUT
    print(json.dumps(points))

if __name__ == "__main__":
    main()