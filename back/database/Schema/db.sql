CREATE TABLE TYPE_PRISE (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL
);

CREATE TABLE OPERATEUR (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    nom       VARCHAR(150) NOT NULL,
    contact   VARCHAR(150),
    telephone VARCHAR(30)
);

CREATE TABLE ACCESSIBILITE_PMR (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL
);

CREATE TABLE CONDITION_ACCES (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL
);

CREATE TABLE IMPLANTATION (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL
);

CREATE TABLE RESTRICTION_GABARIT (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL
);


CREATE TABLE STATION (
    id                    VARCHAR(50)    PRIMARY KEY,
    nom_enseigne          VARCHAR(150),
    adresse_station       VARCHAR(255),
    longitude             DECIMAL(10, 7) NOT NULL,
    latitude              DECIMAL(10, 7) NOT NULL,
    tarif_eur_kwh         DECIMAL(6, 4),
    puissance_max_kw      DECIMAL(6, 1),
    nbre_pdc              INT            NOT NULL DEFAULT 1,
    reservation           BOOLEAN        NOT NULL DEFAULT FALSE,
    date_mise_en_service  DATE,
    id_operateur          INT,
    id_condition_acces    INT,
    id_restriction_gabarit INT,
    id_accessibilite_pmr  INT,
    id_implantation       INT,

    CONSTRAINT fk_station_operateur
        FOREIGN KEY (id_operateur)
        REFERENCES OPERATEUR(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_station_condition_acces
        FOREIGN KEY (id_condition_acces)
        REFERENCES CONDITION_ACCES(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_station_restriction_gabarit
        FOREIGN KEY (id_restriction_gabarit)
        REFERENCES RESTRICTION_GABARIT(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_station_accessibilite_pmr
        FOREIGN KEY (id_accessibilite_pmr)
        REFERENCES ACCESSIBILITE_PMR(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_station_implantation
        FOREIGN KEY (id_implantation)
        REFERENCES IMPLANTATION(id)
        ON DELETE SET NULL
);


CREATE TABLE HORAIRE (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    jour        ENUM('mo', 'tu', 'we', 'th', 'fr', 'sa', 'su') NOT NULL,
    heure_debut TIME NOT NULL,
    heure_fin   TIME NOT NULL,

    CONSTRAINT uq_horaire UNIQUE (jour, heure_debut, heure_fin)
);

CREATE TABLE STATION_HORAIRE (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    id_station  VARCHAR(50) NOT NULL,
    id_horaire  INT         NOT NULL,

    CONSTRAINT fk_sh_station
        FOREIGN KEY (id_station)
        REFERENCES STATION(id_station)
        ON DELETE CASCADE,

    CONSTRAINT fk_sh_horaire
        FOREIGN KEY (id_horaire)
        REFERENCES HORAIRE(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_station_horaire UNIQUE (id_station, id_horaire)
);


CREATE TABLE STATION_PRISE (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    id_station     VARCHAR(50) NOT NULL,
    id_type_prise  INT         NOT NULL,

    CONSTRAINT fk_sp_station
        FOREIGN KEY (id_station)
        REFERENCES STATION(id_station)
        ON DELETE CASCADE,

    CONSTRAINT fk_sp_type_prise
        FOREIGN KEY (id_type_prise)
        REFERENCES TYPE_PRISE(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_station_prise UNIQUE (id_station, id_type_prise)
);


CREATE TABLE UTILISATEUR (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nom_utilisateur VARCHAR(100) NOT NULL UNIQUE,
    mot_de_passe    VARCHAR(255) NOT NULL  -- stocker un hash (bcrypt, argon2...)
);


INSERT INTO TYPE_PRISE (libelle) VALUES
    ('EF'),
    ('Type 2'),
    ('Combo CCS'),
    ('CHAdeMO'),
    ('Autre');

INSERT INTO CONDITION_ACCES (libelle) VALUES
    ('Accès libre'),
    ('Accès réservé');

INSERT INTO ACCESSIBILITE_PMR (libelle) VALUES
    ('Accessible mais non réservé PMR'),
    ('Accessibilité inconnue'),
    ('Non accessible'),
    ('Réservé PMR');

INSERT INTO RESTRICTION_GABARIT (libelle) VALUES
    ('aucune'),
    ('inconnu'),
    ('Hauteur 3m'),
    ('Hauteur 2m'),
    ('vehicules legers uniquement'),
    ('Hauteur 1.5m');

INSERT INTO IMPLANTATION (libelle) VALUES
    ('Parking public'),
    ('Parking privé à usage public'),
    ('Voirie'),
    ('Parking privé réservé à la clientèle');