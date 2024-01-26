# alt-ebird-targets

A web app to list bird species that have *not* been reported at a given
[eBird](https://ebird.org/home) [hotspot](https://ebird.org/hotspots).
After selecting a hotspot, the app displays a list of species reported from the
corresponding county minus those already reported from the hotspot.
This is in contrast to eBird's
[target species feature](https://ebird.org/targets) which lists species
confirmed from a hotspot or region but not reported by the user.
This web app can be helpful for targeting species to increase the species list
at your favorite eBird hotspots.

**In early development.**

Currently setup to work only with hotspots in Jefferson Co, WI, but will be
generalized to WI.

This website incorporates data the following APIs:

* [eBird API 2.0](https://documenter.getpostman.com/view/664302/S1ENwy59)
* [WI DNR Open Data: County Boundaries 24K](https://data-wi-dnr.opendata.arcgis.com/datasets/wi-dnr::county-boundaries-24k/about)
