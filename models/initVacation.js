var Vacation=require('./models/vacation.js');

Vacation.find(function(err, vacations){
	if(vacations.length) return;
	
	new Vacation({
		name: 'Hood River Day Trip',
		slug: 'hood-river-day-trip',
		category: 'Day Trip',
		sku: 'HR199',
		descriptoin: 'Spend a day sailing on the Columbia and enjoying craft beers in Hood River!',
		priceInCents: 9995,
		tags: ['day trip', 'hood river', 'sailing', 'windsurfing', 'breweries'],
		inSeason: true,
		available: true,
		maximumGuests: 16,
		packageSold: 0
	}).save();
	
	new Vacation({
		name: 'Oregon Coast Getaway',
		slug: 'oregon-coast-getaway',
		category: 'Weekend Getaway',
		sku: 'OC39',
		descriptoin: 'Enjoy the ocean air and quaint coastal towns!',
		priceInCents: 269995,
		tags: ['weekend getaway', 'oregon coast', 'beachcombing'],
		inSeason: false,
		available: true,
		maximumGuests: 8,
		packageSold: 0
	}).save();
	
	new Vacation({
		name: 'Rock Climbing in Bend',
		slug: 'rock-climbing-in-bend',
		category: 'Adventure',
		sku: 'B99',
		descriptoin: 'Experience the thrill of climbing in the high desert.',
		priceInCents: 289995,
		tags: ['weekend getaway', 'bend', 'high desert', 'rock climbing'],
		inSeason: true,
		available: false,
		requiresWaiver: true,
		maximumGuests: 4,
		notes: 'The tour guide is currently recovering from a skiing accident.',
		packageSold: 0
	}).save();
	
});
