// author:  Edward A. Lee
// email:   eal@eecs.berkeley.edu
//
// Stock Price Lookup Accessor
// ===========================
//
// This accessor, when fired, reads the most recent bid price for the specified
// stock symbol from a Yahoo server.

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

function* fire() {
  rt.log.debug("StockTick fire start");
  var stock = get('StockSymbol');
  var url = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.quotes%20where%20symbol%20in%20(%22"+ stock + "%22)%0A%09%09&env=http%3A%2F%2Fdatatables.org%2Falltables.env&format=json";
  var record = yield* rt.http.readURL(url);
  var json = JSON.parse(record);
  if (json.query.results == null) {
    rt.log.error("Stock query failed");
    set('Price', '<ERR>');
  } else {
    var tick = parseFloat(json.query.results.quote.LastTradePriceOnly);
    set('Price', tick);
  }
  rt.log.debug("StockTick fire end");
}
