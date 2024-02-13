// create an empty map displayed in the div with corresponding id
let map = L.map('map', {
    center: [44.7863, -89.8470],
    zoom: 7,
    minZoom: 6,
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
        console.error(e);
    }
}

// used this method to expose co_bnds to global env for future manipulation
// but there may be a better way to accomplish this
let co_bnds;
get_co_bnds()
    .then(co_bnds_json => {
        co_bnds = L.geoJSON(co_bnds_json)
            .on('click', zoomToCountyGetHotspots);
        co_bnds.addTo(map);

        // populate the county search box
        const co_props = co_bnds_json.features.map(f => f.properties);
        const co_search = document.querySelector('#county-search-list');
        co_props.forEach(co_prop => {
            const li = document.createElement('li');
            li.classList.add('search-item');
            li.id = `US-WI-${co_prop.COUNTY_FIPS_CODE.padStart(3, '0')}`;
            li.textContent = co_prop.COUNTY_NAME;
            co_search.append(li);
        });
    });

// add event listener to search counties from search box
const countySearchInput = document.querySelector('#county-input');
countySearchInput.addEventListener('input', (e) => {
    // avoid matching on the empty string
    const value = e.target.value.toLocaleLowerCase() || null;
    const counties = document.querySelectorAll('#county-search-list li');
    counties.forEach(co => {
        const chosen =  co.textContent.toLocaleLowerCase().startsWith(value);
        co.classList.toggle('visible', chosen);
    });
});

// on clicking the enter key, the first county in the results is placed in the
// search box
countySearchInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    try {
        // avoid matching on the empty string
        const value = e.target.value.toLocaleLowerCase() || null;
        const counties = document.querySelectorAll('#county-search-list li');
        const county = Array.from(counties)
            .filter(co => {
                return co.textContent.toLocaleLowerCase().startsWith(value)
            })[0].textContent;

        countySearchInput.value = county;
        counties.forEach(co => co.classList.toggle('visible', false));

        // zoom to selected county
        map.eachLayer(layer => {
            if (layer.feature?.properties?.COUNTY_NAME === county) {
                const bb = layer._bounds;
                map.fitBounds(bb);
            }
        });
    } catch (e) {
        // to do: this should be a popup or something more elegant
        alert('Enter valid county');
    }
});

function zoomToCountyGetHotspots(click) {
    // add selected county to county search box
    const co_name = click.layer.feature.properties.COUNTY_NAME;
    document.querySelector('#county-input').value = co_name;

    const bb = click.sourceTarget._bounds;
    map.fitBounds(bb);
    const fips = click.layer.feature.properties.COUNTY_FIPS_CODE
        .padStart(3, '0');
    map.eachLayer(layer => {
        if (layer.feature?.name === "hotspot_locations") {
            map.removeLayer(layer);
        }
    });
    get_county_hotspots(`US-WI-${fips}`);
}

// function to parse ebird species object and format as html
function parse_species(fips, targets_obj) {
    let res = '';

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
        dest.innerHTML = parse_species(fips, targets);
    } catch (e) {
        console.error(e);
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
                    "${feature.properties.locId}");'>
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
        console.error(e);
    } finally {
        console.log("Getting hotspots for: " + fips);
    }
}

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
