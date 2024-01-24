// creates an empty map that is displayed in the div with the
// corresponding id
let map = L.map('map', {
    center: [43.0167, -88.783],
    zoom: 11,
    minZoom: 10,
    zoomControl: false
});

// open street map base map
let basemap = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution:
        '&copy; <a href="http://osm.org/copyright">' +
            'OpenStreetMap</a> contributors'
});

basemap.addTo(map);

let co_bnds = new L.GeoJSON.AJAX("County_Boundaries_24K.geojson");
co_bnds.addTo(map);

// function to parse ebird species object and format as html
function parse_species(targets_obj) {
    let res = '';
    let region = 'US-WI-055';  // this will need to be automated
    for (const sp of targets_obj) {
        let link =
            `https://ebird.org/wi/species/${sp.speciesCode}/${region}`;
        res += `<p><a href="${link}" target="_blank">
            <span class="comName">${sp.comName}</span></a></br>
            (<span class="sciName">${sp.sciName}</span>)</p>`;
    };

    return res;
}

// function to fetch target species for selected hotspot
async function get_targets(loc_id) {
    try {
        const res = await fetch(loc_id);
        const targets = await res.json();
        const dest = document.querySelector("#targets");
        dest.innerHTML = parse_species(targets);
    } catch (e) {
        console.log(e);
    } finally {
        console.log("Getting data for: " + loc_id);
    }
}

// function to display hotspot name, n species reported, and link to
// open hotspot targets
function onEachFeature(feature, layer) {
    let popupContent =
        `<div class="pop-header">
            <a href="https://ebird.org/hotspot/${feature.properties.locId}"
                target="_blank">
                ${feature.properties.locName}
            </a>
        </div>
        <div class="n-species-obs">
            <p>Species confirmed:
                ${feature.properties.numSpeciesAllTime}</p>
        </div>
        <div>
            <button type="button" class="btn btn-primary" 
                onclick='get_targets("${feature.properties.locId}");
                open_targets();'>
                Target species
            </button>
        </div>`;

    layer.bindPopup(popupContent);
}

// load hotspots from ebird servers
async function get_county_hotspots(region) {
    try {
        const res = await fetch(region);
        const hotspots = await res.json();

        let hotspot_geo = L.geoJSON(hotspots,
            {onEachFeature: onEachFeature});

        hotspot_geo.addTo(map);
    } catch (e) {
        console.log(e);
    } finally {
        console.log("Getting hotspots for: " + region);
    }
}

get_county_hotspots('US-WI-055');

// load from my server
// let hotspot_geo = new L.GeoJSON.AJAX("hotspot_list.geojson",
//     {onEachFeature: onEachFeature});
// hotspot_geo.addTo(map);

L.control.scale().addTo(map);

L.control.zoom({position: 'topright'}).addTo(map);


// open and close targets side panel
function open_targets() {
    document.querySelector("#target-wrapper").style.position = "static";
}
function close_targets() {
    document.querySelector("#target-wrapper").style.position = "fixed";
}


// toggle hamburger menu open and closed
const toggleButton = document.querySelector('.toggle-button');
const navbarLinks = document.querySelector('.navbar-links');

toggleButton.addEventListener('click', () => {
    navbarLinks.classList.toggle('active');
});
