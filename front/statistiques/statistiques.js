


GetStationsCount();

const nbre_pt_charge_element = document.getElementById('pt_charge');

const puiss_moy_element = document.getElementById('puiss_moy');

const tarif_moy_element = document.getElementById('tarif_moy');


async function GetStationsCount() {

    let nbre_station_element = document.getElementById('nbre_stations');

    let stations = await getData(api_link + "request.php/", "?table=station");


}



async function getData(api_link, args = "?table=station") {
    let result = await fetch(api_link + args, true);
    if (!result.ok) {
        throw new Error("Network response was not ok " + result.statusText);
    }


    console.log(result);

    result = JSON.parse(await result.text());
    //console.log(result);
    if (!result || !result.data) {
        throw new Error("Invalid data format received");
    }

    data = result['data'];

    console.log(data);

    return data;
}