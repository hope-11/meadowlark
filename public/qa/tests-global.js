suite('Global Tests', function(){
	test('page has a valid title', function(){
		assert(document.title && document.title.match(/\S/)
			&& document.title.toUpperCase()!=='TODO');
	});
});

suite('"About" Page Tests', function(){
	test('page should contain link to contact page', function(){
		assert($('a[href="/contact"]').length);
	});
});
