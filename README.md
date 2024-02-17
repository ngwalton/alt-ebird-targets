# alt-ebird-targets

A web app to help you discover species that have *not* been reported from your
favorite Wisconsin [eBird](https://ebird.org/home)
[hotspots](https://ebird.org/hotspots)!

There are currently two modes:

1. List bird species that have *not* been reported from a selected eBird hotspot
1. List eBird hotspots in a county where a selected species has *not* been reported

The first option (`Hotspot`) lets you choose a Wisconsin county and then a
hotspot from that county. It will show a list of species that have been reported
in the county, but not at the selected hotspot. External links are provided to
the county level eBird summary for each species.

The second option (`Species`) lets you choose a Wisconsin county and then a
bird species that has been reported in that county. It will show a list and map
of eBird hotspots where the selected species has not been reported. External
links are provided to the eBird summary for each hotspot.

These options are in contrast to eBird's
[target species feature](https://ebird.org/targets) which lists species
confirmed from a hotspot or region but not reported by the user.

**In active development.**

This website incorporates data the following APIs:

* [eBird API 2.0](https://documenter.getpostman.com/view/664302/S1ENwy59)
* [WI DNR Open Data: County Boundaries 24K](https://data-wi-dnr.opendata.arcgis.com/datasets/wi-dnr::county-boundaries-24k/about)
