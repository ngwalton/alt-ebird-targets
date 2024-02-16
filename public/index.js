// create an empty map displayed in the div with corresponding id
const map = L.map('map', {
    center: [44.7863, -89.8470],
    zoom: 7,
    minZoom: 6,
    zoomControl: false
});

// add open street map basemap
const basemap = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution:
        '&copy; <a href="http://osm.org/copyright">' +
            'OpenStreetMap</a> contributors'
});

basemap.addTo(map);

// add scale and zoom widgets
L.control.scale().addTo(map);
L.control.zoom({position: 'topright'}).addTo(map);

// uncomment this to expose co_bnds to global env for testing
// const co_bnds;
// add county bounds to map and populate the county search list
get_co_bnds()
    .then(co_bnds_json => {
        // add bounds to map
        co_bnds = L.geoJSON(co_bnds_json)
            .on('click', zoomToCountyGetHotspotsOnClick);
        co_bnds.addTo(map);
        return co_bnds_json;
    })
    .then(populateCountySearch);

// add input event listener to search counties from search box
addSearchEventListener('county', 'startsWith');

// add event listener to search hotspots from search box
addSearchEventListener('hotspot', 'includes');

// add event listener to search species from search box
// uncomment when species list feature is added
// addSearchEventListener('species', 'includes');

// on clicking the enter key, the first county in the results is placed in the
// search box and the map zooms to that county
addEnterEventListener('county', county => {
    // zoom to selected county
    map.eachLayer(layer => {
        if (layer.feature?.properties?.COUNTY_NAME === county.textContent) {
            const bb = layer._bounds;
            zoomToCountyGetHotspots(county.textContent, county.id, bb);
        }
    });

    clearSearchInput('hotspot');
    clearSearchInput('species');
    clearTargetsList();
});

addEnterEventListener('hotspot', hotspot => {
    // show target species
    get_targets(hotspot.dataset.fips, hotspot.id);

    // click popup for selected hotspot
    map.eachLayer(layer => {
        if (layer.feature?.properties?.locName === hotspot.textContent) {
            layer.fire('click');
        }
    });
}, 'includes');


// event listener to clear/add hotspots on map based on selected target type
const radioInput = document.querySelector('#type-radio-form');
radioInput.addEventListener('change', e => {
    const countySearchInput = document.querySelector('#county-input');
    const countyEntered = countySearchInput.value.length;
    if (getTargetType() === 'hotspot' && countyEntered) {
        const event = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            which: 13,
            keyCode: 13
        });

        countySearchInput.dispatchEvent(event);
        return;
    }

    clearHotspots();
});

// toggle hamburger menu open and closed
const toggleButton = document.querySelector('.toggle-button');
const navbarLinks = document.querySelector('.navbar-links');

toggleButton.addEventListener('click', () => {
    navbarLinks.classList.toggle('active');
});


//////// functions ////////


//// map related functions ////

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

// remove all hotspots from map
function clearHotspots() {
    map.eachLayer(layer => {
        if (layer.feature?.name === "hotspot_locations") {
            map.removeLayer(layer);
        }
    });
}

function zoomToCountyGetHotspotsOnClick(click) {
    const co_name = click.layer.feature.properties.COUNTY_NAME;
    const bb = click.sourceTarget._bounds;
    const fips = click.layer.feature.properties.COUNTY_FIPS_CODE
        .padStart(3, '0');
    zoomToCountyGetHotspots(co_name, `US-WI-${fips}`, bb);
}

function zoomToCountyGetHotspots(co_name, fips, bb) {
    // add selected county to county search box
    document.querySelector('#county-input').value = co_name;

    map.fitBounds(bb);
    clearHotspots();

    // add hotspots if hotspot targets is selected
    if (getTargetType() === 'hotspot') {
        get_county_hotspots(fips)
            .then(hotspots => populateHotspotSearch(hotspots))
            .catch(e => console.error(e));
    }
}

// function to display hotspot name, n species reported, and link to
// open hotspot targets on hotspot popup
function onEachFeature(feature, layer) {
    const {locId, locName, subnational2Code, numSpeciesAllTime} =
        feature.properties;

    const popupContent =
        `<div class='pop-header'>
            <a href='https://ebird.org/hotspot/${locId}'
                target='_blank'>
                ${locName}
            </a>
        </div>
        <div class='n-species-obs'>
            <p>Species confirmed:
                ${numSpeciesAllTime}</p>
        </div>
        <div>
            <button type='button' class='btn btn-primary'
                onclick="getTargetsUpdateInput(
                        '${subnational2Code}',
                        '${locId}',
                        '${locName.replace(/'/g, "\\'")}'
                    );">
                Target species
            </button>
        </div>`;

    layer.bindPopup(popupContent);
}

function getTargetsUpdateInput(fips, id, name) {
    get_targets(fips, id);
    const hotspotInput = document.querySelector(`#hotspot-input`);
    hotspotInput.value = name;
}

// function to load county hotspots from ebird servers
async function get_county_hotspots(fips) {
    try {
        const query = `./get-county-hotspots?fips=${fips}`
        const res = await fetch(query);
        const hotspots = await res.json();

        const hotspot_geo = L.geoJSON(hotspots,
            {onEachFeature: onEachFeature});

        hotspot_geo.addTo(map);

        // return the hotspots geojson to pass to populateHotspotSearch
        return hotspots;
    } catch (e) {
        console.error(e);
    } finally {
        console.log("Getting hotspots for: " + fips);
    }
}


//// search related functions ////

// function to add an input search event listener for each of the search boxes
// name is the name of the input and matchMethod should be one of "includes" or
// "startsWith"
function addSearchEventListener(name, matchMethod) {
    const searchInput = document.querySelector(`#${name}-input`);
    searchInput.addEventListener('input', (e) => {
        // avoid matching on the empty string
        const value = e.target.value.toLowerCase() || null;
        const listItems = document.querySelectorAll(`#${name}-search-list li`);
        listItems.forEach(item => {
            let chosen =  item.textContent.toLowerCase();
            chosen = matchMethod === 'includes' ?
                chosen.includes(value) : chosen.startsWith(value);

            item.classList.toggle('visible', chosen);
        });
    });
}

// function to return the currently selected target type
function getTargetType() {
    return document.querySelector('input[name="type-radio"]:checked').value;
}

// function to populate county search box from geojson
function populateCountySearch(co_bnds_json) {
    const co_props = co_bnds_json.features.map(f => f.properties);
    const co_search = document.querySelector('#county-search-list');
    co_props.forEach(co_prop => {
        const li = document.createElement('li');
        li.classList.add('search-item');
        li.id = `US-WI-${co_prop.COUNTY_FIPS_CODE.padStart(3, '0')}`;
        li.textContent = co_prop.COUNTY_NAME;
        co_search.append(li);
    });
}

// function to populate hotspot search; hotspots is a hotspots geojson
function populateHotspotSearch(hotspots) {
    const props = hotspots.features.map(f => f.properties);
    const search = document.querySelector('#hotspot-search-list');

    // remove any current hotspots
    search.replaceChildren();

    props.forEach(prop => {
        const li = document.createElement('li');
        li.classList.add('search-item');
        li.id = prop.locId;
        li.setAttribute('data-fips', prop.subnational2Code);
        li.textContent = prop.locName;
        search.append(li);
    });
}

// to do: this is a place holder. need to finish placing the species in the
// search ul
// function to populate the species search
async function populateSpeciesSearch(fips) {
    try {
        const query = `county-species-list?fips=${fips}`;
        const res = await fetch(query);
        const targets = await res.json();
        console.log(targets);
        // const dest = document.querySelector("#targets");
        // dest.innerHTML = parse_species(fips, targets);
    } catch (e) {
        console.error(e);
    } finally {
        console.log("Getting data for: " + fips);
    }
}

// function to use in an event listener to select the top result on clicking
// enter. returns the selected li after updating the input value and removing
// search results
function selectTopItemOnEnter(event, name, matchMethod) {
    // avoid matching on the empty string
    const value = event.target.value.toLowerCase() || null;
    const listItems = document.querySelectorAll(`#${name}-search-list li`);
    const selected = Array.from(listItems)
        .filter(item => {
            const chosen =  item.textContent.toLowerCase();
            return matchMethod === 'includes' ?
                chosen.includes(value) : chosen.startsWith(value);
        })[0];

    const searchInput = document.querySelector(`#${name}-input`);
    searchInput.value = selected.textContent;
    listItems.forEach(item => item.classList.toggle('visible', false));

    return selected;
}

// on clicking the enter key, the first li in the results is placed in the
// search box and a search type specific function is run with the first li as
// the input
function addEnterEventListener(name, fn, matchMethod = 'startsWith') {
    const searchInput = document.querySelector(`#${name}-input`);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;

        try {
            // select the top menu result and get the corresponding li
            const selected = selectTopItemOnEnter(e, name, matchMethod);

            fn(selected);
        } catch (e) {
            // to do: this should be a popup or something more elegant
            console.error(e);
            alert(`Enter valid ${name}`);
        }
    });
}

// function to clear search input fields
function clearSearchInput(name) {
    document.querySelector(`#${name}-input`).value = '';
}

function clearTargetsList() {
    document.querySelector("#targets").replaceChildren();
}


//// target results related functions ////

// function to parse ebird species object and format as html
function parse_species(fips, targets_obj) {
    let res = '';

    for (const sp of targets_obj) {
        const link =
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
