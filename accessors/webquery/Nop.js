// author:  Edward A. Lee
// email:   eal@eecs.berkeley.edu
//
// Stock Price Lookup Accessor
// ===========================
//
// This accessor, when fired, reads the most recent bid price for the specified
// stock symbol from a Yahoo server.

var count = 0;

function init() {
  create_port('input', 'StockSymbol', {
    display_name: "Stock Symbol",
    default: "YHOO",
    description: "The stock symbol."
  });
  create_port('output', 'Price', {
    type: "numeric",
    units: "currency.usd",
    description: "The most recent stock price (bid)."
  });
}

function* StockSymbol(symbol) {
  var stock = get('StockSymbol');
  var url = "http://localhost:11111/empty.txt";
  var record = yield* rt.http.readURL(url);
  count += 1;
  set('Price', count);
}

function* Price () {
  
}
