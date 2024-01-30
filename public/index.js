// create an empty map displayed in the div with corresponding id
let map = L.map('map', {
    center: [43.0167, -88.783],
    zoom: 11,
    minZoom: 10,
    zoomControl: false
});

// open street map basemap
let basemap = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution:
        '&copy; <a href="http://osm.org/copyright">' +
            'OpenStreetMap</a> contributors'
});

basemap.addTo(map);

// function to return WI County Bounds: if not found in localStorage, they are
// downloaded and saved to localStorage before returning the bounds
async function get_co_bnds() {
    if (localStorage.co_bnds) {
        console.log("Retrieved Co Bounds from local storage");
        return JSON.parse(localStorage.co_bnds);
    }

    // metadata/api info:
    // https://data-wi-dnr.opendata.arcgis.com/datasets/wi-dnr::county-boundaries-24k/about
    const url =
        "https://dnrmaps.wi.gov/arcgis/rest/services/DW_Map_Dynamic/" +
        "EN_Basic_Basemap_WTM_Ext_Dynamic_L16/MapServer/3/" +
        "query?outFields=COUNTY_NAME,COUNTY_FIPS_CODE&where=1%3D1&outSR=4326&f=geojson";

    try {
        const res = await fetch(url);
        const co_bnds_json = await res.json();
        localStorage.co_bnds = JSON.stringify(co_bnds_json);

        console.log("Downloaded Co Bounds and saved to local storage");
        return co_bnds_json;
    } catch (e) {
        console.log(e);
    }
}

// used this method to expose co_bnds to global env for future manipulation
// but there may be a better way to accomplish this
let co_bnds;
get_co_bnds()
    .then(co_bnds_json => {
        co_bnds = L.geoJSON(co_bnds_json);
        co_bnds.addTo(map);
    });

// function to parse ebird species object and format as html
function parse_species(targets_obj) {
    let res = '';
    let fips = 'US-WI-055';  // this will need to be automated

    for (const sp of targets_obj) {
        let link =
            `https://ebird.org/wi/species/${sp.speciesCode}/${fips}`;
        res += `<p><a href="${link}" target="_blank">
            <span class="comName">${sp.comName}</span></a></br>
            (<span class="sciName">${sp.sciName}</span>)</p>`;
    };

    return res;
}

// function to fetch target species for selected hotspot
async function get_targets(fips, loc_id) {
    try {
        const query = `hotspot-targets?fips=${fips}&hotspot=${loc_id}`
        const res = await fetch(query);
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
// open hotspot targets on hotspot popup
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
                onclick='get_targets("${feature.properties.subnational2Code}",
                    "${feature.properties.locId}");
                open_targets();'>
                Target species
            </button>
        </div>`;

    layer.bindPopup(popupContent);
}

// function to load county hotspots from ebird servers
async function get_county_hotspots(fips) {
    try {
        const query = `./get-county-hotspots?fips=${fips}`
        const res = await fetch(query);
        const hotspots = await res.json();

        let hotspot_geo = L.geoJSON(hotspots,
            {onEachFeature: onEachFeature});

        hotspot_geo.addTo(map);
    } catch (e) {
        console.log(e);
    } finally {
        console.log("Getting hotspots for: " + fips);
    }
}

get_county_hotspots('US-WI-055');

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