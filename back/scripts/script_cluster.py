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

    # 2. Chargement du modèle de clustering et du scaler
    
    model_path = os.path.join(os.path.dirname(__file__), "modele_kmeans_3.pkl")
    scaler_path = os.path.join(os.path.dirname(__file__), "scaler_kmeans_3.pkl")
    
    if not os.path.exists(model_path):
        print(json.dumps({"error": f"Modèle introuvable à l'emplacement: {model_path}"}), file=sys.stderr)
        sys.exit(1)
        
    try :
        kmeans_model = joblib.load(model_path)
        scaler = joblib.load(scaler_path)
    except Exception as e:
        print(json.dumps({"error": f"Erreur lors du chargement des fichier pkl: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

    # 3. Conversion en DataFrame pour traitement vectorisé
    df = pd.DataFrame(points)
    X = df[['latitude', 'longitude']].astype(float)

    # On renomme les colonnes pour matcher exactement l'entraînement
    X.columns = ['consolidated_latitude', 'consolidated_longitude']

    # 4. Inférence en lot (Batch prediction) - Prend quelques millisecondes pour nos 3915 lignes
    try :
        X_scaled = scaler.transform(X)
        predictions = kmeans_model.predict(X)
        # On ajoute les prédictions comme une nouvelle clé dans nos dictionnaires d'origine
        for i, point in enumerate(points):
            point['cluster'] = int(predictions[i])

            # Debug
            point['scaled_lat'] = float(X_scaled[i][0])
            point['scaled_lon'] = float(X_scaled[i][1])
            
            point['lat'] = float(point.pop('latitude'))
            point['lon'] = float(point.pop('longitude'))
    except Exception as e:
        print(json.dumps({"error": f"Erreur lors de la prédiction KMeans: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

    # 5. On renvoie le résultat final au PHP via STDOUT
    print(json.dumps(points))

if __name__ == "__main__":
    main()