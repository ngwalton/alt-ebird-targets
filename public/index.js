/* eslint-disable no-use-before-define -- chose to use hoisting */
/* eslint-disable no-undef -- L is defined in the leaflet library */
// create an empty map displayed in the div with corresponding id
const map = L.map('map', {
  center: [44.7863, -89.847],
  zoom: 7,
  minZoom: 6,
  zoomControl: false,
});

// add open street map basemap
const basemap = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution:
    '&copy; <a href="http://osm.org/copyright">' +
    'OpenStreetMap</a> contributors',
});

basemap.addTo(map);

// add scale and zoom widgets
L.control.scale().addTo(map);
L.control.zoom({ position: 'topright' }).addTo(map);

// uncomment this to expose coBnds to global env for testing
// const coBnds;
// add county bounds to map and populate the county search list
getCoBnds()
  .then((coBndsJSON) => {
    // add bounds to map
    coBnds = L.geoJSON(coBndsJSON).on('click', zoomToCountyGetHotspotsOnClick);
    coBnds.addTo(map);
    return coBndsJSON;
  })
  .then(populateCountySearch);

// add input event listener to search counties from search box
addSearchEventListener('county', 'startsWith');

// add event listener to search hotspots from search box
addSearchEventListener('hotspot', 'includes');

// add event listener to search species from search box
// uncomment when species list feature is added
addSearchEventListener('species', 'includes');

// on clicking the enter key, the first county in the results is placed in the
// search box and the map zooms to that county
addEnterEventListener('county', (county) => {
  // zoom to selected county
  map.eachLayer((layer) => {
    if (layer.feature?.properties?.COUNTY_NAME === county.textContent) {
      const bb = layer.getBounds();
      zoomToCountyGetHotspots(county.textContent, county.id, bb);
    }
  });

  clearSearchInput('hotspot');
  clearSearchInput('species');
  clearTargetsList();
});

addEnterEventListener(
  'hotspot',
  (hotspot) => {
    // show target species
    getTargets(hotspot.dataset.fips, hotspot.id);

    // click popup for selected hotspot
    map.eachLayer((layer) => {
      if (layer.feature?.properties?.locName === hotspot.textContent) {
        layer.fire('click');
      }
    });
  },
  'includes',
);

addEnterEventListener(
  'species',
  (species) => {
    getHotspotsForSpecies(species.dataset.fips, species.id).then((hotspots) => {
      clearHotspots();
      addHotspotsToMap(hotspots);
    });
  },
  'includes',
);

// event listener to clear/add hotspots on map based on selected target type
const radioInput = document.querySelector('#type-radio-form');
radioInput.addEventListener('change', () => {
  const countySearchInput = document.querySelector('#county-input');
  const countyEntered = countySearchInput.value.length;
  if (countyEntered) {
    countySearchInput.dispatchEvent(enterEvent());
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

/* functions */

/* map related functions */

// function to return WI County Bounds: if not found in localStorage, they are
// downloaded and saved to localStorage before returning the bounds
async function getCoBnds() {
  if (localStorage.coBnds) {
    console.log('Retrieved Co Bounds from local storage');
    return JSON.parse(localStorage.coBnds);
  }

  // metadata/api info:
  // https://data-wi-dnr.opendata.arcgis.com/datasets/wi-dnr::county-boundaries-24k/about
  const url =
    'https://dnrmaps.wi.gov/arcgis/rest/services/DW_Map_Dynamic/' +
    'EN_Basic_Basemap_WTM_Ext_Dynamic_L16/MapServer/3/' +
    'query?outFields=COUNTY_NAME,COUNTY_FIPS_CODE&where=1%3D1&outSR=4326&f=geojson';

  try {
    const res = await fetch(url);
    const coBndsJSON = await res.json();
    localStorage.coBnds = JSON.stringify(coBndsJSON);

    console.log('Downloaded Co Bounds and saved to local storage');
    return coBndsJSON;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// remove all hotspots from map
function clearHotspots() {
  map.eachLayer((layer) => {
    if (layer.feature?.name === 'hotspot_locations') {
      map.removeLayer(layer);
    }
  });
}

function zoomToCountyGetHotspotsOnClick(click) {
  const coName = click.layer.feature.properties.COUNTY_NAME;
  const bb = click.sourceTarget.getBounds();
  const fips = click.layer.feature.properties.COUNTY_FIPS_CODE.padStart(3, '0');
  zoomToCountyGetHotspots(coName, `US-WI-${fips}`, bb);

  clearSearchInput('hotspot');
  clearSearchInput('species');
  clearTargetsList();
}

function zoomToCountyGetHotspots(coName, fips, bb) {
  // add selected county to county search box
  document.querySelector('#county-input').value = coName;

  map.fitBounds(bb);
  clearHotspots();

  // add hotspots if hotspot targets is selected
  if (getTargetType() === 'hotspot') {
    getCountyHotspots(fips)
      .then(populateHotspotSearch)
      .then(addHotspotsToMap)
      .catch((e) => console.error(e));
  }

  if (getTargetType() === 'species') {
    populateSpeciesSearch(fips);
  }
}

// function to display hotspot name, n species reported, and link to
// open hotspot targets on hotspot popup
function onEachFeature(feature, layer) {
  const { locId, locName, subnational2Code, numSpeciesAllTime } =
    feature.properties;

  const popupContent = `<div class='pop-header'>
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

// eslint-disable-next-line no-unused-vars -- function is used in onEachFeature
function getTargetsUpdateInput(fips, id, name) {
  getTargets(fips, id);
  const hotspotInput = document.querySelector(`#hotspot-input`);
  hotspotInput.value = name;
}

// function to load county hotspots from ebird servers
async function getCountyHotspots(fips) {
  try {
    const query = `./get-county-hotspots?fips=${fips}`;
    const res = await fetch(query);
    const hotspots = await res.json();

    // return the hotspots geojson to pass to other functions
    return hotspots;
  } catch (e) {
    console.error(e);
    return null;
  } finally {
    console.log(`Getting hotspots for: ${fips}`);
  }
}

// function to take a hotspots geojson and add it to the map
function addHotspotsToMap(hotspots) {
  const hotspotGeo = L.geoJSON(hotspots, { onEachFeature });

  hotspotGeo.addTo(map);
}

/* eslint-enable no-undef -- done using L */

/* search related functions */

// function to add an input search event listener for each of the search boxes
// name is the name of the input and matchMethod should be one of "includes" or
// "startsWith"
function addSearchEventListener(name, matchMethod) {
  const searchInput = document.querySelector(`#${name}-input`);
  searchInput.addEventListener('input', (e) => {
    // avoid matching on the empty string
    const value = e.target.value.toLowerCase() || null;
    const listItems = document.querySelectorAll(`#${name}-search-list li`);
    listItems.forEach((item) => {
      let chosen = item.textContent.toLowerCase();
      chosen =
        matchMethod === 'includes'
          ? chosen.includes(value)
          : chosen.startsWith(value);

      item.classList.toggle('visible', chosen);
    });
  });
}

// function to return the currently selected target type
function getTargetType() {
  return document.querySelector('input[name="type-radio"]:checked').value;
}

// function to populate county search box from geojson
function populateCountySearch(coBndsJSON) {
  const coProps = coBndsJSON.features.map((f) => f.properties);
  const coSearch = document.querySelector('#county-search-list');
  coProps.forEach((coProp) => {
    const li = document.createElement('li');
    li.classList.add('search-item');
    li.id = `US-WI-${coProp.COUNTY_FIPS_CODE.padStart(3, '0')}`;
    li.textContent = coProp.COUNTY_NAME;
    coSearch.append(li);
  });
}

// function to populate hotspot search; hotspots is a hotspots geojson
function populateHotspotSearch(hotspots) {
  const props = hotspots.features.map((f) => f.properties);
  const search = document.querySelector('#hotspot-search-list');

  // remove any current hotspots
  search.replaceChildren();

  props.forEach((prop) => {
    const li = document.createElement('li');
    li.classList.add('search-item');
    li.id = prop.locId;
    li.setAttribute('data-fips', prop.subnational2Code);
    li.textContent = prop.locName;
    search.append(li);
  });

  return hotspots;
}

// to do: this is a place holder. need to finish placing the species in the
// search ul
// function to populate the species search
async function populateSpeciesSearch(fips) {
  try {
    const query = `county-species-list?fips=${fips}`;
    const res = await fetch(query);
    const species = await res.json();

    const search = document.querySelector('#species-search-list');

    // remove any current species
    search.replaceChildren();

    species.forEach((sp) => {
      const li = document.createElement('li');
      li.classList.add('search-item');
      li.id = sp.speciesCode;
      li.setAttribute('data-fips', fips);
      li.textContent = sp.comName;
      search.append(li);
    });
  } catch (e) {
    console.error(e);
  } finally {
    console.log(`Getting data for: ${fips}`);
  }
}

// function to use in an event listener to select the top result on clicking
// enter. returns the selected li after updating the input value and removing
// search results
function selectTopItemOnEnter(event, name, matchMethod) {
  // avoid matching on the empty string
  const value = event.target.value.toLowerCase() || null;
  const listItems = document.querySelectorAll(`#${name}-search-list li`);
  const selected = Array.from(listItems).filter((item) => {
    const chosen = item.textContent.toLowerCase();
    return matchMethod === 'includes'
      ? chosen.includes(value)
      : chosen.startsWith(value);
  })[0];

  const searchInput = document.querySelector(`#${name}-input`);
  searchInput.value = selected.textContent;
  listItems.forEach((item) => item.classList.toggle('visible', false));

  return selected;
}

// on clicking the enter key, the first li in the results is placed in the
// search box and a search type specific function is run with the first li as
// the input
function addEnterEventListener(name, fn, matchMethod = 'startsWith') {
  const searchInput = document.querySelector(`#${name}-input`);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    try {
      // select the top menu result and get the corresponding li
      const selected = selectTopItemOnEnter(event, name, matchMethod);

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
  document.querySelector('#targets').replaceChildren();
}

function enterEvent() {
  return new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    which: 13,
    keyCode: 13,
  });
}

/* target results related functions */

// function to parse ebird species object and format as html
function parseSpecies(fips, targetsObj) {
  return targetsObj.reduce((markup, sp) => {
    const link = `https://ebird.org/wi/species/${sp.speciesCode}/${fips}`;

    // eslint-disable-next-line no-param-reassign
    markup += `<p><a href="${link}" target="_blank">
      <span class="comName">${sp.comName}</span></a></br>
      (<span class="sciName">${sp.sciName}</span>)</p>`;

    return markup;
  }, '');
}

// function to parse ebird hotspot object and format as html
function parseHotspots(targetsObj) {
  return targetsObj.reduce((markup, hotspot) => {
    const link = `https://ebird.org/wi/hotspot/${hotspot.properties.locId}`;

    // eslint-disable-next-line no-param-reassign
    markup += `<p><a href="${link}" target="_blank">
      <span class="hotspot">${hotspot.properties.locName}</span></a></p>`;

    return markup;
  }, '');
}

// function to fetch target species for selected hotspot
async function getTargets(fips, locID) {
  try {
    const query = `hotspot-targets?fips=${fips}&hotspot=${locID}`;
    const res = await fetch(query);
    const targets = await res.json();
    const dest = document.querySelector('#targets');
    dest.innerHTML = parseSpecies(fips, targets);
  } catch (e) {
    console.error(e);
  } finally {
    console.log(`Getting data for: ${locID}`);
  }
}

// function to fetch target hotspots for selected species
async function getHotspotsForSpecies(fips, alpha) {
  try {
    const query = `species-target?fips=${fips}&alpha=${alpha}`;
    const res = await fetch(query);
    const targets = await res.json();
    const dest = document.querySelector('#targets');
    dest.innerHTML = parseHotspots(targets);
    return targets;
  } catch (e) {
    console.error(e);
    return null;
  } finally {
    console.log(`Getting data for: ${alpha}`);
  }
}
