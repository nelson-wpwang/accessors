acc = require('./accessors.js')('http://localhost:6565');

//console.log(acc);
load = process.hrtime();

nop = acc.create_accessor('/webquery/Nop',
		[],
		function(dev) {
			//console.log("----------------------");
			//console.log(dev);
			console.log("ld: " + process.hrtime(load)[1]);

			t1 = process.hrtime();
			dev.StockSymbol(1, function() {
				console.log("q1: " + process.hrtime(t1)[1]);
				t2 = process.hrtime();
				dev.StockSymbol(2, function() {
					console.log("q2: " + process.hrtime(t2)[1]);
					t3 = process.hrtime();
					dev.StockSymbol(3, function() {
						console.log("q3: " + process.hrtime(t3)[1]);
						t4 = process.hrtime();
						dev.StockSymbol(4, function() {
							console.log("q4: " + process.hrtime(t4)[1]);
						});
					});
				});
			});
		},
		function() {
			console.log("err");
		});
