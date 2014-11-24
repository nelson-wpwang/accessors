function* fire() {
  var stock = get('StockSymbol');
  var url = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.quotes%20where%20symbol%20in%20(%22"+ stock + "%22)%0A%09%09&env=http%3A%2F%2Fdatatables.org%2Falltables.env&format=json";
  var record = yield* http.readURL(url);
  var json = JSON.parse(record);
  var tick = parseFloat(json.query.results.quote.AskRealtime);
  set('Price', '$' + tick);
}
