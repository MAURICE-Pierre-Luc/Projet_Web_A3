
let allStations = [];
let stationsWithDept = [];


async function init() {
    allStations = await getData(api_link + "request.php", "?table=station");

    await populateDepartementSelect();

    stationsWithDept = await enrichStationsWithDept(allStations);

    renderAll(stationsWithDept);
}


async function enrichStationsWithDept(stations) {
    // Appels en parallèle par lots de 100 pour ne pas saturer l'API
    const BATCH = 100;
    const result = [];

    for (let i = 0; i < stations.length; i += BATCH) {
        const batch = stations.slice(i, i + BATCH);
        const enriched = await Promise.all(batch.map(async (station) => {
            try {
                const res = await fetch(
                    `https://geo.api.gouv.fr/communes?lat=${station.latitude}&lon=${station.longitude}&fields=codeDepartement&format=json`
                );
                const data = await res.json();
                return {
                    ...station,
                    codeDept: data[0]?.codeDepartement ?? null
                };
            } catch {
                return { ...station, codeDept: null };
            }
        }));
        result.push(...enriched);
    }

    return result;
}


async function populateDepartementSelect() {
    const res = await fetch("https://geo.api.gouv.fr/departements?fields=nom,code&format=json");
    const depts = await res.json();

    const select = document.getElementById("filterDepartement");
    select.innerHTML = `<option value="">Tous les départements</option>`;

    depts.sort((a, b) => a.code.localeCompare(b.code));
    depts.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.code;
        opt.textContent = `${d.code} – ${d.nom}`;
        select.appendChild(opt);
    });

    select.addEventListener("change", () => {
        const code = select.value;
        const filtered = code
            ? stationsWithDept.filter(s => s.codeDept === code)
            : stationsWithDept;
        renderAll(filtered);
    });
}


function renderAll(stations) {
    insertBasicStats(stations);
    grapheTypeImplantation(stations);
    grapheConditionAcces(stations);
    graphePuissances(stations);
    grapheAccessibilityPMR(stations);
}


function insertBasicStats(stations) {
    const nbre_stations = stations.length;
    const nbre_pt_charge = stations.reduce((sum, s) => sum + Number(s.nbre_pdc), 0);
    const puiss_moy = nbre_stations
        ? stations.reduce((sum, s) => sum + Number(s.puissance_max_kw), 0) / nbre_stations
        : 0;
    const tarif_moy = nbre_stations
        ? stations.reduce((sum, s) => sum + Number(s.tarif_eur_kwh), 0) / nbre_stations
        : 0;

    document.getElementById('nbre_stations').innerHTML = nbre_stations;
    document.getElementById('pt_charge').innerHTML = nbre_pt_charge;
    document.getElementById('puiss_moy').innerHTML = puiss_moy.toFixed(2);
    document.getElementById('tarif_moy').innerHTML = tarif_moy.toFixed(2);
}


// Helper : détruit et recrée un canvas (pour Chart.js)
function resetCanvas(id) {
    const old = document.getElementById(id);
    const parent = old.parentNode;
    old.remove();
    const newCanvas = document.createElement("canvas");
    newCanvas.id = id;
    parent.appendChild(newCanvas);
    return newCanvas;
}

async function grapheTypeImplantation(stations) {
    const canvas = resetCanvas("GrapheTypeImplantation");

    let implantations = await getData(api_link + "request.php", "?table=implantation");
    const ids = implantations.map(e => e.id);
    let labels = implantations.map(e => e.libelle);

    const data = ids.map(id =>
        stations.filter(s => String(s.id_implantation) === String(id)).length
    );

    const total = data.reduce((a, b) => a + b, 0);
    const labelsWithPct = labels.map((l, i) =>
        `${l} (${total ? ((data[i] / total) * 100).toFixed(1) : 0}%)`
    );

    new Chart(canvas, {
        type: "pie",
        data: { labels: labelsWithPct, datasets: [{ data }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom", align: "center" } }
        }
    });
}

async function grapheConditionAcces(stations) {
    const canvas = resetCanvas("GrapheConditionAcces");

    let conditions = await getData(api_link + "request.php", "?table=condition_acces");
    const ids = conditions.map(e => e.id);
    const labels = conditions.map(e => e.libelle);

    const data = ids.map(id =>
        stations.filter(s => String(s.id_condition_acces) === String(id)).length
    );

    new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: ["green", "orange", "red", "blue"],
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { type: "logarithmic" } },
            plugins: { legend: { display: false } }
        }
    });
}


function graphePuissances(stations) {
    const canvas = resetCanvas("GraphePuissances");

    const values = stations.map(s => Number(s.puissance_max_kw));
    if (!values.length) return;

    const k = 15;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = (max - min) / k;

    const bins = Array.from({ length: k }, (_, i) => ({
        min: min + i * step,
        max: min + (i + 1) * step,
        label: `${(min + i * step).toFixed(0)}-${(min + (i + 1) * step).toFixed(0)}`
    }));

    const dataCount = Object.fromEntries(bins.map(b => [b.label, 0]));
    values.forEach(v => {
        const bin = bins.find(b => v >= b.min && v < b.max) ?? bins[bins.length - 1];
        if (bin) dataCount[bin.label]++;
    });

    new Chart(canvas, {
        type: "bar",
        data: {
            labels: Object.keys(dataCount),
            datasets: [{
                data: Object.values(dataCount),
                backgroundColor: "rgba(54, 162, 235, 0.7)",
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => `${ctx.raw} éléments` }
                }
            },
            scales: {
                x: { beginAtZero: true, ticks: { precision: 0 } },
                y: {
                    type: 'logarithmic',
                    ticks: {
                        autoSkip: false,
                        callback(value) {
                            const log = Math.log10(value);
                            return log === Math.floor(log) ? value.toLocaleString() : null;
                        }
                    }
                }
            }
        }
    });
}


async function grapheAccessibilityPMR(stations) {
    const canvas = resetCanvas("GrapheAccessibilitePMR");

    let accessibilites = await getData(api_link + "request.php", "?table=accessibilite_pmr");
    const ids = accessibilites.map(e => e.id);
    const labels = accessibilites.map(e => e.libelle);

    const data = ids.map(id =>
        stations.filter(s => String(s.id_accessibilite_pmr) === String(id)).length
    );

    const total = data.reduce((a, b) => a + b, 0);
    const labelsWithPct = labels.map((l, i) =>
        `${l} (${total ? ((data[i] / total) * 100).toFixed(1) : 0}%)`
    );

    new Chart(canvas, {
        type: "pie",
        data: {
            labels: labelsWithPct,
            datasets: [{ data }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", align: "center" }
            }
        }
    });
}


async function getData(url, args = "?table=station", details = false) {
    const res = await fetch(url + args);

    if (!res.ok) throw new Error("Network error: " + res.statusText);

    if(details){
        console.log(res)
    }

    const result = JSON.parse(await res.text());

    if (!result?.data) throw new Error("Invalid data format");

    return result.data;
}

init();