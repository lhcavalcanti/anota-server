// AIzaSyA3vTN6Plw5dwS1y-U5AozRKb8udkLp-lw

var google = require('@google/maps').createClient({
    key: 'AIzaSyA3vTN6Plw5dwS1y-U5AozRKb8udkLp-lw',
    Promise: Promise
});


var origin2 = 'CIn - UFPE';
var destinationA = 'Travessa desembargador altino, 109';


google.distanceMatrix(
    {
        origins: [origin2],
        destinations: [destinationA],
        mode: 'driving',
        units: 'metric',

        // transitOptions: TransitOptions,
        // drivingOptions: DrivingOptions,
        // unitSystem: UnitSystem,
        // avoidHighways: Boolean,
        // avoidTolls: Boolean,
    }, callback);

function callback(err, response) {
    if (response.json.status == "OK") {
        console.log(response.json);
        var origins = response.json.origin_addresses;
        var destinations = response.json.destination_addresses;
        for (var i = 0; i < origins.length; i++) {
            var results = response.json.rows[i].elements;
            for (var j = 0; j < results.length; j++) {
                var element = results[j];
                var distance = element.distance.text;
                var duration = element.duration.text;
                console.log(distance);
                console.log(duration);
                var from = origins[i];
                var to = destinations[j];
            }
        }
    } else {
        console.log(response.status);
    }
}