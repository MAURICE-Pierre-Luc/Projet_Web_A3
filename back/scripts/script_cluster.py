
"""Predict cluster."""

# Imports.
import argparse
import joblib
import numpy as np
import warnings


# Désactivation des warnings scikit-learn pour garder une sortie console propre
warnings.filterwarnings("ignore", category=UserWarning)


def checkArguments():
    """Check program arguments and return program parameters."""
    parser = argparse.ArgumentParser()
    parser.add_argument('-lat', '--latitude', type=float, required=True,
                        help='latitude')
    parser.add_argument('-lon', '--longitude', type=float, required=True,
                        help='longitude')
    return parser.parse_args()

# Main program.
if __name__ == "__main__":
    args = checkArguments()

    try:
        # Load models 
        scaler = joblib.load('scaler_gps.pkl')
        kmeans = joblib.load('modele_kmeans.pkl')
        
        # Prepare data 
        nouvelle_borne = np.array([[args.latitude, args.longitude]])
        borne_scaled = scaler.transform(nouvelle_borne)
        
        # Predict cluster
        cluster_predit = kmeans.predict(borne_scaled)[0]
        
        # Affichage du résultat brut attendu par le script de correction
        print(f"Cluster prédit :{cluster_predit}")
        
    except FileNotFoundError:
        print("Error: Les fichiers .pkl n'ont pas été trouvés dans ce dossier.")
    except Exception as e:
        print(f"Error: {e}")x²